import { Hono } from "hono";
import { getVideoProvider } from "@vuqiro/services";
import { unauthorized } from "../lib/errors";
import { getServiceDb, isBackendConfigured } from "../lib/supabase";

export const videoWebhookRoutes = new Hono();

type MuxWebhookEvent = {
  type: string;
  data: {
    id: string;
    upload_id?: string;
    passthrough?: string;
    status?: string;
    duration?: number;
    aspect_ratio?: string;
    playback_ids?: { id: string; policy: string }[];
    errors?: { messages?: string[] };
  };
};

/**
 * Video provider webhook (Mux). Advances the video status machine:
 *
 *   video.upload.asset_created  -> link asset id, status processing
 *   video.asset.ready           -> store playback/thumbnail, status ready
 *                                  (or under_review if moderation flagged it)
 *   video.asset.errored         -> status rejected + error stored
 */
videoWebhookRoutes.post("/video-provider/webhook", async (c) => {
  const rawBody = await c.req.text();
  const provider = getVideoProvider();
  const verification = provider.verifyWebhookSignature(rawBody, c.req.header("mux-signature"));
  if (!verification.valid) {
    throw unauthorized(verification.reason ?? "Invalid webhook signature");
  }

  const event = JSON.parse(rawBody) as MuxWebhookEvent & { id?: string };

  if (!isBackendConfigured()) {
    return c.json({ received: true, processed: false, reason: "backend not configured" });
  }

  const db = getServiceDb()!;

  // Idempotency: each provider event is recorded once in
  // video_processing_jobs; replays are acknowledged without reprocessing.
  const providerEventId = event.id ?? `${event.type}:${event.data?.id ?? "unknown"}`;
  const videoIdForJob =
    event.data?.passthrough && /^[0-9a-f-]{36}$/i.test(event.data.passthrough) ? event.data.passthrough : null;
  if (videoIdForJob) {
    const { error: jobError } = await db.from("video_processing_jobs").insert({
      video_id: videoIdForJob,
      provider: provider.name,
      provider_event_id: providerEventId,
      type: "webhook",
      status: "processing",
      payload: { type: event.type }
    });
    if (jobError) {
      if (jobError.code === "23505") {
        return c.json({ received: true, duplicate: true, type: event.type });
      }
      // Non-duplicate insert failures should not drop the event; continue.
      console.error("[video-webhook] failed to record processing job", jobError.message);
    }
  }

  switch (event.type) {
    case "video.upload.asset_created": {
      // data.id = upload id here; asset id arrives in data.asset_id-like field
      // via passthrough lookups. We link by upload id.
      const uploadId = event.data.id;
      await db
        .from("video_assets")
        .update({ provider_asset_id: (event.data as { asset_id?: string }).asset_id ?? null, status: "processing" })
        .eq("provider_upload_id", uploadId);
      const { data: asset } = await db
        .from("video_assets")
        .select("video_id")
        .eq("provider_upload_id", uploadId)
        .maybeSingle();
      if (asset) {
        await db.from("videos").update({ status: "processing" }).eq("id", asset.video_id).eq("status", "uploading");
      }
      break;
    }
    case "video.asset.ready": {
      const assetId = event.data.id;
      const videoId = event.data.passthrough;
      // Public assets carry a public playback id; gated/private uploads use a
      // signed-policy id whose URL only plays with a server-issued token
      // (issued by preparePlaybackUrl after the access check).
      const playbackId = (
        event.data.playback_ids?.find((candidate) => candidate.policy === "public") ?? event.data.playback_ids?.[0]
      )?.id;
      const playbackUrl = playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : null;
      const thumbnailUrl = playbackId ? `https://image.mux.com/${playbackId}/thumbnail.jpg?time=1` : null;

      await db
        .from("video_assets")
        .update({
          provider_asset_id: assetId,
          status: "ready",
          playback_url: playbackUrl,
          thumbnail_url: thumbnailUrl,
          duration_seconds: event.data.duration,
          aspect_ratio: event.data.aspect_ratio
        })
        .or(videoId ? `video_id.eq.${videoId},provider_asset_id.eq.${assetId}` : `provider_asset_id.eq.${assetId}`);

      if (videoId) {
        // Respect the moderation pre-check: flagged videos stay under_review.
        const { data: video } = await db
          .from("videos")
          .select("id, moderation_status")
          .eq("id", videoId)
          .maybeSingle();
        if (video) {
          await db
            .from("videos")
            .update({
              status: video.moderation_status === "under_review" ? "under_review" : "ready",
              playback_url: playbackUrl,
              thumbnail_url: thumbnailUrl,
              duration_seconds: event.data.duration
            })
            .eq("id", videoId);
        }
      }
      break;
    }
    case "video.asset.errored": {
      const assetId = event.data.id;
      const videoId = event.data.passthrough;
      const message = event.data.errors?.messages?.join("; ") ?? "Processing failed";
      await db
        .from("video_assets")
        .update({ status: "errored", error_message: message })
        .eq("provider_asset_id", assetId);
      if (videoId) {
        await db.from("videos").update({ status: "rejected" }).eq("id", videoId);
      }
      break;
    }
    default:
      // Unhandled event types are acknowledged so Mux stops retrying.
      break;
  }

  if (videoIdForJob) {
    await db
      .from("video_processing_jobs")
      .update({ status: "succeeded" })
      .eq("provider", provider.name)
      .eq("provider_event_id", providerEventId);
  }

  return c.json({ received: true, type: event.type });
});
