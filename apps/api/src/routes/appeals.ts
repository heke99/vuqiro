import { Hono } from "hono";
import { z } from "zod";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { enforceRateLimit } from "../lib/rateLimit";
import { getServiceDb, isBackendConfigured } from "../lib/supabase";
import type { AppEnv } from "../middleware/auth";
import { attachUser, requireUser } from "../middleware/auth";

export const appealRoutes = new Hono<AppEnv>();

appealRoutes.use("*", attachUser);

const appealBody = z.object({
  caseId: z.string().min(1).max(64).optional(),
  videoId: z.string().min(1).max(64).optional(),
  message: z.string().trim().min(10).max(2000)
});

/**
 * Appeals a moderation decision. Only the owner of the affected content can
 * appeal; the case returns to the admin queue as "appealed".
 */
appealRoutes.post("/appeals", requireUser, async (c) => {
  const profile = c.get("profile")!;
  enforceRateLimit(`appeal:${profile.id}`, 5, 24 * 3_600_000);
  const body = appealBody.parse(await c.req.json());
  if (!body.caseId && !body.videoId) throw badRequest("Provide caseId or videoId");

  if (!isBackendConfigured()) {
    return c.json({ appeal: { id: `mock_appeal_${Date.now()}`, status: "appealed" }, source: "mock" }, 201);
  }

  const db = getServiceDb()!;

  let caseId = body.caseId ?? null;
  if (!caseId && body.videoId) {
    const { data: found } = await db
      .from("moderation_cases")
      .select("id")
      .eq("target_type", "video")
      .eq("target_id", body.videoId)
      .eq("status", "resolved")
      .order("resolved_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    caseId = found?.id ?? null;
  }
  if (!caseId) throw notFound("No resolved moderation case found to appeal");

  const { data: caseRow } = await db
    .from("moderation_cases")
    .select("id, target_type, target_id, status")
    .eq("id", caseId)
    .maybeSingle();
  if (!caseRow) throw notFound("Case not found");

  // Ownership check: the appellant must own the moderated content.
  let ownerProfileId: string | null = null;
  if (caseRow.target_type === "video") {
    const { data } = await db
      .from("videos")
      .select("creators (profile_id)")
      .eq("id", caseRow.target_id)
      .maybeSingle();
    ownerProfileId = (data?.creators as { profile_id?: string } | null)?.profile_id ?? null;
  } else if (caseRow.target_type === "comment") {
    const { data } = await db.from("comments").select("author_id").eq("id", caseRow.target_id).maybeSingle();
    ownerProfileId = data?.author_id ?? null;
  } else if (caseRow.target_type === "profile") {
    ownerProfileId = caseRow.target_id;
  } else if (caseRow.target_type === "creator") {
    const { data } = await db.from("creators").select("profile_id").eq("id", caseRow.target_id).maybeSingle();
    ownerProfileId = data?.profile_id ?? null;
  }
  if (ownerProfileId !== profile.id) throw forbidden("You can only appeal decisions on your own content");

  const { error } = await db.from("moderation_cases").update({ status: "appealed" }).eq("id", caseId);
  if (error) throw badRequest(error.message);

  // The appeal message is attached as a report-style record for reviewers.
  await db.from("reports").insert({
    reporter_id: profile.id,
    target_type: caseRow.target_type,
    target_id: caseRow.target_id,
    reason: "other",
    details: `APPEAL: ${body.message}`,
    status: "attached_to_case",
    moderation_case_id: caseId
  });

  return c.json({ appeal: { caseId, status: "appealed" }, source: "db" }, 201);
});
