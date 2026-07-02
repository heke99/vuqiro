import { Hono } from "hono";
import { ZodError } from "zod";
import { loadEnv } from "@vuqiro/config";
import { ApiError } from "./lib/errors";
import type { AppEnv } from "./middleware/auth";
import { requestLogger, securityHeaders } from "./middleware/logging";
import { adminRoutes } from "./routes/admin";
import { adminFraudRoutes } from "./routes/adminFraud";
import { adminModerationRoutes } from "./routes/adminModeration";
import { analyticsRoutes } from "./routes/analytics";
import { appealRoutes } from "./routes/appeals";
import { commentRoutes } from "./routes/comments";
import { creatorRoutes } from "./routes/creators";
import { creatorStudioRoutes } from "./routes/creatorStudio";
import { discoveryRoutes } from "./routes/discovery";
import { eventRoutes } from "./routes/events";
import { feedRoutes } from "./routes/feed";
import { legalRoutes } from "./routes/legal";
import { moderationRoutes } from "./routes/moderation";
import { monetizationRoutes } from "./routes/monetization";
import { notificationRoutes } from "./routes/notifications";
import { payoutRoutes } from "./routes/payouts";
import { uploadRoutes } from "./routes/uploads";
import { videoRoutes } from "./routes/videos";
import { videoWebhookRoutes } from "./routes/videoWebhooks";
import { walletRoutes } from "./routes/wallet";
import { webhookRoutes } from "./routes/webhooks";

export function createApp() {
  const app = new Hono<AppEnv>();
  const env = loadEnv();

  if (env.appEnv !== "development") {
    app.use("*", requestLogger);
  }
  app.use("*", securityHeaders);

  app.onError((error, c) => {
    if (error instanceof ApiError) {
      return c.json({ error: error.message, code: error.code }, error.status as 400);
    }
    if (error instanceof ZodError) {
      return c.json({ error: "Validation failed", issues: error.issues }, 400);
    }
    console.error("[api] unhandled error", error);
    return c.json({ error: "Internal server error" }, 500);
  });

  app.get("/health", (c) =>
    c.json({
      ok: true,
      service: "vuqiro-api",
      appEnv: env.appEnv,
      videoProvider: env.videoProvider,
      time: new Date().toISOString()
    })
  );

  app.route("/feed", feedRoutes);
  // Studio routes must precede discovery: /creators/me/* would otherwise be
  // captured by the public /creators/:id/videos matcher.
  app.route("/", creatorStudioRoutes); // /creators/me/*, /creators/onboard
  app.route("/", discoveryRoutes); // GET /search, /discover/trending, /creators/:id/videos
  app.route("/", eventRoutes); // POST /events
  app.route("/", analyticsRoutes); // GET /admin/analytics, GET /creators/me/analytics
  app.route("/creators", creatorRoutes);
  app.route("/", uploadRoutes); // POST /videos/uploads, GET /videos/:id/status, DELETE /videos/:id
  app.route("/videos", videoRoutes);
  app.route("/", videoWebhookRoutes); // POST /video-provider/webhook
  app.route("/comments", commentRoutes);
  app.route("/", moderationRoutes); // POST /reports, POST /blocks
  app.route("/wallet", walletRoutes);
  app.route("/monetization", monetizationRoutes);
  app.route("/", webhookRoutes); // POST /revenuecat/webhook, POST /stripe/webhook
  app.route("/", appealRoutes); // POST /appeals
  app.route("/", payoutRoutes); // /payouts/*, POST /admin/payouts/batch
  app.route("/", notificationRoutes); // /notifications, /notifications/read, /notifications/preferences
  app.route("/", legalRoutes); // /legal/documents, /legal/accept, /legal/acceptances
  app.route("/admin", adminModerationRoutes); // moderation case detail + decisions
  app.route("/admin", adminFraudRoutes); // fraud signals
  app.route("/admin", adminRoutes);

  return app;
}
