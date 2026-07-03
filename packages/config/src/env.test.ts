import { describe, expect, it } from "vitest";
import {
  assertProductionSafety,
  checkProductionSafety,
  loadEnv,
  MissingEnvError,
  ProductionSafetyError,
  requireEnv
} from "./env";

describe("loadEnv", () => {
  it("defaults to development + mock provider with no source", () => {
    const env = loadEnv({});
    expect(env.appEnv).toBe("development");
    expect(env.videoProvider).toBe("mock");
    expect(env.apiPort).toBe(3002);
  });

  it("reads provided values and trims whitespace", () => {
    const env = loadEnv({
      EXPO_PUBLIC_APP_ENV: "production",
      VIDEO_PROVIDER: "mux",
      EXPO_PUBLIC_SUPABASE_URL: " https://example.supabase.co ",
      API_PORT: "4000"
    });
    expect(env.appEnv).toBe("production");
    expect(env.videoProvider).toBe("mux");
    expect(env.supabaseUrl).toBe("https://example.supabase.co");
    expect(env.apiPort).toBe(4000);
  });

  it("falls back to mock for unknown video providers", () => {
    const env = loadEnv({ VIDEO_PROVIDER: "something-else" });
    expect(env.videoProvider).toBe("mock");
  });

  it("treats empty strings as unset", () => {
    const env = loadEnv({ STRIPE_SECRET_KEY: "   " });
    expect(env.stripeSecretKey).toBeUndefined();
  });
});

describe("requireEnv", () => {
  it("returns the value when present", () => {
    expect(requireEnv("KEY", { KEY: "value" })).toBe("value");
  });

  it("throws MissingEnvError when absent", () => {
    expect(() => requireEnv("MISSING", {})).toThrow(MissingEnvError);
  });
});

describe("production safety", () => {
  const fullyConfigured = {
    EXPO_PUBLIC_APP_ENV: "production",
    EXPO_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    EXPO_PUBLIC_SUPABASE_ANON_KEY: "anon",
    SUPABASE_SERVICE_ROLE_KEY: "service",
    VIDEO_PROVIDER: "mux",
    VIDEO_PROVIDER_API_KEY: "key",
    VIDEO_PROVIDER_API_SECRET: "secret",
    VIDEO_WEBHOOK_SECRET: "whsec",
    REVENUECAT_WEBHOOK_SECRET: "rcsec",
    STRIPE_SECRET_KEY: "sk_live",
    STRIPE_WEBHOOK_SECRET: "whsec_stripe",
    PUSH_PROVIDER: "expo",
    CORS_ORIGINS: "https://admin.vuqiro.app"
  };

  it("allows mocks in development and test", () => {
    for (const appEnv of ["development", "test", "preview"]) {
      const report = checkProductionSafety(loadEnv({ EXPO_PUBLIC_APP_ENV: appEnv }));
      expect(report.fatal).toHaveLength(0);
      expect(report.warnings).toHaveLength(0);
    }
  });

  it("downgrades findings to warnings in staging", () => {
    const report = checkProductionSafety(loadEnv({ EXPO_PUBLIC_APP_ENV: "staging" }));
    expect(report.fatal).toHaveLength(0);
    expect(report.warnings.length).toBeGreaterThan(0);
  });

  it("refuses production boot with missing providers", () => {
    expect(() => assertProductionSafety(loadEnv({ EXPO_PUBLIC_APP_ENV: "production" }))).toThrow(
      ProductionSafetyError
    );
  });

  it("names each unconfigured provider in production", () => {
    const report = checkProductionSafety(loadEnv({ EXPO_PUBLIC_APP_ENV: "production" }));
    const joined = report.fatal.join("\n");
    expect(joined).toContain("Supabase");
    expect(joined).toContain("Video provider");
    expect(joined).toContain("REVENUECAT_WEBHOOK_SECRET");
    expect(joined).toContain("Stripe");
    expect(joined).toContain("PUSH_PROVIDER");
  });

  it("passes with a fully configured production environment", () => {
    const report = assertProductionSafety(loadEnv(fullyConfigured));
    expect(report.fatal).toHaveLength(0);
  });

  it("parses CORS origins and push provider", () => {
    const env = loadEnv({ CORS_ORIGINS: "https://a.example, https://b.example", PUSH_PROVIDER: "expo" });
    expect(env.corsOrigins).toEqual(["https://a.example", "https://b.example"]);
    expect(env.pushProvider).toBe("expo");
  });
});
