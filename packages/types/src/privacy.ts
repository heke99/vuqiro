import type { ID } from "./user";

export type PrivacyRequestType = "access" | "export" | "correction" | "restriction" | "objection" | "deletion";
export type PrivacyRequestStatus = "submitted" | "processing" | "completed" | "rejected";

export type PrivacyRequest = {
  id: ID;
  profileId: ID;
  type: PrivacyRequestType;
  details?: string;
  status: PrivacyRequestStatus;
  createdAt: string;
};

export type DataExportStatus = "requested" | "processing" | "ready" | "delivered" | "failed" | "expired";

export type DataExport = {
  id: ID;
  profileId: ID;
  privacyRequestId?: ID;
  status: DataExportStatus;
  fileUrl?: string;
  expiresAt?: string;
  createdAt: string;
};

export type ConsentType =
  | "terms"
  | "privacy"
  | "community_guidelines"
  | "creator_terms"
  | "payout_terms"
  | "personalized_ads"
  | "analytics"
  | "notifications"
  | "marketing";

export type ConsentEvent = {
  id: ID;
  profileId: ID;
  consentType: ConsentType;
  granted: boolean;
  source: "onboarding" | "settings" | "forced_reacceptance" | "signup";
  createdAt: string;
};

export type ProfileSettings = {
  profileId: ID;
  privacyLevel: "public" | "followers" | "private";
  commentPermission: "everyone" | "followers" | "no_one";
  messagePermission: "everyone" | "followers" | "no_one";
  likedVideosVisibility: "public" | "private";
  analyticsOptIn: boolean;
  personalizedAdsOptIn: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
};

export type UserSafetySettings = {
  profileId: ID;
  restrictedMode: boolean;
  commentFilterLevel: "off" | "standard" | "strict";
  blockedKeywords: string[];
  whoCanMessage: "everyone" | "followers" | "no_one";
  whoCanMention: "everyone" | "followers" | "no_one";
};
