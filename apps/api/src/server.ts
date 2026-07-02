import { serve } from "@hono/node-server";
import { loadEnv } from "@vuqiro/config";
import { createApp } from "./app";

const env = loadEnv();
const app = createApp();

serve({ fetch: app.fetch, port: env.apiPort }, (info) => {
  console.log(`vuqiro-api listening on http://localhost:${info.port}`);
});
