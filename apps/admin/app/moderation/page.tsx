import { mockModerationCases } from "@vuqiro/mock-data";

export default function ModerationPage() {
  return (
    <>
      <div className="header">
        <div>
          <div className="kicker">Moderation</div>
          <h1>Report queue</h1>
          <p className="copy">UGC moderation foundation for reports, removals, blocks, payout holds, appeals and audit logs.</p>
        </div>
      </div>
      <div className="card">
        <table className="table">
          <thead><tr><th>Case</th><th>Target</th><th>Reason</th><th>Priority</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {mockModerationCases.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.id}</strong><br />{item.createdAt}</td>
                <td>{item.targetType}: {item.targetId}</td>
                <td>{item.reason}</td>
                <td><span className="badge warning">{item.priority}</span></td>
                <td><span className="badge secondary">{item.status}</span></td>
                <td><button className="button ghost">Review</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
