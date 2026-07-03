import { AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { ErrorBanner, guardPage } from "../../../components/PageGuard";
import { adminApiFetch } from "../../../lib/adminApi";
import { fieldDate, fieldStr, type Row } from "../../../lib/rows";

export default async function PurchasesPage() {
  const { denied } = await guardPage("/monetization/purchases");
  if (denied) return denied;
  const result = await adminApiFetch<{ purchases: Row[] }>("/admin/purchases");

  return (
    <>
      <AdminPageHeader
        kicker="Monetization"
        title="Purchases"
        copy="Store-verified purchases from RevenueCat webhooks. Coins credit through the idempotent wallet functions."
      />
      {!result.ok ? <ErrorBanner message={result.error} /> : null}
      {result.ok && result.data.purchases.length === 0 ? <div className="empty-state">No purchases yet.</div> : null}
      {result.ok && result.data.purchases.length > 0 ? (
        <AdminTable<Row>
          columns={[
            {
              key: "who",
              header: "User",
              render: (purchase) => {
                const profile = (purchase.profiles ?? {}) as Row;
                return <strong>@{fieldStr(profile, "handle") || fieldStr(purchase, "profile_id", "profileId")}</strong>;
              }
            },
            { key: "platform", header: "Platform", render: (purchase) => fieldStr(purchase, "platform") },
            { key: "product", header: "Product", render: (purchase) => fieldStr(purchase, "store_product_id", "storeProductId") },
            { key: "status", header: "Status", render: (purchase) => <AdminStatusBadge status={fieldStr(purchase, "status")} /> },
            { key: "when", header: "When", render: (purchase) => fieldDate(purchase, "created_at", "createdAt") }
          ]}
          rows={result.data.purchases}
        />
      ) : null}
    </>
  );
}
