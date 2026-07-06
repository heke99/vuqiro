import { getServiceDb, isBackendConfigured } from "./supabase";

/**
 * Privacy background workers, invoked from the admin ops endpoint or an
 * external scheduler:
 *  - data exports: build the user's data bundle, store it in the private
 *    legal-exports bucket and mark the export ready (owner downloads via
 *    signed URL);
 *  - account deletions: requests whose 30-day window elapsed are executed by
 *    anonymizing the profile and marking content deleted.
 */

const EXPORT_TTL_DAYS = 7;

async function buildExportBundle(profileId: string): Promise<Record<string, unknown>> {
  const db = getServiceDb()!;
  const [profile, settings, safety, interests, videos, comments, likes, saves, follows, walletTx, consents, acceptances] =
    await Promise.all([
      db.from("profiles").select("*").eq("id", profileId).maybeSingle(),
      db.from("profile_settings").select("*").eq("profile_id", profileId).maybeSingle(),
      db.from("user_safety_settings").select("*").eq("profile_id", profileId).maybeSingle(),
      db.from("user_interests").select("interest, created_at").eq("profile_id", profileId),
      db
        .from("videos")
        .select("id, caption, hashtags, visibility, status, created_at, creators!inner (profile_id)")
        .eq("creators.profile_id", profileId),
      db.from("comments").select("id, video_id, text, created_at").eq("author_id", profileId),
      db.from("likes").select("video_id, created_at").eq("profile_id", profileId),
      db.from("saves").select("video_id, created_at").eq("profile_id", profileId),
      db.from("follows").select("creator_id, created_at").eq("follower_id", profileId),
      db.from("coin_transactions").select("type, amount, description, created_at").eq("profile_id", profileId),
      db.from("consent_events").select("consent_type, granted, created_at").eq("profile_id", profileId),
      db.from("legal_acceptances").select("document_type, document_version, created_at").eq("profile_id", profileId)
    ]);

  return {
    exportedAt: new Date().toISOString(),
    profile: profile.data,
    settings: settings.data,
    safetySettings: safety.data,
    interests: interests.data ?? [],
    videos: videos.data ?? [],
    comments: comments.data ?? [],
    likes: likes.data ?? [],
    saves: saves.data ?? [],
    follows: follows.data ?? [],
    walletTransactions: walletTx.data ?? [],
    consentEvents: consents.data ?? [],
    legalAcceptances: acceptances.data ?? []
  };
}

export async function processDataExports(batchSize = 10): Promise<{ processed: number; ready: number; failed: number }> {
  if (!isBackendConfigured()) {
    return { processed: 0, ready: 0, failed: 0 };
  }
  const db = getServiceDb()!;
  const { data: exports } = await db
    .from("data_exports")
    .select("id, profile_id")
    .in("status", ["requested", "processing"])
    .order("created_at")
    .limit(batchSize);
  if (!exports || exports.length === 0) {
    return { processed: 0, ready: 0, failed: 0 };
  }

  let ready = 0;
  let failed = 0;
  for (const exportRow of exports) {
    try {
      await db.from("data_exports").update({ status: "processing" }).eq("id", exportRow.id);
      const bundle = await buildExportBundle(exportRow.profile_id);
      const path = `${exportRow.profile_id}/${exportRow.id}.json`;
      const { error: uploadError } = await db.storage
        .from("legal-exports")
        .upload(path, JSON.stringify(bundle, null, 2), { contentType: "application/json", upsert: true });
      if (uploadError) throw new Error(uploadError.message);

      const expiresAt = new Date(Date.now() + EXPORT_TTL_DAYS * 24 * 3_600_000).toISOString();
      await db
        .from("data_exports")
        .update({ status: "ready", file_url: path, expires_at: expiresAt })
        .eq("id", exportRow.id);
      ready += 1;
    } catch {
      await db.from("data_exports").update({ status: "failed" }).eq("id", exportRow.id);
      failed += 1;
    }
  }
  return { processed: exports.length, ready, failed };
}

/**
 * Executes account deletions whose 30-day grace window has elapsed:
 * anonymize the profile (identity fields cleared, status deleted), mark the
 * user's videos deleted and complete the request. Ledgers and moderation
 * history are retained (legal/financial records are append-only).
 */
export async function processAccountDeletions(batchSize = 20): Promise<{ processed: number; completed: number }> {
  if (!isBackendConfigured()) {
    return { processed: 0, completed: 0 };
  }
  const db = getServiceDb()!;
  const nowIso = new Date().toISOString();
  const { data: requests } = await db
    .from("account_deletion_requests")
    .select("id, profile_id")
    .in("status", ["requested", "processing"])
    .lte("complete_by", nowIso)
    .order("requested_at")
    .limit(batchSize);
  if (!requests || requests.length === 0) {
    return { processed: 0, completed: 0 };
  }

  let completed = 0;
  for (const request of requests) {
    await db.from("account_deletion_requests").update({ status: "processing" }).eq("id", request.id);

    const anonymizedHandle = `deleted_${request.profile_id.slice(0, 8)}`;
    await db
      .from("profiles")
      .update({
        handle: anonymizedHandle,
        display_name: "Deleted account",
        bio: "",
        avatar_url: null,
        website_url: null,
        status: "deleted"
      })
      .eq("id", request.profile_id);

    // Content is soft-deleted (recoverable only by direct DB intervention).
    const { data: creator } = await db.from("creators").select("id").eq("profile_id", request.profile_id).maybeSingle();
    if (creator) {
      await db
        .from("videos")
        .update({ status: "deleted", deleted_at: nowIso })
        .eq("creator_id", creator.id)
        .neq("status", "deleted");
    }
    await db.from("push_tokens").update({ is_active: false }).eq("profile_id", request.profile_id);
    await db
      .from("account_deletion_requests")
      .update({ status: "completed", processed_at: nowIso })
      .eq("id", request.id);
    completed += 1;
  }
  return { processed: requests.length, completed };
}
