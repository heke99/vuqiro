import { Hono } from "hono";
import { z } from "zod";
import { mockCreators, mockMemberships, mockModerationCases, mockVideos } from "@vuqiro/mock-data";
import { badRequest, forbidden } from "../lib/errors";
import { getServiceDb, isBackendConfigured } from "../lib/supabase";
import type { ApiProfile, AppEnv } from "../middleware/auth";
import { attachUser, requireUser } from "../middleware/auth";

export const creatorStudioRoutes = new Hono<AppEnv>();

creatorStudioRoutes.use("*", attachUser);

/** Records acceptance of the latest published version of a legal document. */
export async function recordAcceptance(profileId: string, documentType: string): Promise<void> {
  const db = getServiceDb();
  if (!db) return;
  const { data: doc } = await db
    .from("legal_documents")
    .select("id")
    .eq("type", documentType)
    .eq("status", "published")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!doc) return;
  await db
    .from("legal_acceptances")
    .upsert({ profile_id: profileId, document_id: doc.id }, { onConflict: "profile_id,document_id" });
}

/**
 * Resolves the calling user's creator record. Every studio endpoint is
 * scoped through this — a creator can never address another creator's data.
 */
async function requireOwnCreator(profile: ApiProfile): Promise<{ id: string }> {
  const db = getServiceDb()!;
  const { data: creator } = await db.from("creators").select("id").eq("profile_id", profile.id).maybeSingle();
  if (!creator) throw forbidden("Not a creator account");
  return creator;
}

/** The creator's own videos — including drafts, processing and moderated. */
creatorStudioRoutes.get("/creators/me/videos", requireUser, async (c) => {
  const profile = c.get("profile")!;

  if (!isBackendConfigured()) {
    return c.json({ items: mockVideos.filter((video) => video.creatorId === "creator_001"), source: "mock" });
  }

  const db = getServiceDb()!;
  const creator = await requireOwnCreator(profile);
  const { data, error } = await db
    .from("videos")
    .select(
      "id, caption, hashtags, category, visibility, status, moderation_status, coin_unlock_price, required_tier, like_count, comment_count, watch_count, report_count, created_at"
    )
    .eq("creator_id", creator.id)
    .neq("status", "deleted")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw badRequest(error.message);
  return c.json({ items: data ?? [], source: "db" });
});

/** The creator's subscriber overview (counts + recent joins; no payment PII). */
creatorStudioRoutes.get("/creators/me/subscribers", requireUser, async (c) => {
  const profile = c.get("profile")!;

  if (!isBackendConfigured()) {
    return c.json({
      totals: { active: mockMemberships.filter((m) => m.status === "active").length, gracePeriod: 1, cancelled: 1 },
      byTier: { support: 1, plus: 1, premium: 1 },
      recent: mockMemberships.map((membership) => ({
        tier: membership.tier,
        status: membership.status,
        startedAt: membership.startedAt
      })),
      source: "mock"
    });
  }

  const db = getServiceDb()!;
  const creator = await requireOwnCreator(profile);
  const { data: memberships } = await db
    .from("creator_memberships")
    .select("tier, status, started_at, profiles (handle)")
    .eq("creator_id", creator.id)
    .order("started_at", { ascending: false })
    .limit(100);

  const rows = memberships ?? [];
  const byTier: Record<string, number> = { support: 0, plus: 0, premium: 0 };
  let active = 0;
  let gracePeriod = 0;
  let cancelled = 0;
  for (const row of rows) {
    if (row.status === "active") {
      active += 1;
      byTier[row.tier] = (byTier[row.tier] ?? 0) + 1;
    } else if (row.status === "grace_period") {
      gracePeriod += 1;
    } else {
      cancelled += 1;
    }
  }

  return c.json({
    totals: { active, gracePeriod, cancelled },
    byTier,
    recent: rows.slice(0, 20).map((row) => ({
      handle: (row.profiles as { handle?: string } | null)?.handle,
      tier: row.tier,
      status: row.status,
      startedAt: row.started_at
    })),
    source: "db"
  });
});

/** Moderation warnings and cases affecting the creator's own content. */
creatorStudioRoutes.get("/creators/me/moderation", requireUser, async (c) => {
  const profile = c.get("profile")!;

  if (!isBackendConfigured()) {
    return c.json({
      warnings: mockCreators[0].moderationWarnings ?? 0,
      cases: mockModerationCases.filter((item) => item.targetId === "video_002"),
      source: "mock"
    });
  }

  const db = getServiceDb()!;
  const creator = await requireOwnCreator(profile);
  const { data: creatorRow } = await db
    .from("creators")
    .select("moderation_warnings")
    .eq("id", creator.id)
    .maybeSingle();

  const { data: videos } = await db.from("videos").select("id").eq("creator_id", creator.id);
  const videoIds = (videos ?? []).map((video) => video.id);

  const cases: unknown[] = [];
  if (videoIds.length > 0) {
    const { data: videoCases } = await db
      .from("moderation_cases")
      .select("id, target_type, target_id, reason, status, resolved_action, resolved_at, created_at")
      .eq("target_type", "video")
      .in("target_id", videoIds)
      .order("created_at", { ascending: false })
      .limit(50);
    cases.push(...(videoCases ?? []));
  }
  const { data: creatorCases } = await db
    .from("moderation_cases")
    .select("id, target_type, target_id, reason, status, resolved_action, resolved_at, created_at")
    .eq("target_type", "creator")
    .eq("target_id", creator.id)
    .order("created_at", { ascending: false })
    .limit(20);
  cases.push(...(creatorCases ?? []));

  return c.json({ warnings: creatorRow?.moderation_warnings ?? 0, cases, source: "db" });
});

const tierSettingsBody = z.object({
  tiersEnabled: z.array(z.enum(["support", "plus", "premium"])).max(3)
});

/** Update the creator's own subscription tier availability. */
creatorStudioRoutes.post("/creators/me/tiers", requireUser, async (c) => {
  const profile = c.get("profile")!;
  const body = tierSettingsBody.parse(await c.req.json());

  if (!isBackendConfigured()) {
    return c.json({ tiersEnabled: body.tiersEnabled, source: "mock" });
  }

  const db = getServiceDb()!;
  const creator = await requireOwnCreator(profile);
  const { error } = await db.from("creators").update({ tiers_enabled: body.tiersEnabled }).eq("id", creator.id);
  if (error) throw badRequest(error.message);
  return c.json({ tiersEnabled: body.tiersEnabled, source: "db" });
});

/** Become a creator (onboarding entry point for regular users). */
creatorStudioRoutes.post("/creators/onboard", requireUser, async (c) => {
  const profile = c.get("profile")!;

  if (!isBackendConfigured()) {
    return c.json({ creatorId: "mock_creator", onboardingStatus: "completed", source: "mock" }, 201);
  }

  const db = getServiceDb()!;
  const { data: existing } = await db.from("creators").select("id").eq("profile_id", profile.id).maybeSingle();
  if (existing) {
    return c.json({ creatorId: existing.id, onboardingStatus: "completed", source: "db" });
  }

  const { data: creator, error } = await db
    .from("creators")
    .insert({ profile_id: profile.id, onboarding_status: "completed" })
    .select("id")
    .single();
  if (error) throw badRequest(error.message);

  await db.from("creator_profiles").insert({ creator_id: creator.id }).select("creator_id");
  await db.from("profiles").update({ is_creator: true }).eq("id", profile.id);

  // Creator onboarding implies acceptance of the creator terms.
  await recordAcceptance(profile.id, "creator_terms");

  return c.json({ creatorId: creator.id, onboardingStatus: "completed", source: "db" }, 201);
});
