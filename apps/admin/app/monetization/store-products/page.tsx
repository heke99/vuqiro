import { AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { ErrorBanner, guardPage } from "../../../components/PageGuard";
import { adminApiFetch } from "../../../lib/adminApi";
import { fieldStr, type Row } from "../../../lib/rows";

export default async function StoreProductsPage() {
  const { denied } = await guardPage("/monetization/store-products");
  if (denied) return denied;
  const result = await adminApiFetch<{ products: Row[] }>("/admin/monetization/store-products");

  return (
    <>
      <AdminPageHeader
        kicker="Monetization"
        title="Store products"
        copy="Apple App Store and Google Play product mappings per price version. 'Missing' means the product still has to be created in the store console."
      />
      {!result.ok ? <ErrorBanner message={result.error} /> : null}
      {result.ok && result.data.products.length > 0 ? (
        <AdminTable<Row>
          columns={[
            {
              key: "product",
              header: "Store product ID",
              render: (product) => <strong>{fieldStr(product, "store_product_id", "storeProductId")}</strong>
            },
            { key: "platform", header: "Platform", render: (product) => <AdminStatusBadge status={fieldStr(product, "platform")} /> },
            {
              key: "version",
              header: "Price version",
              render: (product) => fieldStr(product, "package_version_id", "packageVersionId")
            },
            {
              key: "offering",
              header: "RC offering",
              render: (product) => fieldStr(product, "revenuecat_offering_id", "revenueCatOfferingId") || "—"
            },
            {
              key: "entitlement",
              header: "RC entitlement",
              render: (product) => fieldStr(product, "revenuecat_entitlement_id", "revenueCatEntitlementId") || "—"
            },
            { key: "status", header: "Status", render: (product) => <AdminStatusBadge status={fieldStr(product, "status")} /> }
          ]}
          rows={result.data.products}
        />
      ) : (
        <div className="empty-state">No store products mapped.</div>
      )}
    </>
  );
}
