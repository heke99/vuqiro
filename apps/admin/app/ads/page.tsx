import Link from "next/link";
import { AdminMetricCard, AdminPageHeader } from "@vuqiro/ui/admin";
import { ErrorBanner, guardPage } from "../../components/PageGuard";
import { adminApiFetch } from "../../lib/adminApi";
import { fieldNum, usd, type Row } from "../../lib/rows";

export default async function AdsOverviewPage() {
  const { denied } = await guardPage("/ads");
  if (denied) return denied;

  const [advertisers, campaigns, reporting, revenue] = await Promise.all([
    adminApiFetch<{ advertisers: Row[] }>("/admin/ads/advertisers"),
    adminApiFetch<{ campaigns: Row[] }>("/admin/ads/campaigns"),
    adminApiFetch<{ reporting: Row[] }>("/admin/ads/reporting"),
    adminApiFetch<{ entries: Row[] }>("/admin/revenue/platform-ledger")
  ]);

  const totalImpressions = reporting.ok
    ? reporting.data.reporting.reduce((sum, row) => sum + fieldNum(row, "impressions"), 0)
    : 0;
  const totalClicks = reporting.ok
    ? reporting.data.reporting.reduce((sum, row) => sum + fieldNum(row, "clicks"), 0)
    : 0;
  const totalSpend = reporting.ok
    ? reporting.data.reporting.reduce((sum, row) => sum + fieldNum(row, "spentCents", "spent_cents"), 0)
    : 0;
  const adRevenue = revenue.ok
    ? revenue.data.entries
        .filter((entry) => ["ad_revenue", "sponsorship"].includes(String(entry.source)))
        .reduce((sum, entry) => sum + fieldNum(entry, "amount_cents", "amountCents"), 0)
    : 0;

  return (
    <>
      <AdminPageHeader
        kicker="Ads"
        title="Advertising overview"
        copy="Native ads and manually sold company sponsorships. Campaigns are served into the mobile feed with frequency caps, targeting and personalization opt-out honored server-side."
      />
      {!reporting.ok ? <ErrorBanner message={reporting.error} /> : null}
      <div className="grid">
        <AdminMetricCard label="Advertisers" value={advertisers.ok ? advertisers.data.advertisers.length : "—"} />
        <AdminMetricCard
          label="Active campaigns"
          value={campaigns.ok ? campaigns.data.campaigns.filter((campaign) => campaign.status === "active").length : "—"}
        />
        <AdminMetricCard label="Impressions" value={totalImpressions.toLocaleString()} />
        <AdminMetricCard label="Clicks" value={totalClicks.toLocaleString()} />
        <AdminMetricCard label="Delivery spend" value={usd(totalSpend)} />
        <AdminMetricCard label="Ads + sponsorship revenue" value={usd(adRevenue)} />
      </div>
      <div className="section-header">
        <h2>Manual sponsorship flow</h2>
      </div>
      <div className="card">
        <ol style={{ lineHeight: 2, color: "var(--muted)", paddingLeft: 20 }}>
          <li>
            Create the advertiser under <Link href="/ads/advertisers">Advertisers</Link> (the company never logs in).
          </li>
          <li>Create an ad account for billing, then a fixed_sponsorship campaign with the agreed price and flight dates.</li>
          <li>
            Add the creative under <Link href="/ads/creatives">Creatives</Link> (card, image or video) and approve it.
          </li>
          <li>
            Create + activate the deal under <Link href="/ads/sponsorships">Sponsorships</Link> — the fixed price books
            into the platform revenue ledger automatically.
          </li>
          <li>Activate the campaign; delivery and clicks appear under <Link href="/ads/reporting">Reporting</Link>.</li>
        </ol>
      </div>
    </>
  );
}
