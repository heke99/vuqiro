import { describe, expect, it } from "vitest";
import { rankVideos, scoreVideo, type RankingInput } from "./ranking";

const NOW = new Date("2026-07-02T12:00:00Z");

function makeInput(overrides: Partial<RankingInput> = {}): RankingInput {
  return {
    videoId: "v1",
    creatorId: "c1",
    createdAt: "2026-07-02T06:00:00Z",
    watchCount: 10000,
    likeCount: 500,
    commentCount: 50,
    saveCount: 80,
    shareCount: 40,
    completionRate: 0.6,
    rewatchRate: 0.1,
    skipRate: 0.1,
    safetyScore: 100,
    moderationStatus: "visible",
    reportCount: 0,
    creatorFollowerCount: 50000,
    creatorVerified: true,
    creatorVideoCount: 20,
    ...overrides
  };
}

describe("ranking determinism", () => {
  it("produces identical scores for identical inputs", () => {
    const a = scoreVideo(makeInput(), NOW);
    const b = scoreVideo(makeInput(), NOW);
    expect(a.score).toBe(b.score);
    expect(a.factors).toEqual(b.factors);
  });

  it("orders deterministically with a videoId tie-break", () => {
    const inputs = [makeInput({ videoId: "b" }), makeInput({ videoId: "a" })];
    const ranked = rankVideos(inputs, NOW);
    expect(ranked.map((item) => item.videoId)).toEqual(["a", "b"]);
  });

  it("explains every factor", () => {
    const result = scoreVideo(makeInput(), NOW);
    const names = result.factors.map((factor) => factor.name);
    expect(names).toContain("engagement_rate");
    expect(names).toContain("completion_rate");
    expect(names).toContain("freshness");
    expect(names).toContain("safety");
    expect(names).toContain("report_penalty");
  });
});

describe("ranking rules", () => {
  it("downranks reported content", () => {
    const clean = scoreVideo(makeInput(), NOW);
    const reported = scoreVideo(makeInput({ reportCount: 5 }), NOW);
    expect(reported.score).toBeLessThan(clean.score);
  });

  it("downranks unsafe content", () => {
    const safe = scoreVideo(makeInput(), NOW);
    const unsafe = scoreVideo(makeInput({ safetyScore: 30 }), NOW);
    expect(unsafe.score).toBeLessThan(safe.score);
  });

  it("suppresses limited-distribution content heavily", () => {
    const visible = scoreVideo(makeInput(), NOW);
    const limited = scoreVideo(makeInput({ moderationStatus: "limited" }), NOW);
    expect(limited.score).toBeLessThan(visible.score * 0.5);
  });

  it("does not let boosts bypass moderation or reports", () => {
    const boostedReported = scoreVideo(makeInput({ boostScore: 1, reportCount: 3 }), NOW);
    const boostedClean = scoreVideo(makeInput({ boostScore: 1 }), NOW);
    const boostFactorReported = boostedReported.factors.find((factor) => factor.name === "boost");
    const boostFactorClean = boostedClean.factors.find((factor) => factor.name === "boost");
    expect(boostFactorReported?.contribution).toBe(0);
    expect(boostFactorClean?.contribution).toBeGreaterThan(0);
  });

  it("gives new creators a cold-start floor", () => {
    const newcomer = scoreVideo(
      makeInput({ creatorFollowerCount: 50, creatorVideoCount: 2, watchCount: 100, likeCount: 5 }),
      NOW
    );
    const quality = newcomer.factors.find((factor) => factor.name === "creator_quality");
    expect(quality!.value).toBeGreaterThanOrEqual(0.35);
  });

  it("downranks spammy high-volume low-engagement creators", () => {
    const normal = scoreVideo(makeInput(), NOW);
    const spam = scoreVideo(
      makeInput({ creatorVideoCount: 80, watchCount: 100000, likeCount: 10, commentCount: 1, saveCount: 0, shareCount: 0 }),
      NOW
    );
    const spamPenalty = spam.factors.find((factor) => factor.name === "spam_penalty");
    expect(spamPenalty!.contribution).toBeLessThan(0);
    expect(spam.score).toBeLessThan(normal.score);
  });

  it("boosts the viewer's followed/subscribed creators", () => {
    const stranger = scoreVideo(makeInput(), NOW);
    const followed = scoreVideo(makeInput({ viewerFollowsCreator: true, viewerSubscribedToCreator: true }), NOW);
    expect(followed.score).toBeGreaterThan(stranger.score);
  });

  it("prefers fresher content, all else equal", () => {
    const fresh = scoreVideo(makeInput({ createdAt: "2026-07-02T11:00:00Z" }), NOW);
    const old = scoreVideo(makeInput({ createdAt: "2026-06-01T11:00:00Z" }), NOW);
    expect(fresh.score).toBeGreaterThan(old.score);
  });

  it("penalizes high skip rates", () => {
    const engaging = scoreVideo(makeInput({ skipRate: 0 }), NOW);
    const skipped = scoreVideo(makeInput({ skipRate: 0.9 }), NOW);
    expect(skipped.score).toBeLessThan(engaging.score);
  });
});

describe("analytics endpoints", () => {
  it("requires admin for platform analytics", async () => {
    const { createApp } = await import("../app");
    const app = createApp();
    const res = await app.request("/admin/analytics");
    expect(res.status).toBe(401);
    const ok = await app.request("/admin/analytics", { headers: { authorization: "Bearer admin" } });
    expect(ok.status).toBe(200);
  });

  it("serves creator self-analytics to authenticated users", async () => {
    const { createApp } = await import("../app");
    const app = createApp();
    const res = await app.request("/creators/me/analytics", { headers: { authorization: "Bearer token" } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { analytics: { views: number } };
    expect(body.analytics.views).toBeGreaterThanOrEqual(0);
  });
});
