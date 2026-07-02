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
  | "age_restrict"
  | "suspend_user"
  | "ban_user"
  | "hold_payout"
  | "release_payout"
  | "restore_content";

export type ModerationTargetType = "video" | "comment" | "profile" | "creator";

export type ModerationCaseStatus = "open" | "reviewing" | "resolved" | "appealed";

export type ModerationPriority = "low" | "medium" | "high" | "critical";

export type ModerationCase = {
  id: string;
  targetType: ModerationTargetType;
  targetId: string;
  reason: ReportReason;
  status: ModerationCaseStatus;
  priority: ModerationPriority;
  reportCount?: number;
  reporterId?: string;
  assignedTo?: string;
  resolvedAction?: ModerationAction;
  resolvedAt?: string;
  createdAt: string;
};

export type Report = {
  id: string;
  reporterId: string;
  targetType: ModerationTargetType;
  targetId: string;
  reason: ReportReason;
  details?: string;
  status: "submitted" | "attached_to_case" | "dismissed";
  moderationCaseId?: string;
  createdAt: string;
};

export type Block = {
  id: string;
  blockerId: string;
  blockedUserId: string;
  createdAt: string;
};

export type ModerationDecision = {
  id: string;
  caseId: string;
  action: ModerationAction;
  actorId: string;
  note?: string;
  createdAt: string;
};
