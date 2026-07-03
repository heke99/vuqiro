import { AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { ErrorBanner, guardPage } from "../../components/PageGuard";
import { adminApiFetch } from "../../lib/adminApi";
import { fieldDate, fieldStr, type Row } from "../../lib/rows";

export default async function ReportsPage() {
  const { denied } = await guardPage("/reports");
  if (denied) return denied;
  const result = await adminApiFetch<{ reports: Row[]; cases: Row[] }>("/admin/moderation");

  return (
    <>
      <AdminPageHeader
        kicker="Safety"
        title="Reports"
        copy="All user-submitted reports. Every report attaches to a moderation case; decisions happen on the Moderation page."
      />
      {!result.ok ? <ErrorBanner message={result.error} /> : null}
      {result.ok && result.data.reports.length === 0 ? <div className="empty-state">No reports.</div> : null}
      {result.ok && result.data.reports.length > 0 ? (
        <AdminTable<Row>
          columns={[
            {
              key: "target",
              header: "Target",
              render: (report) => (
                <>
                  <strong>{fieldStr(report, "target_type", "targetType")}</strong>
                  <br />
                  {fieldStr(report, "target_id", "targetId")}
                </>
              )
            },
            { key: "reason", header: "Reason", render: (report) => fieldStr(report, "reason") },
            { key: "details", header: "Details", render: (report) => fieldStr(report, "details").slice(0, 90) || "—" },
            { key: "status", header: "Status", render: (report) => <AdminStatusBadge status={fieldStr(report, "status")} /> },
            {
              key: "case",
              header: "Case",
              render: (report) => fieldStr(report, "moderation_case_id", "moderationCaseId") || "—"
            },
            { key: "when", header: "When", render: (report) => fieldDate(report, "created_at", "createdAt") }
          ]}
          rows={result.data.reports}
        />
      ) : null}
    </>
  );
}
