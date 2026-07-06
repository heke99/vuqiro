import { AdminMetricCard, AdminPageHeader, AdminTable } from "@vuqiro/ui/admin";
import { AdminApiAction } from "../../components/AdminApiAction";
import { ErrorBanner, guardPage } from "../../components/PageGuard";
import { adminApiFetch } from "../../lib/adminApi";
import { usd } from "../../lib/rows";

type DailyPoint = {
  id?: string;
  date: string;
  views: number;
  uniqueViewers: number;
  watchHours: number;
  completions: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
};

type AnalyticsData = {
  range: { from: string; to: string };
  totals: {
    newUsers: number;
    uploads: number;
    publishedVideos: number;
    views: number;
    watchHours: number;
    completions: number;
    likes: number;
    comments: number;
    reports: number;
    moderationActions?: number;
    revenueCents: number;
    adImpressions: number;
    adClicks: number;
  };
  series: DailyPoint[];
  topVideos: { id: string; caption: string; watch_count?: number; watchCount?: number }[];
  topCreators: { creatorId: string; handle: string; views: number; followersGained: number; coinsEarned: number }[];
};

export default async function AnalyticsPage({
  searchParams
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { denied } = await guardPage("/analytics");
  if (denied) return denied;
  const params = await searchParams;

  const query = new URLSearchParams();
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  const result = await adminApiFetch<AnalyticsData>(`/admin/analytics?${query.toString()}`);

  return (
    <>
      <AdminPageHeader
        kicker="Overview"
        title="Platform analytics"
        copy="Views, watch time, engagement, growth, safety and revenue for the selected window. Data comes from the daily rollup tables — run the rollup job below if a recent day is missing."
      />
      <form className="row" style={{ marginBottom: 14 }}>
        <input className="input" type="date" name="from" defaultValue={params.from ?? ""} style={{ maxWidth: 180 }} />
        <input className="input" type="date" name="to" defaultValue={params.to ?? ""} style={{ maxWidth: 180 }} />
        <button className="button small" type="submit">
          Apply
        </button>
        <a className="button small" href="/api/export/platform-analytics" download>
          Export CSV
        </a>
        <AdminApiAction label="Run rollup (yesterday)" path="/admin/ops/analytics/run" />
      </form>

      {!result.ok ? <ErrorBanner message={result.error} /> : null}
      {result.ok ? (
        <>
          <div className="grid">
            <AdminMetricCard label="Views" value={result.data.totals.views.toLocaleString()} />
            <AdminMetricCard label="Watch hours" value={result.data.totals.watchHours.toLocaleString()} />
            <AdminMetricCard label="Completions" value={result.data.totals.completions.toLocaleString()} />
            <AdminMetricCard label="New users" value={result.data.totals.newUsers.toLocaleString()} />
          </div>
          <div className="grid">
            <AdminMetricCard label="Uploads / published" value={`${result.data.totals.uploads} / ${result.data.totals.publishedVideos}`} />
            <AdminMetricCard label="Likes / comments" value={`${result.data.totals.likes.toLocaleString()} / ${result.data.totals.comments.toLocaleString()}`} />
            <AdminMetricCard label="Reports" value={result.data.totals.reports.toLocaleString()} />
            <AdminMetricCard label="Revenue" value={usd(result.data.totals.revenueCents)} />
          </div>
          <div className="grid">
            <AdminMetricCard label="Ad impressions" value={result.data.totals.adImpressions.toLocaleString()} />
            <AdminMetricCard label="Ad clicks" value={result.data.totals.adClicks.toLocaleString()} />
            <AdminMetricCard
              label="Ad CTR"
              value={
                result.data.totals.adImpressions > 0
                  ? `${((result.data.totals.adClicks / result.data.totals.adImpressions) * 100).toFixed(2)}%`
                  : "—"
              }
            />
            <AdminMetricCard
              label="Completion rate"
              value={
                result.data.totals.views > 0
                  ? `${((result.data.totals.completions / result.data.totals.views) * 100).toFixed(1)}%`
                  : "—"
              }
            />
          </div>

          <div className="section-header">
            <h2>Daily series ({result.data.range.from} → {result.data.range.to})</h2>
          </div>
          {result.data.series.length === 0 ? (
            <div className="empty-state">
              No rollup rows in this window yet. Trigger "Run rollup" (or wait for the scheduled job) to populate it.
            </div>
          ) : (
            <AdminTable<DailyPoint>
              columns={[
                { key: "date", header: "Date", render: (point) => <strong>{point.date}</strong> },
                { key: "views", header: "Views", render: (point) => point.views.toLocaleString() },
                { key: "unique", header: "Unique viewers", render: (point) => point.uniqueViewers.toLocaleString() },
                { key: "watch", header: "Watch hours", render: (point) => point.watchHours.toLocaleString() },
                { key: "completions", header: "Completions", render: (point) => point.completions.toLocaleString() },
                { key: "likes", header: "Likes", render: (point) => point.likes.toLocaleString() },
                { key: "comments", header: "Comments", render: (point) => point.comments.toLocaleString() },
                { key: "shares", header: "Shares", render: (point) => point.shares.toLocaleString() }
              ]}
              rows={result.data.series.map((point) => ({ ...point, id: point.date }))}
            />
          )}

          <div className="section-header">
            <h2>Top videos</h2>
          </div>
          <AdminTable<{ id: string; caption: string; watch_count?: number; watchCount?: number }>
            columns={[
              { key: "caption", header: "Video", render: (video) => <strong>{video.caption.slice(0, 80)}</strong> },
              {
                key: "watches",
                header: "Watches (all-time)",
                render: (video) => Number(video.watch_count ?? video.watchCount ?? 0).toLocaleString()
              }
            ]}
            rows={result.data.topVideos}
          />

          {result.data.topCreators.length > 0 ? (
            <>
              <div className="section-header">
                <h2>Top creators (window)</h2>
              </div>
              <AdminTable<AnalyticsData["topCreators"][number] & { id: string }>
                columns={[
                  { key: "handle", header: "Creator", render: (creator) => <strong>@{creator.handle}</strong> },
                  { key: "views", header: "Views", render: (creator) => creator.views.toLocaleString() },
                  { key: "followers", header: "Followers gained", render: (creator) => creator.followersGained.toLocaleString() },
                  { key: "coins", header: "Coins earned", render: (creator) => creator.coinsEarned.toLocaleString() }
                ]}
                rows={result.data.topCreators.map((creator) => ({ ...creator, id: creator.creatorId }))}
              />
            </>
          ) : null}
        </>
      ) : null}
    </>
  );
}
