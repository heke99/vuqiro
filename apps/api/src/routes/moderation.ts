import { Hono } from "hono";
import { z } from "zod";
import { badRequest } from "../lib/errors";
import { checkRepeatedReports } from "../lib/fraudSignals";
import { enforceRateLimit } from "../lib/rateLimit";
import { getServiceDb, isBackendConfigured } from "../lib/supabase";
import type { AppEnv } from "../middleware/auth";
import { attachUser, requireUser } from "../middleware/auth";

export const moderationRoutes = new Hono<AppEnv>();

moderationRoutes.use("*", attachUser);

const reportBody = z.object({
  targetType: z.enum(["video", "comment", "profile", "creator"]),
  targetId: z.string().min(1).max(64),
  reason: z.enum([
    "harassment",
    "hate",
    "violence",
    "sexual_content",
    "minor_safety",
    "spam",
    "scam",
    "copyright",
    "misinformation",
    "other"
  ]),
  details: z.string().trim().max(2000).optional()
});

/**
 * Creates a report. Reports for the same target attach to an existing open
 * case (bumping its report count and priority) or open a new one.
 * Minor-safety reports are always escalated to critical.
 */
moderationRoutes.post("/reports", requireUser, async (c) => {
  const profile = c.get("profile")!;
  enforceRateLimit(`report:${profile.id}`, 20, 3_600_000);
  const body = reportBody.parse(await c.req.json());

  if (!isBackendConfigured()) {
    return c.json({ report: { id: `mock_report_${Date.now()}`, ...body }, source: "mock" }, 201);
  }

  const db = getServiceDb()!;
  const { data: existingCase } = await db
    .from("moderation_cases")
    .select("id, report_count, priority")
    .eq("target_type", body.targetType)
    .eq("target_id", body.targetId)
    .in("status", ["open", "reviewing"])
    .maybeSingle();

  let caseId: string;
  if (existingCase) {
    caseId = existingCase.id;
    const nextCount = existingCase.report_count + 1;
    const escalate =
      body.reason === "minor_safety"
        ? "critical"
        : nextCount >= 5 && existingCase.priority === "medium"
          ? "high"
          : existingCase.priority;
    await db
      .from("moderation_cases")
      .update({ report_count: nextCount, priority: escalate })
      .eq("id", caseId);
  } else {
    const { data: created, error } = await db
      .from("moderation_cases")
      .insert({
        target_type: body.targetType,
        target_id: body.targetId,
        reason: body.reason,
        priority: body.reason === "minor_safety" ? "critical" : "medium"
      })
      .select("id")
      .single();
    if (error) throw badRequest(error.message);
    caseId = created.id;
  }

  const { data: report, error: reportError } = await db
    .from("reports")
    .insert({
      reporter_id: profile.id,
      target_type: body.targetType,
      target_id: body.targetId,
      reason: body.reason,
      details: body.details,
      status: "attached_to_case",
      moderation_case_id: caseId
    })
    .select("id, target_type, target_id, reason, status, moderation_case_id, created_at")
    .single();
  if (reportError) throw badRequest(reportError.message);

  // Abuse signal: many distinct reporters on one target.
  await checkRepeatedReports(body.targetType, body.targetId);

  return c.json({ report, source: "db" }, 201);
});

const blockBody = z.object({
  blockedProfileId: z.string().min(1).max(64)
});

moderationRoutes.post("/blocks", requireUser, async (c) => {
  const profile = c.get("profile")!;
  enforceRateLimit(`block:${profile.id}`, 60, 3_600_000);
  const body = blockBody.parse(await c.req.json());

  if (body.blockedProfileId === profile.id) throw badRequest("Cannot block yourself");

  if (!isBackendConfigured()) {
    return c.json({ blocked: true, source: "mock" }, 201);
  }

  const db = getServiceDb()!;
  const { data: existing } = await db
    .from("blocks")
    .select("id")
    .eq("blocker_id", profile.id)
    .eq("blocked_profile_id", body.blockedProfileId)
    .maybeSingle();

  if (existing) {
    await db.from("blocks").delete().eq("id", existing.id);
    return c.json({ blocked: false, source: "db" });
  }

  const { error } = await db
    .from("blocks")
    .insert({ blocker_id: profile.id, blocked_profile_id: body.blockedProfileId });
  if (error) throw badRequest(error.message);
  return c.json({ blocked: true, source: "db" }, 201);
});
