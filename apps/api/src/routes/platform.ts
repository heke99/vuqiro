import { Hono } from "hono";
import { loadEnv } from "@vuqiro/config";
import { mockFeatureFlags } from "@vuqiro/mock-data";
import { badRequest } from "../lib/errors";
import { getServiceDb, isBackendConfigured } from "../lib/supabase";
import type { AppEnv } from "../middleware/auth";

/**
 * Public platform surface. Exposes only the minimal client-safe view of
 * feature flags (key + enabled) so apps can gate UI without shipping a
 * hardcoded flag file. Admin metadata (descriptions, editors) stays on the
 * admin-only /admin/feature-flags endpoint.
 */
export const platformRoutes = new Hono<AppEnv>();

function flagAppliesToEnvironment(environment: string, appEnv: string): boolean {
  if (environment === "all") return true;
  // preview flags also apply in test to keep CI deterministic with dev.
  if (appEnv === "test") return environment === "development";
  return environment === appEnv;
}

platformRoutes.get("/feature-flags", async (c) => {
  const env = loadEnv();
  if (!isBackendConfigured()) {
    const flags = mockFeatureFlags
      .filter((flag) => flagAppliesToEnvironment(flag.environment, env.appEnv))
      .map((flag) => ({ key: flag.key, enabled: flag.enabled }));
    return c.json({ flags, source: "mock" });
  }
  const db = getServiceDb()!;
  const { data, error } = await db.from("feature_flags").select("key, enabled, environment").order("key");
  if (error) throw badRequest(error.message);
  const flags = (data ?? [])
    .filter((flag) => flagAppliesToEnvironment(flag.environment as string, env.appEnv))
    .map((flag) => ({ key: flag.key as string, enabled: Boolean(flag.enabled) }));
  return c.json({ flags, source: "db" });
});
