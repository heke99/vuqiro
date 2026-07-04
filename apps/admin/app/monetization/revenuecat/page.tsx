import { AdminCard, AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { ErrorBanner, guardPage } from "../../../components/PageGuard";
import { adminApiFetch } from "../../../lib/adminApi";
import { fieldStr, type Row } from "../../../lib/rows";

type HealthData = {
  report: { payments: { status: string; message?: string } };
};

export default async function RevenueCatPage() {
  const { denied } = await guardPage("/monetization/revenuecat");
  if (denied) return denied;

  const [products, health] = await Promise.all([
    adminApiFetch<{ products: Row[] }>("/admin/monetization/store-products"),
    adminApiFetch<HealthData>("/admin/integration-health")
  ]);
  const payments = health.ok ? health.data.report.payments : { status: "unknown", message: "" };
  const rows = products.ok
    ? products.data.products.filter((product) => fieldStr(product, "revenuecat_offering_id", "revenueCatOfferingId"))
    : [];

  return (
    <>
      <AdminPageHeader
        kicker="Monetization"
        title="RevenueCat"
        copy="Offering and entitlement mapping plus webhook state. API keys are provided via environment variables; webhook events are verified and processed idempotently by the API service."
      />
      <div className="grid-3" style={{ marginBottom: 24 }}>
        <AdminCard title="Provider status">
          <p className="copy">
            <AdminStatusBadge status={payments.status} />
            <br />
            {payments.message}
          </p>
        </AdminCard>
        <AdminCard title="Webhook">
          <p className="copy">
            Endpoint: POST /revenuecat/webhook
            <br />
            Verified via REVENUECAT_WEBHOOK_SECRET; events are recorded in revenuecat_webhook_events and replayed
            idempotently. Coins credit through the atomic wallet functions.
          </p>
        </AdminCard>
        <AdminCard title="Entitlement sync">
          <p className="copy">
            Server-side entitlements are the source of truth for locked content. Client entitlement state is never
            trusted for access control.
          </p>
        </AdminCard>
      </div>

      <div className="section-header">
        <h2>Product mapping state</h2>
      </div>
      {!products.ok ? <ErrorBanner message={products.error} /> : null}
      {rows.length > 0 ? (
        <AdminTable<Row>
          columns={[
            {
              key: "product",
              header: "Store product",
              render: (product) => <strong>{fieldStr(product, "store_product_id", "storeProductId")}</strong>
            },
            { key: "platform", header: "Platform", render: (product) => <AdminStatusBadge status={fieldStr(product, "platform")} /> },
            {
              key: "offering",
              header: "Offering",
              render: (product) => fieldStr(product, "revenuecat_offering_id", "revenueCatOfferingId") || "—"
            },
            {
              key: "entitlement",
              header: "Entitlement",
              render: (product) => fieldStr(product, "revenuecat_entitlement_id", "revenueCatEntitlementId") || "—"
            },
            { key: "status", header: "Status", render: (product) => <AdminStatusBadge status={fieldStr(product, "status")} /> }
          ]}
          rows={rows}
        />
      ) : (
        <div className="empty-state">No RevenueCat-mapped products.</div>
      )}
    </>
  );
}
