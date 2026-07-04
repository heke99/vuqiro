import { AdminMetricCard, AdminPageHeader, AdminStatusBadge } from "@vuqiro/ui/admin";
import { AdminApiAction } from "../../../components/AdminApiAction";
import { ErrorBanner, guardPage } from "../../../components/PageGuard";
import { adminApiFetch } from "../../../lib/adminApi";
import { field, fieldDate, fieldNum, fieldStr, type Row } from "../../../lib/rows";

type UserDetail = {
  user: Row;
  wallet?: { coin_balance?: number; locked_balance?: number } | null;
  reports: Row[];
  deletionRequests: Row[];
  settings?: Row | null;
  safetySettings?: Row | null;
};

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { identity, denied } = await guardPage("/users");
  if (denied) return denied;
  const { id } = await params;
  const result = await adminApiFetch<UserDetail>(`/admin/users/${id}`);
  if (!result.ok) {
    return (
      <>
        <AdminPageHeader kicker="Community" title="User detail" copy="" />
        <ErrorBanner message={result.error} />
      </>
    );
  }
  const { user, wallet, reports, deletionRequests, settings } = result.data;
  const canEnforce = ["platform_superadmin", "admin", "moderator"].includes(identity.admin.role);
  const status = fieldStr(user, "status");

  return (
    <>
      <AdminPageHeader
        kicker="Community"
        title={`@${fieldStr(user, "handle")}`}
        copy={`${fieldStr(user, "display_name", "displayName")} — ${fieldStr(user, "bio")?.slice(0, 140) ?? ""}`}
      />
      <div className="row" style={{ marginBottom: 18 }}>
        <AdminStatusBadge status={status} />
        {canEnforce ? (
          <div className="actions-cell">
            {status === "active" ? (
              <>
                <AdminApiAction label="Suspend" path={`/admin/users/${id}/suspend`} variant="danger" />
                <AdminApiAction label="Ban" path={`/admin/users/${id}/ban`} variant="danger" />
              </>
            ) : (
              <AdminApiAction label="Restore" path={`/admin/users/${id}/restore`} variant="success" />
            )}
          </div>
        ) : null}
      </div>

      <div className="grid">
        <AdminMetricCard label="Followers" value={fieldNum(user, "follower_count", "followerCount")} />
        <AdminMetricCard label="Following" value={fieldNum(user, "following_count", "followingCount")} />
        <AdminMetricCard label="Videos" value={fieldNum(user, "video_count", "videoCount")} />
        <AdminMetricCard label="Wallet" value={`${(wallet?.coin_balance ?? 0).toLocaleString()} coins`} />
      </div>

      <div className="section-header">
        <h2>Account</h2>
      </div>
      <div className="grid-3">
        <div className="card">
          <div className="card-title">Profile</div>
          <div className="metric-hint">Role: {fieldStr(user, "role")}</div>
          <div className="metric-hint">Country: {fieldStr(user, "country") || "—"}</div>
          <div className="metric-hint">Language: {fieldStr(user, "language") || "—"}</div>
          <div className="metric-hint">Creator: {field<boolean>(user, "is_creator", "isCreator") ? "yes" : "no"}</div>
          <div className="metric-hint">Verified: {field<boolean>(user, "is_verified", "isVerified") ? "yes" : "no"}</div>
          <div className="metric-hint">Created: {fieldDate(user, "created_at", "createdAt")}</div>
        </div>
        <div className="card">
          <div className="card-title">Privacy settings</div>
          {settings ? (
            <>
              <div className="metric-hint">Privacy: {fieldStr(settings, "privacy_level")}</div>
              <div className="metric-hint">Comments: {fieldStr(settings, "comment_permission")}</div>
              <div className="metric-hint">Personalized ads: {field<boolean>(settings, "personalized_ads_opt_in") ? "opted in" : "opted out"}</div>
              <div className="metric-hint">Analytics: {field<boolean>(settings, "analytics_opt_in") ? "opted in" : "opted out"}</div>
            </>
          ) : (
            <div className="metric-hint">Defaults (no row yet)</div>
          )}
        </div>
        <div className="card">
          <div className="card-title">Deletion requests</div>
          {deletionRequests.length === 0 ? (
            <div className="metric-hint">None</div>
          ) : (
            deletionRequests.map((request) => (
              <div className="metric-hint" key={fieldStr(request, "id")}>
                {fieldStr(request, "status")} — requested {fieldDate(request, "requested_at", "requestedAt")}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="section-header">
        <h2>Reports filed by this user</h2>
      </div>
      {reports.length === 0 ? (
        <div className="empty-state">No reports.</div>
      ) : (
        <div className="card table-card">
          <table className="table">
            <thead>
              <tr>
                <th>Target</th>
                <th>Reason</th>
                <th>Status</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={fieldStr(report, "id")}>
                  <td>
                    {fieldStr(report, "target_type", "targetType")} {fieldStr(report, "target_id", "targetId")}
                  </td>
                  <td>{fieldStr(report, "reason")}</td>
                  <td>
                    <AdminStatusBadge status={fieldStr(report, "status")} />
                  </td>
                  <td>{fieldDate(report, "created_at", "createdAt")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
