import { loadEnv } from "@vuqiro/config";
import { getServiceDb } from "../lib/supabase";
import { checkDemoSeedGuards, cleanupDemoSeed, runDemoSeed, DEMO_USER_PASSWORD } from "./demoSeed";
import { buildDemoPlan, DEMO_SEED_BATCH } from "./demoSeedData";

/**
 * CLI for the demo creator seed (local/staging only).
 *
 *   pnpm seed:demo-creators            # requires ALLOW_DEMO_SEED=true
 *   pnpm seed:demo-creators:cleanup    # removes seed_batch rows
 *
 * Guards: never runs with NODE_ENV/EXPO_PUBLIC_APP_ENV=production, always
 * requires ALLOW_DEMO_SEED=true, and refuses non-local databases unless
 * ALLOW_DEMO_SEED_REMOTE=true (staging).
 */
async function main(): Promise<void> {
  const cleanup = process.argv.includes("--cleanup");
  const env = loadEnv();

  const guard = checkDemoSeedGuards({
    nodeEnv: process.env.NODE_ENV,
    appEnv: env.appEnv,
    supabaseUrl: env.supabaseUrl,
    allowDemoSeed: process.env.ALLOW_DEMO_SEED,
    allowDemoSeedRemote: process.env.ALLOW_DEMO_SEED_REMOTE
  });
  if (!guard.allowed) {
    console.error(`[demo-seed] ${guard.reason}`);
    process.exit(1);
  }
  for (const warning of guard.warnings) {
    console.warn(`[demo-seed] WARNING: ${warning}`);
  }

  const db = getServiceDb();
  if (!db) {
    console.error("[demo-seed] Supabase service client unavailable (check SUPABASE_SERVICE_ROLE_KEY).");
    process.exit(1);
  }

  if (cleanup) {
    await cleanupDemoSeed(db, DEMO_SEED_BATCH);
    return;
  }

  const plan = buildDemoPlan();
  await runDemoSeed(db, plan);
  console.log(
    `[demo-seed] Demo sign-ins (password "${DEMO_USER_PASSWORD}"): ` +
      plan.users.map((user) => user.email).join(", ")
  );
  console.log(`[demo-seed] Creator logins use demo-<handle>@vuqiro.test with the same password.`);
}

main().catch((error) => {
  console.error("[demo-seed] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
