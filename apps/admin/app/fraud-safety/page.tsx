import { AdminMetricCard, AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { AdminApiAction } from "../../components/AdminApiAction";
import { ErrorBanner, guardPage } from "../../components/PageGuard";
import { adminApiFetch } from "../../lib/adminApi";
import { fieldDate, fieldStr, type Row } from "../../lib/rows";

export default async function FraudSafetyPage() {
  const { identity, denied } = await guardPage("/fraud-safety");
  if (denied) return denied;
  const canResolve = ["platform_superadmin", "admin", "moderator"].includes(identity.admin.role);
  const result = await adminApiFetch<{ signals: Row[] }>("/admin/fraud-signals");

  const signals = result.ok ? result.data.signals : [];
  const open = signals.filter((signal) => fieldStr(signal, "status") === "open");
  const high = signals.filter((signal) => fieldStr(signal, "severity") === "high");

  return (
    <>
      <AdminPageHeader
        kicker="Safety"
        title="Fraud & safety signals"
        copy="Automated signals: repeated reports, wallet anomalies, rapid uploads, engagement anomalies, chargeback risk, multi-account patterns."
      />
      {!result.ok ? <ErrorBanner message={result.error} /> : null}
      <div className="grid-3" style={{ marginBottom: 24 }}>
        <AdminMetricCard label="Open signals" value={open.length} />
        <AdminMetricCard label="High severity" value={high.length} />
        <AdminMetricCard label="Total signals" value={signals.length} />
      </div>
      {signals.length === 0 ? <div className="empty-state">No fraud signals.</div> : null}
      {signals.length > 0 ? (
        <AdminTable<Row>
          columns={[
            { key: "type", header: "Type", render: (signal) => <strong>{fieldStr(signal, "type")}</strong> },
            { key: "severity", header: "Severity", render: (signal) => <AdminStatusBadge status={fieldStr(signal, "severity")} /> },
            {
              key: "target",
              header: "Target",
              render: (signal) => `${fieldStr(signal, "target_type", "targetType")}: ${fieldStr(signal, "target_id", "targetId").slice(0, 14)}`
            },
            { key: "summary", header: "Summary", render: (signal) => fieldStr(signal, "summary").slice(0, 100) },
            { key: "status", header: "Status", render: (signal) => <AdminStatusBadge status={fieldStr(signal, "status")} /> },
            { key: "when", header: "When", render: (signal) => fieldDate(signal, "created_at", "createdAt") },
            {
              key: "actions",
              header: "Actions",
              render: (signal) => {
                if (!canResolve) return <span className="metric-hint">Read-only</span>;
                const id = fieldStr(signal, "id");
                const status = fieldStr(signal, "status");
                if (status !== "open" && status !== "reviewing") return <span className="metric-hint">Resolved</span>;
                return (
                  <div className="actions-cell">
                    <AdminApiAction
                      label="Mark actioned"
                      path={`/admin/fraud-signals/${id}/resolve`}
                      body={{ resolution: "actioned" }}
                      variant="success"
                    />
                    <AdminApiAction
                      label="Dismiss"
                      path={`/admin/fraud-signals/${id}/resolve`}
                      body={{ resolution: "dismissed" }}
                    />
                  </div>
                );
              }
            }
          ]}
          rows={signals}
        />
      ) : null}
    </>
  );
}
