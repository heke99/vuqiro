import { Hono } from "hono";
import { z } from "zod";
import { getVideoProvider } from "@vuqiro/services";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { checkRapidUploads } from "../lib/fraudSignals";
import { precheckModeration } from "../lib/moderationPrecheck";
import { hasPlaybackSigning, preparePlaybackUrl } from "../lib/playback";
import { enforceRateLimit } from "../lib/rateLimit";
import { getServiceDb, isBackendConfigured } from "../lib/supabase";
import type { AppEnv } from "../middleware/auth";
import { attachUser, requireUser } from "../middleware/auth";

export const uploadRoutes = new Hono<AppEnv>();

uploadRoutes.use("*", attachUser);

/** Upload constraints enforced server-side. */
export const UPLOAD_LIMITS = {
  maxDurationSeconds: 180,
  maxFileSizeBytes: 500 * 1024 * 1024,
  allowedFormats: ["mp4", "mov", "webm"],
  uploadsPerHour: 10
} as const;

const createUploadBody = z.object({
  caption: z.string().trim().min(1).max(500),
  hashtags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  category: z.string().trim().max(40).optional(),
  visibility: z
    .enum(["public", "followers_only", "subscribers_only", "premium_tier_only", "unlock_with_coins", "private"])
    .default("public"),
  requiredTier: z.enum(["support", "plus", "premium"]).optional(),
  coinUnlockPrice: z.number().int().positive().max(100_000).optional(),
  fileName: z.string().trim().min(1).max(200),
  fileSizeBytes: z.number().int().positive()
});

/**
 * Step 1 of the upload flow: validates the user/creator + constraints,
 * creates the video + asset records, and returns a provider direct-upload
 * URL. The provider webhook advances the status machine afterwards.
 */
uploadRoutes.post("/videos/uploads", requireUser, async (c) => {
  const profile = c.get("profile")!;
  enforceRateLimit(`upload:${profile.id}`, UPLOAD_LIMITS.uploadsPerHour, 3_600_000);
  const body = createUploadBody.parse(await c.req.json());

  const extension = body.fileName.split(".").pop()?.toLowerCase() ?? "";
  if (!(UPLOAD_LIMITS.allowedFormats as readonly string[]).includes(extension)) {
    throw badRequest(`Unsupported format .${extension}. Allowed: ${UPLOAD_LIMITS.allowedFormats.join(", ")}`);
  }
  if (body.fileSizeBytes > UPLOAD_LIMITS.maxFileSizeBytes) {
    throw badRequest("File exceeds the 500 MB limit");
  }
  if (body.visibility === "unlock_with_coins" && !body.coinUnlockPrice) {
    throw badRequest("unlock_with_coins requires coinUnlockPrice");
  }

  const provider = getVideoProvider();
  const precheck = precheckModeration(body.caption, body.hashtags);

  if (!isBackendConfigured()) {
    const upload = await provider.createDirectUpload({
      videoId: `mock_video_${Date.now()}`,
      creatorId: "mock_creator",
      maxDurationSeconds: UPLOAD_LIMITS.maxDurationSeconds
    });
    return c.json(
      {
        videoId: `mock_video_${Date.now()}`,
        uploadUrl: upload.uploadUrl,
        uploadId: upload.uploadId,
        expiresAt: upload.expiresAt,
        status: precheck.eligible ? "uploading" : "under_review",
        source: "mock"
      },
      201
    );
  }

  const db = getServiceDb()!;

  // The uploader must be an onboarded creator with monetization checks for
  // gated content.
  const { data: creator } = await db
    .from("creators")
    .select("id, monetization_enabled, onboarding_status")
    .eq("profile_id", profile.id)
    .maybeSingle();
  if (!creator) throw forbidden("Complete creator onboarding before uploading");
  const gated = body.visibility !== "public" && body.visibility !== "private";
  if (gated && !creator.monetization_enabled && body.visibility !== "followers_only") {
    throw forbidden("Monetization is not enabled for this creator");
  }

  await checkRapidUploads(creator.id);

  // Non-public videos get a signed playback policy when signing keys are
  // configured, so a leaked stream URL is unplayable without a short-lived
  // server-issued token. (Without keys we keep the public policy: the URL is
  // still only released by the entitlement-checked /videos/:id/access.)
  const playbackPolicy = body.visibility !== "public" && hasPlaybackSigning() ? "signed" : "public";

  const { data: video, error: videoError } = await db
    .from("videos")
    .insert({
      creator_id: creator.id,
      caption: body.caption,
      hashtags: body.hashtags,
      category: body.category,
      visibility: body.visibility,
      required_tier: body.requiredTier,
      coin_unlock_price: body.coinUnlockPrice,
      status: "uploading",
      moderation_status: precheck.eligible ? "visible" : "under_review",
      safety_score: precheck.safetyScore
    })
    .select("id")
    .single();
  if (videoError) throw badRequest(videoError.message);

  const upload = await provider.createDirectUpload({
    videoId: video.id,
    creatorId: creator.id,
    maxDurationSeconds: UPLOAD_LIMITS.maxDurationSeconds,
    playbackPolicy
  });

  const { error: assetError } = await db.from("video_assets").insert({
    video_id: video.id,
    provider: provider.name,
    provider_upload_id: upload.uploadId,
    status: "waiting_for_upload"
  });
  if (assetError) throw badRequest(assetError.message);

  // Mock provider assets are instantly "ready" — finalize immediately so the
  // local pipeline works end-to-end without webhooks.
  if (provider.name === "mock") {
    const asset = await provider.getAsset(upload.uploadId);
    await db
      .from("video_assets")
      .update({
        provider_asset_id: asset.assetId,
        status: asset.status,
        playback_url: asset.playbackUrl,
        duration_seconds: asset.durationSeconds,
        aspect_ratio: asset.aspectRatio
      })
      .eq("video_id", video.id);
    await db
      .from("videos")
      .update({
        status: precheck.eligible ? "ready" : "under_review",
        playback_url: asset.playbackUrl,
        duration_seconds: asset.durationSeconds
      })
      .eq("id", video.id);
  }

  return c.json(
    {
      videoId: video.id,
      uploadUrl: upload.uploadUrl,
      uploadId: upload.uploadId,
      expiresAt: upload.expiresAt,
      status: precheck.eligible ? "uploading" : "under_review",
      source: "db"
    },
    201
  );
});

