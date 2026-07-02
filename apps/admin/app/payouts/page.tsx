export default function PayoutsPage() {
  const rows = [
    ["Maya North", "$4,210", "$0", "active", "payable"],
    ["Riven Atlas", "$1,340", "$220", "active", "held"],
    ["Noor Builds", "$420", "$0", "onboarding_started", "pending"]
  ];
  return (
    <>
      <div className="header">
        <div>
          <div className="kicker">Payouts</div>
          <h1>Creator payouts</h1>
          <p className="copy">Stripe Connect will handle creator payouts. Superadmin can hold, release and audit payout decisions.</p>
        </div>
      </div>
      <div className="card">
        <table className="table">
          <thead><tr><th>Creator</th><th>Payable</th><th>Held</th><th>Stripe status</th><th>Payout status</th><th>Action</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row[0]}><td><strong>{row[0]}</strong></td><td>{row[1]}</td><td>{row[2]}</td><td>{row[3]}</td><td><span className="badge warning">{row[4]}</span></td><td><button className="button ghost">Manage</button></td></tr>)}</tbody>
        </table>
      </div>
    </>
  );
}
