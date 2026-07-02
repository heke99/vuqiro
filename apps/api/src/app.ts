import { Hono } from "hono";
import { loadEnv } from "@vuqiro/config";

export function createApp() {
  const app = new Hono();
  const env = loadEnv();

  app.get("/health", (c) =>
    c.json({
      ok: true,
      service: "vuqiro-api",
      appEnv: env.appEnv,
      videoProvider: env.videoProvider,
      time: new Date().toISOString()
    })
  );

  return app;
}
