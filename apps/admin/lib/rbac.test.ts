import { describe, expect, it } from "vitest";
import { canAccessPath } from "./rbac";

describe("admin RBAC", () => {
  it("gives platform superadmins access to everything", () => {
    for (const path of ["/dashboard", "/admin-users", "/ads/campaigns", "/monetization/payouts", "/settings"]) {
      expect(canAccessPath("platform_superadmin", path)).toBe(true);
    }
  });

  it("blocks everyone but superadmins from admin-users", () => {
    expect(canAccessPath("admin", "/admin-users")).toBe(false);
    expect(canAccessPath("moderator", "/admin-users")).toBe(false);
    expect(canAccessPath("finance", "/admin-users")).toBe(false);
    expect(canAccessPath("support", "/admin-users")).toBe(false);
  });

  it("scopes moderators to safety surfaces", () => {
    expect(canAccessPath("moderator", "/moderation")).toBe(true);
    expect(canAccessPath("moderator", "/appeals")).toBe(true);
    expect(canAccessPath("moderator", "/copyright-claims")).toBe(true);
    expect(canAccessPath("moderator", "/videos")).toBe(true);
    expect(canAccessPath("moderator", "/monetization/payouts")).toBe(false);
    expect(canAccessPath("moderator", "/ads")).toBe(false);
  });

  it("scopes finance to money surfaces", () => {
    expect(canAccessPath("finance", "/monetization/payouts")).toBe(true);
    expect(canAccessPath("finance", "/monetization/revenue")).toBe(true);
    expect(canAccessPath("finance", "/monetization/wallet-transactions")).toBe(true);
    expect(canAccessPath("finance", "/ads/reporting")).toBe(true);
    expect(canAccessPath("finance", "/moderation")).toBe(false);
    expect(canAccessPath("finance", "/users")).toBe(false);
  });

  it("scopes support to users and support cases", () => {
    expect(canAccessPath("support", "/users")).toBe(true);
    expect(canAccessPath("support", "/support-cases")).toBe(true);
    expect(canAccessPath("support", "/privacy")).toBe(true);
    expect(canAccessPath("support", "/moderation")).toBe(false);
    expect(canAccessPath("support", "/monetization")).toBe(false);
  });

  it("uses longest-prefix matching for nested routes", () => {
    // /monetization is finance-scoped, but the payouts subpage stays allowed.
    expect(canAccessPath("finance", "/monetization/payouts")).toBe(true);
    expect(canAccessPath("finance", "/monetization")).toBe(true);
    // detail pages inherit the list page rule
    expect(canAccessPath("support", "/users/abc-123")).toBe(true);
  });

  it("denies unknown paths for non-superadmins", () => {
    expect(canAccessPath("admin", "/secret-lab")).toBe(false);
  });
});
