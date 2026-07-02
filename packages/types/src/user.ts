export type ID = string;

export type UserRole = "user" | "creator" | "moderator" | "admin" | "platform_superadmin";

export type UserStatus = "active" | "suspended" | "banned" | "deletion_requested" | "deleted";

export type User = {
  id: ID;
  handle: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  role: UserRole;
  status: UserStatus;
  isCreator: boolean;
  followerCount: number;
  followingCount: number;
  subscriptionCount: number;
  walletBalance: number;
  reportsMade: number;
  reportsAgainst: number;
  blockedCount: number;
  createdAt: string;
  lastActiveAt: string;
};

export type AccountDeletionRequest = {
  id: ID;
  userId: ID;
  reason?: string;
  status: "requested" | "cancelled" | "processing" | "completed";
  requestedAt: string;
  completeBy: string;
};
