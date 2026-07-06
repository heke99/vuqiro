"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import type { AdminRole } from "@vuqiro/types";
import { canAccessPath } from "../lib/rbac";

const groups: { label: string; items: [string, string][] }[] = [
  {
    label: "Overview",
    items: [
      ["/dashboard", "Dashboard"],
      ["/analytics", "Analytics"]
    ]
  },
  {
    label: "Community",
    items: [
      ["/users", "Users"],
      ["/creators", "Creators"],
      ["/videos", "Videos"],
      ["/comments", "Comments"]
    ]
  },
  {
    label: "Safety",
    items: [
      ["/moderation", "Moderation"],
      ["/reports", "Reports"],
      ["/appeals", "Appeals"],
      ["/copyright-claims", "Copyright claims"],
      ["/fraud-safety", "Fraud & safety"]
    ]
  },
  {
    label: "Monetization",
    items: [
      ["/monetization", "Overview"],
      ["/monetization/packages", "Packages"],
      ["/monetization/price-versions", "Price versions"],
      ["/monetization/store-products", "Store products"],
      ["/monetization/revenuecat", "RevenueCat"],
      ["/monetization/payouts", "Payouts"],
      ["/monetization/wallet-transactions", "Wallet transactions"],
      ["/monetization/purchases", "Purchases"],
      ["/monetization/revenue", "Revenue ledger"]
    ]
  },
  {
    label: "Ads",
    items: [
      ["/ads", "Overview"],
      ["/ads/advertisers", "Advertisers"],
      ["/ads/campaigns", "Campaigns"],
      ["/ads/creatives", "Creatives"],
      ["/ads/sponsorships", "Sponsorships"],
      ["/ads/reporting", "Reporting"]
    ]
  },
  {
    label: "Compliance",
    items: [
      ["/legal", "Legal documents"],
      ["/privacy", "Privacy & deletion"]
    ]
  },
  {
    label: "Platform",
    items: [
      ["/notifications", "Notifications"],
      ["/feature-flags", "Feature flags"],
      ["/settings", "Settings"],
      ["/integration-health", "Integration health"],
      ["/support-cases", "Support cases"],
      ["/admin-users", "Admin users"],
      ["/audit-log", "Audit log"],
      ["/app-store-readiness", "Store readiness"]
    ]
  }
];

export function AdminNav({ role }: { role: AdminRole }) {
  const pathname = usePathname();
  return (
    <nav className="nav">
      {groups.map((group) => {
        const visible = group.items.filter(([href]) => canAccessPath(role, href));
        if (visible.length === 0) return null;
        return (
          <React.Fragment key={group.label}>
            <div className="nav-group">{group.label}</div>
            {visible.map(([href, label]) => (
              <Link href={href} key={href} className={pathname === href ? "active" : ""}>
                {label}
              </Link>
            ))}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
