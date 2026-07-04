import { Hono } from "hono";
import { z } from "zod";
import { badRequest, conflict, notFound } from "../lib/errors";
import { enforceRateLimit } from "../lib/rateLimit";
import { getServiceDb, isBackendConfigured } from "../lib/supabase";
import type { AppEnv } from "../middleware/auth";
import { attachUser, requireUser } from "../middleware/auth";

/**
 * Privacy & account lifecycle: privacy/data-export requests and account
 * deletion — all via the API so mobile never writes these tables directly.
 */
export const privacyRoutes = new Hono<AppEnv>();

privacyRoutes.use("*", attachUser);

const privacyRequestBody = z.object({
  type: z.enum(["access", "export", "correction", "restriction", "objection", "deletion"]),
  details: z.string().trim().max(2000).optional()
});

privacyRoutes.post("/privacy/requests", requireUser, async (c) => {
  const profile = c.get("profile")!;
  const body = privacyRequestBody.parse(await c.req.json());
  enforceRateLimit(`privacy:${profile.id}`, 10, 24 * 3_600_000);

  if (!isBackendConfigured()) {
    return c.json({ request: { id: `mock_privacy_${Date.now()}`, ...body, status: "submitted" }, source: "mock" }, 201);
  }
  const db = getServiceDb()!;
  const { data, error } = await db
    .from("privacy_requests")
    .insert({ profile_id: profile.id, type: body.type, details: body.details })
    .select("id, type, status, created_at")
    .single();
  if (error) throw badRequest(error.message);

  // Export requests also open a data_exports job.
  if (body.type === "export" || body.type === "access") {
    await db.from("data_exports").insert({ profile_id: profile.id, privacy_request_id: data.id });
  }
  return c.json({ request: data, source: "db" }, 201);
});

privacyRoutes.get("/privacy/requests", requireUser, async (c) => {
  const profile = c.get("profile")!;
  if (!isBackendConfigured()) {
    return c.json({ requests: [], source: "mock" });
  }
  const db = getServiceDb()!;
  const { data, error } = await db
    .from("privacy_requests")
    .select("id, type, status, details, created_at")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false });
  if (error) throw badRequest(error.message);
  return c.json({ requests: data ?? [], source: "db" });
});

privacyRoutes.get("/privacy/data-exports", requireUser, async (c) => {
  const profile = c.get("profile")!;
  if (!isBackendConfigured()) {
    return c.json({ exports: [], source: "mock" });
  }
  const db = getServiceDb()!;
  const { data, error } = await db
    .from("data_exports")
    .select("id, status, file_url, expires_at, created_at")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false });
  if (error) throw badRequest(error.message);
  return c.json({ exports: data ?? [], source: "db" });
});

// ---------------------------------------------------------------------------
// Account deletion
// ---------------------------------------------------------------------------

const deletionBody = z.object({ reason: z.string().trim().max(1000).optional() });

privacyRoutes.post("/account/deletion", requireUser, async (c) => {
  const profile = c.get("profile")!;
  const body = deletionBody.parse(await c.req.json().catch(() => ({})));
  enforceRateLimit(`deletion:${profile.id}`, 5, 24 * 3_600_000);

  if (!isBackendConfigured()) {
    return c.json(
      { request: { id: `mock_del_${Date.now()}`, status: "requested", reason: body.reason }, source: "mock" },
      201
    );
  }

  const db = getServiceDb()!;
  const { data: existing } = await db
    .from("account_deletion_requests")
    .select("id")
    .eq("profile_id", profile.id)
    .eq("status", "requested")
    .maybeSingle();
  if (existing) throw conflict("A deletion request is already pending");

  const { data, error } = await db
    .from("account_deletion_requests")
    .insert({ profile_id: profile.id, reason: body.reason })
    .select("id, status, requested_at, complete_by")
    .single();
  if (error) throw badRequest(error.message);

  await db.from("profiles").update({ status: "deletion_requested" }).eq("id", profile.id);
  await db.from("consent_events").insert({
    profile_id: profile.id,
    consent_type: "terms",
    granted: false,
    source: "settings"
  });
  return c.json({ request: data, source: "db" }, 201);
});

