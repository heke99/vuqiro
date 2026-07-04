import { AdminMetricCard, AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { AdminApiAction } from "../../../components/AdminApiAction";
import { ErrorBanner, guardPage } from "../../../components/PageGuard";
import { adminApiFetch } from "../../../lib/adminApi";
import { fieldDate, fieldNum, fieldStr, type Row } from "../../../lib/rows";

function payoutAmount(payout: Row): number {
  return fieldNum(payout, "amount_cents", "amountCents") / 100 || fieldNum(payout, "amount");
}

export default async function PayoutsPage() {
  const { identity, denied } = await guardPage("/monetization/payouts");
  if (denied) return denied;
  const canAct = ["platform_superadmin", "finance"].includes(identity.admin.role);
  const result = await adminApiFetch<{ payouts: Row[]; holds: Row[] }>("/admin/payouts");

  const payouts = result.ok ? result.data.payouts : [];
  const holds = result.ok ? result.data.holds : [];
  const totalPending = payouts
    .filter((payout) => ["pending", "payable"].includes(fieldStr(payout, "status")))
    .reduce((sum, payout) => sum + payoutAmount(payout), 0);
  const totalHeld = payouts
    .filter((payout) => fieldStr(payout, "status") === "held")
    .reduce((sum, payout) => sum + payoutAmount(payout), 0);

  return (
    <>
      <AdminPageHeader
        kicker="Monetization"
        title="Creator payouts"
        copy="Stripe Connect payout batches with finance/superadmin hold, release and batch controls. Every action is audit-logged."
        actions={
          canAct ? (
            <AdminApiAction label="Create payout batch" variant="primary" path="/admin/payouts/batch" body={{}} />
          ) : undefined
        }
      />
      {!result.ok ? <ErrorBanner message={result.error} /> : null}
      <div className="grid" style={{ marginBottom: 24 }}>
        <AdminMetricCard label="Pending / payable" value={`$${totalPending.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
        <AdminMetricCard label="Held" value={`$${totalHeld.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} hint={`${holds.length} active holds`} />
        <AdminMetricCard label="Processing" value={payouts.filter((payout) => fieldStr(payout, "status") === "processing").length} />
        <AdminMetricCard label="Failed" value={payouts.filter((payout) => fieldStr(payout, "status") === "failed").length} />
      </div>

      {payouts.length === 0 ? <div className="empty-state">No payouts yet.</div> : null}
      {payouts.length > 0 ? (
        <AdminTable<Row>
          columns={[
            {
              key: "payout",
              header: "Payout",
              render: (payout) => (
                <>
                  <strong>{fieldStr(payout, "id").slice(0, 14)}</strong>
                  <br />
                  {fieldStr(payout, "batch_id", "batchId") || "unbatched"}
                </>
              )
            },
            {
              key: "creator",
              header: "Creator",
              render: (payout) => {
                const creators = (payout.creators ?? {}) as Row;
                const profile = (creators.profiles ?? {}) as Row;
                return `@${fieldStr(profile, "handle") || fieldStr(payout, "creatorId", "creator_id").slice(0, 12)}`;
              }
            },
            {
              key: "amount",
              header: "Amount",
              render: (payout) => `$${payoutAmount(payout).toLocaleString()} ${fieldStr(payout, "currency") || "USD"}`
            },
            { key: "status", header: "Status", render: (payout) => <AdminStatusBadge status={fieldStr(payout, "status")} /> },
            { key: "failure", header: "Failure", render: (payout) => fieldStr(payout, "failure_reason", "failureReason") || "—" },
            { key: "created", header: "Created", render: (payout) => fieldDate(payout, "created_at", "createdAt") },
            {
              key: "actions",
              header: "Actions",
              render: (payout) => {
                if (!canAct) return <span className="metric-hint">Finance/superadmin only</span>;
                const id = fieldStr(payout, "id");
                const status = fieldStr(payout, "status");
                return (
                  <div className="actions-cell">
                    {status === "held" ? (
                      <AdminApiAction label="Release" variant="success" path={`/admin/payouts/${id}/release`} />
                    ) : status !== "paid" && status !== "failed" ? (
                      <AdminApiAction
                        label="Hold"
                        variant="danger"
                        path={`/admin/payouts/${id}/hold`}
                        body={{ reason: "manual_admin_hold" }}
                      />
                    ) : null}
                  </div>
                );
              }
            }
          ]}
          rows={payouts}
        />
      ) : null}

      <div className="section-header">
        <h2>Active holds</h2>
        <p className="copy">Payout holds and the reason they were placed. Only finance/superadmin can release.</p>
      </div>
      {holds.length > 0 ? (
        <AdminTable<Row>
          columns={[
            { key: "id", header: "Hold", render: (hold) => <strong>{fieldStr(hold, "id").slice(0, 14)}</strong> },
            {
              key: "creator",
              header: "Creator",
              render: (hold) => {
                const creators = (hold.creators ?? {}) as Row;
                const profile = (creators.profiles ?? {}) as Row;
                return `@${fieldStr(profile, "handle") || fieldStr(hold, "creatorId", "creator_id").slice(0, 12)}`;
              }
            },
            { key: "reason", header: "Reason", render: (hold) => <AdminStatusBadge status={fieldStr(hold, "reason")} /> },
            { key: "note", header: "Note", render: (hold) => fieldStr(hold, "note") || "—" },
            { key: "created", header: "Created", render: (hold) => fieldDate(hold, "created_at", "createdAt") }
          ]}
          rows={holds}
        />
      ) : (
        <div className="empty-state">No active holds.</div>
      )}
    </>
  );
}
