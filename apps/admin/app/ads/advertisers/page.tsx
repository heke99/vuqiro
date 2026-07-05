import { AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { AdminForm } from "../../../components/AdminForm";
import { ErrorBanner, guardPage } from "../../../components/PageGuard";
import { adminApiFetch } from "../../../lib/adminApi";
import { fieldDate, fieldStr, type Row } from "../../../lib/rows";

export default async function AdvertisersPage() {
  const { identity, denied } = await guardPage("/ads/advertisers");
  if (denied) return denied;
  const canManage = ["platform_superadmin", "admin"].includes(identity.admin.role);

  const [advertisers, accounts] = await Promise.all([
    adminApiFetch<{ advertisers: Row[] }>("/admin/ads/advertisers"),
    adminApiFetch<{ accounts: Row[] }>("/admin/ads/accounts")
  ]);

  return (
    <>
      <AdminPageHeader
        kicker="Ads"
        title="Advertisers"
        copy="Companies buying ads or sponsorships. Superadmins create advertisers directly — no self-serve login required."
      />
      {canManage ? (
        <AdminForm
          title="+ New advertiser"
          path="/admin/ads/advertisers"
          fields={[
            { name: "name", label: "Company name", required: true },
            { name: "legalName", label: "Legal name" },
            { name: "contactEmail", label: "Contact email" },
            { name: "contactName", label: "Contact person" },
            { name: "websiteUrl", label: "Website URL", placeholder: "https://…" },
            { name: "country", label: "Country (2-letter)", placeholder: "US" },
            {
              name: "ownerProfileId",
              label: "Owner profile id (optional — enables the self-serve advertiser portal)",
              placeholder: "profile uuid"
            },
            { name: "notes", label: "Notes", type: "textarea" }
          ]}
        />
      ) : null}
      {!advertisers.ok ? <ErrorBanner message={advertisers.error} /> : null}
      {advertisers.ok && advertisers.data.advertisers.length === 0 ? (
        <div className="empty-state">No advertisers yet — create the first one above.</div>
      ) : null}
      {advertisers.ok && advertisers.data.advertisers.length > 0 ? (
        <AdminTable<Row>
          columns={[
            {
              key: "advertiser",
              header: "Advertiser",
              render: (advertiser) => (
                <>
                  <strong>{fieldStr(advertiser, "name")}</strong>
                  <br />
                  {fieldStr(advertiser, "contact_email", "contactEmail")}
                </>
              )
            },
            { key: "status", header: "Status", render: (advertiser) => <AdminStatusBadge status={fieldStr(advertiser, "status")} /> },
            { key: "country", header: "Country", render: (advertiser) => fieldStr(advertiser, "country") || "—" },
            { key: "created", header: "Created", render: (advertiser) => fieldDate(advertiser, "created_at", "createdAt") },
            { key: "notes", header: "Notes", render: (advertiser) => fieldStr(advertiser, "notes").slice(0, 80) || "—" }
          ]}
          rows={advertisers.data.advertisers}
        />
      ) : null}

      <div className="section-header">
        <h2>Ad accounts</h2>
      </div>
      {canManage && advertisers.ok && advertisers.data.advertisers.length > 0 ? (
        <AdminForm
          title="+ New ad account"
          path="/admin/ads/accounts"
          fields={[
            {
              name: "advertiserId",
              label: "Advertiser",
              type: "select",
              options: advertisers.data.advertisers.map((advertiser) => ({
                value: fieldStr(advertiser, "id"),
                label: fieldStr(advertiser, "name")
              }))
            },
            { name: "name", label: "Account name", required: true },
            { name: "currency", label: "Currency", defaultValue: "USD" }
          ]}
        />
      ) : null}
      {accounts.ok && accounts.data.accounts.length > 0 ? (
        <AdminTable<Row>
          columns={[
            { key: "name", header: "Account", render: (account) => <strong>{fieldStr(account, "name")}</strong> },
            { key: "status", header: "Status", render: (account) => <AdminStatusBadge status={fieldStr(account, "status")} /> },
            { key: "currency", header: "Currency", render: (account) => fieldStr(account, "currency") },
            { key: "created", header: "Created", render: (account) => fieldDate(account, "created_at", "createdAt") }
          ]}
          rows={accounts.data.accounts}
        />
      ) : (
        <div className="empty-state">No ad accounts yet.</div>
      )}
    </>
  );
}
