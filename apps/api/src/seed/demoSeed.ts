import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildDemoPlan,
  DEMO_SEED_BATCH,
  type DemoCreatorPlan,
  type DemoPlan,
  type DemoUserPlan
} from "./demoSeedData";

/**
 * Demo creator seed runner (local/staging ONLY).
 *
 * - Idempotent: identities are addressed by handle and deterministic video
 *   ids; reruns update in place and never duplicate rows.
 * - Safe: refuses to run in production, without ALLOW_DEMO_SEED=true, or
 *   against a non-local database unless ALLOW_DEMO_SEED_REMOTE=true is also
 *   set (staging).
 * - Honest: every row is marked is_demo/is_synthetic + seed_batch. The seed
 *   NEVER writes monetization rows (creator_revenue_ledger,
 *   platform_revenue_ledger, purchases, payouts, ad_*), so demo metrics can
 *   never count toward payouts, ad billing or advertiser reporting.
 * - Reversible: cleanupDemoSeed() removes everything by seed_batch.
 */

/** Shared, non-secret password for demo logins in local/staging. */
export const DEMO_USER_PASSWORD = "VuqiroDemo!2026";

export type SeedGuardInput = {
  nodeEnv: string | undefined;
  appEnv: string;
  supabaseUrl: string | undefined;
  allowDemoSeed: string | undefined;
  allowDemoSeedRemote: string | undefined;
};

export type SeedGuardResult = { allowed: true; warnings: string[] } | { allowed: false; reason: string };

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "host.docker.internal", "kong"]);

