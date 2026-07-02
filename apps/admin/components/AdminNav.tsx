"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

const groups: { label: string; items: [string, string][] }[] = [
  {
    label: "Overview",
    items: [["/dashboard", "Dashboard"]]
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
      ["/monetization/payouts", "Payouts"]
    ]
  },
  {
    label: "Platform",
    items: [
      ["/notifications", "Notifications"],
      ["/legal", "Legal"],
      ["/feature-flags", "Feature flags"],
      ["/settings", "Settings"],
      ["/audit-log", "Audit log"],
      ["/app-store-readiness", "Store readiness"]
    ]
  }
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="nav">
      {groups.map((group) => (
        <React.Fragment key={group.label}>
          <div className="nav-group">{group.label}</div>
          {group.items.map(([href, label]) => (
            <Link href={href} key={href} className={pathname === href ? "active" : ""}>
              {label}
            </Link>
          ))}
        </React.Fragment>
      ))}
    </nav>
  );
}
