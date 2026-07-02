import type { AuditLogAction, AuditLogEntry } from "@vuqiro/types";

const seeds: [id: string, action: AuditLogAction, targetType: string, targetId: string, summary: string][] = [
  ["audit_001", "admin_login", "admin", "admin_001", "Superadmin signed in"],
  ["audit_002", "creator_verify", "creator", "creator_007", "Verified Vera Codes after identity review"],
  ["audit_003", "payout_hold", "payout", "payout_006", "Held payout for Dune Style pending moderation case mod_005"],
  ["audit_004", "content_remove", "comment", "comment_012", "Removed comment for hate speech (case mod_007)"],
  ["audit_005", "content_age_restrict", "video", "video_016", "Age-restricted speedrun clip (case mod_006)"],
  ["audit_006", "package_publish", "package", "pkg_coins_5000", "Published 5,000 coins pack v1"],
  ["audit_007", "price_version_create", "package_version", "ver_boost_small_1", "Created Small Boost price version"],
  ["audit_008", "payout_release", "payout", "payout_003", "Released June payout for Kai Moves"],
  ["audit_009", "user_suspend", "user", "user_233", "Suspended user for repeated spam reports"],
  ["audit_010", "user_restore", "user", "user_233", "Restored user after appeal"],
  ["audit_011", "feature_flag_change", "feature_flag", "boost_purchases", "Disabled boost purchases in production"],
  ["audit_012", "content_restore", "video", "video_013", "Restored video after misinformation review (no violation)"],
  ["audit_013", "wallet_adjustment", "wallet", "wallet_me", "Issued 50-coin support credit"],
  ["audit_014", "creator_unverify", "creator", "creator_009", "Removed pending verification: docs expired"],
  ["audit_015", "monetization_disable", "creator", "creator_009", "Disabled monetization pending re-verification"],
  ["audit_016", "legal_document_publish", "legal_document", "terms_v2", "Published Terms of Service v2"],
  ["audit_017", "payout_hold", "payout", "payout_008", "Held payout for Lumen Art: Stripe account restricted"],
  ["audit_018", "content_limit", "video", "video_005", "Limited distribution pending spam review"],
  ["audit_019", "settings_change", "app_settings", "upload_limits", "Lowered max upload duration to 180s"],
  ["audit_020", "user_ban", "user", "user_412", "Banned user for minor-safety violation (case mod_008)"]
];

export const mockAuditLogs: AuditLogEntry[] = seeds.map(([id, action, targetType, targetId, summary], index) => ({
  id,
  actorId: "admin_001",
  actorRole: "platform_superadmin",
  action,
  targetType,
  targetId,
  summary,
  createdAt: new Date(Date.UTC(2026, 5, 12 + (index % 20), 8 + (index % 11))).toISOString()
}));
