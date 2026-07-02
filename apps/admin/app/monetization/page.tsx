import Link from "next/link";
import { AdminMetricCard, AdminPageHeader } from "@vuqiro/ui/admin";
import { mockAdminMetrics, mockPackages, mockPackageVersions, mockPayouts, mockStoreProducts } from "@vuqiro/mock-data";

export default function MonetizationOverviewPage() {
  const liveProducts = mockStoreProducts.filter((product) => product.status === "configured" || product.status === "live").length;
  const heldPayouts = mockPayouts.filter((payout) => payout.status === "held").length;

  return (
    <>
      <AdminPageHeader
        kicker="Monetization"
        title="Monetization overview"
        copy="Packages, price versions, store product mappings, RevenueCat sync and creator payouts. Store prices always come from Apple/Google via RevenueCat; the database is the mapping and versioning source of truth."
      />
      <div className="grid">
        <AdminMetricCard label="Published packages" value={mockPackages.filter((pkg) => pkg.status === "published").length} hint={`${mockPackages.length} total`} />
        <AdminMetricCard label="Price versions" value={mockPackageVersions.length} />
        <AdminMetricCard label="Store products configured" value={liveProducts} hint={`${mockStoreProducts.length} mappings`} />
        <AdminMetricCard label="Coin revenue" value={`$${mockAdminMetrics.coinRevenue.toLocaleString()}`} />
        <AdminMetricCard label="MRR" value={`$${mockAdminMetrics.mrr.toLocaleString()}`} />
        <AdminMetricCard label="Pending payouts" value={`$${mockAdminMetrics.pendingPayouts.toLocaleString()}`} />
        <AdminMetricCard label="Held payouts" value={heldPayouts} hint="See payout controls" />
        <AdminMetricCard label="Refunds / chargebacks" value={`${mockAdminMetrics.refunds} / ${mockAdminMetrics.chargebacks}`} />
      </div>
      <div className="section-header">
        <h2>Manage</h2>
      </div>
      <div className="grid">
        {[
          ["/monetization/packages", "Packages", "Subscription tiers, coin packs and boosts"],
          ["/monetization/price-versions", "Price versions", "Versioned pricing with fee splits"],
          ["/monetization/store-products", "Store products", "Apple / Google product mappings"],
          ["/monetization/revenuecat", "RevenueCat", "Offerings, entitlements and webhook state"],
          ["/monetization/payouts", "Payouts", "Creator payout batches, holds and failures"]
        ].map(([href, title, copy]) => (
          <Link key={href} href={href} className="card">
            <div className="card-title">{title}</div>
            <p className="copy">{copy}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
