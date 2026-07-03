import { AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { AdminApiAction } from "../../components/AdminApiAction";
import { ErrorBanner, guardPage } from "../../components/PageGuard";
import { adminApiFetch } from "../../lib/adminApi";
import { field, fieldDate, fieldNum, fieldStr, type Row } from "../../lib/rows";

export default async function VideosPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string; moderation?: string }>;
}) {
  const { identity, denied } = await guardPage("/videos");
  if (denied) return denied;
  const params = await searchParams;
  const canEnforce = ["platform_superadmin", "admin", "moderator"].includes(identity.admin.role);

  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.moderation) query.set("moderation", params.moderation);
  const result = await adminApiFetch<{ videos: Row[] }>(`/admin/videos?${query.toString()}`);

  return (
    <>
      <AdminPageHeader
        kicker="Community"
        title="Videos"
        copy="All uploaded content with pipeline status, moderation state and ad eligibility. Actions are audit-logged."
      />
      <form className="row" style={{ marginBottom: 16 }}>
        <select className="input" name="status" defaultValue={params.status ?? ""} style={{ maxWidth: 220 }}>
          <option value="">All statuses</option>
          {["ready", "processing", "uploading", "under_review", "removed", "blocked", "deleted", "draft"].map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select className="input" name="moderation" defaultValue={params.moderation ?? ""} style={{ maxWidth: 220 }}>
          <option value="">All moderation states</option>
          {["visible", "limited", "under_review", "removed", "blocked", "age_restricted"].map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <button className="button small" type="submit">
          Filter
        </button>
      </form>
      {!result.ok ? <ErrorBanner message={result.error} /> : null}
      {result.ok && result.data.videos.length === 0 ? <div className="empty-state">No videos match.</div> : null}
      {result.ok && result.data.videos.length > 0 ? (
        <AdminTable<Row>
          columns={[
            {
              key: "video",
              header: "Video",
              render: (video) => {
                const creators = (video.creators ?? {}) as Row;
                const profile = (creators.profiles ?? {}) as Row;
                return (
                  <>
                    <strong>{fieldStr(video, "caption").slice(0, 70) || "(no caption)"}</strong>
                    <br />@{fieldStr(profile, "handle") || fieldStr(video, "creatorId", "creator_id")}
                  </>
                );
              }
            },
            { key: "status", header: "Status", render: (video) => <AdminStatusBadge status={fieldStr(video, "status")} /> },
            {
              key: "moderation",
              header: "Moderation",
              render: (video) => <AdminStatusBadge status={fieldStr(video, "moderation_status", "moderationStatus")} />
            },
            {
              key: "adEligible",
              header: "Ads",
              render: (video) => (field<boolean>(video, "ad_eligible", "adEligible") === false ? "Not eligible" : "Eligible")
            },
            {
              key: "engagement",
              header: "Likes / comments / reports",
              render: (video) =>
                `${fieldNum(video, "like_count", "likeCount")} / ${fieldNum(video, "comment_count", "commentCount")} / ${fieldNum(video, "report_count", "reportCount")}`
            },
            { key: "created", header: "Created", render: (video) => fieldDate(video, "created_at", "createdAt") },
            {
              key: "actions",
              header: "Actions",
              render: (video) => {
                if (!canEnforce) return <span className="metric-hint">Read-only</span>;
                const id = fieldStr(video, "id");
                const moderation = fieldStr(video, "moderation_status", "moderationStatus");
                return (
                  <div className="actions-cell">
                    {moderation === "visible" ? (
                      <>
                        <AdminApiAction label="Hide" path={`/admin/videos/${id}/hide`} variant="danger" />
                        <AdminApiAction label="Remove" path={`/admin/videos/${id}/remove`} variant="danger" />
                        <AdminApiAction label="Age-restrict" path={`/admin/videos/${id}/age-restrict`} />
                      </>
                    ) : (
                      <AdminApiAction label="Restore" path={`/admin/videos/${id}/restore`} variant="success" />
                    )}
                    {field<boolean>(video, "ad_eligible", "adEligible") === false ? (
                      <AdminApiAction label="Mark ad-eligible" path={`/admin/videos/${id}/ad-eligible`} />
                    ) : (
                      <AdminApiAction label="Mark ad-ineligible" path={`/admin/videos/${id}/ad-ineligible`} />
                    )}
                  </div>
                );
              }
            }
          ]}
          rows={result.data.videos}
        />
      ) : null}
    </>
  );
}