privacyRoutes.get("/account/deletion", async (c) => {
  const profile = c.get("profile");
  if (!profile) return c.json({ request: null, source: isBackendConfigured() ? "db" : "mock" });
  if (!isBackendConfigured()) {
    return c.json({ request: null, source: "mock" });
  }
  const db = getServiceDb()!;
  const { data } = await db
    .from("account_deletion_requests")
    .select("id, status, reason, requested_at, complete_by")
    .eq("profile_id", profile.id)
    .in("status", ["requested", "processing"])
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return c.json({ request: data ?? null, source: "db" });
});

/** Cancel a pending deletion request (allowed within the grace period). */
privacyRoutes.delete("/account/deletion", async (c) => {
  const profile = c.get("profile");
  if (!profile) throw notFound("No pending deletion request");
  if (!isBackendConfigured()) {
    return c.json({ cancelled: true, source: "mock" });
  }
  const db = getServiceDb()!;
  const { data, error } = await db
    .from("account_deletion_requests")
    .update({ status: "cancelled" })
    .eq("profile_id", profile.id)
    .eq("status", "requested")
    .select("id")
    .maybeSingle();
  if (error) throw badRequest(error.message);
  if (!data) throw notFound("No pending deletion request");
  await db.from("profiles").update({ status: "active" }).eq("id", profile.id);
  return c.json({ cancelled: true, source: "db" });
});

// ---------------------------------------------------------------------------
// Copyright takedown submissions (public form; profile optional)
// ---------------------------------------------------------------------------

const copyrightBody = z.object({
  claimantName: z.string().trim().min(1).max(200),
  claimantEmail: z.string().email(),
  claimantOrganization: z.string().trim().max(200).default(""),
  targetVideoId: z.string().min(1),
  description: z.string().trim().min(10).max(4000),
  originalWorkUrl: z.string().url().optional()
});

privacyRoutes.post("/copyright-claims", async (c) => {
  const profile = c.get("profile");
  const body = copyrightBody.parse(await c.req.json());
  enforceRateLimit(`copyright:${profile?.id ?? c.req.header("x-forwarded-for") ?? "anon"}`, 5, 24 * 3_600_000);

  if (!isBackendConfigured()) {
    return c.json({ claim: { id: `mock_claim_${Date.now()}`, status: "submitted" }, source: "mock" }, 201);
  }

  const db = getServiceDb()!;
  const { data: video } = await db.from("videos").select("id").eq("id", body.targetVideoId).maybeSingle();
  if (!video) throw notFound("Video not found");

  const { data: moderationCase } = await db
    .from("moderation_cases")
    .insert({
      target_type: "video",
      target_id: body.targetVideoId,
      reason: "copyright",
      priority: "high"
    })
    .select("id")
    .single();

  const { data, error } = await db
    .from("copyright_claims")
    .insert({
      claimant_profile_id: profile?.id ?? null,
      claimant_name: body.claimantName,
      claimant_email: body.claimantEmail,
      claimant_organization: body.claimantOrganization,
      target_video_id: body.targetVideoId,
      description: body.description,
      original_work_url: body.originalWorkUrl,
      moderation_case_id: moderationCase?.id ?? null
    })
    .select("id, status, created_at")
    .single();
  if (error) throw badRequest(error.message);
  return c.json({ claim: data, source: "db" }, 201);
});

// ---------------------------------------------------------------------------
// Support cases (user side)
// ---------------------------------------------------------------------------

const supportBody = z.object({
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(8000),
  email: z.string().email().optional()
});

privacyRoutes.post("/support-cases", requireUser, async (c) => {
  const profile = c.get("profile")!;
  const body = supportBody.parse(await c.req.json());
  enforceRateLimit(`support:${profile.id}`, 10, 24 * 3_600_000);

  if (!isBackendConfigured()) {
    return c.json({ case: { id: `mock_support_${Date.now()}`, status: "open" }, source: "mock" }, 201);
  }
  const db = getServiceDb()!;
  const { data, error } = await db
    .from("support_cases")
    .insert({ profile_id: profile.id, email: body.email ?? "", subject: body.subject, body: body.body })
    .select("id, status, created_at")
    .single();
  if (error) throw badRequest(error.message);
  return c.json({ case: data, source: "db" }, 201);
});

privacyRoutes.get("/support-cases", requireUser, async (c) => {
  const profile = c.get("profile")!;
  if (!isBackendConfigured()) {
    return c.json({ cases: [], source: "mock" });
  }
  const db = getServiceDb()!;
  const { data, error } = await db
    .from("support_cases")
    .select("id, subject, status, priority, created_at")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false });
  if (error) throw badRequest(error.message);
  return c.json({ cases: data ?? [], source: "db" });
});
