import { AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { AdminApiAction } from "../../components/AdminApiAction";
import { ErrorBanner, guardPage } from "../../components/PageGuard";
import { adminApiFetch } from "../../lib/adminApi";
import { fieldDate, fieldStr, type Row } from "../../lib/rows";

export default async function PrivacyPage() {
  const { identity, denied } = await guardPage("/privacy");
  if (denied) return denied;
  const canProcess = ["platform_superadmin", "admin"].includes(identity.admin.role);

  const [requests, exports, deletions] = await Promise.all([
    adminApiFetch<{ requests: Row[] }>("/admin/privacy-requests"),
    adminApiFetch<{ exports: Row[] }>("/admin/data-exports"),
    adminApiFetch<{ requests: Row[] }>("/admin/deletion-requests")
  ]);

  return (
    <>
      <AdminPageHeader
        kicker="Compliance"
        title="Privacy & account deletion"
        copy="GDPR-style privacy requests, data exports and account deletion processing. Processing a deletion anonymizes the profile and retires its content."
      />
      <div className="section-header">
        <h2>Privacy requests</h2>
      </div>
      {!requests.ok ? <ErrorBanner message={requests.error} /> : null}
      {requests.ok && requests.data.requests.length > 0 ? (
        <AdminTable<Row>
          columns={[
            {
              key: "who",
              header: "User",
              render: (request) => {
                const profile = (request.profiles ?? {}) as Row;
                return <strong>@{fieldStr(profile, "handle") || fieldStr(request, "profile_id", "profileId")}</strong>;
              }
            },
            { key: "type", header: "Type", render: (request) => fieldStr(request, "type") },
            { key: "details", header: "Details", render: (request) => fieldStr(request, "details").slice(0, 80) || "—" },
            { key: "status", header: "Status", render: (request) => <AdminStatusBadge status={fieldStr(request, "status")} /> },
            { key: "when", header: "When", render: (request) => fieldDate(request, "created_at", "createdAt") },
            {
              key: "actions",
              header: "Actions",
              render: (request) => {
                if (!canProcess) return <span className="metric-hint">Read-only</span>;
                const id = fieldStr(request, "id");
                const status = fieldStr(request, "status");
                if (status === "completed" || status === "rejected") return <span className="metric-hint">Done</span>;
                return (
                  <div className="actions-cell">
                    <AdminApiAction label="Mark processing" path={`/admin/privacy-requests/${id}/status`} body={{ status: "processing" }} />
                    <AdminApiAction label="Complete" path={`/admin/privacy-requests/${id}/status`} body={{ status: "completed" }} variant="success" />
                    <AdminApiAction label="Reject" path={`/admin/privacy-requests/${id}/status`} body={{ status: "rejected" }} variant="danger" />
                  </div>
                );
              }
            }
          ]}
          rows={requests.data.requests}
        />
      ) : (
        <div className="empty-state">No privacy requests.</div>
      )}

      <div className="section-header">
        <h2>Data exports</h2>
      </div>
      {exports.ok && exports.data.exports.length > 0 ? (
        <AdminTable<Row>
          columns={[
            {
              key: "who",
              header: "User",
              render: (row) => {
                const profile = (row.profiles ?? {}) as Row;
                return <strong>@{fieldStr(profile, "handle") || fieldStr(row, "profile_id", "profileId")}</strong>;
              }
            },
            { key: "status", header: "Status", render: (row) => <AdminStatusBadge status={fieldStr(row, "status")} /> },
            { key: "expires", header: "Expires", render: (row) => fieldDate(row, "expires_at", "expiresAt") },
            { key: "when", header: "Requested", render: (row) => fieldDate(row, "created_at", "createdAt") }
          ]}
          rows={exports.data.exports}
        />
      ) : (
        <div className="empty-state">No data exports.</div>
      )}

      <div className="section-header">
        <h2>Account deletion requests</h2>
      </div>
      {deletions.ok && deletions.data.requests.length > 0 ? (
        <AdminTable<Row>
          columns={[
            {
              key: "who",
              header: "User",
              render: (request) => {
                const profile = (request.profiles ?? {}) as Row;
                return <strong>@{fieldStr(profile, "handle") || fieldStr(request, "profile_id", "profileId")}</strong>;
              }
            },
            { key: "reason", header: "Reason", render: (request) => fieldStr(request, "reason").slice(0, 80) || "—" },
            { key: "status", header: "Status", render: (request) => <AdminStatusBadge status={fieldStr(request, "status")} /> },
            { key: "deadline", header: "Complete by", render: (request) => fieldDate(request, "complete_by", "completeBy") },
            {
              key: "actions",
              header: "Actions",
              render: (request) => {
                if (!canProcess) return <span className="metric-hint">Read-only</span>;
                const id = fieldStr(request, "id");
                const status = fieldStr(request, "status");
                if (status !== "requested" && status !== "processing") return <span className="metric-hint">Done</span>;
                return (
                  <AdminApiAction
                    label="Process deletion (anonymize)"
                    path={`/admin/deletion-requests/${id}/process`}
                    variant="danger"
                  />
                );
              }
            }
          ]}
          rows={deletions.data.requests}
        />
      ) : (
        <div className="empty-state">No deletion requests.</div>
      )}
    </>
  );
}
