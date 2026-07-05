import { describe, expect, it, vi } from "vitest";

// The API client transitively imports the Supabase RN client; mock it so the
// pure watch-outcome logic is testable in Node.
vi.mock("../api/client", () => ({
  isApiConfigured: () => false,
  apiFetch: vi.fn()
}));

const { computeWatchOutcome, QUICK_SKIP_THRESHOLD_MS } = await import("./feedTracking");

describe("computeWatchOutcome", () => {
  it("counts short abandoned views as quick skips", () => {
    const outcome = computeWatchOutcome(500, false);
    expect(outcome.skippedQuickly).toBe(true);
    expect(outcome.qualifiedView).toBe(false);
  });

  it("counts watches past the threshold as qualified views", () => {
    const outcome = computeWatchOutcome(QUICK_SKIP_THRESHOLD_MS + 1, false);
    expect(outcome.skippedQuickly).toBe(false);
    expect(outcome.qualifiedView).toBe(true);
  });

  it("never marks a completed watch as a skip, even when very short", () => {
    const outcome = computeWatchOutcome(800, true);
    expect(outcome.skippedQuickly).toBe(false);
    expect(outcome.qualifiedView).toBe(true);
  });
});
