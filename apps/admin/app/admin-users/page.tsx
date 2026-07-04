import { AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { AdminApiAction } from "../../components/AdminApiAction";
import { AdminForm } from "../../components/AdminForm";
import { ErrorBanner, guardPage } from "../../components/PageGuard";
import { adminApiFetch } from "../../lib/adminApi";
import { fieldDate, fieldStr, type Row } from "../../lib/rows";

const roles = ["platform_superadmin", "admin", "moderator", "finance", "support"];

export default async function AdminUsersPage() {
  const { identity, denied } = await guardPage("/admin-users");
  if (denied) return denied;
  const isSuperadmin = identity.admin.role === "platform_superadmin";

  const [admins, invitations] = await Promise.all([
    adminApiFetch<{ admins: Row[] }>("/admin/admin-users"),
    adminApiFetch<{ invitations: Row[] }>("/admin/admin-users/invitations")
  ]);

  return (
    <>
      <AdminPageHeader
        kicker="Platform"
        title="Admin users"
        copy="Console operators and their roles. Only platform superadmins can invite, change roles or disable admins."
      />
      {isSuperadmin ? (
        <AdminForm
          title="+ Invite admin"
          path="/admin/admin-users/invite"
          submitLabel="Send invitation"
          fields={[
            { name: "email", label: "Email", required: true },
            {
              name: "role",
              label: "Role",
              type: "select",
              options: roles.map((role) => ({ value: role, label: role }))
            }
          ]}
        />
      ) : null}
      {!admins.ok ? <ErrorBanner message={admins.error} /> : null}
      {admins.ok && admins.data.admins.length > 0 ? (
        <AdminTable<Row>
          columns={[
            {
              key: "admin",
              header: "Admin",
              render: (admin) => (
                <>
                  <strong>{fieldStr(admin, "display_name", "displayName") || fieldStr(admin, "email")}</strong>
                  <br />
                  {fieldStr(admin, "email")}
                </>
              )
            },
            { key: "role", header: "Role", render: (admin) => <AdminStatusBadge status={fieldStr(admin, "role")} /> },
            {
              key: "active",
              header: "Active",
              render: (admin) => (admin.is_active === false || admin.isActive === false ? "Disabled" : "Active")
            },
            { key: "created", header: "Created", render: (admin) => fieldDate(admin, "created_at", "createdAt") },
            {
              key: "actions",
              header: "Actions (superadmin only)",
              render: (admin) => {
                if (!isSuperadmin) return <span className="metric-hint">Superadmin only</span>;
                const id = fieldStr(admin, "id");
                if (id === identity.admin.id) return <span className="metric-hint">You</span>;
                return (
                  <div className="actions-cell">
                    {roles
                      .filter((role) => role !== fieldStr(admin, "role"))
                      .slice(0, 2)
                      .map((role) => (
                        <AdminApiAction
                          key={role}
                          label={`Make ${role.replace("platform_", "")}`}
                          path={`/admin/admin-users/${id}/role`}
                          body={{ role }}
                        />
                      ))}
                    <AdminApiAction label="Disable" path={`/admin/admin-users/${id}/disable`} variant="danger" />
                  </div>
                );
              }
            }
          ]}
          rows={admins.data.admins}
        />
      ) : null}

      <div className="section-header">
        <h2>Invitations</h2>
      </div>
      {invitations.ok && invitations.data.invitations.length > 0 ? (
        <AdminTable<Row>
          columns={[
            { key: "email", header: "Email", render: (invitation) => <strong>{fieldStr(invitation, "email")}</strong> },
            { key: "role", header: "Role", render: (invitation) => fieldStr(invitation, "role") },
            { key: "status", header: "Status", render: (invitation) => <AdminStatusBadge status={fieldStr(invitation, "status")} /> },
            { key: "expires", header: "Expires", render: (invitation) => fieldDate(invitation, "expires_at", "expiresAt") },
            {
              key: "actions",
              header: "Actions",
              render: (invitation) => {
                if (!isSuperadmin || fieldStr(invitation, "status") !== "pending") return null;
                return (
                  <AdminApiAction
                    label="Revoke"
                    path={`/admin/admin-users/invitations/${fieldStr(invitation, "id")}/revoke`}
                    variant="danger"
                  />
                );
              }
            }
          ]}
          rows={invitations.data.invitations}
        />
      ) : (
        <div className="empty-state">No invitations.</div>
      )}
    </>
  );
}
