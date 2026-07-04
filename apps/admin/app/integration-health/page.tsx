import { AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { ErrorBanner, guardPage } from "../../components/PageGuard";
import { adminApiFetch } from "../../lib/adminApi";
import { fieldDate, fieldStr, type Row } from "../../lib/rows";

type HealthData = {
  report: { appEnv: string; version: string; warnings: string[] };
  checks: { provider: string; status: string; message?: string }[];
};

export default async function IntegrationHealthPage() {
  const { denied } = await guardPage("/integration-health");
  if (denied) return denied;

  const [health, history] = await Promise.all([
    adminApiFetch<HealthData>("/admin/integration-health?deep=1"),
    adminApiFetch<{ history: Row[] }>("/admin/integration-health/history")
  ]);

  return (
    <>
      <AdminPageHeader
        kicker="Platform"
        title="Integration health"
        copy="Live provider status (Supabase, video, payments, payouts, push). Providers in mock state are fine in development but block a production boot."
      />
      {!health.ok ? <ErrorBanner message={health.error} /> : null}
      {health.ok ? (
        <>
          <div className="grid">
            {health.data.checks.map((check) => (
              <div className="card" key={check.provider}>
                <div className="card-title">{check.provider}</div>
                <AdminStatusBadge status={check.status} />
                <div className="metric-hint">{check.message}</div>
              </div>
            ))}
          </div>
          <div className="section-header">
            <h2>Environment</h2>
          </div>
          <div className="card">
            <div className="metric-hint">App environment: {health.data.report.appEnv}</div>
            <div className="metric-hint">Version: {health.data.report.version}</div>
            {health.data.report.warnings.length > 0 ? (
              <>
                <div className="card-title" style={{ marginTop: 12 }}>
                  Configuration warnings
                </div>
                {health.data.report.warnings.map((warning) => (
                  <div className="metric-hint" key={warning}>
                    ⚠ {warning}
                  </div>
                ))}
              </>
            ) : (
              <div className="metric-hint">No configuration warnings.</div>
            )}
          </div>
        </>
      ) : null}

      <div className="section-header">
        <h2>Check history</h2>
      </div>
      {history.ok && history.data.history.length > 0 ? (
        <AdminTable<Row>
          columns={[
            { key: "provider", header: "Provider", render: (check) => <strong>{fieldStr(check, "provider")}</strong> },
            { key: "status", header: "Status", render: (check) => <AdminStatusBadge status={fieldStr(check, "status")} /> },
            { key: "message", header: "Message", render: (check) => fieldStr(check, "message").slice(0, 90) },
            { key: "when", header: "Checked", render: (check) => fieldDate(check, "checked_at", "checkedAt") }
          ]}
          rows={history.data.history}
        />
      ) : (
        <div className="empty-state">No history recorded yet (snapshots are written each time this page loads with a live database).</div>
      )}
    </>
  );
}
