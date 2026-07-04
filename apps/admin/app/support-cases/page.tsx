import { AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { AdminApiAction } from "../../components/AdminApiAction";
import { ErrorBanner, guardPage } from "../../components/PageGuard";
import { adminApiFetch } from "../../lib/adminApi";
import { fieldDate, fieldStr, type Row } from "../../lib/rows";

export default async function SupportCasesPage() {
  const { identity, denied } = await guardPage("/support-cases");
  if (denied) return denied;
  const canWork = ["platform_superadmin", "admin", "support"].includes(identity.admin.role);
  const result = await adminApiFetch<{ cases: Row[] }>("/admin/support-cases");

  return (
    <>
      <AdminPageHeader
        kicker="Platform"
        title="Support cases"
        copy="User support inbox. Assign, prioritize and resolve — every update is audit-logged."
      />
      {!result.ok ? <ErrorBanner message={result.error} /> : null}
      {result.ok && result.data.cases.length === 0 ? <div className="empty-state">No support cases.</div> : null}
      {result.ok && result.data.cases.length > 0 ? (
        <AdminTable<Row>
          columns={[
            {
              key: "case",
              header: "Case",
              render: (supportCase) => {
                const profile = (supportCase.profiles ?? {}) as Row;
                return (
                  <>
                    <strong>{fieldStr(supportCase, "subject")}</strong>
                    <br />@{fieldStr(profile, "handle") || fieldStr(supportCase, "email") || "anonymous"}
                  </>
                );
              }
            },
            { key: "body", header: "Message", render: (supportCase) => fieldStr(supportCase, "body").slice(0, 100) },
            { key: "status", header: "Status", render: (supportCase) => <AdminStatusBadge status={fieldStr(supportCase, "status")} /> },
            { key: "priority", header: "Priority", render: (supportCase) => fieldStr(supportCase, "priority") },
            { key: "when", header: "Opened", render: (supportCase) => fieldDate(supportCase, "created_at", "createdAt") },
            {
              key: "actions",
              header: "Actions",
              render: (supportCase) => {
                if (!canWork) return <span className="metric-hint">Read-only</span>;
                const id = fieldStr(supportCase, "id");
                const status = fieldStr(supportCase, "status");
                return (
                  <div className="actions-cell">
                    <AdminApiAction label="Assign to me" path={`/admin/support-cases/${id}/update`} body={{ assign: true }} />
                    {status !== "resolved" ? (
                      <AdminApiAction
                        label="Resolve"
                        path={`/admin/support-cases/${id}/update`}
                        body={{ status: "resolved" }}
                        variant="success"
                      />
                    ) : (
                      <AdminApiAction label="Reopen" path={`/admin/support-cases/${id}/update`} body={{ status: "open" }} />
                    )}
                  </div>
                );
              }
            }
          ]}
          rows={result.data.cases}
        />
      ) : null}
    </>
  );
}
