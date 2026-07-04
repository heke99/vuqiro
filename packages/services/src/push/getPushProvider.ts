import { loadEnv } from "@vuqiro/config";
import type { PushProvider } from "./pushProvider";
import { ExpoPushProvider } from "./expoPushProvider";
import { MockPushProvider } from "./mockPushProvider";

let cached: PushProvider | null = null;

/** Expo push when PUSH_PROVIDER=expo; mock otherwise. */
export function getPushProvider(): PushProvider {
  if (cached) return cached;
  const env = loadEnv();
  cached =
    env.pushProvider === "expo"
      ? new ExpoPushProvider({ accessToken: env.expoAccessToken })
      : new MockPushProvider();
  return cached;
}

export function resetPushProviderCache(): void {
  cached = null;
}
