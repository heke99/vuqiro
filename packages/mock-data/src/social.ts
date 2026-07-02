import type { AppNotification, Comment } from "@vuqiro/types";

export const mockComments: Comment[] = [
  {
    id: "comment_001",
    videoId: "video_001",
    authorId: "creator_002",
    authorHandle: "riven",
    authorDisplayName: "Riven Atlas",
    isCreator: true,
    isSubscriber: false,
    text: "The transition at the end is so clean.",
    likeCount: 214,
    replyCount: 2,
    createdAt: "2026-07-02T10:12:00Z"
  },
  {
    id: "comment_002",
    videoId: "video_001",
    authorId: "user_101",
    authorHandle: "lenafilms",
    authorDisplayName: "Lena Films",
    isCreator: false,
    isSubscriber: true,
    text: "Been waiting for this drop all week.",
    likeCount: 96,
    replyCount: 0,
    createdAt: "2026-07-02T10:30:00Z"
  },
  {
    id: "comment_003",
    videoId: "video_001",
    authorId: "user_102",
    authorHandle: "kofi.codes",
    authorDisplayName: "Kofi Codes",
    isCreator: false,
    isSubscriber: false,
    text: "What camera setup is this?",
    likeCount: 41,
    replyCount: 1,
    createdAt: "2026-07-02T11:02:00Z"
  },
  {
    id: "comment_004",
    videoId: "video_001",
    authorId: "creator_001",
    authorHandle: "maya",
    authorDisplayName: "Maya North",
    isCreator: true,
    isSubscriber: false,
    text: "All handheld, natural light only.",
    likeCount: 88,
    replyCount: 0,
    parentCommentId: "comment_003",
    createdAt: "2026-07-02T11:15:00Z"
  },
  {
    id: "comment_005",
    videoId: "video_002",
    authorId: "user_103",
    authorHandle: "nightdrive",
    authorDisplayName: "Night Drive",
    isCreator: false,
    isSubscriber: true,
    text: "Worth every coin. The color grade is unreal.",
    likeCount: 33,
    replyCount: 0,
    createdAt: "2026-07-01T22:40:00Z"
  },
  {
    id: "comment_006",
    videoId: "video_003",
    authorId: "user_104",
    authorHandle: "buildlog",
    authorDisplayName: "Build Log",
    isCreator: false,
    isSubscriber: true,
    text: "This is the clearest breakdown I have seen.",
    likeCount: 52,
    replyCount: 0,
    createdAt: "2026-07-01T18:05:00Z"
  }
];

export const mockNotifications: AppNotification[] = [
  {
    id: "notif_001",
    type: "new_follower",
    title: "New follower",
    body: "@lenafilms started following you.",
    isRead: false,
    createdAt: "2026-07-02T11:40:00Z"
  },
  {
    id: "notif_002",
    type: "coin_received",
    title: "Coins received",
    body: "@nightdrive sent you 100 coins.",
    isRead: false,
    createdAt: "2026-07-02T10:55:00Z"
  },
  {
    id: "notif_003",
    type: "new_comment",
    title: "New comment",
    body: "Riven Atlas commented: \u201cThe transition at the end is so clean.\u201d",
    isRead: false,
    createdAt: "2026-07-02T10:12:00Z"
  },
  {
    id: "notif_004",
    type: "creator_new_video",
    title: "New video from Maya North",
    body: "\u201cA quick moment from tonight\u2019s session.\u201d is live now.",
    isRead: true,
    createdAt: "2026-07-02T09:00:00Z"
  },
  {
    id: "notif_005",
    type: "subscription_active",
    title: "Subscription active",
    body: "Your Creator Plus membership for @maya renewed.",
    isRead: true,
    createdAt: "2026-07-01T08:00:00Z"
  },
  {
    id: "notif_006",
    type: "system_notice",
    title: "Welcome to Vuqiro",
    body: "Discover creators and support what you love.",
    isRead: true,
    createdAt: "2026-06-30T12:00:00Z"
  }
];
