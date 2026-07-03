import { Hono } from "hono";
import { cors } from "hono/cors";
import { ZodError } from "zod";
import { loadEnv } from "@vuqiro/config";
import { ApiError } from "./lib/errors";
import { getHealthReport } from "./lib/health";
import type { AppEnv } from "./middleware/auth";
import { requestLogger, securityHeaders } from "./middleware/logging";
import { adminRoutes } from "./routes/admin";
import { adminAdsRoutes } from "./routes/adminAds";
import { adminComplianceRoutes } from "./routes/adminCompliance";
import { adminFinanceRoutes } from "./routes/adminFinance";
import { adminFraudRoutes } from "./routes/adminFraud";
import { adminModerationRoutes } from "./routes/adminModeration";
import { adminOpsRoutes } from "./routes/adminOps";
import { adminPlatformRoutes } from "./routes/adminPlatform";
import { adsRoutes } from "./routes/ads";
import { analyticsRoutes } from "./routes/analytics";
import { appealRoutes } from "./routes/appeals";
import { commentRoutes } from "./routes/comments";
import { creatorRoutes } from "./routes/creators";
import { creatorStudioRoutes } from "./routes/creatorStudio";
import { discoveryRoutes } from "./routes/discovery";
import { eventRoutes } from "./routes/events";
import { feedRoutes } from "./routes/feed";
import { feedSessionRoutes } from "./routes/feedSessions";
import { legalRoutes } from "./routes/legal";
import { privacyRoutes } from "./routes/privacy";
import { profileRoutes } from "./routes/profile";
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
  app.use(
    "*",
    cors({
      origin:
        env.corsOrigins.length > 0
          ? env.corsOrigins
          : env.appEnv === "production"
            ? [] // production requires an explicit allowlist
            : (origin) => origin, // dev/test: reflect any origin
      allowHeaders: ["authorization", "content-type", "x-request-id", "x-mock-user", "x-mock-admin"],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      maxAge: 600
    })
  );

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

  app.get("/health", async (c) => {
    const deep = c.req.query("deep") === "1";
    const report = await getHealthReport({ deep });
    return c.json({ ...report, videoProvider: env.videoProvider }, report.ok ? 200 : 503);
  });

  app.route("/feed", feedRoutes);
  app.route("/", feedSessionRoutes); // /feed/session/*, /feed/impression
  app.route("/ads", adsRoutes); // /ads/serve, /ads/impression, /ads/click, /ads/report
  app.route("/", profileRoutes); // /me, /me/settings, /me/safety-settings, /me/interests, /me/blocks
  app.route("/", privacyRoutes); // /privacy/*, /account/deletion, /copyright-claims, /support-cases
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
  app.route("/admin", adminAdsRoutes); // ads suite + platform revenue ledger
  app.route("/admin", adminPlatformRoutes); // users, creators, videos, comments
  app.route("/admin", adminOpsRoutes); // admin users, flags, settings, health, support, audit, broadcast
  app.route("/admin", adminComplianceRoutes); // legal docs, privacy, deletions, appeals, copyright
  app.route("/admin", adminFinanceRoutes); // wallet txns, purchases, creator ledger, adjustments
  app.route("/admin", adminRoutes);

  return app;
}
