import { beforeEach, describe, expect, it } from "vitest";
import { resetRateLimits } from "../lib/rateLimit";
import { createApp } from "../app";

/**
 * End-to-end access-control regression tests over the real routes (mock
 * mode). Scenario identities (via x-mock-user):
 *
 *   anonymous            no Authorization header
 *   user_free            logged-in viewer, no memberships
 *   user_member_a        active membership -> creator_003 (support)
 *   user_member_b        active membership -> creator_005 (plus)
 *   user_expired_member  EXPIRED membership -> creator_003
 *   user_follower        follows creator_002
 *   user_003             owns creator_003
 *
 * Fixture videos:
 *   video_001  public               (creator_001)
 *   video_002  unlock_with_coins    (creator_002)
 *   video_003  subscribers_only     (creator_003, tier support)  "creator A"
 *   video_007  subscribers_only     (creator_005, tier plus)     "creator B"
 *   video_026  private              (creator_003)
 *   video_027  followers_only       (creator_002)
 */

const app = createApp();

function headersFor(user?: string): Record<string, string> {
  if (!user) return { "content-type": "application/json" };
  return { authorization: "Bearer mock-token", "x-mock-user": user, "content-type": "application/json" };
}

type FeedBody = { items: ({ kind?: string; id: string; visibility: string; playbackUrl?: string } & Record<string, unknown>)[] };

async function feedVideoIds(path: string, user?: string): Promise<string[]> {
  const res = await app.request(path, { headers: headersFor(user) });
  expect(res.status).toBe(200);
  const body = (await res.json()) as FeedBody;
  return body.items.filter((item) => item.kind !== "ad").map((item) => item.id);
}

beforeEach(() => resetRateLimits());

describe("public viewing is free", () => {
  it("serves the public feed without auth or payment, with playable public videos", async () => {
    const res = await app.request("/feed/for-you");
    expect(res.status).toBe(200);
    const body = (await res.json()) as FeedBody;
    const videos = body.items.filter((item) => item.kind !== "ad");
    expect(videos.length).toBeGreaterThan(0);
    for (const video of videos) {
      expect(video.visibility).toBe("public");
      expect(video.playbackUrl).toBeTruthy();
    }
  });

  it("serves the public video detail endpoint without auth", async () => {
    const res = await app.request("/videos/video_001");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { video: { playbackUrl?: string } };
    expect(body.video.playbackUrl).toBeTruthy();
  });

  it("grants playback access to public videos for free users (no subscription required)", async () => {
    const res = await app.request("/videos/video_001/access", { headers: headersFor("user_free") });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { access: boolean; reason: string; playbackUrl?: string };
    expect(body).toMatchObject({ access: true, reason: "public" });
    expect(body.playbackUrl).toBeTruthy();
  });

  it("serves public creator profiles and their public videos to anonymous viewers", async () => {
    const profileRes = await app.request("/creators/creator_003");
    expect(profileRes.status).toBe(200);
    const videosRes = await app.request("/creators/creator_003/videos");
    expect(videosRes.status).toBe(200);
    const body = (await videosRes.json()) as FeedBody & { lockedCount: number };
    expect(body.items.length).toBeGreaterThan(0);
    for (const item of body.items) {
      expect(item.visibility).toBe("public");
    }
  });

  it("lets anonymous viewers read comments on public videos", async () => {
    const res = await app.request("/videos/video_001/comments");
    expect(res.status).toBe(200);
  });

  it("lets anonymous viewers share public videos", async () => {
    const res = await app.request("/videos/video_001/share", { method: "POST", body: "{}" });
    expect(res.status).toBe(201);
  });
});

