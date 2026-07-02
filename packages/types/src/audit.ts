import type { ID } from "./user";

export type AuditLogAction =
  | "user_suspend"
  | "user_ban"
  | "user_restore"
  | "creator_verify"
  | "creator_unverify"
  | "monetization_disable"
  | "monetization_enable"
  | "content_remove"
  | "content_restore"
  | "content_limit"
  | "content_age_restrict"
  | "payout_hold"
  | "payout_release"
  | "payout_create"
  | "package_publish"
  | "package_retire"
  | "price_version_create"
  | "feature_flag_change"
  | "legal_document_publish"
  | "wallet_adjustment"
  | "admin_login"
  | "settings_change";

export type AuditLogEntry = {
  id: ID;
  actorId: ID;
  actorRole: string;
  action: AuditLogAction;
  targetType: string;
  targetId: string;
  summary: string;
  metadata?: Record<string, string | number | boolean>;
  createdAt: string;
};
