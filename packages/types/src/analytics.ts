import type { ID } from "./user";

export type AnalyticsEventName =
  | "app_open"
  | "signup_started"
  | "signup_completed"
  | "feed_view"
  | "video_impression"
  | "video_play"
  | "video_pause"
  | "video_progress"
  | "video_complete"
  | "video_skip"
  | "video_rewatch"
  | "video_like"
  | "video_save"
  | "video_share"
  | "video_comment_open"
  | "video_share_open"
  | "video_report"
  | "comment_open"
  | "comment_submit"
  | "creator_profile_open"
  | "creator_follow"
  | "creator_subscribe_open"
  | "creator_subscribe_success"
  | "coin_pack_open"
  | "coin_support_open"
  | "coin_purchase_success"
  | "coin_tip_sent"
  | "video_unlock_success"
  | "report_submit"
  | "block_user"
  | "upload_started"
  | "upload_submitted"
  | "admin_action";

export type AnalyticsEvent = {
  id: ID;
  name: AnalyticsEventName;
  userId?: ID;
  videoId?: ID;
  creatorId?: ID;
  value?: number;
  metadata?: Record<string, string | number | boolean>;
  createdAt: string;
};

export type CreatorAnalyticsSummary = {
  creatorId: ID;
  views: number;
  watchTimeHours: number;
  completionRate: number;
  followersGained: number;
  subscribersGained: number;
  coinTips: number;
  unlockRevenue: number;
  subscriptionRevenue: number;
  payoutPending: number;
  payoutPaid: number;
};
