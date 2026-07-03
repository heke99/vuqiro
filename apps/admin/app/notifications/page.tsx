import { AdminPageHeader, AdminTable } from "@vuqiro/ui/admin";
import { AdminApiAction } from "../../components/AdminApiAction";
import { AdminForm } from "../../components/AdminForm";
import { ErrorBanner, guardPage } from "../../components/PageGuard";
import { adminApiFetch } from "../../lib/adminApi";
import { fieldDate, fieldStr, type Row } from "../../lib/rows";

export default async function NotificationsPage() {
  const { identity, denied } = await guardPage("/notifications");
  if (denied) return denied;
  const canBroadcast = ["platform_superadmin", "admin"].includes(identity.admin.role);

  return (
    <>
      <AdminPageHeader
        kicker="Platform"
        title="Notifications"
        copy="Broadcast a system notice to all users (in-app now, push via the job queue). Broadcasts are audit-logged."
      />
      {canBroadcast ? (
        <>
          <AdminForm
            title="+ New broadcast"
            path="/admin/notifications/broadcast"
            submitLabel="Send broadcast"
            fields={[
              { name: "title", label: "Title", required: true },
              { name: "body", label: "Message", type: "textarea", required: true },
              {
                name: "audience",
                label: "Audience",
                type: "select",
                options: [
                  { value: "all", label: "All active users" },
                  { value: "creators", label: "Creators only" },
                  { value: "users", label: "Non-creator users" }
                ]
              }
            ]}
          />
          <div className="row" style={{ marginBottom: 18 }}>
            <span className="metric-hint">
              Push delivery runs through the notification job queue (Expo push provider in production).
            </span>
            <AdminApiAction label="Run push job queue now" path="/admin/notifications/process-jobs" />
          </div>
        </>
      ) : null}
      <BroadcastHistory />
    </>
  );
}

async function BroadcastHistory() {
  const result = await adminApiFetch<{ logs: Row[] }>("/admin/audit-logs?action=notification_broadcast&limit=25");
  if (!result.ok) return <ErrorBanner message={result.error} />;
  if (result.data.logs.length === 0) return <div className="empty-state">No broadcasts sent yet.</div>;
  return (
    <>
      <div className="section-header">
        <h2>Broadcast history</h2>
      </div>
      <AdminTable<Row>
        columns={[
          { key: "summary", header: "Broadcast", render: (log) => <strong>{fieldStr(log, "summary")}</strong> },
          { key: "audience", header: "Audience", render: (log) => fieldStr(log, "target_id", "targetId") },
          { key: "when", header: "When", render: (log) => fieldDate(log, "created_at", "createdAt") }
        ]}
        rows={result.data.logs}
      />
    </>
  );
}
