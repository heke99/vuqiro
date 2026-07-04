import { AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { AdminApiAction } from "../../components/AdminApiAction";
import { ErrorBanner, guardPage } from "../../components/PageGuard";
import { adminApiFetch } from "../../lib/adminApi";
import { fieldDate, fieldStr, type Row } from "../../lib/rows";

export default async function AppealsPage() {
  const { identity, denied } = await guardPage("/appeals");
  if (denied) return denied;
  const canDecide = ["platform_superadmin", "admin", "moderator"].includes(identity.admin.role);
  const result = await adminApiFetch<{ appeals: Row[] }>("/admin/appeals");

  return (
    <>
      <AdminPageHeader
        kicker="Safety"
        title="Appeals"
        copy="User appeals against moderation decisions. Approving a video appeal restores the content and notifies the user."
      />
      {!result.ok ? <ErrorBanner message={result.error} /> : null}
      {result.ok && result.data.appeals.length === 0 ? <div className="empty-state">No appeals.</div> : null}
      {result.ok && result.data.appeals.length > 0 ? (
        <AdminTable<Row>
          columns={[
            {
              key: "appeal",
              header: "Appeal",
              render: (appeal) => {
                const profile = (appeal.profiles ?? {}) as Row;
                return (
                  <>
                    <strong>@{fieldStr(profile, "handle") || fieldStr(appeal, "profileId", "profile_id")}</strong>
                    <br />
                    {fieldStr(appeal, "target_type", "targetType")} {fieldStr(appeal, "target_id", "targetId")}
                  </>
                );
              }
            },
            { key: "message", header: "Message", render: (appeal) => fieldStr(appeal, "message").slice(0, 110) },
            { key: "status", header: "Status", render: (appeal) => <AdminStatusBadge status={fieldStr(appeal, "status")} /> },
            { key: "when", header: "When", render: (appeal) => fieldDate(appeal, "created_at", "createdAt") },
            {
              key: "actions",
              header: "Decision",
              render: (appeal) => {
                if (!canDecide) return <span className="metric-hint">Read-only</span>;
                const id = fieldStr(appeal, "id");
                const status = fieldStr(appeal, "status");
                if (status === "approved" || status === "rejected") {
                  return <span className="metric-hint">{fieldStr(appeal, "decision_note", "decisionNote") || "Decided"}</span>;
                }
                return (
                  <div className="actions-cell">
                    <AdminApiAction
                      label="Approve"
                      path={`/admin/appeals/${id}/decide`}
                      body={{ decision: "approved" }}
                      variant="success"
                    />
                    <AdminApiAction
                      label="Reject"
                      path={`/admin/appeals/${id}/decide`}
                      body={{ decision: "rejected" }}
                      variant="danger"
                    />
                  </div>
                );
              }
            }
          ]}
          rows={result.data.appeals}
        />
      ) : null}
    </>
  );
}
