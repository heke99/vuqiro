import type { AdminDashboardMetrics, AdminUser, FeatureFlag, FraudSignal, User } from "@vuqiro/types";

export const mockAdminIdentity: AdminUser = {
  id: "admin_001",
  email: "superadmin@vuqiro.app",
  displayName: "Superadmin",
  role: "platform_superadmin",
  isActive: true,
  createdAt: "2025-08-01T00:00:00Z"
};

export const mockAdminMetrics: AdminDashboardMetrics = {
  totalUsers: 18240,
  activeUsers: 7420,
  totalCreators: 1240,
  verifiedCreators: 612,
  videosUploaded: 92100,
  videosUnderReview: 42,
  activeSubscriptions: 5600,
  coinRevenue: 24800,
  mrr: 31450,
  pendingPayouts: 11400,
  heldPayouts: 2200,
  reportedContent: 18,
  refunds: 31,
  chargebacks: 4,
  contentRemovals: 57
};

const userSeeds: [id: string, handle: string, name: string, status: User["status"], wallet: number, subs: number, made: number, against: number, blocked: number][] = [
  ["user_001", "maya", "Maya North", "active", 320, 0, 1, 0, 2],
  ["user_002", "riven", "Riven Atlas", "active", 150, 2, 0, 1, 0],
  ["user_003", "noorbuilds", "Noor Builds", "active", 80, 1, 0, 1, 1],
  ["user_004", "solacooks", "Sola Cooks", "active", 940, 0, 2, 0, 3],
  ["user_005", "kaimoves", "Kai Moves", "active", 210, 1, 0, 0, 0],
  ["user_101", "lenafilms", "Lena Films", "active", 425, 3, 1, 0, 1],
  ["user_102", "kofi.codes", "Kofi Codes", "active", 60, 1, 0, 0, 0],
  ["user_103", "nightdrive", "Night Drive", "active", 1250, 4, 2, 0, 2],
  ["user_104", "buildlog", "Build Log", "active", 90, 2, 0, 0, 0],
  ["user_233", "flashdealz", "Flash Dealz", "suspended", 0, 0, 0, 9, 0],
  ["user_412", "anon4127", "Anon 4127", "banned", 15, 0, 0, 12, 0],
  ["user_509", "quietfan", "Quiet Fan", "deletion_requested", 5, 1, 0, 0, 0]
];

export const mockUsers: User[] = userSeeds.map(
  ([id, handle, displayName, status, walletBalance, subs, reportsMade, reportsAgainst, blockedCount], index) => ({
    id,
    handle,
    displayName,
    email: `${handle.replace(/[^a-z0-9]/gi, "")}@example.com`,
    role: index < 5 ? "creator" : "user",
    status,
    isCreator: index < 5,
    followerCount: index < 5 ? 30000 + index * 21000 : 10 + index * 3,
    followingCount: 40 + index * 7,
    subscriptionCount: subs,
    walletBalance,
    reportsMade,
    reportsAgainst,
    blockedCount,
    createdAt: new Date(Date.UTC(2025, 8 + (index % 4), 1 + index, 9)).toISOString(),
    lastActiveAt: new Date(Date.UTC(2026, 6, 1, 6 + (index % 14))).toISOString()
  })
);

export const mockFeatureFlags: FeatureFlag[] = [
  { key: "boost_purchases", description: "Allow buying video boosts", enabled: false, environment: "production", updatedAt: "2026-06-25T10:00:00Z", updatedBy: "admin_001" },
  { key: "coin_tips", description: "Allow sending coin tips to creators", enabled: true, environment: "all", updatedAt: "2026-06-01T10:00:00Z", updatedBy: "admin_001" },
  { key: "creator_subscriptions", description: "Creator subscription purchases", enabled: true, environment: "all", updatedAt: "2026-06-01T10:00:00Z", updatedBy: "admin_001" },
  { key: "video_upload", description: "Allow video uploads", enabled: true, environment: "all", updatedAt: "2026-05-15T10:00:00Z", updatedBy: "admin_001" },
  { key: "new_user_signup", description: "Allow new account creation", enabled: true, environment: "all", updatedAt: "2026-05-15T10:00:00Z", updatedBy: "admin_001" },
  { key: "premium_feed", description: "Show premium discovery rail", enabled: true, environment: "development", updatedAt: "2026-06-28T10:00:00Z", updatedBy: "admin_001" }
];

export const mockFraudSignals: FraudSignal[] = [
  { id: "fraud_001", type: "repeated_reports", severity: "high", targetType: "creator", targetId: "creator_008", summary: "6 scam reports in 72 hours from distinct users.", status: "reviewing", createdAt: "2026-06-29T08:00:00Z" },
  { id: "fraud_002", type: "suspicious_wallet_activity", severity: "medium", targetType: "user", targetId: "user_103", summary: "Rapid purchase-refund-purchase pattern across 3 packs.", status: "open", createdAt: "2026-06-28T14:00:00Z" },
  { id: "fraud_003", type: "rapid_uploads", severity: "low", targetType: "creator", targetId: "creator_009", summary: "14 uploads in one hour; content near-duplicate.", status: "open", createdAt: "2026-06-27T21:00:00Z" },
  { id: "fraud_004", type: "engagement_anomaly", severity: "medium", targetType: "video", targetId: "video_015", summary: "Like velocity 40x baseline with low watch time.", status: "dismissed", createdAt: "2026-06-25T10:00:00Z" },
  { id: "fraud_005", type: "chargeback_risk", severity: "high", targetType: "user", targetId: "user_233", summary: "2 chargebacks in 30 days.", status: "actioned", createdAt: "2026-06-20T16:00:00Z" }
];

