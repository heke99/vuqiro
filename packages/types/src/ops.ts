import type { AdminRole } from "./admin";
import type { ID } from "./user";

export type PlatformSetting = {
  key: string;
  value: Record<string, unknown>;
  description: string;
  updatedAt: string;
};

export type AdminInvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export type AdminInvitation = {
  id: ID;
  email: string;
  role: AdminRole;
  status: AdminInvitationStatus;
  invitedBy: ID;
  expiresAt: string;
  createdAt: string;
};

export type IntegrationHealthStatus = "ok" | "degraded" | "down" | "unconfigured" | "mock";

export type IntegrationHealthCheck = {
  id: ID;
  provider: "supabase" | "video" | "payments" | "payouts" | "push" | "sentry" | "api";
  status: IntegrationHealthStatus;
  message: string;
  checkedAt: string;
};

export type SupportCaseStatus = "open" | "pending" | "resolved" | "closed";

export type SupportCase = {
  id: ID;
  profileId?: ID;
  email: string;
  subject: string;
  body: string;
  status: SupportCaseStatus;
  priority: "low" | "medium" | "high" | "urgent";
  assignedTo?: ID;
  createdAt: string;
};

export type AppealStatus = "open" | "under_review" | "approved" | "rejected";

export type Appeal = {
  id: ID;
  profileId: ID;
  caseId?: ID;
  targetType: "video" | "comment" | "profile" | "creator" | "ad";
  targetId: ID;
  message: string;
  status: AppealStatus;
  decisionNote?: string;
  createdAt: string;
};

export type CopyrightClaimStatus =
  | "submitted"
  | "reviewing"
  | "accepted"
  | "rejected"
  | "counter_claimed"
  | "withdrawn";

export type CopyrightClaim = {
  id: ID;
  claimantName: string;
  claimantEmail: string;
  claimantOrganization: string;
  targetVideoId: ID;
  description: string;
  originalWorkUrl?: string;
  status: CopyrightClaimStatus;
  createdAt: string;
};
