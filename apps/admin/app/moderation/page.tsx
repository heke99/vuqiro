import { AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { mockModerationCases, mockReports } from "@vuqiro/mock-data";
import type { ModerationCase, Report } from "@vuqiro/types";
import { MockAction } from "../../components/MockAction";

export default function ModerationPage() {
  const openCases = mockModerationCases.filter((item) => item.status === "open" || item.status === "reviewing");

  return (
    <>
      <AdminPageHeader
        kicker="Safety"
        title="Moderation queue"
        copy="Reports become cases; every decision (remove, limit, age-restrict, suspend, ban, payout hold, restore) is audit-logged. Appeals return to this queue."
      />
      <div className="grid-3" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="metric">Open cases</div>
          <div className="metric-value">{openCases.length}</div>
        </div>
        <div className="card">
          <div className="metric">Appealed</div>
          <div className="metric-value">{mockModerationCases.filter((item) => item.status === "appealed").length}</div>
        </div>
        <div className="card">
          <div className="metric">Reports (30 days)</div>
          <div className="metric-value">{mockReports.length}</div>
        </div>
      </div>

      <AdminTable<ModerationCase>
        columns={[
          {
            key: "case",
            header: "Case",
            render: (item) => (
              <>
                <strong>{item.id}</strong>
                <br />
                {new Date(item.createdAt).toLocaleString()}
              </>
            )
          },
          { key: "target", header: "Target", render: (item) => `${item.targetType}: ${item.targetId}` },
          { key: "reason", header: "Reason", render: (item) => <AdminStatusBadge status={item.reason} tone="primary" /> },
          {
            key: "priority",
            header: "Priority",
            render: (item) => (
              <AdminStatusBadge status={item.priority} tone={item.priority === "critical" || item.priority === "high" ? "danger" : "warning"} />
            )
          },
          { key: "reports", header: "Reports", render: (item) => item.reportCount ?? 1 },
          { key: "status", header: "Status", render: (item) => <AdminStatusBadge status={item.status} /> },
          {
            key: "resolution",
            header: "Resolution",
            render: (item) => (item.resolvedAction ? <AdminStatusBadge status={item.resolvedAction} /> : "—")
          },
          {
            key: "actions",
            header: "Decision",
            render: (item) =>
              item.status === "resolved" ? (
                <div className="actions-cell">
                  <MockAction label="Reopen" />
                </div>
              ) : (
                <div className="actions-cell">
                  <MockAction label="No action" />
                  <MockAction label="Limit" />
                  <MockAction label="Age restrict" />
                  <MockAction label="Remove" variant="danger" />
                  <MockAction label="Suspend user" variant="danger" />
                  <MockAction label="Ban user" variant="danger" />
                  <MockAction label="Hold payout" variant="danger" />
                  <MockAction label="Restore" variant="success" />
                </div>
              )
          }
        ]}
        rows={mockModerationCases}
      />

      <div className="section-header">
        <h2>Recent reports</h2>
        <p className="copy">Raw reports before triage. Reports attach to cases automatically when targets match.</p>
      </div>
      <AdminTable<Report>
        columns={[
          { key: "id", header: "Report", render: (report) => <strong>{report.id}</strong> },
          { key: "target", header: "Target", render: (report) => `${report.targetType}: ${report.targetId}` },
          { key: "reason", header: "Reason", render: (report) => <AdminStatusBadge status={report.reason} tone="primary" /> },
          { key: "status", header: "Status", render: (report) => <AdminStatusBadge status={report.status} tone={report.status === "dismissed" ? "primary" : "secondary"} /> },
          { key: "case", header: "Case", render: (report) => report.moderationCaseId ?? "—" },
          { key: "created", header: "Created", render: (report) => new Date(report.createdAt).toLocaleDateString() }
        ]}
        rows={mockReports.slice(0, 10)}
      />
    </>
  );
}
