import { loadEnv } from "@vuqiro/config";
import { signPlaybackUrl, type PlaybackSigningConfig } from "@vuqiro/services";

/**
 * Response-time playback URL signing. When Mux signing keys are configured,
 * every playback URL leaving the API carries a short-lived token; otherwise
 * URLs pass through unchanged (public playback policy).
 */

let signingConfig: PlaybackSigningConfig | null | undefined;

function getSigningConfig(): PlaybackSigningConfig | null {
  if (signingConfig !== undefined) return signingConfig;
  const env = loadEnv();
  signingConfig =
    env.muxSigningKeyId && env.muxSigningPrivateKey
      ? { keyId: env.muxSigningKeyId, privateKeyBase64: env.muxSigningPrivateKey }
      : null;
  return signingConfig;
}

export function preparePlaybackUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const config = getSigningConfig();
  if (!config) return url;
  try {
    return signPlaybackUrl(url, config);
  } catch {
    // A signing failure must not break playback for public-policy assets.
    return url;
  }
}

export function resetPlaybackSigningCache(): void {
  signingConfig = undefined;
}
