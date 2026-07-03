import { AdminMetricCard, AdminPageHeader, AdminStatusBadge } from "@vuqiro/ui/admin";
import { adminApiFetch } from "../../lib/adminApi";
import { ErrorBanner, guardPage } from "../../components/PageGuard";

type DashboardData = {
  metrics: Record<string, number>;
  source: string;
};

type HealthData = {
  checks: { provider: string; status: string; message?: string }[];
};

type AuditData = { logs: { id: string; action: string; summary: string; created_at?: string; createdAt?: string }[] };

export default async function DashboardPage() {
  const { denied } = await guardPage("/dashboard");
  if (denied) return denied;

  const [dashboard, health, audit] = await Promise.all([
    adminApiFetch<DashboardData>("/admin/dashboard"),
    adminApiFetch<HealthData>("/admin/integration-health"),
    adminApiFetch<AuditData>("/admin/audit-logs?limit=8")
  ]);

  const metrics = dashboard.ok ? dashboard.data.metrics : {};
  const cards: [string, string | number][] = [
    ["Total users", (metrics.totalUsers ?? 0).toLocaleString()],
    ["Total creators", (metrics.totalCreators ?? 0).toLocaleString()],
    ["Videos uploaded", (metrics.videosUploaded ?? 0).toLocaleString()],
    ["Videos under review", metrics.videosUnderReview ?? 0],
    ["Open moderation cases", metrics.reportedContent ?? 0],
    ["Active subscriptions", (metrics.activeSubscriptions ?? 0).toLocaleString()],
    ["Pending payouts", metrics.pendingPayouts ?? 0],
    ["Held payouts", metrics.heldPayouts ?? 0]
  ];

  return (
    <>
      <AdminPageHeader
        kicker="Superadmin"
        title="Vuqiro dashboard"
        copy="Live platform health across community, monetization, moderation, payouts and integrations."
      />
      {!dashboard.ok ? <ErrorBanner message={dashboard.error} /> : null}
      <div className="grid">
        {cards.map(([label, value]) => (
          <AdminMetricCard key={label} label={label} value={value} />
        ))}
      </div>

      <div className="section-header">
        <h2>Integration health</h2>
      </div>
      {health.ok ? (
        <div className="grid">
          {health.data.checks.map((check) => (
            <div className="card" key={check.provider}>
              <div className="card-title">{check.provider}</div>
              <AdminStatusBadge status={check.status} />
              <div className="metric-hint">{check.message}</div>
            </div>
          ))}
        </div>
      ) : (
        <ErrorBanner message={health.error} />
      )}

      <div className="section-header">
        <h2>Recent audit activity</h2>
      </div>
      {audit.ok && audit.data.logs.length > 0 ? (
        <div className="card table-card">
          <table className="table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Summary</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {audit.data.logs.map((log) => (
                <tr key={log.id}>
                  <td>
                    <strong>{log.action}</strong>
                  </td>
                  <td>{log.summary}</td>
                  <td>{new Date(log.created_at ?? log.createdAt ?? Date.now()).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">No audit entries yet.</div>
      )}
    </>
  );
}
