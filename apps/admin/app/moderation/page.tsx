import { AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { AdminApiAction } from "../../components/AdminApiAction";
import { ErrorBanner, guardPage } from "../../components/PageGuard";
import { adminApiFetch } from "../../lib/adminApi";
import { fieldDate, fieldNum, fieldStr, type Row } from "../../lib/rows";

const decisions: { action: string; label: string; variant?: "danger" | "success" }[] = [
  { action: "no_action", label: "No action", variant: "success" },
  { action: "limit_distribution", label: "Limit" },
  { action: "remove_content", label: "Remove", variant: "danger" },
  { action: "age_restrict", label: "Age-restrict" },
  { action: "suspend_user", label: "Suspend user", variant: "danger" },
  { action: "ban_user", label: "Ban user", variant: "danger" },
  { action: "restore_content", label: "Restore", variant: "success" }
];

export default async function ModerationPage() {
  const { identity, denied } = await guardPage("/moderation");
  if (denied) return denied;
  const canDecide = ["platform_superadmin", "admin", "moderator"].includes(identity.admin.role);
  const result = await adminApiFetch<{ cases: Row[]; reports: Row[] }>("/admin/moderation");

  const cases = result.ok ? result.data.cases : [];
  const reports = result.ok ? result.data.reports : [];
  const openCases = cases.filter((item) => ["open", "reviewing"].includes(fieldStr(item, "status")));

  return (
    <>
      <AdminPageHeader
        kicker="Safety"
        title="Moderation queue"
        copy="Reports become cases; every decision (remove, limit, age-restrict, suspend, ban, restore) is audit-logged. Appeals return to this queue."
      />
      {!result.ok ? <ErrorBanner message={result.error} /> : null}
      <div className="grid-3" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="metric">Open cases</div>
          <div className="metric-value">{openCases.length}</div>
        </div>
        <div className="card">
          <div className="metric">Appealed</div>
          <div className="metric-value">{cases.filter((item) => fieldStr(item, "status") === "appealed").length}</div>
        </div>
        <div className="card">
          <div className="metric">Reports</div>
          <div className="metric-value">{reports.length}</div>
        </div>
      </div>

      {cases.length === 0 ? <div className="empty-state">The moderation queue is empty.</div> : null}
      {cases.length > 0 ? (
        <AdminTable<Row>
          columns={[
            {
              key: "case",
              header: "Case",
              render: (item) => (
                <>
                  <strong>{fieldStr(item, "id").slice(0, 12)}</strong>
                  <br />
                  {fieldDate(item, "created_at", "createdAt")}
                </>
              )
            },
            {
              key: "target",
              header: "Target",
              render: (item) => `${fieldStr(item, "target_type", "targetType")}: ${fieldStr(item, "target_id", "targetId").slice(0, 14)}`
            },
            { key: "reason", header: "Reason", render: (item) => <AdminStatusBadge status={fieldStr(item, "reason")} /> },
            {
              key: "priority",
              header: "Priority",
              render: (item) => <AdminStatusBadge status={fieldStr(item, "priority")} />
            },
            { key: "reports", header: "Reports", render: (item) => fieldNum(item, "report_count", "reportCount") },
            { key: "status", header: "Status", render: (item) => <AdminStatusBadge status={fieldStr(item, "status")} /> },
            {
              key: "actions",
              header: "Decision",
              render: (item) => {
                if (!canDecide) return <span className="metric-hint">Read-only</span>;
                const id = fieldStr(item, "id");
                const status = fieldStr(item, "status");
                if (status === "resolved") {
                  return <AdminApiAction label="Reopen" path={`/admin/moderation/cases/${id}/reopen`} />;
                }
                return (
                  <div className="actions-cell">
                    {decisions.map((decision) => (
                      <AdminApiAction
                        key={decision.action}
                        label={decision.label}
                        path={`/admin/moderation/cases/${id}/decide`}
                        body={{ action: decision.action }}
                        variant={decision.variant}
                      />
                    ))}
                  </div>
                );
              }
            }
          ]}
          rows={cases}
        />
      ) : null}

      <div className="section-header">
        <h2>Recent reports</h2>
      </div>
      {reports.length > 0 ? (
        <AdminTable<Row>
          columns={[
            {
              key: "target",
              header: "Target",
              render: (report) => `${fieldStr(report, "target_type", "targetType")}: ${fieldStr(report, "target_id", "targetId").slice(0, 14)}`
            },
            { key: "reason", header: "Reason", render: (report) => fieldStr(report, "reason") },
            { key: "status", header: "Status", render: (report) => <AdminStatusBadge status={fieldStr(report, "status")} /> },
            { key: "when", header: "When", render: (report) => fieldDate(report, "created_at", "createdAt") }
          ]}
          rows={reports.slice(0, 20)}
        />
      ) : (
        <div className="empty-state">No reports.</div>
      )}
    </>
  );
}
