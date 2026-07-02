import type {
  CreateDirectUploadParams,
  DirectUpload,
  ProviderVideoAsset,
  VideoProvider,
  VideoWebhookVerification
} from "./videoProvider";

/**
 * In-memory video provider used in development and tests when no managed
 * provider credentials are configured. Assets become "ready" immediately with
 * a public sample HLS stream so the feed can play real video in dev.
 */
export class MockVideoProvider implements VideoProvider {
  readonly name = "mock" as const;
  private assets = new Map<string, ProviderVideoAsset>();

  async createDirectUpload(params: CreateDirectUploadParams): Promise<DirectUpload> {
    const uploadId = `mock-upload-${params.videoId}`;
    this.assets.set(uploadId, {
      assetId: uploadId,
      status: "ready",
      playbackUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
      thumbnailUrl: undefined,
      durationSeconds: 30,
      aspectRatio: "9:16"
    });
    return {
      uploadId,
      uploadUrl: `https://mock.vuqiro.local/upload/${uploadId}`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
    };
  }

  async getAsset(assetId: string): Promise<ProviderVideoAsset> {
    const asset = this.assets.get(assetId);
    if (!asset) {
      return { assetId, status: "errored", errorMessage: "Unknown mock asset" };
    }
    return asset;
  }

  async deleteAsset(assetId: string): Promise<void> {
    const asset = this.assets.get(assetId);
    if (asset) {
      this.assets.set(assetId, { ...asset, status: "deleted", playbackUrl: undefined });
    }
  }

  verifyWebhookSignature(_rawBody: string, _signatureHeader: string | undefined): VideoWebhookVerification {
    // Mock provider trusts local webhooks; the real provider must verify.
    return { valid: true };
  }
}
