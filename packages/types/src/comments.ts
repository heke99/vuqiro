import type { ID } from "./user";
import type { ModerationStatus } from "./moderation";

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
  reportCount?: number;
  moderationStatus?: ModerationStatus;
  parentCommentId?: ID;
  createdAt: string;
};
