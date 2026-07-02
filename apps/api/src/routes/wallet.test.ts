import { beforeEach, describe, expect, it } from "vitest";
import { splitCoinRevenue } from "../lib/creatorLedger";
import { resetRateLimits } from "../lib/rateLimit";
import { createApp } from "../app";

const app = createApp();
const userHeaders = { authorization: "Bearer token", "content-type": "application/json" };

beforeEach(() => resetRateLimits());

describe("wallet endpoints (mock mode)", () => {
  it("requires auth for the wallet", async () => {
    const res = await app.request("/wallet");
    expect(res.status).toBe(401);
  });

  it("returns wallet + transactions", async () => {
    const res = await app.request("/wallet", { headers: userHeaders });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { wallet: { coinBalance: number }; transactions: unknown[] };
    expect(body.wallet.coinBalance).toBeGreaterThanOrEqual(0);
    expect(body.transactions.length).toBeGreaterThan(0);
  });

  it("validates tip amounts", async () => {
    const res = await app.request("/wallet/tip", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ creatorId: "creator_001", amount: -50, idempotencyKey: "key-123456" })
    });
    expect(res.status).toBe(400);
  });

  it("requires idempotency keys on all spends", async () => {
    for (const path of ["/wallet/tip", "/wallet/unlock", "/wallet/boost"]) {
      const res = await app.request(path, {
        method: "POST",
        headers: userHeaders,
        body: JSON.stringify({ creatorId: "creator_001", videoId: "video_002", amount: 50, coins: 50 })
      });
      expect(res.status, path).toBe(400);
    }
  });

  it("accepts valid tips", async () => {
    const res = await app.request("/wallet/tip", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ creatorId: "creator_001", amount: 100, idempotencyKey: "tip-key-0001" })
    });
    expect(res.status).toBe(201);
  });

  it("accepts valid unlocks", async () => {
    const res = await app.request("/wallet/unlock", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ videoId: "video_002", idempotencyKey: "unlock-key-01" })
    });
    expect(res.status).toBe(201);
  });

  it("accepts valid boosts", async () => {
    const res = await app.request("/wallet/boost", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ videoId: "video_001", coins: 250, idempotencyKey: "boost-key-01" })
    });
    expect(res.status).toBe(201);
  });

  it("rate limits boosts", async () => {
    let lastStatus = 0;
    for (let i = 0; i < 12; i += 1) {
      const res = await app.request("/wallet/boost", {
        method: "POST",
        headers: userHeaders,
        body: JSON.stringify({ videoId: "video_001", coins: 100, idempotencyKey: `boost-rl-${i}00000` })
      });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});

describe("revenue splits", () => {
  it("computes the tip/unlock split correctly", () => {
    // 100 coins = $1.00 gross; 20% platform + 15% store fee → $0.65 net.
    const split = splitCoinRevenue(100);
    expect(split.grossAmount).toBe(1);
    expect(split.platformFeeAmount).toBe(0.2);
    expect(split.storeFeeAmount).toBe(0.15);
    expect(split.netAmount).toBe(0.65);
  });

  it("never produces negative nets", () => {
    const split = splitCoinRevenue(1);
    expect(split.netAmount).toBeGreaterThanOrEqual(0);
  });
});

// Note: atomic balance behaviour (overdraw rejection, idempotent replay,
// reversal floor at zero) is asserted against real Postgres in
// scripts/validate-migrations.sh, which runs the wallet_spend/credit/reverse
// functions end-to-end.
