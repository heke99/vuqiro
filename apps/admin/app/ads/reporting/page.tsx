import { AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { ErrorBanner, guardPage } from "../../../components/PageGuard";
import { adminApiFetch } from "../../../lib/adminApi";
import { fieldDate, fieldNum, fieldStr, usd, type Row } from "../../../lib/rows";

export default async function AdsReportingPage() {
  const { denied } = await guardPage("/ads/reporting");
  if (denied) return denied;

  const [reporting, billing, adReports] = await Promise.all([
    adminApiFetch<{ reporting: Row[] }>("/admin/ads/reporting"),
    adminApiFetch<{ events: Row[] }>("/admin/ads/billing"),
    adminApiFetch<{ reports: Row[] }>("/admin/ads/reports")
  ]);

  return (
    <>
      <AdminPageHeader
        kicker="Ads"
        title="Delivery reporting & billing"
        copy="Impressions, clicks, conversions and billing events per campaign. CPM/CPC charges reconcile automatically into the platform revenue ledger."
      />
      {!reporting.ok ? <ErrorBanner message={reporting.error} /> : null}
      {reporting.ok && reporting.data.reporting.length > 0 ? (
        <AdminTable<Row>
          columns={[
            { key: "campaign", header: "Campaign", render: (row) => <strong>{fieldStr(row, "campaignName")}</strong> },
            { key: "status", header: "Status", render: (row) => <AdminStatusBadge status={fieldStr(row, "status")} /> },
            { key: "buying", header: "Buying", render: (row) => fieldStr(row, "buyingType") },
            { key: "impressions", header: "Impressions", render: (row) => fieldNum(row, "impressions").toLocaleString() },
            { key: "clicks", header: "Clicks", render: (row) => fieldNum(row, "clicks").toLocaleString() },
            {
              key: "ctr",
              header: "CTR",
              render: (row) => {
                const impressions = fieldNum(row, "impressions");
                const clicks = fieldNum(row, "clicks");
                return impressions > 0 ? `${((clicks / impressions) * 100).toFixed(2)}%` : "—";
              }
            },
            { key: "conversions", header: "Conversions", render: (row) => fieldNum(row, "conversions") },
            { key: "spend", header: "Spend", render: (row) => usd(fieldNum(row, "spentCents", "spent_cents")) }
          ]}
          rows={reporting.data.reporting}
        />
      ) : (
        <div className="empty-state">No campaigns to report.</div>
      )}

      <div className="section-header">
        <h2>Billing events</h2>
      </div>
      {billing.ok && billing.data.events.length > 0 ? (
        <AdminTable<Row>
          columns={[
            { key: "type", header: "Type", render: (event) => <strong>{fieldStr(event, "type")}</strong> },
            { key: "amount", header: "Amount", render: (event) => usd(fieldNum(event, "amount_cents", "amountCents")) },
            { key: "description", header: "Description", render: (event) => fieldStr(event, "description") },
            { key: "when", header: "When", render: (event) => fieldDate(event, "created_at", "createdAt") }
          ]}
          rows={billing.data.events}
        />
      ) : (
        <div className="empty-state">No billing events yet — they appear as CPM/CPC delivery accrues.</div>
      )}

      <div className="section-header">
        <h2>User reports against ads</h2>
      </div>
      {adReports.ok && adReports.data.reports.length > 0 ? (
        <AdminTable<Row>
          columns={[
            { key: "reason", header: "Reason", render: (report) => <strong>{fieldStr(report, "reason")}</strong> },
            { key: "details", header: "Details", render: (report) => fieldStr(report, "details").slice(0, 100) || "—" },
            { key: "status", header: "Status", render: (report) => <AdminStatusBadge status={fieldStr(report, "status")} /> },
            { key: "when", header: "When", render: (report) => fieldDate(report, "created_at", "createdAt") }
          ]}
          rows={adReports.data.reports}
        />
      ) : (
        <div className="empty-state">No ad reports.</div>
      )}
    </>
  );
}
