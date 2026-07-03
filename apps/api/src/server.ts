import { serve } from "@hono/node-server";
import { assertProductionSafety, loadEnv } from "@vuqiro/config";
import { createApp } from "./app";

const env = loadEnv();

// Refuse to boot in production with mock/unconfigured providers; log
// warnings for staging so degraded configuration is always visible.
const safety = assertProductionSafety(env);
for (const warning of safety.warnings) {
  console.warn(`[vuqiro-api] configuration warning: ${warning}`);
}

const app = createApp();

serve({ fetch: app.fetch, port: env.apiPort }, (info) => {
  console.log(`vuqiro-api listening on http://localhost:${info.port} (${env.appEnv})`);
});
