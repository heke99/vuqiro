/**
 * Video provider adapter contract.
 *
 * Vuqiro uses a managed video provider (Mux first) behind this interface so
 * the product can run with a mock implementation before credentials exist,
 * and switch providers without touching product code.
 */
import type { ProviderHealth } from "../health/providerHealth";

export type VideoAssetStatus =
  | "waiting_for_upload"
  | "processing"
  | "ready"
  | "errored"
  | "deleted";

export interface CreateDirectUploadParams {
  /** Vuqiro video id — round-tripped through provider metadata/passthrough. */
  videoId: string;
  creatorId: string;
  maxDurationSeconds: number;
  /**
   * Provider playback policy for the new asset. Non-public (members-only,
   * followers-only, coin-unlock, private) videos should use "signed" so a
   * leaked stream URL is unplayable without a server-issued token. Defaults
   * to "public".
   */
  playbackPolicy?: "public" | "signed";
}

export interface DirectUpload {
  uploadId: string;
  uploadUrl: string;
  expiresAt: string;
}

export interface ProviderVideoAsset {
  assetId: string;
  status: VideoAssetStatus;
  playbackUrl?: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  aspectRatio?: string;
  errorMessage?: string;
}

export interface VideoWebhookVerification {
  valid: boolean;
  reason?: string;
}

export interface VideoProvider {
  readonly name: "mux" | "mock";
  createDirectUpload(params: CreateDirectUploadParams): Promise<DirectUpload>;
  getAsset(assetId: string): Promise<ProviderVideoAsset>;
  deleteAsset(assetId: string): Promise<void>;
  /** Verify a webhook signature before trusting the payload. */
  verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined): VideoWebhookVerification;
  healthCheck(): Promise<ProviderHealth>;
}
