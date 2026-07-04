import { AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { AdminApiAction } from "../../../components/AdminApiAction";
import { AdminForm } from "../../../components/AdminForm";
import { ErrorBanner, guardPage } from "../../../components/PageGuard";
import { adminApiFetch } from "../../../lib/adminApi";
import { fieldDate, fieldNum, fieldStr, usd, type Row } from "../../../lib/rows";

export default async function SponsorshipsPage() {
  const { identity, denied } = await guardPage("/ads/sponsorships");
  if (denied) return denied;
  const canManage = ["platform_superadmin", "admin"].includes(identity.admin.role);

  const [deals, advertisers, campaigns] = await Promise.all([
    adminApiFetch<{ deals: Row[] }>("/admin/ads/sponsorships"),
    adminApiFetch<{ advertisers: Row[] }>("/admin/ads/advertisers"),
    adminApiFetch<{ campaigns: Row[] }>("/admin/ads/campaigns")
  ]);

  return (
    <>
      <AdminPageHeader
        kicker="Ads"
        title="Direct sponsorship deals"
        copy="Manually sold fixed-price deals. Activating a deal books its full price into the platform revenue ledger and the advertiser's billing history."
      />
      {canManage && advertisers.ok ? (
        <AdminForm
          title="+ New sponsorship deal"
          path="/admin/ads/sponsorships"
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
              name: "campaignId",
              label: "Linked campaign (optional)",
              type: "select",
              options: [
                { value: "", label: "—" },
                ...(campaigns.ok
                  ? campaigns.data.campaigns.map((campaign) => ({
                      value: fieldStr(campaign, "id"),
                      label: fieldStr(campaign, "name")
                    }))
                  : [])
              ]
            },
            { name: "name", label: "Deal name", required: true },
            { name: "description", label: "Description", type: "textarea" },
            { name: "fixedPriceCents", label: "Fixed price (cents)", type: "number", required: true },
            { name: "currency", label: "Currency", defaultValue: "USD" },
            { name: "startsAt", label: "Starts", type: "datetime-local" },
            { name: "endsAt", label: "Ends", type: "datetime-local" },
            { name: "invoiceReference", label: "Invoice reference" }
          ]}
          transform={(values) => {
            if (!values.campaignId) delete values.campaignId;
            return values;
          }}
        />
      ) : null}
      {!deals.ok ? <ErrorBanner message={deals.error} /> : null}
      {deals.ok && deals.data.deals.length === 0 ? <div className="empty-state">No sponsorship deals yet.</div> : null}
      {deals.ok && deals.data.deals.length > 0 ? (
        <AdminTable<Row>
          columns={[
            {
              key: "deal",
              header: "Deal",
              render: (deal) => {
                const advertiser = (deal.advertisers ?? {}) as Row;
                return (
                  <>
                    <strong>{fieldStr(deal, "name")}</strong>
                    <br />
                    {fieldStr(advertiser, "name") || fieldStr(deal, "advertiserId", "advertiser_id")}
                  </>
                );
              }
            },
            { key: "status", header: "Status", render: (deal) => <AdminStatusBadge status={fieldStr(deal, "status")} /> },
            {
              key: "price",
              header: "Fixed price",
              render: (deal) => usd(fieldNum(deal, "fixed_price_cents", "fixedPriceCents"))
            },
            {
              key: "flight",
              header: "Flight",
              render: (deal) => `${fieldDate(deal, "starts_at", "startsAt")} → ${fieldDate(deal, "ends_at", "endsAt")}`
            },
            {
              key: "invoice",
              header: "Invoice",
              render: (deal) => fieldStr(deal, "invoice_reference", "invoiceReference") || "—"
            },
            {
              key: "actions",
              header: "Actions",
              render: (deal) => {
                if (!canManage) return <span className="metric-hint">Read-only</span>;
                const id = fieldStr(deal, "id");
                const status = fieldStr(deal, "status");
                return (
                  <div className="actions-cell">
                    {status === "draft" ? (
                      <AdminApiAction
                        label="Activate & book revenue"
                        path={`/admin/ads/sponsorships/${id}/activate`}
                        variant="success"
                      />
                    ) : null}
                    {status === "active" ? (
                      <AdminApiAction label="Complete" path={`/admin/ads/sponsorships/${id}/complete`} />
                    ) : null}
                  </div>
                );
              }
            }
          ]}
          rows={deals.data.deals}
        />
      ) : null}
    </>
  );
}
