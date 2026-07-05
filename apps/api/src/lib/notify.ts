import { getServiceDb } from "./supabase";
import type { NotificationType } from "@vuqiro/types";

/** Maps each notification type to the preference toggle that controls it. */
const preferenceKeyByType: Record<NotificationType, string> = {
  new_follower: "followers",
  new_comment: "comments",
  comment_reply: "comments",
  creator_new_video: "creator_updates",
  subscriber_drop: "creator_updates",
  subscription_active: "purchases",
  subscription_cancelled: "purchases",
  coin_received: "purchases",
  video_unlocked: "purchases",
  payout_status: "payouts",
  moderation_warning: "moderation",
  system_notice: "system",
  new_message: "messages"
};

/** Types important enough to also deliver by email (when configured). */
const EMAIL_WORTHY_TYPES: Set<NotificationType> = new Set(["payout_status", "moderation_warning", "system_notice"]);

/** Repeats of the same event within this window are deduped (noise control). */
const DEDUPE_WINDOW_MS = 60 * 60 * 1000;

/**
 * Creates an in-app notification for a profile, honoring their notification
 * preferences, deduping repeats and fanning out to push/email job queues.
 * Payout details are only ever sent to the owning profile — callers must
 * pass the correct target.
 */
export async function notifyProfile(params: {
  profileId: string;
  type: NotificationType;
  title: string;
  body: string;
  relatedProfileId?: string;
  relatedVideoId?: string;
}): Promise<void> {
  const db = getServiceDb();
  if (!db) return;

  const prefKey = preferenceKeyByType[params.type];
  const { data: prefs } = await db
    .from("notification_preferences")
    .select("followers, comments, creator_updates, purchases, payouts, moderation, system, messages, push_enabled")
    .eq("profile_id", params.profileId)
    .maybeSingle();
  if (prefs && prefKey in prefs && (prefs as Record<string, boolean>)[prefKey] === false) {
    return;
  }

  // Dedupe: the same actor doing the same thing repeatedly (follow/unfollow
  // spam, repeated replies) collapses into one notification per hour.
  if (params.relatedProfileId || params.relatedVideoId) {
    const since = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString();
    let dupQuery = db
      .from("notifications")
      .select("id")
      .eq("profile_id", params.profileId)
      .eq("type", params.type)
      .gte("created_at", since)
      .limit(1);
    if (params.relatedProfileId) dupQuery = dupQuery.eq("related_profile_id", params.relatedProfileId);
    if (params.relatedVideoId) dupQuery = dupQuery.eq("related_video_id", params.relatedVideoId);
    const { data: duplicate } = await dupQuery.maybeSingle();
    if (duplicate) return;
  }

  const { data: created, error } = await db
    .from("notifications")
    .insert({
      profile_id: params.profileId,
      type: params.type,
      title: params.title,
      body: params.body,
      related_profile_id: params.relatedProfileId ?? null,
      related_video_id: params.relatedVideoId ?? null
    })
    .select("id")
    .single();
  if (error) {
    console.error("[notify] insert failed:", error.message);
    return;
  }

  // Channel fan-out via notification_jobs (processed by the job runner).
  const jobs: Record<string, unknown>[] = [];
  const payload = { title: params.title, body: params.body, type: params.type };
  if (prefs?.push_enabled) {
    jobs.push({ profile_id: params.profileId, notification_id: created.id, channel: "push", payload });
  }
  if (EMAIL_WORTHY_TYPES.has(params.type)) {
    jobs.push({ profile_id: params.profileId, notification_id: created.id, channel: "email", payload });
  }
  if (jobs.length > 0) {
    await db.from("notification_jobs").insert(jobs);
  }
}

/** Notify the profile behind a creator id. */
export async function notifyCreatorProfile(
  creatorId: string,
  params: Omit<Parameters<typeof notifyProfile>[0], "profileId">
): Promise<void> {
  const db = getServiceDb();
  if (!db) return;
  const { data: creator } = await db.from("creators").select("profile_id").eq("id", creatorId).maybeSingle();
  if (!creator) return;
  await notifyProfile({ ...params, profileId: creator.profile_id });
}
