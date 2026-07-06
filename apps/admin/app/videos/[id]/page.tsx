import { AdminMetricCard, AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { AdminApiAction } from "../../../components/AdminApiAction";
import { ErrorBanner, guardPage } from "../../../components/PageGuard";
import { adminApiFetch } from "../../../lib/adminApi";
import { field, fieldDate, fieldNum, fieldStr, type Row } from "../../../lib/rows";

type VideoDetail = {
  video: Row;
  asset?: Row | null;
  reports: Row[];
  processingJobs: Row[];
};

type RankingFactor = { id?: string; name: string; value: number; weight: number; contribution: number };

type RankingExplanation = {
  result: { score: number; factors: RankingFactor[] };
  input: Row;
  weights: Record<string, number>;
};

export default async function VideoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { identity, denied } = await guardPage("/videos");
  if (denied) return denied;
  const { id } = await params;
  const [detail, ranking] = await Promise.all([
    adminApiFetch<VideoDetail>(`/admin/videos/${id}`),
    adminApiFetch<RankingExplanation>(`/admin/videos/${id}/ranking`)
  ]);
  if (!detail.ok) {
    return (
      <>
        <AdminPageHeader kicker="Community" title="Video detail" copy="" />
        <ErrorBanner message={detail.error} />
      </>
    );
  }
  const { video, reports, processingJobs } = detail.data;
  const canEnforce = ["platform_superadmin", "admin", "moderator"].includes(identity.admin.role);
  const moderation = fieldStr(video, "moderation_status", "moderationStatus");
  const isFeatured = field<boolean>(video, "is_featured", "isFeatured") === true;

  return (
    <>
      <AdminPageHeader
        kicker="Community"
        title={fieldStr(video, "caption").slice(0, 80) || "(no caption)"}
        copy={`Status, moderation, reports and the live ranking breakdown for this video. Ranking weights are tunable under Settings → feed_weights.`}
      />
      <div className="row" style={{ marginBottom: 18 }}>
        <AdminStatusBadge status={fieldStr(video, "status")} />
        <AdminStatusBadge status={moderation} />
        {isFeatured ? <AdminStatusBadge status="featured" /> : null}
        {canEnforce ? (
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
            {isFeatured ? (
              <AdminApiAction label="Unfeature" path={`/admin/videos/${id}/unfeature`} />
            ) : moderation === "visible" ? (
              <AdminApiAction label="Feature" path={`/admin/videos/${id}/feature`} variant="success" />
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="grid">
        <AdminMetricCard label="Watches" value={fieldNum(video, "watch_count", "watchCount")} />
        <AdminMetricCard label="Likes" value={fieldNum(video, "like_count", "likeCount")} />
        <AdminMetricCard label="Comments" value={fieldNum(video, "comment_count", "commentCount")} />
        <AdminMetricCard label="Reports" value={fieldNum(video, "report_count", "reportCount")} />
      </div>

      <div className="section-header">
        <h2>Ranking inspector</h2>
      </div>
      {!ranking.ok ? <ErrorBanner message={ranking.error} /> : null}
      {ranking.ok ? (
        <>
          <div className="grid" style={{ marginBottom: 12 }}>
            <AdminMetricCard label="Total score" value={ranking.data.result.score.toFixed(2)} />
            <AdminMetricCard
              label="Safety score"
              value={String(field<number>(ranking.data.input, "safetyScore") ?? "—")}
            />
            <AdminMetricCard
              label="Featured"
              value={field<boolean>(ranking.data.input, "isFeatured") ? "yes" : "no"}
            />
            <AdminMetricCard
              label="Boost"
              value={String(field<number>(ranking.data.input, "boostScore") ?? 0)}
            />
          </div>
          <AdminTable<RankingFactor>
            columns={[
              { key: "name", header: "Factor", render: (factor) => <strong>{factor.name}</strong> },
              { key: "value", header: "Value (0–1)", render: (factor) => factor.value.toFixed(4) },
              { key: "weight", header: "Effective weight", render: (factor) => factor.weight.toFixed(2) },
              { key: "contribution", header: "Contribution", render: (factor) => factor.contribution.toFixed(3) }
            ]}
            rows={ranking.data.result.factors.map((factor) => ({ ...factor, id: factor.name }))}
          />
          <div className="metric-hint" style={{ marginTop: 8 }}>
            Weight multipliers: {JSON.stringify(ranking.data.weights)}
          </div>
        </>
      ) : null}

      <div className="section-header">
        <h2>Reports</h2>
      </div>
      {reports.length === 0 ? <div className="empty-state">No reports.</div> : null}
      {reports.length > 0 ? (
        <AdminTable<Row>
          columns={[
            { key: "reason", header: "Reason", render: (report) => fieldStr(report, "reason") },
            { key: "status", header: "Status", render: (report) => <AdminStatusBadge status={fieldStr(report, "status")} /> },
            { key: "created", header: "Created", render: (report) => fieldDate(report, "created_at", "createdAt") }
          ]}
          rows={reports}
        />
      ) : null}

      <div className="section-header">
        <h2>Processing jobs</h2>
      </div>
      {processingJobs.length === 0 ? <div className="empty-state">No processing jobs.</div> : null}
      {processingJobs.length > 0 ? (
        <AdminTable<Row>
          columns={[
            { key: "event", header: "Event", render: (job) => fieldStr(job, "event_type", "eventType") || fieldStr(job, "status") },
            { key: "provider", header: "Provider", render: (job) => fieldStr(job, "provider") },
            { key: "created", header: "Created", render: (job) => fieldDate(job, "created_at", "createdAt") }
          ]}
          rows={processingJobs}
        />
      ) : null}
    </>
  );
}
