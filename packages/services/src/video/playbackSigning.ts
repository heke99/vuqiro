import { createSign } from "node:crypto";

/**
 * Mux signed playback tokens (RS256 JWT, https://docs.mux.com/guides/secure-video-playback).
 *
 * Playback URLs are stored unsigned (`https://stream.mux.com/{id}.m3u8`);
 * when signing keys are configured the API appends a short-lived token at
 * response time, so leaked URLs expire. Without keys this module is a no-op
 * (public playback policy).
 */

export type PlaybackSigningConfig = {
  /** Mux signing key id (from the Mux dashboard, not the API token). */
  keyId: string;
  /** Base64-encoded RSA private key PEM as issued by Mux. */
  privateKeyBase64: string;
  /** Token lifetime in seconds (default 6h — long enough for a session). */
  ttlSeconds?: number;
};

const MUX_STREAM_RE = /^https:\/\/stream\.mux\.com\/([A-Za-z0-9]+)\.m3u8/;
const MUX_IMAGE_RE = /^https:\/\/image\.mux\.com\/([A-Za-z0-9]+)\/(thumbnail\.[a-z]+)(\?([^#]*))?/;

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

/** Mux token audiences: "v" = video playback, "t" = thumbnails. */
export type MuxTokenAudience = "v" | "t";

export function signMuxPlaybackToken(
  playbackId: string,
  config: PlaybackSigningConfig,
  audience: MuxTokenAudience = "v",
  extraClaims: Record<string, string> = {}
): string {
  const privateKeyPem = Buffer.from(config.privateKeyBase64, "base64").toString("utf8");
  const header = { alg: "RS256", typ: "JWT", kid: config.keyId };
  const payload = {
    ...extraClaims,
    sub: playbackId,
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + (config.ttlSeconds ?? 6 * 3600)
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = createSign("RSA-SHA256").update(signingInput).sign(privateKeyPem);
  return `${signingInput}.${base64url(signature)}`;
}

/**
 * Returns a signed variant of a Mux stream URL, or the original URL when it
 * is not a Mux stream URL (mock providers, external sources).
 */
export function signPlaybackUrl(url: string, config: PlaybackSigningConfig): string {
  const match = MUX_STREAM_RE.exec(url);
  if (!match) return url;
  const token = signMuxPlaybackToken(match[1], config);
  return `https://stream.mux.com/${match[1]}.m3u8?token=${token}`;
}

/**
 * Returns a signed variant of a Mux thumbnail URL (aud "t"), or the original
 * URL when it is not a Mux image URL. Thumbnails of signed-policy assets are
 * unavailable without such a token, so private/members-only poster frames
 * stay protected alongside their streams.
 */
export function signThumbnailUrl(url: string, config: PlaybackSigningConfig): string {
  const match = MUX_IMAGE_RE.exec(url);
  if (!match) return url;
  const [, playbackId, file, , existingQuery] = match;
  // Mux signed image requests carry rendering params (e.g. time) inside the
  // token claims; the URL itself must only contain the token.
  const claims: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(existingQuery ?? "")) {
    if (key !== "token") claims[key] = value;
  }
  const token = signMuxPlaybackToken(playbackId, config, "t", claims);
  return `https://image.mux.com/${playbackId}/${file}?token=${token}`;
}
