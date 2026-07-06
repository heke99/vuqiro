import { Hono } from "hono";
import { z } from "zod";
import { mockCreators } from "@vuqiro/mock-data";
import { badRequest, notFound } from "../lib/errors";
import { notifyCreatorProfile } from "../lib/notify";
import { enforceRateLimit } from "../lib/rateLimit";
import { getServiceDb, isBackendConfigured } from "../lib/supabase";
import type { AppEnv } from "../middleware/auth";
import { attachUser, requireUser } from "../middleware/auth";

export const creatorRoutes = new Hono<AppEnv>();

creatorRoutes.use("*", attachUser);

const idParam = z.string().min(1).max(64);

creatorRoutes.get("/:id", async (c) => {
  const id = idParam.parse(c.req.param("id"));

  if (!isBackendConfigured()) {
    const creator = mockCreators.find((candidate) => candidate.id === id);
    if (!creator) throw notFound("Creator not found");
    return c.json({ creator, source: "mock" });
  }

  const db = getServiceDb()!;
  const { data, error } = await db
    .from("creators")
    .select(
      "id, category, verification_status, onboarding_status, monetization_enabled, tiers_enabled, created_at, profiles (handle, display_name, bio, status), creator_profiles (banner_tone, storefront_headline, storefront_about)"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw badRequest(error.message);
  if (!data || (data.profiles as { status?: string } | null)?.status === "banned") {
    throw notFound("Creator not found");
  }

  const [{ count: followerCount }, { count: subscriberCount }] = await Promise.all([
    db.from("follows").select("id", { count: "exact", head: true }).eq("creator_id", id),
    db
      .from("creator_memberships")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", id)
      .eq("status", "active")
  ]);

  return c.json({
    creator: { ...data, followerCount: followerCount ?? 0, subscriberCount: subscriberCount ?? 0 },
    source: "db"
  });
});

/** Public follower list (public profile fields only, active accounts only). */
creatorRoutes.get("/:id/followers", async (c) => {
  const id = idParam.parse(c.req.param("id"));
  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? "50"), 1), 100);
  const offset = Math.max(Number(c.req.query("offset") ?? "0"), 0);

  if (!isBackendConfigured()) {
    return c.json({ followers: [], total: 0, source: "mock" });
  }

  const db = getServiceDb()!;
  const { data, error, count } = await db
    .from("follows")
    .select("id, created_at, profiles!follows_follower_id_fkey (id, handle, display_name, avatar_url, status)", {
      count: "exact"
    })
    .eq("creator_id", id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw badRequest(error.message);

  const followers = (data ?? [])
    .map((row) => {
      const follower = row.profiles as unknown as {
        id: string;
        handle: string;
        display_name: string;
        avatar_url: string | null;
        status: string;
      } | null;
      if (!follower || follower.status !== "active") return null;
      return {
        profileId: follower.id,
        handle: follower.handle,
        displayName: follower.display_name,
        avatarUrl: follower.avatar_url ?? undefined,
        followedAt: row.created_at
      };
    })
    .filter(Boolean);
  return c.json({ followers, total: count ?? followers.length, source: "db" });
});

creatorRoutes.post("/:id/follow", requireUser, async (c) => {
  const id = idParam.parse(c.req.param("id"));
  const profile = c.get("profile")!;
  enforceRateLimit(`follow:${profile.id}`, 60, 60_000);

  if (!isBackendConfigured()) {
    return c.json({ following: true, source: "mock" });
  }

  const db = getServiceDb()!;
  const { data: existing } = await db
    .from("follows")
    .select("id")
    .eq("follower_id", profile.id)
    .eq("creator_id", id)
    .maybeSingle();

  if (existing) {
    await db.from("follows").delete().eq("id", existing.id);
    return c.json({ following: false, source: "db" });
  }

  const { error } = await db.from("follows").insert({ follower_id: profile.id, creator_id: id });
  if (error) throw badRequest(error.message);

  await notifyCreatorProfile(id, {
    type: "new_follower",
    title: "New follower",
    body: `@${profile.handle} started following you.`,
    relatedProfileId: profile.id
  });

  return c.json({ following: true, source: "db" });
});
