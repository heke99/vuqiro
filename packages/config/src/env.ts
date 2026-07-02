/**
 * Typed environment contract for Vuqiro services.
 *
 * Every value is optional at read time so apps can boot with mock fallbacks
 * when provider credentials are missing. Call `requireEnv` at the point where
 * a real credential is genuinely needed (e.g. a live webhook handler).
 */

export type AppEnv = "development" | "preview" | "production";

export interface VuqiroEnv {
  appEnv: AppEnv;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  /** Server-side only. Never expose to clients. */
  supabaseServiceRoleKey?: string;
  revenueCatIosApiKey?: string;
  revenueCatAndroidApiKey?: string;
  revenueCatWebhookSecret?: string;
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  stripeConnectClientId?: string;
  videoProvider: "mux" | "mock";
  videoProviderApiKey?: string;
  videoProviderApiSecret?: string;
  videoWebhookSecret?: string;
  sentryDsn?: string;
  supportEmail: string;
  publicTermsUrl?: string;
  publicPrivacyUrl?: string;
  publicSupportUrl?: string;
  publicCommunityGuidelinesUrl?: string;
  publicCreatorTermsUrl?: string;
  publicPayoutTermsUrl?: string;
  apiPort: number;
  apiBaseUrl: string;
}

type EnvSource = Record<string, string | undefined>;

function str(source: EnvSource, key: string): string | undefined {
  const value = source[key];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

export function loadEnv(source: EnvSource = typeof process !== "undefined" ? process.env : {}): VuqiroEnv {
  const appEnv = (str(source, "EXPO_PUBLIC_APP_ENV") ?? "development") as AppEnv;
  const videoProvider = (str(source, "VIDEO_PROVIDER") ?? "mock") as VuqiroEnv["videoProvider"];

  return {
    appEnv,
    supabaseUrl: str(source, "EXPO_PUBLIC_SUPABASE_URL"),
    supabaseAnonKey: str(source, "EXPO_PUBLIC_SUPABASE_ANON_KEY"),
    supabaseServiceRoleKey: str(source, "SUPABASE_SERVICE_ROLE_KEY"),
    revenueCatIosApiKey: str(source, "REVENUECAT_IOS_API_KEY"),
    revenueCatAndroidApiKey: str(source, "REVENUECAT_ANDROID_API_KEY"),
    revenueCatWebhookSecret: str(source, "REVENUECAT_WEBHOOK_SECRET"),
    stripeSecretKey: str(source, "STRIPE_SECRET_KEY"),
    stripeWebhookSecret: str(source, "STRIPE_WEBHOOK_SECRET"),
    stripeConnectClientId: str(source, "STRIPE_CONNECT_CLIENT_ID"),
    videoProvider: videoProvider === "mux" ? "mux" : "mock",
    videoProviderApiKey: str(source, "VIDEO_PROVIDER_API_KEY"),
    videoProviderApiSecret: str(source, "VIDEO_PROVIDER_API_SECRET"),
    videoWebhookSecret: str(source, "VIDEO_WEBHOOK_SECRET"),
    sentryDsn: str(source, "SENTRY_DSN"),
    supportEmail: str(source, "SUPPORT_EMAIL") ?? "support@vuqiro.app",
    publicTermsUrl: str(source, "PUBLIC_TERMS_URL"),
    publicPrivacyUrl: str(source, "PUBLIC_PRIVACY_URL"),
    publicSupportUrl: str(source, "PUBLIC_SUPPORT_URL"),
    publicCommunityGuidelinesUrl: str(source, "PUBLIC_COMMUNITY_GUIDELINES_URL"),
    publicCreatorTermsUrl: str(source, "PUBLIC_CREATOR_TERMS_URL"),
    publicPayoutTermsUrl: str(source, "PUBLIC_PAYOUT_TERMS_URL"),
    apiPort: Number(str(source, "API_PORT") ?? "3002"),
    apiBaseUrl: str(source, "API_BASE_URL") ?? "http://localhost:3002"
  };
}

export class MissingEnvError extends Error {
  constructor(public readonly key: string) {
    super(
      `Missing required environment variable "${key}". ` +
        `Add it to your .env file (see .env.example) or keep the mock provider enabled.`
    );
    this.name = "MissingEnvError";
  }
}

/** Read a single required env var, throwing a descriptive error when absent. */
export function requireEnv(key: string, source: EnvSource = typeof process !== "undefined" ? process.env : {}): string {
  const value = source[key];
  if (!value || value.trim().length === 0) {
    throw new MissingEnvError(key);
  }
  return value.trim();
}
