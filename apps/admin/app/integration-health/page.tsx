import { AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { AdminApiAction } from "../../components/AdminApiAction";
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

  const [health, history, rateLimitEvents] = await Promise.all([
    adminApiFetch<HealthData>("/admin/integration-health?deep=1"),
    adminApiFetch<{ history: Row[] }>("/admin/integration-health/history"),
    adminApiFetch<{ events: Row[] }>("/admin/rate-limit-events")
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
        <h2>Scheduled jobs</h2>
      </div>
      <div className="card">
        <div className="metric-hint">
          These jobs are normally run by an external cron hitting the same endpoints. Trigger them manually here when
          needed; every run is audit-logged.
        </div>
        <div className="actions-cell" style={{ marginTop: 10 }}>
          <AdminApiAction label="Run trending snapshot (daily)" path="/admin/ops/trending/run" body={{ window: "daily" }} />
          <AdminApiAction label="Run trending snapshot (weekly)" path="/admin/ops/trending/run" body={{ window: "weekly" }} />
          <AdminApiAction label="Process notification jobs" path="/admin/notifications/process-jobs" />
          <AdminApiAction label="Run privacy workers (exports + deletions)" path="/admin/ops/privacy/run" />
        </div>
      </div>

      <div className="section-header">
        <h2>Rate limit violations</h2>
      </div>
      {rateLimitEvents.ok && rateLimitEvents.data.events.length > 0 ? (
        <AdminTable<Row>
          columns={[
            { key: "scope", header: "Scope", render: (event) => <strong>{fieldStr(event, "scope")}</strong> },
            { key: "key", header: "Limiter key", render: (event) => fieldStr(event, "limiter_key").slice(0, 60) },
            { key: "limit", header: "Limit", render: (event) => `${fieldStr(event, "limit_max")} / ${Number(fieldStr(event, "window_ms")) / 1000}s` },
            { key: "when", header: "When", render: (event) => fieldDate(event, "created_at") }
          ]}
          rows={rateLimitEvents.data.events}
        />
      ) : (
        <div className="empty-state">No rate-limit violations recorded.</div>
      )}

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
