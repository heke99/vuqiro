import type { ID } from "./user";

export type NotificationType =
  | "new_follower"
  | "new_comment"
  | "comment_reply"
  | "creator_new_video"
  | "subscriber_drop"
  | "subscription_active"
  | "subscription_cancelled"
  | "coin_received"
  | "video_unlocked"
  | "payout_status"
  | "moderation_warning"
  | "system_notice";

export type AppNotification = {
  id: ID;
  userId?: ID;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  relatedUserId?: ID;
  relatedVideoId?: ID;
  createdAt: string;
};

export type NotificationPreferences = {
  userId: ID;
  followers: boolean;
  comments: boolean;
  creatorUpdates: boolean;
  purchases: boolean;
  payouts: boolean;
  moderation: boolean;
  system: boolean;
  pushEnabled: boolean;
};
