import { Hono } from "hono";
import { z } from "zod";
import { badRequest, notFound } from "../lib/errors";
import { enforceRateLimit } from "../lib/rateLimit";
import { recordAdClick, recordAdImpression, selectAds, type AdViewer } from "../lib/adServing";
import { getServiceDb, isBackendConfigured } from "../lib/supabase";
import type { AppEnv } from "../middleware/auth";
import { attachUser, requireUser } from "../middleware/auth";

export const adsRoutes = new Hono<AppEnv>();

adsRoutes.use("*", attachUser);

const placementSchema = z.enum(["feed", "discover", "profile", "inbox", "post_roll"]).default("feed");

async function buildViewer(c: {
  get: (key: "profile") => { id: string } | undefined;
  req: { query: (key: string) => string | undefined };
}): Promise<AdViewer> {
  const profile = c.get("profile");
  const anonSessionId = c.req.query("session") ?? undefined;
  let personalizedAdsOptIn = false;
  let interests: string[] | undefined;
  let country: string | undefined = c.req.query("country") ?? undefined;
  let language: string | undefined = c.req.query("language") ?? undefined;

  if (profile && isBackendConfigured()) {
    const db = getServiceDb()!;
    const [{ data: settings }, { data: interestRows }, { data: profileRow }] = await Promise.all([
      db.from("profile_settings").select("personalized_ads_opt_in").eq("profile_id", profile.id).maybeSingle(),
      db.from("user_interests").select("interest").eq("profile_id", profile.id),
      db.from("profiles").select("country, language").eq("id", profile.id).maybeSingle()
    ]);
    personalizedAdsOptIn = settings?.personalized_ads_opt_in ?? false;
    interests = (interestRows ?? []).map((row) => row.interest);
    country = country ?? profileRow?.country ?? undefined;
    language = language ?? profileRow?.language ?? undefined;
  }

  return { profileId: profile?.id, anonSessionId, country, language, interests, personalizedAdsOptIn };
}

/** GET /ads/serve?placement=feed&count=1 — select ads for the viewer. */
adsRoutes.get("/serve", async (c) => {
  const placement = placementSchema.parse(c.req.query("placement") ?? "feed");
  const count = Math.min(Math.max(Number(c.req.query("count") ?? "1"), 1), 5);
  const viewer = await buildViewer(c);
  const ads = await selectAds(viewer, placement, count);
  return c.json({ ads, source: isBackendConfigured() ? "db" : "mock" });
});

const deliveryBody = z.object({
  creativeId: z.string().min(1),
  placement: placementSchema,
  session: z.string().max(120).optional()
});

/** POST /ads/impression — log a delivered ad (billing + frequency caps). */
adsRoutes.post("/impression", async (c) => {
  const body = deliveryBody.parse(await c.req.json());
  const profile = c.get("profile");
  enforceRateLimit(`ad-impression:${profile?.id ?? body.session ?? "anon"}`, 120, 60_000);
  const viewer = await buildViewer(c);
  if (body.session) viewer.anonSessionId = body.session;
  const result = await recordAdImpression({ creativeId: body.creativeId, viewer, placement: body.placement });
  return c.json({ ...result, source: isBackendConfigured() ? "db" : "mock" });
});

/** POST /ads/click — log an ad click (CPC billing). */
adsRoutes.post("/click", async (c) => {
  const body = deliveryBody.parse(await c.req.json());
  const profile = c.get("profile");
  enforceRateLimit(`ad-click:${profile?.id ?? body.session ?? "anon"}`, 60, 60_000);
  const viewer = await buildViewer(c);
  if (body.session) viewer.anonSessionId = body.session;
  const result = await recordAdClick({ creativeId: body.creativeId, viewer, placement: body.placement });
  return c.json({ ...result, source: isBackendConfigured() ? "db" : "mock" });
});

const adReportBody = z.object({
  creativeId: z.string().min(1),
  reason: z.enum(["misleading", "offensive", "scam", "adult_content", "dangerous_product", "irrelevant", "other"]),
  details: z.string().trim().max(2000).optional()
});

/** POST /ads/report — user reports an ad; creates/links a moderation case. */
adsRoutes.post("/report", requireUser, async (c) => {
  const profile = c.get("profile")!;
  const body = adReportBody.parse(await c.req.json());
  enforceRateLimit(`ad-report:${profile.id}`, 20, 60 * 60_000);

  if (!isBackendConfigured()) {
    return c.json({ reportId: `mock_adreport_${Date.now()}`, source: "mock" }, 201);
  }

  const db = getServiceDb()!;
  const { data: creative } = await db
    .from("ad_creatives")
    .select("id, campaign_id")
    .eq("id", body.creativeId)
    .maybeSingle();
  if (!creative) throw notFound("Ad not found");

  // Attach to an open case for this creative, or open a new one.
  const { data: existingCase } = await db
    .from("moderation_cases")
    .select("id, report_count")
    .eq("target_type", "video")
    .eq("target_id", creative.id)
    .in("status", ["open", "reviewing"])
    .maybeSingle();

  let caseId = existingCase?.id as string | undefined;
  if (existingCase) {
    await db
      .from("moderation_cases")
      .update({ report_count: existingCase.report_count + 1 })
      .eq("id", existingCase.id);
  } else {
    const { data: created, error } = await db
      .from("moderation_cases")
      .insert({
        target_type: "video",
        target_id: creative.id,
        reason: body.reason === "scam" ? "scam" : "other",
        status: "open",
        priority: "medium"
      })
      .select("id")
      .single();
    if (error) throw badRequest(error.message);
    caseId = created.id;
  }

  const { data: report, error: reportError } = await db
    .from("ad_reports")
    .insert({
      reporter_id: profile.id,
      creative_id: creative.id,
      campaign_id: creative.campaign_id,
      reason: body.reason,
      details: body.details,
      moderation_case_id: caseId
    })
    .select("id")
    .single();
  if (reportError) throw badRequest(reportError.message);

  return c.json({ reportId: report.id, caseId, source: "db" }, 201);
});
