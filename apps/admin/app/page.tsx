import { mockAdminMetrics } from "@vuqiro/mock-data";

const metrics = [
  ["Total users", mockAdminMetrics.totalUsers],
  ["Creators", mockAdminMetrics.totalCreators],
  ["Videos under review", mockAdminMetrics.videosUnderReview],
  ["Active subscriptions", mockAdminMetrics.activeSubscriptions],
  ["Coin revenue", `$${mockAdminMetrics.coinRevenue.toLocaleString()}`],
  ["Pending payouts", `$${mockAdminMetrics.pendingPayouts.toLocaleString()}`],
  ["Held payouts", `$${mockAdminMetrics.heldPayouts.toLocaleString()}`],
  ["Refunds", mockAdminMetrics.refunds]
];

export default function Page() {
  return (
    <>
      <div className="header">
        <div>
          <div className="kicker">Superadmin</div>
          <h1>Vuqiro overview</h1>
          <p className="copy">Mock admin foundation for users, creators, moderation, monetization, payouts and legal control. Real auth/RBAC will be added in a later backend batch.</p>
        </div>
        <button className="button">Create report</button>
      </div>
      <div className="grid">
        {metrics.map(([label, value]) => <div className="card" key={label}><div className="metric">{label}</div><div className="metric-value">{value}</div></div>)}
      </div>
    </>
  );
}
