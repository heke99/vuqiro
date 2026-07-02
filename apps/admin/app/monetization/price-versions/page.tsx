import { AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { mockPackageVersions } from "@vuqiro/mock-data";
import type { MonetizationPackageVersion } from "@vuqiro/types";
import { MockAction } from "../../../components/MockAction";

export default function PriceVersionsPage() {
  return (
    <>
      <AdminPageHeader
        kicker="Monetization"
        title="Price versions"
        copy="Every price change creates a new version. Store prices are shown to buyers by Apple/Google; these versions define the mapping, coin amounts and revenue splits."
        actions={<MockAction label="New price version" variant="primary" />}
      />
      <AdminTable<MonetizationPackageVersion>
        columns={[
          {
            key: "version",
            header: "Version",
            render: (version) => (
              <>
                <strong>{version.displayName}</strong> v{version.version}
                <br />
                {version.id}
              </>
            )
          },
          {
            key: "price",
            header: "Reference price",
            render: (version) => `$${version.priceAmount.toFixed(2)} ${version.currency} / ${version.billingPeriod.replaceAll("_", " ")}`
          },
          {
            key: "coins",
            header: "Coins",
            render: (version) =>
              version.coinsAmount
                ? `${version.coinsAmount.toLocaleString()}${version.bonusCoinsAmount ? ` +${version.bonusCoinsAmount}` : ""}`
                : "—"
          },
          {
            key: "split",
            header: "Split (platform / creator)",
            render: (version) => `${version.platformFeePercent}% / ${version.creatorSharePercent}%`
          },
          { key: "status", header: "Status", render: (version) => <AdminStatusBadge status={version.status} /> },
          {
            key: "actions",
            header: "Actions",
            render: () => (
              <div className="actions-cell">
                <MockAction label="View store products" />
                <MockAction label="Supersede" />
              </div>
            )
          }
        ]}
        rows={mockPackageVersions}
      />
    </>
  );
}