describe("members-only videos are hidden from unauthorized viewers", () => {
  const gatedIds = ["video_003", "video_007", "video_026", "video_027"];

  it("keeps them out of the public feed", async () => {
    const ids = await feedVideoIds("/feed/for-you");
    for (const gated of gatedIds) expect(ids).not.toContain(gated);
  });

  it("keeps them out of the feed for logged-in free users", async () => {
    const ids = await feedVideoIds("/feed/for-you", "user_free");
    for (const gated of gatedIds) expect(ids).not.toContain(gated);
  });

  it("keeps them out of trending", async () => {
    const ids = await feedVideoIds("/feed/trending");
    for (const gated of gatedIds) expect(ids).not.toContain(gated);
  });

  it("keeps them out of hashtag feeds", async () => {
    // video_003 carries #build; a non-member searching the hashtag must not see it.
    const ids = await feedVideoIds("/feed/hashtag/build", "user_free");
    expect(ids).not.toContain("video_003");
  });

  it("keeps them out of search results and hashtag suggestions", async () => {
    const res = await app.request("/search?q=subscriber", { headers: headersFor("user_free") });
    const body = (await res.json()) as { videos: { id: string }[]; hashtags: string[] };
    expect(body.videos.map((video) => video.id)).not.toContain("video_003");
    expect(body.videos.map((video) => video.id)).not.toContain("video_025");
  });

  it("keeps them off the creator profile for non-members (aggregate count only)", async () => {
    const res = await app.request("/creators/creator_003/videos", { headers: headersFor("user_free") });
    const body = (await res.json()) as FeedBody & { lockedCount: number; teasers: unknown[] };
    expect(body.items.map((item) => item.id)).not.toContain("video_003");
    expect(body.items.map((item) => item.id)).not.toContain("video_026");
    expect(body.lockedCount).toBeGreaterThanOrEqual(1);
  });

  it("denies the direct detail request (404, not probeable)", async () => {
    for (const user of [undefined, "user_free", "user_member_b"]) {
      const res = await app.request("/videos/video_003", { headers: headersFor(user) });
      expect(res.status, `viewer=${user ?? "anonymous"}`).toBe(404);
    }
  });

  it("refuses playback access without a membership (no URL in the response)", async () => {
    const res = await app.request("/videos/video_003/access", { headers: headersFor("user_free") });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { access: boolean; reason: string; playbackUrl?: string };
    expect(body.access).toBe(false);
    expect(body.reason).toBe("subscription_required");
    expect(body.playbackUrl).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("http");
  });

  it("refuses playback access for expired memberships", async () => {
    const res = await app.request("/videos/video_003/access", { headers: headersFor("user_expired_member") });
    expect(res.status).toBe(403);
  });

  it("blocks engagement (like/comment) on videos the caller cannot view", async () => {
    const like = await app.request("/videos/video_003/like", { method: "POST", headers: headersFor("user_free") });
    expect(like.status).toBe(404);
    const comment = await app.request("/videos/video_003/comments", {
      method: "POST",
      headers: headersFor("user_free"),
      body: JSON.stringify({ text: "hi" })
    });
    expect(comment.status).toBe(404);
    const comments = await app.request("/videos/video_003/comments", { headers: headersFor("user_free") });
    expect(comments.status).toBe(404);
  });
});

describe("membership access is creator-specific", () => {
  it("member of creator A can watch creator A members-only videos", async () => {
    const res = await app.request("/videos/video_003/access", { headers: headersFor("user_member_a") });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { access: boolean; reason: string; playbackUrl?: string };
    expect(body).toMatchObject({ access: true, reason: "membership" });
    expect(body.playbackUrl).toBeTruthy();
  });

  it("member of creator A sees the members-only video on creator A's profile", async () => {
    const res = await app.request("/creators/creator_003/videos", { headers: headersFor("user_member_a") });
    const body = (await res.json()) as FeedBody;
    expect(body.items.map((item) => item.id)).toContain("video_003");
    // But playback still only comes from the access endpoint.
    const gated = body.items.find((item) => item.id === "video_003")!;
    expect(gated.playbackUrl).toBeUndefined();
  });

  it("member of creator A can like/comment on creator A members-only videos", async () => {
    const like = await app.request("/videos/video_003/like", { method: "POST", headers: headersFor("user_member_a") });
    expect(like.status).toBe(200);
  });

  it("member of creator A cannot access creator B members-only videos", async () => {
    const detail = await app.request("/videos/video_007", { headers: headersFor("user_member_a") });
    expect(detail.status).toBe(404);
    const access = await app.request("/videos/video_007/access", { headers: headersFor("user_member_a") });
    expect(access.status).toBe(403);
  });

  it("member of creator B can access creator B but not creator A", async () => {
    const accessB = await app.request("/videos/video_007/access", { headers: headersFor("user_member_b") });
    expect(accessB.status).toBe(200);
    const accessA = await app.request("/videos/video_003/access", { headers: headersFor("user_member_b") });
    expect(accessA.status).toBe(403);
  });

  it("the member feed only contains the caller's accessible gated videos", async () => {
    const idsA = await feedVideoIds("/feed/premium", "user_member_a");
    expect(idsA).toContain("video_003");
    expect(idsA).not.toContain("video_007");
    expect(idsA).not.toContain("video_026");
  });
});

