import type { ID } from "./core";

export type Comment = {
  id: ID;
  videoId: ID;
  authorId: ID;
  authorHandle: string;
  authorDisplayName: string;
  isCreator: boolean;
  isSubscriber: boolean;
  text: string;
  likeCount: number;
  replyCount: number;
  parentCommentId?: ID;
  createdAt: string;
};

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
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
};
