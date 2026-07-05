import { AdminMetricCard, AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { AdminApiAction } from "../../components/AdminApiAction";
import { AdminForm } from "../../components/AdminForm";
import { AdminSignIn } from "../../components/AdminSignIn";
import { ErrorBanner } from "../../components/PageGuard";
import { advertiserApiFetch, getAdvertiserSession } from "../../lib/advertiserApi";
import { field, fieldNum, fieldStr, usd, type Row } from "../../lib/rows";

export const dynamic = "force-dynamic";

type ReportingRow = {
  id?: string;
  campaignId: string;
  campaignName: string;
  status: string;
  impressions: number;
  clicks: number;
  spentCents: number;
};

/**
 * Advertiser self-serve portal. Any signed-in user can open it; the API
 * scopes all data to advertisers whose owner_profile_id matches the caller.
 * Campaigns created here are drafts and require Vuqiro admin review before
 * they can serve.
 */
export default async function AdvertiserPortal() {
  const session = await getAdvertiserSession();
  if (!session) {
    return <AdminSignIn />;
  }

  const [me, campaigns, reporting] = await Promise.all([
    advertiserApiFetch<{ advertisers: Row[]; accounts: Row[] }>("/advertiser/me"),
    advertiserApiFetch<{ campaigns: Row[] }>("/advertiser/campaigns"),
    advertiserApiFetch<{ reporting: ReportingRow[] }>("/advertiser/reporting")
  ]);

  const advertisers = me.ok ? me.data.advertisers : [];
  const totalSpend = reporting.ok ? reporting.data.reporting.reduce((sum, row) => sum + row.spentCents, 0) : 0;
  const totalImpressions = reporting.ok ? reporting.data.reporting.reduce((sum, row) => sum + row.impressions, 0) : 0;
  const totalClicks = reporting.ok ? reporting.data.reporting.reduce((sum, row) => sum + row.clicks, 0) : 0;

  return (
    <div className="content" style={{ maxWidth: 1080, margin: "0 auto", padding: 24 }}>
      <AdminPageHeader
        kicker="Vuqiro Ads"
        title="Advertiser portal"
        copy={`Manage your campaigns and see delivery results. New campaigns start as drafts and go live after Vuqiro review. Signed in${session.mode === "real" ? ` as ${session.email}` : " (mock mode)"}.`}
      />

      {!me.ok ? <ErrorBanner message={me.error} /> : null}
      {me.ok && advertisers.length === 0 ? (
        <div className="card">
          <div className="card-title">No advertiser account linked</div>
          <p className="copy">
            Your Vuqiro account is not linked to an advertiser yet. Contact the Vuqiro ads team to set up your
            advertiser account — once linked, your campaigns and reporting appear here.
          </p>
        </div>
      ) : null}

      {advertisers.length > 0 ? (
        <>
          <div className="grid">
            <AdminMetricCard label="Advertisers" value={advertisers.length} />
            <AdminMetricCard label="Impressions" value={totalImpressions.toLocaleString()} />
            <AdminMetricCard label="Clicks" value={totalClicks.toLocaleString()} />
            <AdminMetricCard label="Total spend" value={usd(totalSpend)} />
          </div>

          <div className="section-header">
            <h2>Your campaigns</h2>
          </div>
          <AdminForm
            title="Create campaign (draft)"
            path="/advertiser/campaigns"
            fields={[
              {
                name: "advertiserId",
                label: "Advertiser",
                type: "select",
                required: true,
                options: advertisers.map((advertiser) => ({
                  value: fieldStr(advertiser, "id"),
                  label: fieldStr(advertiser, "name")
                }))
              },
              { name: "name", label: "Campaign name", required: true, placeholder: "Summer launch" },
              {
                name: "objective",
                label: "Objective",
                type: "select",
                options: [
                  { value: "awareness", label: "Awareness" },
                  { value: "traffic", label: "Traffic" },
                  { value: "conversions", label: "Conversions" }
                ]
              },
              {
                name: "buyingType",
                label: "Buying type",
                type: "select",
                options: [
                  { value: "cpm", label: "CPM (per 1000 impressions)" },
                  { value: "cpc", label: "CPC (per click)" }
                ]
              },
              { name: "totalBudgetCents", label: "Total budget (cents, min 1000)", type: "number", required: true },
              { name: "dailyBudgetCents", label: "Daily budget (cents, optional)", type: "number" },
              { name: "startsAt", label: "Start", type: "datetime-local" },
              { name: "endsAt", label: "End", type: "datetime-local" }
            ]}
          />
          {!campaigns.ok ? <ErrorBanner message={campaigns.error} /> : null}
          {campaigns.ok && campaigns.data.campaigns.length === 0 ? (
            <div className="empty-state">No campaigns yet — create your first draft above.</div>
          ) : null}
          {campaigns.ok && campaigns.data.campaigns.length > 0 ? (
            <AdminTable<Row>
              columns={[
                { key: "name", header: "Campaign", render: (campaign) => <strong>{fieldStr(campaign, "name")}</strong> },
                { key: "status", header: "Status", render: (campaign) => <AdminStatusBadge status={fieldStr(campaign, "status")} /> },
                { key: "type", header: "Type", render: (campaign) => fieldStr(campaign, "buying_type", "buyingType") },
                {
                  key: "budget",
                  header: "Budget / spent",
                  render: (campaign) =>
                    `${usd(fieldNum(campaign, "total_budget_cents", "totalBudgetCents"))} / ${usd(fieldNum(campaign, "spent_cents", "spentCents"))}`
                },
                {
                  key: "actions",
                  header: "Actions",
                  render: (campaign) => {
                    const id = fieldStr(campaign, "id");
                    const status = fieldStr(campaign, "status");
                    return (
                      <div className="actions-cell">
                        {status === "draft" ? (
                          <AdminApiAction label="Submit for review" path={`/advertiser/campaigns/${id}/submit`} variant="success" />
                        ) : null}
                        {status === "active" ? (
                          <AdminApiAction label="Pause" path={`/advertiser/campaigns/${id}/pause`} />
                        ) : null}
                        {status === "paused" ? (
                          <AdminApiAction label="Resume" path={`/advertiser/campaigns/${id}/resume`} variant="success" />
                        ) : null}
                        {field(campaign, "status") === "pending_review" ? (
                          <span className="metric-hint">In review by Vuqiro</span>
                        ) : null}
                      </div>
                    );
                  }
                }
              ]}
              rows={campaigns.data.campaigns}
            />
          ) : null}

          <div className="section-header">
            <h2>Delivery reporting</h2>
          </div>
          {!reporting.ok ? <ErrorBanner message={reporting.error} /> : null}
          {reporting.ok && reporting.data.reporting.length > 0 ? (
            <AdminTable<ReportingRow>
              columns={[
                { key: "name", header: "Campaign", render: (row) => <strong>{row.campaignName}</strong> },
                { key: "status", header: "Status", render: (row) => <AdminStatusBadge status={row.status} /> },
                { key: "impressions", header: "Impressions", render: (row) => row.impressions.toLocaleString() },
                { key: "clicks", header: "Clicks", render: (row) => row.clicks.toLocaleString() },
                {
                  key: "ctr",
                  header: "CTR",
                  render: (row) => (row.impressions > 0 ? `${((row.clicks / row.impressions) * 100).toFixed(2)}%` : "—")
                },
                { key: "spend", header: "Spend", render: (row) => usd(row.spentCents) }
              ]}
              rows={reporting.data.reporting.map((row) => ({ ...row, id: row.campaignId }))}
            />
          ) : null}
          {reporting.ok && reporting.data.reporting.length === 0 ? (
            <div className="empty-state">Reporting appears once campaigns start delivering.</div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
