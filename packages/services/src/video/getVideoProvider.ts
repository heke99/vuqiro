import { loadEnv } from "@vuqiro/config";
import { MockVideoProvider } from "./mockVideoProvider";
import { MuxVideoProvider } from "./muxVideoProvider";
import type { VideoProvider } from "./videoProvider";

let cached: VideoProvider | null = null;

/**
 * Returns the configured video provider. Mux activates when
 * VIDEO_PROVIDER=mux and API credentials exist; otherwise the mock provider
 * keeps the whole pipeline working locally.
 */
export function getVideoProvider(): VideoProvider {
  if (cached) return cached;
  const env = loadEnv();
  if (env.videoProvider === "mux" && env.videoProviderApiKey && env.videoProviderApiSecret) {
    cached = new MuxVideoProvider({
      tokenId: env.videoProviderApiKey,
      tokenSecret: env.videoProviderApiSecret,
      webhookSecret: env.videoWebhookSecret
    });
  } else {
    cached = new MockVideoProvider();
  }
  return cached;
}

export function resetVideoProviderCache(): void {
  cached = null;
}
