import { describe, expect, it } from "vitest";
import { MockPushProvider } from "./mockPushProvider";
import { getPushProvider, resetPushProviderCache } from "./getPushProvider";
import { MockPayoutsProvider } from "../payouts/mockPayoutsProvider";
import { MockVideoProvider } from "../video/mockVideoProvider";

describe("MockPushProvider", () => {
  it("records messages and returns ok receipts", async () => {
    const provider = new MockPushProvider();
    const receipts = await provider.send([
      { to: "ExponentPushToken[abc]", title: "Hi", body: "Test" },
      { to: "ExponentPushToken[def]", title: "Hi2", body: "Test2" }
    ]);
    expect(receipts).toHaveLength(2);
    expect(receipts.every((r) => r.status === "ok")).toBe(true);
    expect(provider.sent).toHaveLength(2);
  });

  it("reports mock health status", async () => {
    const provider = new MockPushProvider();
    const health = await provider.healthCheck();
    expect(health.provider).toBe("push");
    expect(health.status).toBe("mock");
  });
});

describe("getPushProvider", () => {
  it("defaults to the mock provider without PUSH_PROVIDER=expo", () => {
    resetPushProviderCache();
    const provider = getPushProvider();
    expect(provider.name).toBe("mock");
    resetPushProviderCache();
  });
});

describe("provider health checks", () => {
  it("mock video provider reports mock status", async () => {
    const health = await new MockVideoProvider().healthCheck();
    expect(health).toMatchObject({ provider: "video", status: "mock" });
  });

  it("mock payouts provider reports mock status", async () => {
    const health = await new MockPayoutsProvider().healthCheck();
    expect(health).toMatchObject({ provider: "payouts", status: "mock" });
  });
});
