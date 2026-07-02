import { AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { mockCreators, mockVideos } from "@vuqiro/mock-data";
import type { Video } from "@vuqiro/types";
import { MockAction } from "../../components/MockAction";

export default function VideosPage() {
  const creatorById = new Map(mockCreators.map((creator) => [creator.id, creator]));

  return (
    <>
      <AdminPageHeader
        kicker="Community"
        title="Videos"
        copy="Every upload with moderation and revenue context. Removal, restore, limiting and age-restriction are audit-logged."
      />
      <AdminTable<Video>
        columns={[
          {
            key: "video",
            header: "Video",
            render: (video) => (
              <>
                <strong>{video.caption}</strong>
                <br />
                {video.id} · @{creatorById.get(video.creatorId)?.handle ?? video.creatorId}
              </>
            )
          },
          { key: "visibility", header: "Visibility", render: (video) => <AdminStatusBadge status={video.visibility} tone="primary" /> },
          { key: "status", header: "Status", render: (video) => <AdminStatusBadge status={video.status ?? "ready"} /> },
          {
            key: "moderation",
            header: "Moderation",
            render: (video) => <AdminStatusBadge status={video.moderationStatus ?? "visible"} />
          },
          {
            key: "engagement",
            header: "Watch / likes / comments",
            render: (video) =>
              `${video.watchCount.toLocaleString()} / ${video.likeCount.toLocaleString()} / ${video.commentCount.toLocaleString()}`
          },
          {
            key: "reports",
            header: "Reports",
            render: (video) =>
              video.reportCount ? <AdminStatusBadge status={`${video.reportCount} reports`} tone="warning" /> : "0"
          },
          { key: "revenue", header: "Revenue", render: (video) => `$${(video.revenue ?? 0).toLocaleString()}` },
          {
            key: "created",
            header: "Created",
            render: (video) => (video.createdAt ? new Date(video.createdAt).toLocaleDateString() : "—")
          },
          {
            key: "actions",
            header: "Actions",
            render: () => (
              <div className="actions-cell">
                <MockAction label="Remove" variant="danger" />
                <MockAction label="Restore" variant="success" />
                <MockAction label="Limit distribution" />
                <MockAction label="Age restrict" />
                <MockAction label="Open reports" />
                <MockAction label="Open creator" />
              </div>
            )
          }
        ]}
        rows={mockVideos}
      />
    </>
  );
}
