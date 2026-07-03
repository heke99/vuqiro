import { AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { ErrorBanner, guardPage } from "../../../components/PageGuard";
import { adminApiFetch } from "../../../lib/adminApi";
import { fieldStr, type Row } from "../../../lib/rows";

export default async function PackagesPage() {
  const { denied } = await guardPage("/monetization/packages");
  if (denied) return denied;
  const result = await adminApiFetch<{ packages: Row[]; versions: Row[] }>("/admin/monetization/packages");

  const versionCount = new Map<string, number>();
  if (result.ok) {
    for (const version of result.data.versions) {
      const packageId = fieldStr(version, "package_id", "packageId");
      versionCount.set(packageId, (versionCount.get(packageId) ?? 0) + 1);
    }
  }

  return (
    <>
      <AdminPageHeader
        kicker="Monetization"
        title="Packages"
        copy="The catalog of purchasable things: creator subscription tiers, coin packs, boosts and platform premium. New price versions are created from the Price versions page."
      />
      {!result.ok ? <ErrorBanner message={result.error} /> : null}
      {result.ok && result.data.packages.length > 0 ? (
        <AdminTable<Row>
          columns={[
            {
              key: "pkg",
              header: "Package",
              render: (pkg) => (
                <>
                  <strong>{fieldStr(pkg, "name")}</strong>
                  <br />
                  {fieldStr(pkg, "code")}
                </>
              )
            },
            { key: "type", header: "Type", render: (pkg) => <AdminStatusBadge status={fieldStr(pkg, "type")} /> },
            { key: "status", header: "Status", render: (pkg) => <AdminStatusBadge status={fieldStr(pkg, "status")} /> },
            { key: "versions", header: "Versions", render: (pkg) => versionCount.get(fieldStr(pkg, "id")) ?? 0 }
          ]}
          rows={result.data.packages}
        />
      ) : (
        <div className="empty-state">No packages.</div>
      )}
    </>
  );
}
