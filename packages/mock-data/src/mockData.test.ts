import { describe, expect, it } from "vitest";
import {
  mockAuditLogs,
  mockComments,
  mockCreators,
  mockLedgerEntries,
  mockNotifications,
  mockPackages,
  mockPackageVersions,
  mockPayouts,
  mockReports,
  mockStoreProducts,
  mockVideos,
  mockWalletTransactions
} from "./index";

describe("mock data spec minimums", () => {
  it("has at least 10 creators", () => expect(mockCreators.length).toBeGreaterThanOrEqual(10));
  it("has at least 25 videos", () => expect(mockVideos.length).toBeGreaterThanOrEqual(25));
  it("has at least 50 comments", () => expect(mockComments.length).toBeGreaterThanOrEqual(50));
  it("has at least 15 notifications", () => expect(mockNotifications.length).toBeGreaterThanOrEqual(15));
  it("has at least 20 wallet transactions", () =>
    expect(mockWalletTransactions.length).toBeGreaterThanOrEqual(20));
  it("has at least 20 reports", () => expect(mockReports.length).toBeGreaterThanOrEqual(20));
  it("has at least 20 audit logs", () => expect(mockAuditLogs.length).toBeGreaterThanOrEqual(20));
  it("has at least 10 payout records", () => expect(mockPayouts.length).toBeGreaterThanOrEqual(10));
});

describe("mock data referential integrity", () => {
  const creatorIds = new Set(mockCreators.map((creator) => creator.id));
  const videoIds = new Set(mockVideos.map((video) => video.id));
  const packageIds = new Set(mockPackages.map((pkg) => pkg.id));
  const versionIds = new Set(mockPackageVersions.map((version) => version.id));

  it("every video points to a known creator", () => {
    for (const video of mockVideos) {
      expect(creatorIds.has(video.creatorId), `video ${video.id} creator`).toBe(true);
    }
  });

  it("every comment points to a known video", () => {
    for (const comment of mockComments) {
      expect(videoIds.has(comment.videoId), `comment ${comment.id} video`).toBe(true);
    }
  });

  it("every reply points to a known parent comment", () => {
    const commentIds = new Set(mockComments.map((comment) => comment.id));
    for (const comment of mockComments) {
      if (comment.parentCommentId) {
        expect(commentIds.has(comment.parentCommentId), `reply ${comment.id}`).toBe(true);
      }
    }
  });

  it("every package version points to a known package", () => {
    for (const version of mockPackageVersions) {
      expect(packageIds.has(version.packageId), `version ${version.id}`).toBe(true);
    }
  });

  it("every store product points to a known package version", () => {
    for (const product of mockStoreProducts) {
      expect(versionIds.has(product.packageVersionId), `product ${product.id}`).toBe(true);
    }
  });

  it("every ledger entry and payout points to a known creator", () => {
    for (const entry of mockLedgerEntries) {
      expect(creatorIds.has(entry.creatorId), `ledger ${entry.id}`).toBe(true);
    }
    for (const payout of mockPayouts) {
      expect(creatorIds.has(payout.creatorId), `payout ${payout.id}`).toBe(true);
    }
  });

  it("ids are unique within each collection", () => {
    expect(videoIds.size).toBe(mockVideos.length);
    expect(creatorIds.size).toBe(mockCreators.length);
    expect(new Set(mockComments.map((comment) => comment.id)).size).toBe(mockComments.length);
  });
});
