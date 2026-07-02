import type { ID } from "./user";

export type AdminRole = "platform_superadmin" | "admin" | "moderator" | "finance" | "support";

export type AdminUser = {
  id: ID;
  email: string;
  displayName: string;
  role: AdminRole;
  isActive: boolean;
  createdAt: string;
};

export type FeatureFlag = {
  key: string;
  description: string;
  enabled: boolean;
  environment: "all" | "development" | "preview" | "production";
  updatedAt: string;
  updatedBy?: ID;
};

export type AdminDashboardMetrics = {
  totalUsers: number;
  activeUsers: number;
  totalCreators: number;
  verifiedCreators: number;
  videosUploaded: number;
  videosUnderReview: number;
  activeSubscriptions: number;
  coinRevenue: number;
  mrr: number;
  pendingPayouts: number;
  heldPayouts: number;
  reportedContent: number;
  refunds: number;
  chargebacks: number;
  contentRemovals: number;
};

export type FraudSignal = {
  id: ID;
  type:
    | "repeated_reports"
    | "suspicious_wallet_activity"
    | "rapid_uploads"
    | "engagement_anomaly"
    | "chargeback_risk"
    | "multi_account";
  severity: "low" | "medium" | "high";
  targetType: "user" | "creator" | "video";
  targetId: ID;
  summary: string;
  status: "open" | "reviewing" | "dismissed" | "actioned";
  createdAt: string;
};

export type ReadinessItem = {
  id: string;
  category: "app_store" | "google_play" | "payments" | "moderation" | "legal" | "backend";
  label: string;
  status: "todo" | "in_progress" | "blocked_external" | "done";
  note?: string;
};
