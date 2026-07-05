import type { AdminRole } from "@vuqiro/types";

/**
 * Role-based access for the admin console. The API enforces RBAC again on
 * every endpoint — this map only controls navigation and page rendering.
 *
 * platform_superadmin implicitly has access to everything.
 */
const ROUTE_ACCESS: { prefix: string; roles: AdminRole[] }[] = [
  { prefix: "/dashboard", roles: ["admin", "moderator", "finance", "support"] },
  { prefix: "/analytics", roles: ["admin", "finance"] },
  { prefix: "/users", roles: ["admin", "moderator", "support"] },
  { prefix: "/creators", roles: ["admin", "moderator", "support"] },
  { prefix: "/videos", roles: ["admin", "moderator"] },
  { prefix: "/comments", roles: ["admin", "moderator"] },
  { prefix: "/moderation", roles: ["admin", "moderator"] },
  { prefix: "/reports", roles: ["admin", "moderator"] },
  { prefix: "/appeals", roles: ["admin", "moderator"] },
  { prefix: "/copyright-claims", roles: ["admin", "moderator"] },
  { prefix: "/fraud-safety", roles: ["admin", "moderator"] },
  { prefix: "/monetization/payouts", roles: ["admin", "finance"] },
  { prefix: "/monetization/wallet-transactions", roles: ["admin", "finance"] },
  { prefix: "/monetization/purchases", roles: ["admin", "finance"] },
  { prefix: "/monetization/revenue", roles: ["admin", "finance"] },
  { prefix: "/monetization", roles: ["admin", "finance"] },
  { prefix: "/ads", roles: ["admin", "finance"] },
  { prefix: "/notifications", roles: ["admin"] },
  { prefix: "/legal", roles: ["admin"] },
  { prefix: "/privacy", roles: ["admin", "support"] },
  { prefix: "/feature-flags", roles: ["admin"] },
  { prefix: "/settings", roles: ["admin"] },
  { prefix: "/integration-health", roles: ["admin"] },
  { prefix: "/support-cases", roles: ["admin", "support"] },
  { prefix: "/admin-users", roles: [] }, // superadmin only
  { prefix: "/audit-log", roles: ["admin"] },
  { prefix: "/app-store-readiness", roles: ["admin"] }
];

export function canAccessPath(role: AdminRole, path: string): boolean {
  if (role === "platform_superadmin") return true;
  // Longest-prefix match so /monetization/payouts wins over /monetization.
  const match = [...ROUTE_ACCESS]
    .sort((a, b) => b.prefix.length - a.prefix.length)
    .find((route) => path === route.prefix || path.startsWith(`${route.prefix}/`));
  if (!match) return false;
  return match.roles.includes(role);
}
