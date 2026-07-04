import Link from "next/link";
import { AdminMetricCard, AdminPageHeader } from "@vuqiro/ui/admin";
import { ErrorBanner, guardPage } from "../../components/PageGuard";
import { adminApiFetch } from "../../lib/adminApi";
import { fieldStr, type Row } from "../../lib/rows";

export default async function MonetizationOverviewPage() {
  const { denied } = await guardPage("/monetization");
  if (denied) return denied;

  const [catalog, products, payouts] = await Promise.all([
    adminApiFetch<{ packages: Row[]; versions: Row[] }>("/admin/monetization/packages"),
    adminApiFetch<{ products: Row[] }>("/admin/monetization/store-products"),
    adminApiFetch<{ payouts: Row[]; holds: Row[] }>("/admin/payouts")
  ]);

  const packages = catalog.ok ? catalog.data.packages : [];
  const versions = catalog.ok ? catalog.data.versions : [];
  const storeProducts = products.ok ? products.data.products : [];
  const liveProducts = storeProducts.filter((product) =>
    ["configured", "live"].includes(fieldStr(product, "status"))
  ).length;
  const payoutRows = payouts.ok ? payouts.data.payouts : [];

  return (
    <>
      <AdminPageHeader
        kicker="Monetization"
        title="Monetization overview"
        copy="Packages, price versions, store product mappings, RevenueCat sync and creator payouts. Store prices always come from Apple/Google via RevenueCat; the database is the mapping and versioning source of truth."
      />
      {!catalog.ok ? <ErrorBanner message={catalog.error} /> : null}
      <div className="grid">
        <AdminMetricCard
          label="Published packages"
          value={packages.filter((pkg) => fieldStr(pkg, "status") === "published").length}
          hint={`${packages.length} total`}
        />
        <AdminMetricCard label="Price versions" value={versions.length} />
        <AdminMetricCard label="Store products configured" value={liveProducts} hint={`${storeProducts.length} mappings`} />
        <AdminMetricCard
          label="Pending payouts"
          value={payoutRows.filter((payout) => ["pending", "payable"].includes(fieldStr(payout, "status"))).length}
        />
        <AdminMetricCard label="Held payouts" value={payoutRows.filter((payout) => fieldStr(payout, "status") === "held").length} hint="See payout controls" />
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
          ["/monetization/payouts", "Payouts", "Creator payout batches, holds and failures"],
          ["/monetization/wallet-transactions", "Wallet transactions", "Coin ledger + manual adjustments"],
          ["/monetization/purchases", "Purchases", "Store-verified purchase records"],
          ["/monetization/revenue", "Revenue ledgers", "Platform + creator revenue"]
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
