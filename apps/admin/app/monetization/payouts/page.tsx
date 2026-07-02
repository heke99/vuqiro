import { AdminMetricCard, AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { mockCreators, mockPayoutHolds, mockPayouts } from "@vuqiro/mock-data";
import type { CreatorPayout, PayoutHold } from "@vuqiro/types";
import { MockAction } from "../../../components/MockAction";

export default function PayoutsPage() {
  const creatorById = new Map(mockCreators.map((creator) => [creator.id, creator]));
  const totalPending = mockPayouts
    .filter((payout) => payout.status === "pending" || payout.status === "payable")
    .reduce((sum, payout) => sum + payout.amount, 0);
  const totalHeld = mockPayouts
    .filter((payout) => payout.status === "held")
    .reduce((sum, payout) => sum + payout.amount, 0);

  return (
    <>
      <AdminPageHeader
        kicker="Monetization"
        title="Creator payouts"
        copy="Stripe Connect payout batches with superadmin hold/release controls. Every hold, release and batch action is audit-logged."
        actions={<MockAction label="Create payout batch" variant="primary" />}
      />
      <div className="grid" style={{ marginBottom: 24 }}>
        <AdminMetricCard label="Pending / payable" value={`$${totalPending.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
        <AdminMetricCard label="Held" value={`$${totalHeld.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} hint={`${mockPayoutHolds.length} active holds`} />
        <AdminMetricCard label="Processing" value={mockPayouts.filter((payout) => payout.status === "processing").length} />
        <AdminMetricCard label="Failed" value={mockPayouts.filter((payout) => payout.status === "failed").length} />
      </div>

      <AdminTable<CreatorPayout>
        columns={[
          {
            key: "payout",
            header: "Payout",
            render: (payout) => (
              <>
                <strong>{payout.id}</strong>
                <br />
                {payout.batchId ?? "unbatched"}
              </>
            )
          },
          {
            key: "creator",
            header: "Creator",
            render: (payout) => (
              <>
                {creatorById.get(payout.creatorId)?.displayName ?? payout.creatorId}
                <br />@{creatorById.get(payout.creatorId)?.handle}
              </>
            )
          },
          { key: "amount", header: "Amount", render: (payout) => `$${payout.amount.toLocaleString()} ${payout.currency}` },
          { key: "status", header: "Status", render: (payout) => <AdminStatusBadge status={payout.status} /> },
          {
            key: "failure",
            header: "Failure",
            render: (payout) => payout.failureReason ?? "—"
          },
          {
            key: "created",
            header: "Created / paid",
            render: (payout) => (
              <>
                {new Date(payout.createdAt).toLocaleDateString()}
                <br />
                {payout.paidAt ? new Date(payout.paidAt).toLocaleDateString() : "—"}
              </>
            )
          },
          {
            key: "actions",
            header: "Actions",
            render: (payout) => (
              <div className="actions-cell">
                {payout.status === "held" ? (
                  <MockAction label="Release" variant="success" />
                ) : payout.status === "failed" ? (
                  <MockAction label="Retry" variant="primary" />
                ) : (
                  <MockAction label="Hold" variant="danger" />
                )}
                <MockAction label="View ledger" />
              </div>
            )
          }
        ]}
        rows={mockPayouts}
      />

      <div className="section-header">
        <h2>Active holds</h2>
        <p className="copy">Payout holds and the reason they were placed. Only superadmins can release.</p>
      </div>
      <AdminTable<PayoutHold>
        columns={[
          { key: "id", header: "Hold", render: (hold) => <strong>{hold.id}</strong> },
          {
            key: "creator",
            header: "Creator",
            render: (hold) => creatorById.get(hold.creatorId)?.displayName ?? hold.creatorId
          },
          { key: "reason", header: "Reason", render: (hold) => <AdminStatusBadge status={hold.reason} tone="warning" /> },
          { key: "note", header: "Note", render: (hold) => hold.note ?? "—" },
          { key: "placedBy", header: "Placed by", render: (hold) => hold.placedBy },
          { key: "created", header: "Created", render: (hold) => new Date(hold.createdAt).toLocaleDateString() },
          {
            key: "actions",
            header: "Actions",
            render: () => (
              <div className="actions-cell">
                <MockAction label="Release hold" variant="success" />
              </div>
            )
          }
        ]}
        rows={mockPayoutHolds}
      />
    </>
  );
}
