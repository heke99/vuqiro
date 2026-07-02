import type { ID } from "./user";

export type LegalDocumentType =
  | "terms"
  | "privacy"
  | "community_guidelines"
  | "creator_terms"
  | "payout_terms"
  | "copyright_takedown"
  | "refund_policy";

export type LegalDocument = {
  id: ID;
  type: LegalDocumentType;
  version: number;
  title: string;
  status: "draft" | "published" | "archived";
  publishedAt?: string;
  createdAt: string;
};

export type LegalAcceptance = {
  id: ID;
  userId: ID;
  documentId: ID;
  documentType: LegalDocumentType;
  documentVersion: number;
  acceptedAt: string;
};
