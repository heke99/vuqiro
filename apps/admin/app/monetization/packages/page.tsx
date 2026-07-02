import { AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { mockPackages, mockPackageVersions } from "@vuqiro/mock-data";
import type { MonetizationPackage } from "@vuqiro/types";
import { MockAction } from "../../../components/MockAction";

export default function PackagesPage() {
  const versionCount = new Map<string, number>();
  for (const version of mockPackageVersions) {
    versionCount.set(version.packageId, (versionCount.get(version.packageId) ?? 0) + 1);
  }

  return (
    <>
      <AdminPageHeader
        kicker="Monetization"
        title="Packages"
        copy="The catalog of purchasable things: creator subscription tiers, coin packs, boosts and platform premium. Publishing and retiring is audit-logged."
        actions={<MockAction label="New package" variant="primary" />}
      />
      <AdminTable<MonetizationPackage>
        columns={[
          {
            key: "pkg",
            header: "Package",
            render: (pkg) => (
              <>
                <strong>{pkg.name}</strong>
                <br />
                {pkg.code} · {pkg.id}
              </>
            )
          },
          { key: "type", header: "Type", render: (pkg) => <AdminStatusBadge status={pkg.type} tone="primary" /> },
          { key: "status", header: "Status", render: (pkg) => <AdminStatusBadge status={pkg.status} /> },
          { key: "versions", header: "Versions", render: (pkg) => versionCount.get(pkg.id) ?? 0 },
          {
            key: "actions",
            header: "Actions",
            render: (pkg) => (
              <div className="actions-cell">
                <MockAction label="New version" />
                {pkg.status === "published" ? (
                  <MockAction label="Retire" variant="danger" />
                ) : (
                  <MockAction label="Publish" variant="success" />
                )}
              </div>
            )
          }
        ]}
        rows={mockPackages}
      />
    </>
  );
}
