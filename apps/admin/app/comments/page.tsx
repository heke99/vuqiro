import { AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { AdminApiAction } from "../../components/AdminApiAction";
import { ErrorBanner, guardPage } from "../../components/PageGuard";
import { adminApiFetch } from "../../lib/adminApi";
import { fieldDate, fieldNum, fieldStr, type Row } from "../../lib/rows";

export default async function CommentsPage({
  searchParams
}: {
  searchParams: Promise<{ flagged?: string }>;
}) {
  const { identity, denied } = await guardPage("/comments");
  if (denied) return denied;
  const params = await searchParams;
  const canEnforce = ["platform_superadmin", "admin", "moderator"].includes(identity.admin.role);
  const result = await adminApiFetch<{ comments: Row[] }>(
    `/admin/comments${params.flagged === "1" ? "?flagged=1" : ""}`
  );

  return (
    <>
      <AdminPageHeader
        kicker="Community"
        title="Comments"
        copy="Comment moderation. Hide/remove/restore actions are audit-logged."
      />
      <form className="row" style={{ marginBottom: 16 }}>
        <label className="metric-hint">
          <input type="checkbox" name="flagged" value="1" defaultChecked={params.flagged === "1"} /> Only flagged
          (reported) comments
        </label>
        <button className="button small" type="submit">
          Apply
        </button>
      </form>
      {!result.ok ? <ErrorBanner message={result.error} /> : null}
      {result.ok && result.data.comments.length === 0 ? <div className="empty-state">No comments match.</div> : null}
      {result.ok && result.data.comments.length > 0 ? (
        <AdminTable<Row>
          columns={[
            {
              key: "comment",
              header: "Comment",
              render: (comment) => {
                const author = (comment.profiles ?? {}) as Row;
                return (
                  <>
                    <strong>{fieldStr(comment, "text").slice(0, 90)}</strong>
                    <br />@{fieldStr(author, "handle") || fieldStr(comment, "authorId", "author_id")}
                  </>
                );
              }
            },
            {
              key: "moderation",
              header: "Moderation",
              render: (comment) => <AdminStatusBadge status={fieldStr(comment, "moderation_status", "moderationStatus") || "visible"} />
            },
            {
              key: "engagement",
              header: "Likes / reports",
              render: (comment) => `${fieldNum(comment, "like_count", "likeCount")} / ${fieldNum(comment, "report_count", "reportCount")}`
            },
            { key: "created", header: "Created", render: (comment) => fieldDate(comment, "created_at", "createdAt") },
            {
              key: "actions",
              header: "Actions",
              render: (comment) => {
                if (!canEnforce) return <span className="metric-hint">Read-only</span>;
                const id = fieldStr(comment, "id");
                const moderation = fieldStr(comment, "moderation_status", "moderationStatus") || "visible";
                return (
                  <div className="actions-cell">
                    {moderation === "visible" ? (
                      <>
                        <AdminApiAction label="Hide" path={`/admin/comments/${id}/hide`} variant="danger" />
                        <AdminApiAction label="Remove" path={`/admin/comments/${id}/remove`} variant="danger" />
                      </>
                    ) : (
                      <AdminApiAction label="Restore" path={`/admin/comments/${id}/restore`} variant="success" />
                    )}
                  </div>
                );
              }
            }
          ]}
          rows={result.data.comments}
        />
      ) : null}
    </>
  );
}
