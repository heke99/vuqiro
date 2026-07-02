export type ModerationStatus =
  | "visible"
  | "limited"
  | "under_review"
  | "removed"
  | "blocked"
  | "age_restricted"
  | "payout_hold";

export type ReportReason =
  | "harassment"
  | "hate"
  | "violence"
  | "sexual_content"
  | "minor_safety"
  | "spam"
  | "scam"
  | "copyright"
  | "misinformation"
  | "other";

export type ModerationAction =
  | "no_action"
  | "limit_distribution"
  | "remove_content"
  | "suspend_user"
  | "ban_user"
  | "hold_payout"
  | "release_payout"
  | "restore_content";

export type ModerationCase = {
  id: string;
  targetType: "video" | "comment" | "profile" | "creator";
  targetId: string;
  reason: ReportReason;
  status: "open" | "reviewing" | "resolved" | "appealed";
  priority: "low" | "medium" | "high" | "critical";
  createdAt: string;
};