export function isLocalSupabaseUrl(url: string): boolean {
  try {
    return LOCAL_HOSTNAMES.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Pure guard evaluation so the production-blocking rules are unit-tested. */
export function checkDemoSeedGuards(input: SeedGuardInput): SeedGuardResult {
  if (input.nodeEnv === "production") {
    return { allowed: false, reason: "Refusing to run: NODE_ENV=production. The demo seed never runs in production." };
  }
  if (input.appEnv === "production") {
    return {
      allowed: false,
      reason: "Refusing to run: EXPO_PUBLIC_APP_ENV=production. The demo seed never runs in production."
    };
  }
  if (input.allowDemoSeed !== "true") {
    return {
      allowed: false,
      reason: "Refusing to run: set ALLOW_DEMO_SEED=true to explicitly allow seeding demo data."
    };
  }
  if (!input.supabaseUrl) {
    return {
      allowed: false,
      reason:
        "Supabase is not configured (EXPO_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY). The demo seed needs a local or staging database."
    };
  }
  if (!isLocalSupabaseUrl(input.supabaseUrl)) {
    if (input.allowDemoSeedRemote !== "true") {
      return {
        allowed: false,
        reason:
          `Refusing to run: ${input.supabaseUrl} is not a local database. ` +
          "Set ALLOW_DEMO_SEED_REMOTE=true ONLY when targeting a staging project — never production."
      };
    }
    return {
      allowed: true,
      warnings: [
        `Seeding a REMOTE database (${input.supabaseUrl}). Make absolutely sure this is a staging project, not production.`
      ]
    };
  }
  return { allowed: true, warnings: [] };
}

export type SeedCounters = { created: number; updated: number; skipped: number };

export type SeedSummary = {
  seedBatch: string;
  profiles: SeedCounters;
  creators: SeedCounters;
  videos: SeedCounters;
  memberships: SeedCounters;
  syntheticEvents: { created: number; deleted: number };
  skippedReasons: string[];
};

function counters(): SeedCounters {
  return { created: 0, updated: 0, skipped: 0 };
}

function log(message: string): void {
  console.log(`[demo-seed] ${message}`);
}

type ProfileRow = { id: string; auth_user_id: string; handle: string; seed_batch: string | null };

async function findProfileByHandle(db: SupabaseClient, handle: string): Promise<ProfileRow | null> {
  const { data, error } = await db
    .from("profiles")
    .select("id, auth_user_id, handle, seed_batch")
    .eq("handle", handle)
    .maybeSingle();
  if (error) throw new Error(`profile lookup failed for ${handle}: ${error.message}`);
  return data;
}

/**
 * Ensures an auth user + profile exists for a demo identity and marks the
 * profile as demo. Returns the resolved profile id, or null when the handle
 * belongs to a non-demo (real) account and must not be touched.
 */
async function ensureDemoProfile(
  db: SupabaseClient,
  identity: { handle: string; email: string; displayName: string; bio: string },
  summary: SeedSummary,
  patch: Record<string, unknown>
): Promise<string | null> {
  let profile = await findProfileByHandle(db, identity.handle);

  if (profile && profile.seed_batch !== DEMO_SEED_BATCH) {
    summary.profiles.skipped += 1;
    summary.skippedReasons.push(`profile @${identity.handle}: handle exists but is not demo-seeded — left untouched`);
    return null;
  }

  let created = false;
  if (!profile) {
    const { error } = await db.auth.admin.createUser({
      email: identity.email,
      password: DEMO_USER_PASSWORD,
      email_confirm: true,
      user_metadata: { handle: identity.handle, display_name: identity.displayName }
    });
    if (error) {
      summary.profiles.skipped += 1;
      summary.skippedReasons.push(`profile @${identity.handle}: auth user creation failed — ${error.message}`);
      return null;
    }
    // The on_auth_user_created trigger creates the profile row.
    profile = await findProfileByHandle(db, identity.handle);
    if (!profile) {
      summary.profiles.skipped += 1;
      summary.skippedReasons.push(`profile @${identity.handle}: profile row not found after auth user creation`);
      return null;
    }
    created = true;
  }

  const { error: updateError } = await db
    .from("profiles")
    .update({
      display_name: identity.displayName,
      bio: identity.bio,
      is_demo: true,
      seed_batch: DEMO_SEED_BATCH,
      ...patch
    })
    .eq("id", profile.id);
  if (updateError) throw new Error(`profile update failed for ${identity.handle}: ${updateError.message}`);

  if (created) {
    summary.profiles.created += 1;
    log(`created profile @${identity.handle}`);
  } else {
    summary.profiles.updated += 1;
    log(`updated profile @${identity.handle}`);
  }
  return profile.id;
}

async function seedCreator(db: SupabaseClient, plan: DemoCreatorPlan, summary: SeedSummary): Promise<void> {
  const profileId = await ensureDemoProfile(
    db,
    plan,
    summary,
    {
      is_creator: true,
      role: "creator",
      follower_count: plan.followerCount,
      video_count: plan.videos.length,
      like_count: plan.totalLikeCount,
      created_at: plan.createdAt
    }
  );
  if (!profileId) return;

  // Creator row: reuse by profile_id, otherwise insert with a deterministic id.
  const { data: existingCreator } = await db.from("creators").select("id").eq("profile_id", profileId).maybeSingle();
  let creatorId = existingCreator?.id as string | undefined;
  if (creatorId) {
    const { error } = await db
      .from("creators")
      .update({
        category: plan.category,
        verification_status: plan.verified ? "verified" : "unverified",
        onboarding_status: "completed",
        monetization_enabled: true,
        tiers_enabled: ["support", "plus", "premium"]
      })
      .eq("id", creatorId);
    if (error) throw new Error(`creator update failed for ${plan.handle}: ${error.message}`);
    summary.creators.updated += 1;
  } else {
    const { error } = await db.from("creators").insert({
      id: plan.creatorId,
      profile_id: profileId,
      category: plan.category,
      verification_status: plan.verified ? "verified" : "unverified",
      onboarding_status: "completed",
      monetization_enabled: true,
      tiers_enabled: ["support", "plus", "premium"],
      created_at: plan.createdAt
    });
    if (error) throw new Error(`creator insert failed for ${plan.handle}: ${error.message}`);
    creatorId = plan.creatorId;
    summary.creators.created += 1;
  }

  const { error: storefrontError } = await db
    .from("creator_profiles")
    .upsert(
      {
        creator_id: creatorId,
        banner_tone: plan.bannerTone,
        storefront_headline: `Support ${plan.displayName} on Vuqiro`,
        storefront_about: plan.bio
      },
      { onConflict: "creator_id" }
    );
  if (storefrontError) throw new Error(`creator profile upsert failed for ${plan.handle}: ${storefrontError.message}`);

  // Videos: deterministic ids make upserts idempotent.
  const videoRows = plan.videos.map((video) => ({
    id: video.id,
    creator_id: creatorId,
    caption: video.caption,
    hashtags: video.hashtags,
    category: video.category,
    visibility: video.visibility,
    required_tier: video.requiredTier,
    status: "ready",
    moderation_status: "visible",
    playback_url: video.playbackUrl,
    thumbnail_url: video.thumbnailUrl,
    duration_seconds: video.durationSeconds,
    safety_score: 96,
    like_count: video.likeCount,
    comment_count: video.commentCount,
    share_count: video.shareCount,
    save_count: video.saveCount,
    watch_count: video.watchCount,
    created_at: video.createdAt,
    published_at: video.createdAt,
    is_demo: true,
    seed_batch: DEMO_SEED_BATCH
  }));
  const { data: existingVideos, error: existingVideosError } = await db
    .from("videos")
    .select("id")
    .in("id", videoRows.map((row) => row.id));
  if (existingVideosError) throw new Error(`video lookup failed for ${plan.handle}: ${existingVideosError.message}`);
  const existingIds = new Set((existingVideos ?? []).map((row) => row.id));
  const { error: videosError } = await db.from("videos").upsert(videoRows, { onConflict: "id" });
  if (videosError) throw new Error(`video upsert failed for ${plan.handle}: ${videosError.message}`);
  summary.videos.created += videoRows.filter((row) => !existingIds.has(row.id)).length;
  summary.videos.updated += videoRows.filter((row) => existingIds.has(row.id)).length;
  log(`seeded ${videoRows.length} videos for @${plan.handle}`);
}

async function seedUser(
  db: SupabaseClient,
  plan: DemoUserPlan,
  creatorIdByHandle: Map<string, string>,
  summary: SeedSummary
): Promise<void> {
  const profileId = await ensureDemoProfile(db, plan, summary, {});
  if (!profileId) return;

  if (!plan.memberOfHandle || !plan.membershipTier) return;
  const creatorId = creatorIdByHandle.get(plan.memberOfHandle);
  if (!creatorId) {
    summary.memberships.skipped += 1;
    summary.skippedReasons.push(`membership for @${plan.handle}: demo creator @${plan.memberOfHandle} missing`);
    return;
  }

  const { data: existing } = await db
    .from("creator_memberships")
    .select("id")
    .eq("profile_id", profileId)
    .eq("creator_id", creatorId)
    .maybeSingle();
  const membershipRow = {
    profile_id: profileId,
    creator_id: creatorId,
    tier: plan.membershipTier,
    status: "active",
    platform: "admin_manual",
    is_demo: true,
    seed_batch: DEMO_SEED_BATCH
  };
  const { error } = await db
    .from("creator_memberships")
    .upsert(membershipRow, { onConflict: "profile_id,creator_id" });
  if (error) throw new Error(`membership upsert failed for ${plan.handle}: ${error.message}`);
  if (existing) {
    summary.memberships.updated += 1;
  } else {
    summary.memberships.created += 1;
  }
  log(`membership: @${plan.handle} -> @${plan.memberOfHandle} (${plan.membershipTier}, active)`);
}

/** Runs the full demo seed. Callers must have passed checkDemoSeedGuards. */
export async function runDemoSeed(db: SupabaseClient, plan: DemoPlan = buildDemoPlan()): Promise<SeedSummary> {
  const summary: SeedSummary = {
    seedBatch: plan.seedBatch,
    profiles: counters(),
    creators: counters(),
    videos: counters(),
    memberships: counters(),
    syntheticEvents: { created: 0, deleted: 0 },
    skippedReasons: []
  };

  for (const creator of plan.creators) {
    await seedCreator(db, creator, summary);
  }

  // Resolve actual creator ids (they may pre-exist with non-plan ids).
  const creatorIdByHandle = new Map<string, string>();
  for (const creator of plan.creators) {
    const profile = await findProfileByHandle(db, creator.handle);
    if (!profile) continue;
    const { data } = await db.from("creators").select("id").eq("profile_id", profile.id).maybeSingle();
    if (data) creatorIdByHandle.set(creator.handle, data.id);
  }

  for (const user of plan.users) {
    await seedUser(db, user, creatorIdByHandle, summary);
  }

  // Synthetic event rows: replace the batch wholesale (idempotent).
  const { count: deletedEvents, error: deleteError } = await db
    .from("video_events")
    .delete({ count: "exact" })
    .eq("seed_batch", plan.seedBatch);
  if (deleteError) throw new Error(`synthetic event cleanup failed: ${deleteError.message}`);
  summary.syntheticEvents.deleted = deletedEvents ?? 0;
  if (plan.events.length > 0) {
    const { error: eventsError } = await db.from("video_events").insert(
      plan.events.map((event) => ({
        video_id: event.videoId,
        profile_id: null,
        name: event.name,
        created_at: event.createdAt,
        is_synthetic: true,
        seed_batch: event.seedBatch
      }))
    );
    if (eventsError) throw new Error(`synthetic event insert failed: ${eventsError.message}`);
    summary.syntheticEvents.created = plan.events.length;
  }

  log(
    `done: profiles ${JSON.stringify(summary.profiles)}, creators ${JSON.stringify(summary.creators)}, ` +
      `videos ${JSON.stringify(summary.videos)}, memberships ${JSON.stringify(summary.memberships)}, ` +
      `synthetic events created=${summary.syntheticEvents.created}`
  );
  for (const reason of summary.skippedReasons) {
    log(`skipped: ${reason}`);
  }
  return summary;
}

export type CleanupSummary = {
  seedBatch: string;
  authUsersDeleted: number;
  profilesDeleted: number;
  videosDeleted: number;
  eventsDeleted: number;
  impressionsDeleted: number;
};

/**
 * Removes everything the demo seed created, addressed by seed_batch.
 * Deleting the auth users cascades through profiles -> creators -> videos ->
 * memberships/likes/comments; explicit deletes below are safety nets for
 * rows that could survive a broken linkage.
 */
export async function cleanupDemoSeed(db: SupabaseClient, seedBatch: string = DEMO_SEED_BATCH): Promise<CleanupSummary> {
  const summary: CleanupSummary = {
    seedBatch,
    authUsersDeleted: 0,
    profilesDeleted: 0,
    videosDeleted: 0,
    eventsDeleted: 0,
    impressionsDeleted: 0
  };

  const { count: eventsDeleted } = await db
    .from("video_events")
    .delete({ count: "exact" })
    .eq("seed_batch", seedBatch);
  summary.eventsDeleted = eventsDeleted ?? 0;

  const { count: impressionsDeleted } = await db
    .from("feed_impressions")
    .delete({ count: "exact" })
    .eq("seed_batch", seedBatch);
  summary.impressionsDeleted = impressionsDeleted ?? 0;

  const { data: profiles, error } = await db
    .from("profiles")
    .select("id, auth_user_id, handle")
    .eq("seed_batch", seedBatch);
  if (error) throw new Error(`demo profile lookup failed: ${error.message}`);

  for (const profile of profiles ?? []) {
    const { error: authError } = await db.auth.admin.deleteUser(profile.auth_user_id);
    if (authError) {
      log(`auth delete failed for @${profile.handle} (${authError.message}); deleting profile row directly`);
    } else {
      summary.authUsersDeleted += 1;
      log(`deleted demo user @${profile.handle}`);
    }
  }

  const { count: profilesDeleted } = await db
    .from("profiles")
    .delete({ count: "exact" })
    .eq("seed_batch", seedBatch);
  summary.profilesDeleted = profilesDeleted ?? 0;

  const { count: videosDeleted } = await db
    .from("videos")
    .delete({ count: "exact" })
    .eq("seed_batch", seedBatch);
  summary.videosDeleted = videosDeleted ?? 0;

  log(
    `cleanup done: auth users ${summary.authUsersDeleted}, residual profiles ${summary.profilesDeleted}, ` +
      `residual videos ${summary.videosDeleted}, events ${summary.eventsDeleted}, impressions ${summary.impressionsDeleted}`
  );
  return summary;
}
