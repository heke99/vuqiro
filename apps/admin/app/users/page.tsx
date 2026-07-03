import Link from "next/link";
import { AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { AdminApiAction } from "../../components/AdminApiAction";
import { ErrorBanner, guardPage } from "../../components/PageGuard";
import { adminApiFetch } from "../../lib/adminApi";
import { field, fieldDate, fieldNum, fieldStr, type Row } from "../../lib/rows";

export default async function UsersPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { identity, denied } = await guardPage("/users");
  if (denied) return denied;
  const params = await searchParams;
  const canEnforce = ["platform_superadmin", "admin", "moderator"].includes(identity.admin.role);

  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.status) query.set("status", params.status);
  const result = await adminApiFetch<{ users: Row[]; total: number }>(`/admin/users?${query.toString()}`);

  return (
    <>
      <AdminPageHeader
        kicker="Community"
        title="Users"
        copy="All Vuqiro accounts. Suspend/ban/restore actions are RBAC-checked and audit-logged by the API."
      />
      <form className="row" style={{ marginBottom: 16 }}>
        <input className="input" name="q" placeholder="Search handle or name…" defaultValue={params.q ?? ""} />
        <select className="input" name="status" defaultValue={params.status ?? ""} style={{ maxWidth: 220 }}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
          <option value="deletion_requested">Deletion requested</option>
        </select>
        <button className="button small" type="submit">
          Filter
        </button>
      </form>
      {!result.ok ? <ErrorBanner message={result.error} /> : null}
      {result.ok && result.data.users.length === 0 ? <div className="empty-state">No users match.</div> : null}
      {result.ok && result.data.users.length > 0 ? (
        <AdminTable<Row>
          columns={[
            {
              key: "user",
              header: "User",
              render: (user) => (
                <>
                  <strong>{fieldStr(user, "display_name", "displayName") || fieldStr(user, "handle")}</strong>
                  <br />@{fieldStr(user, "handle")}
                  <br />
                  <Link href={`/users/${fieldStr(user, "id")}`}>Open detail →</Link>
                </>
              )
            },
            { key: "status", header: "Status", render: (user) => <AdminStatusBadge status={fieldStr(user, "status")} /> },
            {
              key: "type",
              header: "Type",
              render: (user) =>
                field<boolean>(user, "is_creator", "isCreator") ? "Creator" : "User"
            },
            {
              key: "followers",
              header: "Followers / videos",
              render: (user) => `${fieldNum(user, "follower_count", "followerCount")} / ${fieldNum(user, "video_count", "videoCount")}`
            },
            { key: "created", header: "Created", render: (user) => fieldDate(user, "created_at", "createdAt") },
            {
              key: "actions",
              header: "Actions",
              render: (user) => {
                if (!canEnforce) return <span className="metric-hint">Read-only for {identity.admin.role}</span>;
                const id = fieldStr(user, "id");
                const status = fieldStr(user, "status");
                return (
                  <div className="actions-cell">
                    {status === "active" ? (
                      <>
                        <AdminApiAction label="Suspend" path={`/admin/users/${id}/suspend`} variant="danger" />
                        <AdminApiAction label="Ban" path={`/admin/users/${id}/ban`} variant="danger" />
                      </>
                    ) : status === "suspended" ? (
                      <AdminApiAction label="Unsuspend" path={`/admin/users/${id}/unsuspend`} variant="success" />
                    ) : status === "banned" ? (
                      <AdminApiAction label="Restore" path={`/admin/users/${id}/restore`} variant="success" />
                    ) : null}
                  </div>
                );
              }
            }
          ]}
          rows={result.data.users}
        />
      ) : null}
    </>
  );
}
