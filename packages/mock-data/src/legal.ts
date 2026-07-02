import type { LegalAcceptance, LegalDocument } from "@vuqiro/types";

export const mockLegalDocuments: LegalDocument[] = [
  { id: "legal_terms_2", type: "terms", version: 2, title: "Terms of Service", status: "published", publishedAt: "2026-06-15T00:00:00Z", createdAt: "2026-06-10T00:00:00Z" },
  { id: "legal_terms_1", type: "terms", version: 1, title: "Terms of Service", status: "archived", publishedAt: "2025-09-01T00:00:00Z", createdAt: "2025-08-20T00:00:00Z" },
  { id: "legal_privacy_1", type: "privacy", version: 1, title: "Privacy Policy", status: "published", publishedAt: "2025-09-01T00:00:00Z", createdAt: "2025-08-20T00:00:00Z" },
  { id: "legal_guidelines_1", type: "community_guidelines", version: 1, title: "Community Guidelines", status: "published", publishedAt: "2025-09-01T00:00:00Z", createdAt: "2025-08-20T00:00:00Z" },
  { id: "legal_creator_1", type: "creator_terms", version: 1, title: "Creator Terms", status: "published", publishedAt: "2025-10-01T00:00:00Z", createdAt: "2025-09-15T00:00:00Z" },
  { id: "legal_payout_1", type: "payout_terms", version: 1, title: "Payout Terms", status: "published", publishedAt: "2025-10-01T00:00:00Z", createdAt: "2025-09-15T00:00:00Z" },
  { id: "legal_copyright_1", type: "copyright_takedown", version: 1, title: "Copyright & Takedown Policy", status: "draft", createdAt: "2026-06-01T00:00:00Z" },
  { id: "legal_refund_1", type: "refund_policy", version: 1, title: "Refund Policy", status: "draft", createdAt: "2026-06-01T00:00:00Z" }
];

export const mockLegalAcceptances: LegalAcceptance[] = [
  { id: "accept_001", userId: "user_me", documentId: "legal_terms_2", documentType: "terms", documentVersion: 2, acceptedAt: "2026-06-16T09:00:00Z" },
  { id: "accept_002", userId: "user_me", documentId: "legal_privacy_1", documentType: "privacy", documentVersion: 1, acceptedAt: "2026-06-16T09:00:00Z" },
  { id: "accept_003", userId: "user_001", documentId: "legal_creator_1", documentType: "creator_terms", documentVersion: 1, acceptedAt: "2025-10-02T10:00:00Z" },
  { id: "accept_004", userId: "user_001", documentId: "legal_payout_1", documentType: "payout_terms", documentVersion: 1, acceptedAt: "2025-10-02T10:05:00Z" }
];
