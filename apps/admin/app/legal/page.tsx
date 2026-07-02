export default function Page() {
  return (
    <>
      <div className="header">
        <div>
          <div className="kicker">Superadmin</div>
          <h1>Legal</h1>
          <p className="copy">Terms, privacy, community guidelines, creator terms, payout terms and acceptance logs.</p>
        </div>
        <button className="button ghost">Mock action</button>
      </div>
      <div className="grid-3">
        <div className="card"><div className="metric">Status</div><div className="metric-value">Mock</div></div>
        <div className="card"><div className="metric">Audit</div><div className="metric-value">On</div></div>
        <div className="card"><div className="metric">RBAC</div><div className="metric-value">Next</div></div>
      </div>
      <div className="card" style={{ marginTop: 18 }}>
        <h2>Legal foundation</h2>
        <p className="copy">This section is scaffolded for Batch 1. Backend, real auth, database and role-based actions will be connected in later batches.</p>
      </div>
    </>
  );
}
