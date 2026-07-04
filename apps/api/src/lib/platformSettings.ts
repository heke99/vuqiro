import { getServiceDb, isBackendConfigured } from "./supabase";

/**
 * Platform settings with safe defaults. Stored as jsonb rows in
 * `platform_settings`; admins edit them from the console. Reads are cached
 * briefly so the feed does not hit the settings table on every request.
 */

export type FeedSettings = {
  /** Insert one ad after every N organic videos (0 disables ads). */
  adFrequency: number;
  /** Max ads per feed page. */
  maxAdsPerPage: number;
  pageSize: number;
};

export type FeedWeightSettings = {
  recency: number;
  engagement: number;
  completion: number;
  follow: number;
  interest: number;
  boost: number;
  safety: number;
};

export type UploadLimitSettings = {
  maxDurationSeconds: number;
  maxUploadsPerHour: number;
};

export type ModerationThresholdSettings = {
  autoReviewReportCount: number;
  autoHideSafetyScore: number;
};

export const DEFAULT_FEED_SETTINGS: FeedSettings = { adFrequency: 6, maxAdsPerPage: 3, pageSize: 10 };
export const DEFAULT_FEED_WEIGHTS: FeedWeightSettings = {
  recency: 1,
  engagement: 1,
  completion: 1,
  follow: 1,
  interest: 1,
  boost: 1,
  safety: 1
};
export const DEFAULT_UPLOAD_LIMITS: UploadLimitSettings = { maxDurationSeconds: 180, maxUploadsPerHour: 10 };
export const DEFAULT_MODERATION_THRESHOLDS: ModerationThresholdSettings = {
  autoReviewReportCount: 3,
  autoHideSafetyScore: 30
};

export const PLATFORM_SETTING_DEFAULTS: Record<string, Record<string, unknown>> = {
  feed: DEFAULT_FEED_SETTINGS,
  feed_weights: DEFAULT_FEED_WEIGHTS,
  upload_limits: DEFAULT_UPLOAD_LIMITS,
  moderation_thresholds: DEFAULT_MODERATION_THRESHOLDS
};

type CacheEntry = { value: Record<string, unknown>; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30_000;

export async function getPlatformSetting<T extends Record<string, unknown>>(key: string, defaults: T): Promise<T> {
  if (!isBackendConfigured()) return defaults;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...defaults, ...cached.value } as T;
  }
  const db = getServiceDb()!;
  const { data } = await db.from("platform_settings").select("value").eq("key", key).maybeSingle();
  const value = (data?.value ?? {}) as Record<string, unknown>;
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return { ...defaults, ...value } as T;
}

export function resetPlatformSettingsCache(): void {
  cache.clear();
}
