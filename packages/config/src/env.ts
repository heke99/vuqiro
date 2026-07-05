/**
 * Typed environment contract for Vuqiro services.
 *
 * Every value is optional at read time so apps can boot with mock fallbacks
 * in development/test. Production (and staging, for most providers) must not
 * silently fall back to mocks: the API calls `assertProductionSafety()` at
 * boot and refuses to start when a required provider is unconfigured.
 */
import { z } from "zod";

export type AppEnv = "development" | "test" | "preview" | "staging" | "production";

export interface VuqiroEnv {
  appEnv: AppEnv;
  appVersion: string;
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
  pushProvider: "expo" | "mock";
  expoAccessToken?: string;
  emailProvider: "resend" | "mock";
  resendApiKey?: string;
  /** Verified sender identity, e.g. "Vuqiro <no-reply@vuqiro.app>". */
  emailFrom: string;
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
  adminUrl?: string;
  /** Comma-separated allowlist of browser origins for the API. */
  corsOrigins: string[];
}

type EnvSource = Record<string, string | undefined>;

const envSchema = z.object({
  appEnv: z.enum(["development", "test", "preview", "staging", "production"]),
  appVersion: z.string().min(1),
  videoProvider: z.enum(["mux", "mock"]),
  pushProvider: z.enum(["expo", "mock"]),
  emailProvider: z.enum(["resend", "mock"]),
  apiPort: z.number().int().positive(),
  apiBaseUrl: z.string().min(1),
  supportEmail: z.string().email(),
  corsOrigins: z.array(z.string())
});

