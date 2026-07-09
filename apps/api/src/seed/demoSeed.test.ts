import { describe, expect, it } from "vitest";
import { checkDemoSeedGuards, isLocalSupabaseUrl } from "./demoSeed";
import { buildDemoPlan, DEMO_CREATORS, DEMO_SEED_BATCH, deterministicUuid } from "./demoSeedData";

const localGuardInput = {
  nodeEnv: "development",
  appEnv: "development",
  supabaseUrl: "http://127.0.0.1:54321",
  allowDemoSeed: "true",
  allowDemoSeedRemote: undefined
};

describe("demo seed production guards", () => {
  it("allows local development with ALLOW_DEMO_SEED=true", () => {
    const result = checkDemoSeedGuards(localGuardInput);
    expect(result.allowed).toBe(true);
  });

  it("refuses NODE_ENV=production even with the allow flag", () => {
    const result = checkDemoSeedGuards({ ...localGuardInput, nodeEnv: "production" });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toContain("production");
  });

  it("refuses appEnv=production even with the allow flag", () => {
    const result = checkDemoSeedGuards({ ...localGuardInput, appEnv: "production" });
    expect(result.allowed).toBe(false);
  });

  it("refuses without ALLOW_DEMO_SEED=true", () => {
    for (const value of [undefined, "", "false", "1", "yes"]) {
      const result = checkDemoSeedGuards({ ...localGuardInput, allowDemoSeed: value });
      expect(result.allowed, `ALLOW_DEMO_SEED=${value}`).toBe(false);
    }
  });

  it("refuses without a configured database", () => {
    const result = checkDemoSeedGuards({ ...localGuardInput, supabaseUrl: undefined });
    expect(result.allowed).toBe(false);
  });

  it("refuses remote (production-looking) databases without the remote flag", () => {
    const result = checkDemoSeedGuards({
      ...localGuardInput,
      supabaseUrl: "https://abcdefgh.supabase.co"
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.reason).toContain("not a local database");
  });

  it("allows remote staging only with ALLOW_DEMO_SEED_REMOTE=true, with a warning", () => {
    const result = checkDemoSeedGuards({
      ...localGuardInput,
      supabaseUrl: "https://staging-project.supabase.co",
      allowDemoSeedRemote: "true"
    });
    expect(result.allowed).toBe(true);
    if (result.allowed) expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("detects local hostnames", () => {
    expect(isLocalSupabaseUrl("http://localhost:54321")).toBe(true);
    expect(isLocalSupabaseUrl("http://127.0.0.1:54321")).toBe(true);
    expect(isLocalSupabaseUrl("https://myproj.supabase.co")).toBe(false);
    expect(isLocalSupabaseUrl("not a url")).toBe(false);
  });
});

describe("demo seed plan", () => {
  const plan = buildDemoPlan();

  it("is deterministic (idempotent rerun input)", () => {
    expect(buildDemoPlan()).toEqual(plan);
    expect(deterministicUuid("video", "demo_forkful", "0")).toBe(deterministicUuid("video", "demo_forkful", "0"));
  });

  it("creates 12 demo creators with 10 videos each", () => {
    expect(plan.creators.length).toBe(12);
    for (const creator of plan.creators) {
      expect(creator.videos.length, creator.handle).toBe(10);
    }
  });

  it("uses invented demo handles/emails, never real-person identities", () => {
    for (const creator of plan.creators) {
      expect(creator.handle.startsWith("demo_"), creator.handle).toBe(true);
      expect(creator.email.endsWith("@vuqiro.test"), creator.email).toBe(true);
      expect(creator.handle).toMatch(/^[a-z0-9_.]+$/);
      expect(creator.handle.length).toBeLessThanOrEqual(30);
    }
  });

  it("gives each creator 7-8 public, 1-2 members-only and 1 private video", () => {
    for (const creator of plan.creators) {
      const byVisibility = new Map<string, number>();
      for (const video of creator.videos) {
        byVisibility.set(video.visibility, (byVisibility.get(video.visibility) ?? 0) + 1);
      }
      const publicCount = byVisibility.get("public") ?? 0;
      const membersOnly = byVisibility.get("subscribers_only") ?? 0;
      const privateCount = byVisibility.get("private") ?? 0;
      expect(publicCount, creator.handle).toBeGreaterThanOrEqual(7);
      expect(publicCount, creator.handle).toBeLessThanOrEqual(8);
      expect(membersOnly, creator.handle).toBeGreaterThanOrEqual(1);
      expect(membersOnly, creator.handle).toBeLessThanOrEqual(2);
      expect(privateCount, creator.handle).toBe(1);
      expect(publicCount + membersOnly + privateCount).toBe(10);
    }
  });

  it("gives every video playable media, thumbnail, duration and metadata", () => {
    for (const creator of plan.creators) {
      for (const video of creator.videos) {
        expect(video.playbackUrl, video.id).toMatch(/^https:\/\//);
        expect(video.thumbnailUrl, video.id).toMatch(/^https:\/\//);
        expect(video.durationSeconds).toBeGreaterThanOrEqual(15);
        expect(video.durationSeconds).toBeLessThanOrEqual(60);
        expect(video.caption.length).toBeGreaterThan(0);
        expect(video.hashtags.length).toBeGreaterThan(0);
        expect(video.category.length).toBeGreaterThan(0);
        expect(video.createdAt).toMatch(/^\d{4}-/);
      }
    }
  });

  it("seeds realistic banded metrics (views 500-250k, plausible ratios)", () => {
    for (const creator of plan.creators) {
      expect(creator.followerCount).toBeGreaterThanOrEqual(2_400);
      expect(creator.followerCount).toBeLessThanOrEqual(420_000);
      for (const video of creator.videos.filter((candidate) => candidate.visibility === "public")) {
        expect(video.watchCount, video.id).toBeGreaterThanOrEqual(500);
        expect(video.watchCount, video.id).toBeLessThanOrEqual(250_000);
        expect(video.likeCount).toBeLessThanOrEqual(video.watchCount * 0.1);
        expect(video.commentCount).toBeLessThanOrEqual(video.likeCount);
        expect(video.shareCount).toBeLessThanOrEqual(video.likeCount);
      }
      const privateVideo = creator.videos.find((candidate) => candidate.visibility === "private")!;
      expect(privateVideo.watchCount).toBe(0);
    }
  });

  it("marks every entity as demo/synthetic with the seed batch", () => {
    for (const creator of plan.creators) {
      expect(creator.isDemo).toBe(true);
      expect(creator.seedBatch).toBe(DEMO_SEED_BATCH);
      for (const video of creator.videos) {
        expect(video.isDemo).toBe(true);
        expect(video.seedBatch).toBe(DEMO_SEED_BATCH);
      }
    }
    for (const user of plan.users) {
      expect(user.isDemo).toBe(true);
      expect(user.seedBatch).toBe(DEMO_SEED_BATCH);
    }
    for (const event of plan.events) {
      expect(event.isSynthetic).toBe(true);
      expect(event.seedBatch).toBe(DEMO_SEED_BATCH);
    }
  });

  it("creates the access-scenario users with creator-specific memberships", () => {
    const handles = plan.users.map((user) => user.handle);
    expect(handles).toEqual(["demo_free_viewer", "demo_member_a", "demo_member_b"]);
    const memberA = plan.users.find((user) => user.handle === "demo_member_a")!;
    const memberB = plan.users.find((user) => user.handle === "demo_member_b")!;
    expect(memberA.memberOfHandle).toBe(plan.creators[0].handle);
    expect(memberB.memberOfHandle).toBe(plan.creators[1].handle);
    expect(memberA.memberOfHandle).not.toBe(memberB.memberOfHandle);
    const freeViewer = plan.users.find((user) => user.handle === "demo_free_viewer")!;
    expect(freeViewer.memberOfHandle).toBeUndefined();
  });

  it("never plans monetization rows (payouts/ads stay clean of demo data)", () => {
    // The plan's shape is the complete write surface of the seed: profiles,
    // creators, videos, memberships and synthetic events. No ledger,
    // purchase, payout or ad entities exist anywhere in it.
    expect(Object.keys(plan).sort()).toEqual(["creators", "events", "seedBatch", "users"]);
    const serialized = JSON.stringify(plan);
    for (const forbidden of ["ledger", "payout", "purchase", "ad_campaign", "advertiser", "revenue"]) {
      expect(serialized.includes(forbidden), forbidden).toBe(false);
    }
  });

  it("only emits synthetic events pointing at plan videos", () => {
    const videoIds = new Set(plan.creators.flatMap((creator) => creator.videos.map((video) => video.id)));
    expect(plan.events.length).toBeGreaterThan(0);
    for (const event of plan.events) {
      expect(videoIds.has(event.videoId)).toBe(true);
    }
  });

  it("keeps captions consistent with the visibility layout", () => {
    DEMO_CREATORS.forEach((def) => {
      expect(def.captions.length, def.handle).toBe(10);
      expect(def.captions[9].toLowerCase()).toContain("private");
    });
  });
});
