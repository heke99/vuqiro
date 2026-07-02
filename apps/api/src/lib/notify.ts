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
  system_notice: "system"
};

/**
 * Creates an in-app notification for a profile, honoring their notification
 * preferences. Payout details are only ever sent to the owning profile —
 * callers must pass the correct target.
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
    .select("followers, comments, creator_updates, purchases, payouts, moderation, system")
    .eq("profile_id", params.profileId)
    .maybeSingle();
  if (prefs && prefKey in prefs && (prefs as Record<string, boolean>)[prefKey] === false) {
    return;
  }

  const { error } = await db.from("notifications").insert({
    profile_id: params.profileId,
    type: params.type,
    title: params.title,
    body: params.body,
    related_profile_id: params.relatedProfileId ?? null,
    related_video_id: params.relatedVideoId ?? null
  });
  if (error) {
    console.error("[notify] insert failed:", error.message);
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
