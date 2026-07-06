import { isApiConfigured } from "../api/client";

const appEnv = process.env.EXPO_PUBLIC_APP_ENV ?? "development";

/**
 * Single gate for demo/mock content. Demo data keeps credential-free
 * development and tests fully navigable, but production builds must never
 * silently show fake content — they surface real error/empty states instead.
 */
export function isDemoContentAllowed(): boolean {
  return appEnv !== "production";
}

/** True when the app should run entirely on demo data (no API configured). */
export function isDemoMode(): boolean {
  return !isApiConfigured() && isDemoContentAllowed();
}