function str(source: EnvSource, key: string): string | undefined {
  const value = source[key];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

export function loadEnv(source: EnvSource = typeof process !== "undefined" ? process.env : {}): VuqiroEnv {
  const rawAppEnv = str(source, "EXPO_PUBLIC_APP_ENV") ?? "development";
  const appEnv: AppEnv = (["development", "test", "preview", "staging", "production"] as const).includes(
    rawAppEnv as AppEnv
  )
    ? (rawAppEnv as AppEnv)
    : "development";
  const videoProvider = str(source, "VIDEO_PROVIDER") === "mux" ? "mux" : "mock";
  const pushProvider = str(source, "PUSH_PROVIDER") === "expo" ? "expo" : "mock";
  const emailProvider = str(source, "EMAIL_PROVIDER") === "resend" ? "resend" : "mock";
  const corsOrigins = (str(source, "CORS_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  const env: VuqiroEnv = {
    appEnv,
    appVersion: str(source, "APP_VERSION") ?? "0.1.0",
    supabaseUrl: str(source, "EXPO_PUBLIC_SUPABASE_URL"),
    supabaseAnonKey: str(source, "EXPO_PUBLIC_SUPABASE_ANON_KEY"),
    supabaseServiceRoleKey: str(source, "SUPABASE_SERVICE_ROLE_KEY"),
    revenueCatIosApiKey: str(source, "REVENUECAT_IOS_API_KEY"),
    revenueCatAndroidApiKey: str(source, "REVENUECAT_ANDROID_API_KEY"),
    revenueCatWebhookSecret: str(source, "REVENUECAT_WEBHOOK_SECRET"),
    stripeSecretKey: str(source, "STRIPE_SECRET_KEY"),
    stripeWebhookSecret: str(source, "STRIPE_WEBHOOK_SECRET"),
    stripeConnectClientId: str(source, "STRIPE_CONNECT_CLIENT_ID"),
    videoProvider,
    videoProviderApiKey: str(source, "VIDEO_PROVIDER_API_KEY"),
    videoProviderApiSecret: str(source, "VIDEO_PROVIDER_API_SECRET"),
    videoWebhookSecret: str(source, "VIDEO_WEBHOOK_SECRET"),
    pushProvider,
    expoAccessToken: str(source, "EXPO_ACCESS_TOKEN"),
    emailProvider,
    resendApiKey: str(source, "RESEND_API_KEY"),
    emailFrom: str(source, "EMAIL_FROM") ?? "Vuqiro <no-reply@vuqiro.app>",
    sentryDsn: str(source, "SENTRY_DSN"),
    supportEmail: str(source, "SUPPORT_EMAIL") ?? "support@vuqiro.app",
    publicTermsUrl: str(source, "PUBLIC_TERMS_URL"),
    publicPrivacyUrl: str(source, "PUBLIC_PRIVACY_URL"),
    publicSupportUrl: str(source, "PUBLIC_SUPPORT_URL"),
    publicCommunityGuidelinesUrl: str(source, "PUBLIC_COMMUNITY_GUIDELINES_URL"),
    publicCreatorTermsUrl: str(source, "PUBLIC_CREATOR_TERMS_URL"),
    publicPayoutTermsUrl: str(source, "PUBLIC_PAYOUT_TERMS_URL"),
    apiPort: Number(str(source, "API_PORT") ?? "3002"),
    apiBaseUrl: str(source, "API_BASE_URL") ?? "http://localhost:3002",
    adminUrl: str(source, "ADMIN_URL"),
    corsOrigins
  };

  envSchema.parse({
    appEnv: env.appEnv,
    appVersion: env.appVersion,
    videoProvider: env.videoProvider,
    pushProvider: env.pushProvider,
    emailProvider: env.emailProvider,
    apiPort: env.apiPort,
    apiBaseUrl: env.apiBaseUrl,
    supportEmail: env.supportEmail,
    corsOrigins: env.corsOrigins
  });

  return env;
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

export interface ProductionSafetyReport {
  /** Missing configuration that must stop a production boot. */
  fatal: string[];
  /** Degraded-but-tolerable configuration (logged + surfaced in /health). */
  warnings: string[];
}

/**
 * Evaluate provider configuration for the current environment.
 *
 * - development/test/preview: everything may be mocked; no findings.
 * - staging: missing providers are warnings (mock fallback is visible).
 * - production: database/auth, video, payments, payouts and push must be
 *   configured with real providers; anything else is fatal.
 */
export function checkProductionSafety(env: VuqiroEnv): ProductionSafetyReport {
  const fatal: string[] = [];
  const warnings: string[] = [];
  if (env.appEnv === "development" || env.appEnv === "test" || env.appEnv === "preview") {
    return { fatal, warnings };
  }

  const findings = env.appEnv === "production" ? fatal : warnings;

  if (!env.supabaseUrl || !env.supabaseAnonKey || !env.supabaseServiceRoleKey) {
    findings.push(
      "Supabase is not configured (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY). The API would silently serve mock data."
    );
  }
  if (env.videoProvider !== "mux" || !env.videoProviderApiKey || !env.videoProviderApiSecret) {
    findings.push(
      "Video provider is not configured (VIDEO_PROVIDER=mux + VIDEO_PROVIDER_API_KEY / VIDEO_PROVIDER_API_SECRET). Uploads would use the mock pipeline."
    );
  }
  if (env.videoProvider === "mux" && !env.videoWebhookSecret) {
    findings.push("VIDEO_WEBHOOK_SECRET is missing — video webhooks cannot be verified.");
  }
  if (!env.revenueCatWebhookSecret) {
    findings.push("REVENUECAT_WEBHOOK_SECRET is missing — purchases cannot be credited.");
  }
  if (!env.stripeSecretKey || !env.stripeWebhookSecret) {
    findings.push(
      "Stripe is not configured (STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET). Creator payouts would use the mock provider."
    );
  }
  if (env.pushProvider !== "expo") {
    findings.push("PUSH_PROVIDER is not 'expo' — push notifications would use the mock provider.");
  }
  if (env.appEnv === "production" && (env.emailProvider !== "resend" || !env.resendApiKey)) {
    // Email is important but not launch-blocking: in-app + push still work.
    warnings.push("Email is not configured (EMAIL_PROVIDER=resend + RESEND_API_KEY) — email notifications will be skipped.");
  }
  if (env.appEnv === "production" && !env.sentryDsn) {
    warnings.push("SENTRY_DSN is missing — production errors will not be reported.");
  }
  if (env.appEnv === "production" && env.corsOrigins.length === 0) {
    warnings.push("CORS_ORIGINS is empty — browser clients (admin console) will be blocked by CORS.");
  }

  return { fatal, warnings };
}

export class ProductionSafetyError extends Error {
  constructor(public readonly findings: string[]) {
    super(
      `Refusing to start in production with mock/unconfigured providers:\n` +
        findings.map((finding) => `  - ${finding}`).join("\n")
    );
    this.name = "ProductionSafetyError";
  }
}

/** Throws when production would silently run on mock providers. */
export function assertProductionSafety(env: VuqiroEnv = loadEnv()): ProductionSafetyReport {
  const report = checkProductionSafety(env);
  if (report.fatal.length > 0) {
    throw new ProductionSafetyError(report.fatal);
  }
  return report;
}