uploadRoutes.get("/videos/:id/status", requireUser, async (c) => {
  const id = z.string().min(1).parse(c.req.param("id"));
  const profile = c.get("profile")!;

  if (!isBackendConfigured()) {
    return c.json({ videoId: id, status: "ready", moderationStatus: "visible", source: "mock" });
  }

  const db = getServiceDb()!;
  const { data: video } = await db
    .from("videos")
    .select("id, status, moderation_status, playback_url, thumbnail_url, creators (profile_id)")
    .eq("id", id)
    .maybeSingle();
  if (!video) throw notFound("Video not found");
  const owner = (video.creators as { profile_id?: string } | null)?.profile_id === profile.id;
  if (!owner) throw forbidden("Not your video");

  return c.json({
    videoId: video.id,
    status: video.status,
    moderationStatus: video.moderation_status,
    // Owner-only response, but signed like every other playback URL so
    // signed-policy assets are playable and URLs stay short-lived.
    playbackUrl: preparePlaybackUrl(video.playback_url),
    thumbnailUrl: video.thumbnail_url,
    source: "db"
  });
});

uploadRoutes.delete("/videos/:id", requireUser, async (c) => {
  const id = z.string().min(1).parse(c.req.param("id"));
  const profile = c.get("profile")!;

  if (!isBackendConfigured()) {
    return c.json({ videoId: id, status: "deleted", source: "mock" });
  }

  const db = getServiceDb()!;
  const { data: video } = await db
    .from("videos")
    .select("id, creators (profile_id)")
    .eq("id", id)
    .maybeSingle();
  if (!video) throw notFound("Video not found");
  if ((video.creators as { profile_id?: string } | null)?.profile_id !== profile.id) {
    throw forbidden("Not your video");
  }

  const { data: asset } = await db
    .from("video_assets")
    .select("provider_asset_id")
    .eq("video_id", id)
    .maybeSingle();
  if (asset?.provider_asset_id) {
    try {
      await getVideoProvider().deleteAsset(asset.provider_asset_id);
    } catch (error) {
      console.error("[uploads] provider deleteAsset failed", error);
    }
  }

  await db
    .from("videos")
    .update({ status: "deleted", playback_url: null, thumbnail_url: null })
    .eq("id", id);
  await db.from("video_assets").update({ status: "deleted", playback_url: null }).eq("video_id", id);

  return c.json({ videoId: id, status: "deleted", source: "db" });
});
