import { AdminPageHeader, AdminTable } from "@vuqiro/ui/admin";
import { ErrorBanner, guardPage } from "../../components/PageGuard";
import { adminApiFetch } from "../../lib/adminApi";
import { fieldDate, fieldStr, type Row } from "../../lib/rows";

export default async function AuditLogPage() {
  const { denied } = await guardPage("/audit-log");
  if (denied) return denied;
  const result = await adminApiFetch<{ logs: Row[] }>("/admin/audit-logs?limit=200");

  return (
    <>
      <AdminPageHeader
        kicker="Platform"
        title="Audit log"
        copy="Append-only trail of every sensitive admin action. Entries can never be edited or deleted."
      />
      {!result.ok ? <ErrorBanner message={result.error} /> : null}
      {result.ok && result.data.logs.length === 0 ? <div className="empty-state">No audit entries.</div> : null}
      {result.ok && result.data.logs.length > 0 ? (
        <AdminTable<Row>
          columns={[
            { key: "action", header: "Action", render: (log) => <strong>{fieldStr(log, "action")}</strong> },
            {
              key: "target",
              header: "Target",
              render: (log) => `${fieldStr(log, "target_type", "targetType")}: ${fieldStr(log, "target_id", "targetId").slice(0, 18)}`
            },
            { key: "summary", header: "Summary", render: (log) => fieldStr(log, "summary").slice(0, 120) },
            { key: "role", header: "Actor role", render: (log) => fieldStr(log, "actor_role", "actorRole") },
            { key: "when", header: "When", render: (log) => fieldDate(log, "created_at", "createdAt") }
          ]}
          rows={result.data.logs}
        />
      ) : null}
    </>
  );
}
