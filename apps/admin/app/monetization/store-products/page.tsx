import { AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { mockPackageVersions, mockStoreProducts } from "@vuqiro/mock-data";
import type { StoreProduct } from "@vuqiro/types";
import { MockAction } from "../../../components/MockAction";

export default function StoreProductsPage() {
  const versionById = new Map(mockPackageVersions.map((version) => [version.id, version]));

  return (
    <>
      <AdminPageHeader
        kicker="Monetization"
        title="Store products"
        copy="Apple App Store and Google Play product mappings per price version. 'Missing' means the product still has to be created in the store console."
        actions={<MockAction label="Add mapping" variant="primary" />}
      />
      <AdminTable<StoreProduct>
        columns={[
          {
            key: "product",
            header: "Store product ID",
            render: (product) => <strong>{product.storeProductId}</strong>
          },
          { key: "platform", header: "Platform", render: (product) => <AdminStatusBadge status={product.platform} tone="primary" /> },
          {
            key: "version",
            header: "Price version",
            render: (product) => versionById.get(product.packageVersionId)?.displayName ?? product.packageVersionId
          },
          { key: "offering", header: "RC offering", render: (product) => product.revenueCatOfferingId ?? "—" },
          { key: "entitlement", header: "RC entitlement", render: (product) => product.revenueCatEntitlementId ?? "—" },
          { key: "status", header: "Status", render: (product) => <AdminStatusBadge status={product.status} /> },
          {
            key: "actions",
            header: "Actions",
            render: (product) => (
              <div className="actions-cell">
                {product.status === "missing" ? <MockAction label="Mark configured" variant="success" /> : <MockAction label="Re-sync" />}
                <MockAction label="Edit" />
              </div>
            )
          }
        ]}
        rows={mockStoreProducts}
      />
    </>
  );
}
