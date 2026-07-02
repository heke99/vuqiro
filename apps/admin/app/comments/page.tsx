import { AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { mockComments } from "@vuqiro/mock-data";
import type { Comment } from "@vuqiro/types";
import { MockAction } from "../../components/MockAction";

export default function CommentsPage() {
  return (
    <>
      <AdminPageHeader
        kicker="Community"
        title="Comments"
        copy="Comment moderation across all videos. Removals, hides and bans are audit-logged."
      />
      <AdminTable<Comment>
        columns={[
          { key: "id", header: "Comment", render: (comment) => <strong>{comment.id}</strong> },
          {
            key: "author",
            header: "Author",
            render: (comment) => (
              <>
                {comment.authorDisplayName}
                <br />@{comment.authorHandle}
              </>
            )
          },
          { key: "video", header: "Video", render: (comment) => comment.videoId },
          { key: "text", header: "Text", render: (comment) => comment.text },
          {
            key: "reports",
            header: "Reports",
            render: (comment) =>
              comment.reportCount ? <AdminStatusBadge status={`${comment.reportCount}`} tone="warning" /> : "0"
          },
          {
            key: "moderation",
            header: "Moderation",
            render: (comment) => <AdminStatusBadge status={comment.moderationStatus ?? "visible"} />
          },
          {
            key: "created",
            header: "Created",
            render: (comment) => new Date(comment.createdAt).toLocaleDateString()
          },
          {
            key: "actions",
            header: "Actions",
            render: () => (
              <div className="actions-cell">
                <MockAction label="Remove" variant="danger" />
                <MockAction label="Restore" variant="success" />
                <MockAction label="Hide" />
                <MockAction label="Ban user" variant="danger" />
                <MockAction label="Open report" />
              </div>
            )
          }
        ]}
        rows={mockComments.slice(0, 25)}
      />
    </>
  );
}
