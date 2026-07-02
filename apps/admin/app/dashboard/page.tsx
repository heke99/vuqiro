import { AdminMetricCard, AdminPageHeader } from "@vuqiro/ui/admin";
import { mockAdminMetrics } from "@vuqiro/mock-data";

const usd = (value: number) => `$${value.toLocaleString()}`;

const cards: [string, string | number][] = [
  ["Total users", mockAdminMetrics.totalUsers.toLocaleString()],
  ["Active users", mockAdminMetrics.activeUsers.toLocaleString()],
  ["Total creators", mockAdminMetrics.totalCreators.toLocaleString()],
  ["Verified creators", mockAdminMetrics.verifiedCreators.toLocaleString()],
  ["Videos uploaded", mockAdminMetrics.videosUploaded.toLocaleString()],
  ["Videos under review", mockAdminMetrics.videosUnderReview],
  ["Active subscriptions", mockAdminMetrics.activeSubscriptions.toLocaleString()],
  ["Coin revenue", usd(mockAdminMetrics.coinRevenue)],
  ["MRR", usd(mockAdminMetrics.mrr)],
  ["Pending payouts", usd(mockAdminMetrics.pendingPayouts)],
  ["Held payouts", usd(mockAdminMetrics.heldPayouts)],
  ["Reported content", mockAdminMetrics.reportedContent],
  ["Refunds", mockAdminMetrics.refunds],
  ["Chargebacks", mockAdminMetrics.chargebacks],
  ["Content removals", mockAdminMetrics.contentRemovals]
];

export default function DashboardPage() {
  return (
    <>
      <AdminPageHeader
        kicker="Superadmin"
        title="Vuqiro dashboard"
        copy="Platform health across community, monetization, moderation and payouts. Data is mock until the backend batches connect real queries."
      />
      <div className="grid">
        {cards.map(([label, value]) => (
          <AdminMetricCard key={label} label={label} value={value} />
        ))}
      </div>
    </>
  );
}
