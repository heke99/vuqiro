import { AdminCard, AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { mockStoreProducts } from "@vuqiro/mock-data";
import type { StoreProduct } from "@vuqiro/types";
import { MockAction } from "../../../components/MockAction";

const offerings = [
  { id: "creator_memberships", label: "Creator memberships", products: 6, entitlements: ["creator_support", "creator_plus", "creator_premium"] },
  { id: "coins", label: "Coin packs", products: 8, entitlements: [] },
  { id: "boosts", label: "Boost packs", products: 3, entitlements: [] }
];

export default function RevenueCatPage() {
  return (
    <>
      <AdminPageHeader
        kicker="Monetization"
        title="RevenueCat"
        copy="Offering and entitlement mapping plus webhook state. API keys are provided via environment variables; webhook events are verified and processed idempotently by the API service."
      />
      <div className="grid-3" style={{ marginBottom: 24 }}>
        <AdminCard title="SDK configuration">
          <p className="copy">
            iOS key: <AdminStatusBadge status="missing" /> <br />
            Android key: <AdminStatusBadge status="missing" /> <br />
            Set REVENUECAT_IOS_API_KEY / REVENUECAT_ANDROID_API_KEY. The mobile app falls back to the
            mock payments adapter until keys exist.
          </p>
        </AdminCard>
        <AdminCard title="Webhook">
          <p className="copy">
            Endpoint: POST /revenuecat/webhook <br />
            Secret: <AdminStatusBadge status="missing" /> <br />
            Signature verification and idempotent event processing land with the payments batch.
          </p>
        </AdminCard>
        <AdminCard title="Entitlement sync">
          <p className="copy">
            Server-side entitlements are the source of truth for locked content. Client entitlement
            state is never trusted for access control.
          </p>
        </AdminCard>
      </div>

      <div className="section-header">
        <h2>Offerings</h2>
      </div>
      <div className="grid-3">
        {offerings.map((offering) => (
          <AdminCard key={offering.id} title={offering.label}>
            <p className="copy">
              ID: {offering.id}
              <br />
              Products: {offering.products}
              <br />
              Entitlements: {offering.entitlements.length > 0 ? offering.entitlements.join(", ") : "consumable only"}
            </p>
            <MockAction label="Sync offering" />
          </AdminCard>
        ))}
      </div>

      <div className="section-header">
        <h2>Product mapping state</h2>
      </div>
      <AdminTable<StoreProduct>
        columns={[
          { key: "product", header: "Store product", render: (product) => <strong>{product.storeProductId}</strong> },
          { key: "platform", header: "Platform", render: (product) => <AdminStatusBadge status={product.platform} tone="primary" /> },
          { key: "offering", header: "Offering", render: (product) => product.revenueCatOfferingId ?? "—" },
          { key: "entitlement", header: "Entitlement", render: (product) => product.revenueCatEntitlementId ?? "—" },
          { key: "status", header: "Status", render: (product) => <AdminStatusBadge status={product.status} /> }
        ]}
        rows={mockStoreProducts.filter((product) => product.revenueCatOfferingId)}
      />
    </>
  );
}
