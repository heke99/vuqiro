import { AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { AdminApiAction } from "../../../components/AdminApiAction";
import { AdminForm } from "../../../components/AdminForm";
import { ErrorBanner, guardPage } from "../../../components/PageGuard";
import { adminApiFetch } from "../../../lib/adminApi";
import { fieldDate, fieldNum, fieldStr, usd, type Row } from "../../../lib/rows";

export default async function CampaignsPage() {
  const { identity, denied } = await guardPage("/ads/campaigns");
  if (denied) return denied;
  const canManage = ["platform_superadmin", "admin"].includes(identity.admin.role);

  const [campaigns, advertisers, accounts] = await Promise.all([
    adminApiFetch<{ campaigns: Row[] }>("/admin/ads/campaigns"),
    adminApiFetch<{ advertisers: Row[] }>("/admin/ads/advertisers"),
    adminApiFetch<{ accounts: Row[] }>("/admin/ads/accounts")
  ]);

  return (
    <>
      <AdminPageHeader
        kicker="Ads"
        title="Campaigns"
        copy="CPM, CPC, CPA and fixed-sponsorship campaigns. Serving requires an active campaign inside its flight window with budget remaining and an approved creative."
      />
      {canManage && advertisers.ok && accounts.ok ? (
        <AdminForm
          title="+ New campaign"
          path="/admin/ads/campaigns"
          fields={[
            {
              name: "advertiserId",
              label: "Advertiser",
              type: "select",
              options: advertisers.data.advertisers.map((advertiser) => ({
                value: fieldStr(advertiser, "id"),
                label: fieldStr(advertiser, "name")
              }))
            },
            {
              name: "adAccountId",
              label: "Ad account",
              type: "select",
              options: accounts.data.accounts.map((account) => ({
                value: fieldStr(account, "id"),
                label: fieldStr(account, "name")
              }))
            },
            { name: "name", label: "Campaign name", required: true },
            {
              name: "objective",
              label: "Objective",
              type: "select",
              options: ["awareness", "traffic", "conversions", "installs"].map((value) => ({ value, label: value }))
            },
            {
              name: "buyingType",
              label: "Buying type",
              type: "select",
              options: ["cpm", "cpc", "cpa", "fixed_sponsorship"].map((value) => ({ value, label: value }))
            },
            { name: "totalBudgetCents", label: "Total budget (cents)", type: "number" },
            { name: "dailyBudgetCents", label: "Daily budget (cents)", type: "number" },
            { name: "cpmPriceCents", label: "CPM price (cents / 1000 impressions)", type: "number" },
            { name: "cpcPriceCents", label: "CPC price (cents / click)", type: "number" },
            { name: "fixedPriceCents", label: "Fixed price (cents, sponsorships)", type: "number" },
            { name: "startsAt", label: "Starts", type: "datetime-local" },
            { name: "endsAt", label: "Ends", type: "datetime-local" }
          ]}
        />
      ) : null}
      {!campaigns.ok ? <ErrorBanner message={campaigns.error} /> : null}
      {campaigns.ok && campaigns.data.campaigns.length === 0 ? (
        <div className="empty-state">No campaigns yet.</div>
      ) : null}
      {campaigns.ok && campaigns.data.campaigns.length > 0 ? (
        <AdminTable<Row>
          columns={[
            {
              key: "campaign",
              header: "Campaign",
              render: (campaign) => {
                const advertiser = (campaign.advertisers ?? {}) as Row;
                return (
                  <>
                    <strong>{fieldStr(campaign, "name")}</strong>
                    <br />
                    {fieldStr(advertiser, "name") || fieldStr(campaign, "advertiserId", "advertiser_id")}
                  </>
                );
              }
            },
            { key: "status", header: "Status", render: (campaign) => <AdminStatusBadge status={fieldStr(campaign, "status")} /> },
            { key: "buying", header: "Buying", render: (campaign) => fieldStr(campaign, "buying_type", "buyingType") },
            {
              key: "budget",
              header: "Spent / budget",
              render: (campaign) => {
                const spent = fieldNum(campaign, "spent_cents", "spentCents");
                const budget = fieldNum(campaign, "total_budget_cents", "totalBudgetCents");
                return `${usd(spent)}${budget ? ` / ${usd(budget)}` : ""}`;
              }
            },
            {
              key: "flight",
              header: "Flight",
              render: (campaign) => `${fieldDate(campaign, "starts_at", "startsAt")} → ${fieldDate(campaign, "ends_at", "endsAt")}`
            },
            {
              key: "actions",
              header: "Actions",
              render: (campaign) => {
                if (!canManage) return <span className="metric-hint">Read-only</span>;
                const id = fieldStr(campaign, "id");
                const status = fieldStr(campaign, "status");
                return (
                  <div className="actions-cell">
                    {status === "draft" ? (
                      <AdminApiAction label="Submit for review" path={`/admin/ads/campaigns/${id}/submit`} />
                    ) : null}
                    {["pending_review", "draft"].includes(status) ? (
                      <>
                        <AdminApiAction label="Activate" path={`/admin/ads/campaigns/${id}/activate`} variant="success" />
                        <AdminApiAction label="Reject" path={`/admin/ads/campaigns/${id}/reject`} variant="danger" />
                      </>
                    ) : null}
                    {status === "active" ? (
                      <>
                        <AdminApiAction label="Pause" path={`/admin/ads/campaigns/${id}/pause`} variant="danger" />
                        <AdminApiAction label="Complete" path={`/admin/ads/campaigns/${id}/complete`} />
                      </>
                    ) : null}
                    {status === "paused" ? (
                      <AdminApiAction label="Resume" path={`/admin/ads/campaigns/${id}/resume`} variant="success" />
                    ) : null}
                  </div>
                );
              }
            }
          ]}
          rows={campaigns.data.campaigns}
        />
      ) : null}
    </>
  );
}
