import type { AppNotification, NotificationPreferences } from "@vuqiro/types";

export const mockNotifications: AppNotification[] = [
  { id: "notif_001", type: "new_follower", title: "New follower", body: "@lenafilms started following you.", isRead: false, createdAt: "2026-07-02T11:40:00Z" },
  { id: "notif_002", type: "coin_received", title: "Coins received", body: "@nightdrive sent you 100 coins.", isRead: false, createdAt: "2026-07-02T10:55:00Z" },
  { id: "notif_003", type: "new_comment", title: "New comment", body: "Riven Atlas commented: \u201cThe transition at the end is so clean.\u201d", isRead: false, createdAt: "2026-07-02T10:12:00Z" },
  { id: "notif_004", type: "creator_new_video", title: "New video from Maya North", body: "\u201cA quick moment from tonight\u2019s session.\u201d is live now.", isRead: true, createdAt: "2026-07-02T09:00:00Z" },
  { id: "notif_005", type: "subscription_active", title: "Subscription active", body: "Your Creator Plus membership for @maya renewed.", isRead: true, createdAt: "2026-07-01T08:00:00Z" },
  { id: "notif_006", type: "comment_reply", title: "Reply to your comment", body: "Maya North replied: \u201cAll handheld, natural light only.\u201d", isRead: false, createdAt: "2026-07-01T11:20:00Z" },
  { id: "notif_007", type: "video_unlocked", title: "Video unlocked", body: "You unlocked \u201cCity lights, fast cuts, no filter.\u201d", isRead: true, createdAt: "2026-06-29T20:00:00Z" },
  { id: "notif_008", type: "creator_new_video", title: "New video from Sola Cooks", body: "\u201c3-ingredient street tacos in 60 seconds.\u201d is live now.", isRead: true, createdAt: "2026-06-28T12:00:00Z" },
  { id: "notif_009", type: "new_follower", title: "New follower", body: "@buildlog started following you.", isRead: true, createdAt: "2026-06-27T09:30:00Z" },
  { id: "notif_010", type: "payout_status", title: "Payout update", body: "Your June payout of $184.20 is processing.", isRead: false, createdAt: "2026-06-26T07:00:00Z" },
  { id: "notif_011", type: "moderation_warning", title: "Content notice", body: "One of your videos was limited pending review. Tap for details.", isRead: true, createdAt: "2026-06-24T13:45:00Z" },
  { id: "notif_012", type: "subscription_cancelled", title: "Subscription ending", body: "Your membership for @dunestyle ends on July 1.", isRead: true, createdAt: "2026-06-20T10:00:00Z" },
  { id: "notif_013", type: "coin_received", title: "Coins received", body: "@gamefeel sent you 50 coins.", isRead: true, createdAt: "2026-06-18T19:00:00Z" },
  { id: "notif_014", type: "subscriber_drop", title: "Subscriber update", body: "You lost 2 subscribers this week. See analytics.", isRead: true, createdAt: "2026-06-15T08:00:00Z" },
  { id: "notif_015", type: "system_notice", title: "Welcome to Vuqiro", body: "Discover creators and support what you love.", isRead: true, createdAt: "2026-06-10T12:00:00Z" }
];

export const mockNotificationPreferences: NotificationPreferences = {
  userId: "user_me",
  followers: true,
  comments: true,
  creatorUpdates: true,
  purchases: true,
  payouts: true,
  moderation: true,
  system: true,
  messages: true,
  pushEnabled: false
};
