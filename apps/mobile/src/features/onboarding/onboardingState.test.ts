import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: async (key: string) => {
      store.delete(key);
    }
  }
}));

const apiCalls: { path: string; init?: RequestInit }[] = [];
vi.mock("../../services/api/client", () => ({
  isApiConfigured: () => true,
  apiFetch: async (path: string, init?: RequestInit) => {
    apiCalls.push({ path, init });
    return {};
  }
}));

const { completeOnboarding, getOnboardingDraft, isOnboardingComplete, saveOnboardingDraft, INTEREST_OPTIONS } =
  await import("./onboardingState");

beforeEach(() => {
  store.clear();
  apiCalls.length = 0;
});

describe("onboarding state machine", () => {
  it("offers at least 12 interests", () => {
    expect(INTEREST_OPTIONS.length).toBeGreaterThanOrEqual(12);
    for (const option of INTEREST_OPTIONS) {
      expect(option.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("persists draft steps incrementally", async () => {
    await saveOnboardingDraft({ interests: ["music", "food"] });
    await saveOnboardingDraft({ language: "en", country: "US" });
    const draft = await getOnboardingDraft();
    expect(draft.interests).toEqual(["music", "food"]);
    expect(draft.language).toBe("en");
    expect(draft.country).toBe("US");
  });

  it("starts incomplete and completes exactly once", async () => {
    expect(await isOnboardingComplete()).toBe(false);
    await completeOnboarding({ interests: ["music"], language: "en", country: "US", personalizedAds: true });
    expect(await isOnboardingComplete()).toBe(true);
    // Draft is cleared after completion.
    expect((await getOnboardingDraft()).interests).toEqual([]);
  });

  it("syncs interests, locale and consents to the API", async () => {
    await completeOnboarding({
      interests: ["music"],
      language: "sv",
      country: "SE",
      personalizedAds: true,
      notifications: true,
      wantsCreator: true
    });
    const paths = apiCalls.map((call) => call.path);
    expect(paths).toContain("/me/interests");
    expect(paths).toContain("/me");
    expect(paths).toContain("/me/settings");
    expect(paths.filter((path) => path === "/me/consents")).toHaveLength(2);
    expect(paths).toContain("/creators/onboard");
  });
});
