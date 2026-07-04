import { AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { AdminForm } from "../../../components/AdminForm";
import { ErrorBanner, guardPage } from "../../../components/PageGuard";
import { adminApiFetch } from "../../../lib/adminApi";
import { fieldNum, fieldStr, type Row } from "../../../lib/rows";

export default async function PriceVersionsPage() {
  const { identity, denied } = await guardPage("/monetization/price-versions");
  if (denied) return denied;
  const canCreate = ["platform_superadmin", "admin", "finance"].includes(identity.admin.role);
  const result = await adminApiFetch<{ packages: Row[]; versions: Row[] }>("/admin/monetization/packages");

  return (
    <>
      <AdminPageHeader
        kicker="Monetization"
        title="Price versions"
        copy="Every price change creates a new version. Store prices are shown to buyers by Apple/Google; these versions define the mapping, coin amounts and revenue splits."
      />
      {canCreate && result.ok && result.data.packages.length > 0 ? (
        <AdminForm
          title="+ New price version"
          path="/admin/monetization/package-versions"
          fields={[
            {
              name: "packageId",
              label: "Package",
              type: "select",
              options: result.data.packages.map((pkg) => ({
                value: fieldStr(pkg, "id"),
                label: fieldStr(pkg, "name")
              }))
            },
            { name: "displayName", label: "Display name", required: true },
            { name: "description", label: "Description" },
            { name: "priceAmount", label: "Price (USD)", type: "number", required: true },
            {
              name: "billingPeriod",
              label: "Billing period",
              type: "select",
              options: ["one_time", "monthly", "yearly"].map((value) => ({ value, label: value }))
            },
            { name: "coinsAmount", label: "Coins (for coin packs)", type: "number" },
            { name: "bonusCoinsAmount", label: "Bonus coins", type: "number" },
            { name: "platformFeePercent", label: "Platform fee %", type: "number", defaultValue: "20" },
            { name: "creatorSharePercent", label: "Creator share %", type: "number", defaultValue: "80" }
          ]}
        />
      ) : null}
      {!result.ok ? <ErrorBanner message={result.error} /> : null}
      {result.ok && result.data.versions.length > 0 ? (
        <AdminTable<Row>
          columns={[
            {
              key: "version",
              header: "Version",
              render: (version) => (
                <>
                  <strong>{fieldStr(version, "display_name", "displayName")}</strong> v
                  {fieldStr(version, "version_number", "version")}
                </>
              )
            },
            {
              key: "price",
              header: "Reference price",
              render: (version) =>
                `$${fieldNum(version, "price_amount", "priceAmount").toFixed(2)} ${fieldStr(version, "currency") || "USD"} / ${fieldStr(version, "billing_period", "billingPeriod").replaceAll("_", " ")}`
            },
            {
              key: "coins",
              header: "Coins",
              render: (version) => {
                const coins = fieldNum(version, "coins_amount", "coinsAmount");
                const bonus = fieldNum(version, "bonus_coins_amount", "bonusCoinsAmount");
                return coins ? `${coins.toLocaleString()}${bonus ? ` +${bonus}` : ""}` : "—";
              }
            },
            {
              key: "split",
              header: "Split (platform/creator)",
              render: (version) =>
                `${fieldNum(version, "platform_fee_percent", "platformFeePercent")}% / ${fieldNum(version, "creator_share_percent", "creatorSharePercent")}%`
            },
            { key: "status", header: "Status", render: (version) => <AdminStatusBadge status={fieldStr(version, "status")} /> }
          ]}
          rows={result.data.versions}
        />
      ) : (
        <div className="empty-state">No price versions.</div>
      )}
    </>
  );
}
