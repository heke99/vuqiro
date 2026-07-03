import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { apiFetch, isApiConfigured } from "../../services/api/client";

const COMPLETE_KEY = "vuqiro_onboarding_complete";
const DRAFT_KEY = "vuqiro_onboarding_draft";

export type OnboardingDraft = {
  interests: string[];
  language?: string;
  country?: string;
  wantsCreator?: boolean;
  personalizedAds?: boolean;
  notifications?: boolean;
};

export const INTEREST_OPTIONS: { slug: string; label: string }[] = [
  { slug: "comedy", label: "Comedy" },
  { slug: "music", label: "Music" },
  { slug: "dance", label: "Dance" },
  { slug: "food", label: "Food" },
  { slug: "fitness", label: "Fitness" },
  { slug: "sports", label: "Sports" },
  { slug: "gaming", label: "Gaming" },
  { slug: "beauty", label: "Beauty" },
  { slug: "fashion", label: "Fashion" },
  { slug: "travel", label: "Travel" },
  { slug: "diy", label: "DIY & crafts" },
  { slug: "education", label: "Education" },
  { slug: "tech", label: "Tech" },
  { slug: "art", label: "Art" },
  { slug: "lifestyle", label: "Lifestyle" },
  { slug: "pets", label: "Pets" }
];

export async function getOnboardingDraft(): Promise<OnboardingDraft> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as OnboardingDraft) : { interests: [] };
  } catch {
    return { interests: [] };
  }
}

export async function saveOnboardingDraft(patch: Partial<OnboardingDraft>): Promise<OnboardingDraft> {
  const current = await getOnboardingDraft();
  const next = { ...current, ...patch };
  await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(next));
  return next;
}

export async function isOnboardingComplete(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(COMPLETE_KEY)) === "true";
  } catch {
    return false;
  }
}

/**
 * Finish onboarding: persist the flag locally and sync choices to the API
 * (interests, locale, consents, creator onboarding) when configured.
 */
export async function completeOnboarding(draft: OnboardingDraft): Promise<void> {
  await AsyncStorage.setItem(COMPLETE_KEY, "true");
  await AsyncStorage.removeItem(DRAFT_KEY);
  if (!isApiConfigured()) return;

  const calls: Promise<unknown>[] = [];
  if (draft.interests.length > 0) {
    calls.push(apiFetch("/me/interests", { method: "PUT", body: JSON.stringify({ interests: draft.interests }) }));
  }
  if (draft.language || draft.country) {
    calls.push(
      apiFetch("/me", {
        method: "PATCH",
        body: JSON.stringify({ language: draft.language ?? null, country: draft.country ?? null })
      })
    );
  }
  calls.push(
    apiFetch("/me/settings", {
      method: "PUT",
      body: JSON.stringify({ personalizedAdsOptIn: draft.personalizedAds ?? false, pushEnabled: draft.notifications ?? false })
    })
  );
  calls.push(
    apiFetch("/me/consents", {
      method: "POST",
      body: JSON.stringify({ consentType: "personalized_ads", granted: draft.personalizedAds ?? false, source: "onboarding" })
    })
  );
  calls.push(
    apiFetch("/me/consents", {
      method: "POST",
      body: JSON.stringify({ consentType: "notifications", granted: draft.notifications ?? false, source: "onboarding" })
    })
  );
  if (draft.wantsCreator) {
    calls.push(apiFetch("/creators/onboard", { method: "POST", body: JSON.stringify({}) }));
  }
  await Promise.allSettled(calls);
}

export function useOnboardingComplete(): boolean | null {
  const [complete, setComplete] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    isOnboardingComplete().then((value) => {
      if (!cancelled) setComplete(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return complete;
}
