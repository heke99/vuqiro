import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  CreateDirectUploadParams,
  DirectUpload,
  ProviderVideoAsset,
  VideoAssetStatus,
  VideoProvider,
  VideoWebhookVerification
} from "./videoProvider";

const MUX_API_BASE = "https://api.mux.com";

export type MuxProviderConfig = {
  tokenId: string;
  tokenSecret: string;
  webhookSecret?: string;
  /** CORS origin allowed to upload (mobile uses none). */
  uploadOrigin?: string;
};

type MuxUploadResponse = {
  data: {
    id: string;
    url: string;
    timeout: number;
    status: string;
  };
};

type MuxAssetResponse = {
  data: {
    id: string;
    status: "preparing" | "ready" | "errored";
    duration?: number;
    aspect_ratio?: string;
    playback_ids?: { id: string; policy: string }[];
    errors?: { messages?: string[] };
  };
};

function mapStatus(muxStatus: string): VideoAssetStatus {
  switch (muxStatus) {
    case "preparing":
      return "processing";
    case "ready":
      return "ready";
    case "errored":
      return "errored";
    default:
      return "processing";
  }
}

/**
 * Mux implementation of the Vuqiro VideoProvider.
 * Uses the REST API directly (no SDK) to keep the dependency surface small.
 */
export class MuxVideoProvider implements VideoProvider {
  readonly name = "mux" as const;

  constructor(private readonly config: MuxProviderConfig) {}

  private get authHeader(): string {
    return `Basic ${Buffer.from(`${this.config.tokenId}:${this.config.tokenSecret}`).toString("base64")}`;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${MUX_API_BASE}${path}`, {
      ...init,
      headers: {
        authorization: this.authHeader,
        "content-type": "application/json",
        ...(init.headers ?? {})
      }
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Mux API ${init.method ?? "GET"} ${path} failed (${response.status}): ${body}`);
    }
    return (await response.json()) as T;
  }

  async createDirectUpload(params: CreateDirectUploadParams): Promise<DirectUpload> {
    const body = {
      cors_origin: this.config.uploadOrigin ?? "*",
      new_asset_settings: {
        playback_policy: ["public"],
        passthrough: params.videoId,
        video_quality: "basic"
      }
    };
    const result = await this.request<MuxUploadResponse>("/video/v1/uploads", {
      method: "POST",
      body: JSON.stringify(body)
    });
    return {
      uploadId: result.data.id,
      uploadUrl: result.data.url,
      expiresAt: new Date(Date.now() + result.data.timeout * 1000).toISOString()
    };
  }

  async getAsset(assetId: string): Promise<ProviderVideoAsset> {
    const result = await this.request<MuxAssetResponse>(`/video/v1/assets/${assetId}`);
    const playbackId = result.data.playback_ids?.find((candidate) => candidate.policy === "public")?.id;
    return {
      assetId: result.data.id,
      status: mapStatus(result.data.status),
      playbackUrl: playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : undefined,
      thumbnailUrl: playbackId ? `https://image.mux.com/${playbackId}/thumbnail.jpg?time=1` : undefined,
      durationSeconds: result.data.duration,
      aspectRatio: result.data.aspect_ratio,
      errorMessage: result.data.errors?.messages?.join("; ")
    };
  }

  async deleteAsset(assetId: string): Promise<void> {
    await this.request(`/video/v1/assets/${assetId}`, { method: "DELETE" });
  }

  /**
   * Verifies the `mux-signature` header: `t=<timestamp>,v1=<hmac>` where the
   * HMAC-SHA256 is computed over `<timestamp>.<rawBody>` with the webhook
   * signing secret.
   */
  verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined): VideoWebhookVerification {
    if (!this.config.webhookSecret) {
      return { valid: false, reason: "VIDEO_WEBHOOK_SECRET not configured" };
    }
    if (!signatureHeader) {
      return { valid: false, reason: "Missing mux-signature header" };
    }
    const parts = new Map(
      signatureHeader.split(",").map((part) => {
        const [key, ...rest] = part.trim().split("=");
        return [key, rest.join("=")] as const;
      })
    );
    const timestamp = parts.get("t");
    const signature = parts.get("v1");
    if (!timestamp || !signature) {
      return { valid: false, reason: "Malformed mux-signature header" };
    }
    // Reject events older than 5 minutes (replay protection).
    const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!Number.isFinite(ageSeconds) || ageSeconds > 300) {
      return { valid: false, reason: "Stale webhook timestamp" };
    }
    const expected = createHmac("sha256", this.config.webhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest("hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    const actualBuffer = Buffer.from(signature, "hex");
    if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
      return { valid: false, reason: "Signature mismatch" };
    }
    return { valid: true };
  }
}
