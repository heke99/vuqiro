import { AdminPageHeader, AdminTable } from "@vuqiro/ui/admin";
import { AdminForm } from "../../../components/AdminForm";
import { ErrorBanner, guardPage } from "../../../components/PageGuard";
import { adminApiFetch } from "../../../lib/adminApi";
import { fieldDate, fieldNum, fieldStr, type Row } from "../../../lib/rows";

export default async function WalletTransactionsPage() {
  const { identity, denied } = await guardPage("/monetization/wallet-transactions");
  if (denied) return denied;
  const canAdjust = ["platform_superadmin", "finance"].includes(identity.admin.role);
  const result = await adminApiFetch<{ transactions: Row[] }>("/admin/wallet/transactions");

  return (
    <>
      <AdminPageHeader
        kicker="Monetization"
        title="Wallet transactions"
        copy="Append-only coin ledger. Balances are only ever changed by the atomic wallet functions; manual adjustments require finance/superadmin and are audit-logged."
      />
      {canAdjust ? (
        <AdminForm
          title="Manual adjustment"
          path="/admin/wallet/adjust"
          submitLabel="Apply adjustment"
          transform={(values) => ({
            ...values,
            idempotencyKey: `admin-adj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
          })}
          fields={[
            { name: "profileId", label: "Profile ID", required: true },
            { name: "amount", label: "Amount (coins, negative to claw back)", type: "number", required: true },
            { name: "reason", label: "Reason (audit-logged)", required: true }
          ]}
        />
      ) : null}
      {!result.ok ? <ErrorBanner message={result.error} /> : null}
      {result.ok && result.data.transactions.length === 0 ? (
        <div className="empty-state">No wallet transactions.</div>
      ) : null}
      {result.ok && result.data.transactions.length > 0 ? (
        <AdminTable<Row>
          columns={[
            {
              key: "who",
              header: "Wallet",
              render: (txn) => {
                const wallet = (txn.wallets ?? {}) as Row;
                const profile = (wallet.profiles ?? {}) as Row;
                return <strong>@{fieldStr(profile, "handle") || fieldStr(txn, "walletId", "wallet_id")}</strong>;
              }
            },
            { key: "type", header: "Type", render: (txn) => fieldStr(txn, "type") },
            {
              key: "amount",
              header: "Amount",
              render: (txn) => {
                const amount = fieldNum(txn, "amount", "coins_delta", "coinsDelta");
                return `${amount > 0 ? "+" : ""}${amount.toLocaleString()} coins`;
              }
            },
            { key: "label", header: "Label", render: (txn) => fieldStr(txn, "label", "description").slice(0, 80) },
            { key: "when", header: "When", render: (txn) => fieldDate(txn, "created_at", "createdAt") }
          ]}
          rows={result.data.transactions}
        />
      ) : null}
    </>
  );
}
