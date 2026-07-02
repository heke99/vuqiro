import { describe, expect, it } from "vitest";
import { loadEnv, MissingEnvError, requireEnv } from "./env";

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
