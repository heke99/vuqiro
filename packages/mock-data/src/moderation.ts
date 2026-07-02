import type { ModerationCase, Report } from "@vuqiro/types";

export const mockModerationCases: ModerationCase[] = [
  { id: "mod_001", targetType: "video", targetId: "video_002", reason: "copyright", status: "reviewing", priority: "medium", reportCount: 3, assignedTo: "admin_001", createdAt: "2026-07-02T08:00:00Z" },
  { id: "mod_002", targetType: "profile", targetId: "creator_003", reason: "spam", status: "open", priority: "low", reportCount: 1, createdAt: "2026-07-01T15:00:00Z" },
  { id: "mod_003", targetType: "comment", targetId: "comment_025", reason: "harassment", status: "open", priority: "medium", reportCount: 2, createdAt: "2026-07-01T12:00:00Z" },
  { id: "mod_004", targetType: "video", targetId: "video_013", reason: "misinformation", status: "resolved", priority: "low", reportCount: 1, resolvedAction: "no_action", resolvedAt: "2026-06-30T10:00:00Z", createdAt: "2026-06-29T09:00:00Z" },
  { id: "mod_005", targetType: "creator", targetId: "creator_008", reason: "scam", status: "reviewing", priority: "high", reportCount: 6, assignedTo: "admin_001", createdAt: "2026-06-28T14:00:00Z" },
  { id: "mod_006", targetType: "video", targetId: "video_016", reason: "violence", status: "resolved", priority: "medium", reportCount: 2, resolvedAction: "age_restrict", resolvedAt: "2026-06-27T11:00:00Z", createdAt: "2026-06-26T16:00:00Z" },
  { id: "mod_007", targetType: "comment", targetId: "comment_012", reason: "hate", status: "resolved", priority: "high", reportCount: 4, resolvedAction: "remove_content", resolvedAt: "2026-06-25T13:00:00Z", createdAt: "2026-06-25T09:00:00Z" },
  { id: "mod_008", targetType: "video", targetId: "video_021", reason: "minor_safety", status: "appealed", priority: "critical", reportCount: 1, resolvedAction: "remove_content", resolvedAt: "2026-06-23T10:00:00Z", createdAt: "2026-06-22T19:00:00Z" }
];

const reportSeeds: [id: string, targetType: Report["targetType"], targetId: string, reason: Report["reason"], status: Report["status"], caseId?: string][] = [
  ["report_001", "video", "video_002", "copyright", "attached_to_case", "mod_001"],
  ["report_002", "video", "video_002", "copyright", "attached_to_case", "mod_001"],
  ["report_003", "video", "video_002", "other", "attached_to_case", "mod_001"],
  ["report_004", "profile", "creator_003", "spam", "attached_to_case", "mod_002"],
  ["report_005", "comment", "comment_025", "harassment", "attached_to_case", "mod_003"],
  ["report_006", "comment", "comment_025", "harassment", "attached_to_case", "mod_003"],
  ["report_007", "video", "video_013", "misinformation", "attached_to_case", "mod_004"],
  ["report_008", "creator", "creator_008", "scam", "attached_to_case", "mod_005"],
  ["report_009", "creator", "creator_008", "scam", "attached_to_case", "mod_005"],
  ["report_010", "creator", "creator_008", "scam", "attached_to_case", "mod_005"],
  ["report_011", "video", "video_016", "violence", "attached_to_case", "mod_006"],
  ["report_012", "video", "video_016", "violence", "attached_to_case", "mod_006"],
  ["report_013", "comment", "comment_012", "hate", "attached_to_case", "mod_007"],
  ["report_014", "comment", "comment_012", "hate", "attached_to_case", "mod_007"],
  ["report_015", "video", "video_021", "minor_safety", "attached_to_case", "mod_008"],
  ["report_016", "video", "video_005", "spam", "submitted"],
  ["report_017", "video", "video_017", "other", "dismissed"],
  ["report_018", "profile", "creator_009", "spam", "submitted"],
  ["report_019", "comment", "comment_040", "harassment", "submitted"],
  ["report_020", "video", "video_024", "sexual_content", "dismissed"]
];

export const mockReports: Report[] = reportSeeds.map(([id, targetType, targetId, reason, status, moderationCaseId], index) => ({
  id,
  reporterId: `user_${100 + index}`,
  targetType,
  targetId,
  reason,
  status,
  moderationCaseId,
  createdAt: new Date(Date.UTC(2026, 5, 20 + (index % 12), 9 + (index % 10))).toISOString()
}));
