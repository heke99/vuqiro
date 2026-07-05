import { useEffect, useState } from "react";
import { apiFetch, isApiConfigured } from "../api/client";

/**
 * Client-safe feature flags fetched from GET /feature-flags. Defaults are
 * used until the API responds (or when the API is not configured) so the
 * app never blocks on flag resolution.
 */
export type ClientFeatureFlags = {
  videoUpload: boolean;
  newUserSignup: boolean;
  coinTips: boolean;
  creatorSubscriptions: boolean;
  boostPurchases: boolean;
};

export const DEFAULT_FLAGS: ClientFeatureFlags = {
  videoUpload: true,
  newUserSignup: true,
  coinTips: true,
  creatorSubscriptions: true,
  boostPurchases: false
};

const FLAG_KEYS: Record<string, keyof ClientFeatureFlags> = {
  video_upload: "videoUpload",
  new_user_signup: "newUserSignup",
  coin_tips: "coinTips",
  creator_subscriptions: "creatorSubscriptions",
  boost_purchases: "boostPurchases"
};

let cachedFlags: ClientFeatureFlags | null = null;

export async function fetchFeatureFlags(): Promise<ClientFeatureFlags> {
  if (cachedFlags) return cachedFlags;
  if (!isApiConfigured()) return DEFAULT_FLAGS;
  try {
    const response = await apiFetch<{ flags: { key: string; enabled: boolean }[] }>("/feature-flags");
    const flags = { ...DEFAULT_FLAGS };
    for (const flag of response.flags) {
      const mapped = FLAG_KEYS[flag.key];
      if (mapped) flags[mapped] = flag.enabled;
    }
    cachedFlags = flags;
    return flags;
  } catch {
    return DEFAULT_FLAGS;
  }
}

export function resetFeatureFlagCache(): void {
  cachedFlags = null;
}

export function useFeatureFlags(): ClientFeatureFlags {
  const [flags, setFlags] = useState<ClientFeatureFlags>(cachedFlags ?? DEFAULT_FLAGS);
  useEffect(() => {
    let active = true;
    void fetchFeatureFlags().then((resolved) => {
      if (active) setFlags(resolved);
    });
    return () => {
      active = false;
    };
  }, []);
  return flags;
}
