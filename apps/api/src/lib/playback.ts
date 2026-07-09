import { loadEnv } from "@vuqiro/config";
import { signPlaybackUrl, signThumbnailUrl, type PlaybackSigningConfig } from "@vuqiro/services";

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

/** True when Mux playback signing keys are configured. Gated uploads only
 * request a signed playback policy when the API can actually issue tokens. */
export function hasPlaybackSigning(): boolean {
  return getSigningConfig() !== null;
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

/** Signs Mux thumbnail URLs (aud "t") when signing keys are configured, so
 * poster frames of signed-policy assets stay protected like their streams. */
export function prepareThumbnailUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const config = getSigningConfig();
  if (!config) return url;
  try {
    return signThumbnailUrl(url, config);
  } catch {
    return url;
  }
}

export function resetPlaybackSigningCache(): void {
  signingConfig = undefined;
}