describe("followers-only videos", () => {
  it("are visible to followers and hidden from everyone else", async () => {
    const follower = await app.request("/videos/video_027/access", { headers: headersFor("user_follower") });
    expect(follower.status).toBe(200);
    expect(((await follower.json()) as { reason: string }).reason).toBe("follower");

    const stranger = await app.request("/videos/video_027/access", { headers: headersFor("user_free") });
    expect(stranger.status).toBe(403);
    expect(((await stranger.json()) as { reason: string }).reason).toBe("follow_required");
  });
});

describe("private videos are owner/admin only", () => {
  it("404s for anonymous, free users, members and followers", async () => {
    for (const user of [undefined, "user_free", "user_member_a", "user_follower"]) {
      const detail = await app.request("/videos/video_026", { headers: headersFor(user) });
      expect(detail.status, `viewer=${user ?? "anonymous"}`).toBe(404);
    }
    const access = await app.request("/videos/video_026/access", { headers: headersFor("user_member_a") });
    expect(access.status).toBe(404);
  });

  it("is visible to the owning creator", async () => {
    const detail = await app.request("/videos/video_026", { headers: headersFor("user_003") });
    expect(detail.status).toBe(200);
    const access = await app.request("/videos/video_026/access", { headers: headersFor("user_003") });
    expect(access.status).toBe(200);
    expect(((await access.json()) as { reason: string }).reason).toBe("owner");
  });

  it("never appears on the creator profile for non-owners", async () => {
    const res = await app.request("/creators/creator_003/videos", { headers: headersFor("user_member_a") });
    const body = (await res.json()) as FeedBody;
    expect(body.items.map((item) => item.id)).not.toContain("video_026");
  });
});

describe("media URL protection", () => {
  it("never returns playback URLs for gated content on any listing surface", async () => {
    for (const [path, user] of [
      ["/feed/premium", "user_member_a"],
      ["/creators/creator_003/videos", "user_member_a"],
      ["/creators/creator_001/videos", "user_me"]
    ] as const) {
      const res = await app.request(path, { headers: headersFor(user) });
      const body = (await res.json()) as FeedBody;
      for (const item of body.items.filter((candidate) => candidate.kind !== "ad")) {
        if (item.visibility !== "public") {
          expect(item.playbackUrl, `${path} ${item.id}`).toBeUndefined();
        }
      }
    }
  });

  it("coin-unlock teasers carry no media URLs or private metadata", async () => {
    // creator_002 has coin-unlock video_002; anonymous viewers get a teaser.
    const res = await app.request("/creators/creator_002/videos");
    const body = (await res.json()) as { teasers: Record<string, unknown>[] };
    expect(body.teasers.length).toBeGreaterThan(0);
    for (const teaser of body.teasers) {
      expect(teaser.playbackUrl).toBeUndefined();
      expect(teaser.thumbnailUrl).toBeUndefined();
      expect(teaser.coinUnlockPrice).toBeTruthy();
      expect(JSON.stringify(teaser)).not.toContain("http");
    }
  });

  it("the denied access response never contains a URL", async () => {
    const res = await app.request("/videos/video_007/access", { headers: headersFor("user_free") });
    expect(res.status).toBe(403);
    expect(JSON.stringify(await res.json())).not.toContain("http");
  });
});

describe("membership statuses", () => {
  it("active grants access; cancelled does not (fixture user_me)", async () => {
    // user_me: active plus membership for creator_001 -> video_018 accessible.
    const active = await app.request("/videos/video_018/access", { headers: headersFor("user_me") });
    expect(active.status).toBe(200);
    // user_me: CANCELLED membership for creator_008 -> video_025 stays locked.
    const cancelled = await app.request("/videos/video_025/access", { headers: headersFor("user_me") });
    expect(cancelled.status).toBe(403);
  });

  it("grace_period keeps access during billing retries (deliberate rule)", async () => {
    // user_me holds a grace_period premium membership for creator_007;
    // video_012 is premium_tier_only (premium) by creator_007.
    const res = await app.request("/videos/video_012/access", { headers: headersFor("user_me") });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { reason: string }).reason).toBe("membership");
  });
});
