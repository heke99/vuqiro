import { AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { AdminApiAction } from "../../components/AdminApiAction";
import { ErrorBanner, guardPage } from "../../components/PageGuard";
import { adminApiFetch } from "../../lib/adminApi";
import { field, fieldDate, fieldStr, type Row } from "../../lib/rows";

export default async function CreatorsPage() {
  const { identity, denied } = await guardPage("/creators");
  if (denied) return denied;
  const canEnforce = ["platform_superadmin", "admin", "moderator"].includes(identity.admin.role);
  const result = await adminApiFetch<{ creators: Row[] }>("/admin/creators");

  return (
    <>
      <AdminPageHeader
        kicker="Community"
        title="Creators"
        copy="Creator accounts with verification, monetization and payout context."
      />
      {!result.ok ? <ErrorBanner message={result.error} /> : null}
      {result.ok && result.data.creators.length === 0 ? <div className="empty-state">No creators yet.</div> : null}
      {result.ok && result.data.creators.length > 0 ? (
        <AdminTable<Row>
          columns={[
            {
              key: "creator",
              header: "Creator",
              render: (creator) => {
                const profile = (creator.profiles ?? {}) as Row;
                return (
                  <>
                    <strong>{fieldStr(profile, "display_name") || fieldStr(creator, "displayName")}</strong>
                    <br />@{fieldStr(profile, "handle") || fieldStr(creator, "handle")}
                  </>
                );
              }
            },
            {
              key: "verification",
              header: "Verification",
              render: (creator) => <AdminStatusBadge status={fieldStr(creator, "verification_status", "verificationStatus") || "unverified"} />
            },
            {
              key: "monetization",
              header: "Monetization",
              render: (creator) =>
                field<boolean>(creator, "monetization_enabled", "monetizationEnabled") ? (
                  <AdminStatusBadge status="active" />
                ) : (
                  <AdminStatusBadge status="disabled" />
                )
            },
            { key: "category", header: "Category", render: (creator) => fieldStr(creator, "category") || "—" },
            { key: "created", header: "Created", render: (creator) => fieldDate(creator, "created_at", "createdAt") },
            {
              key: "actions",
              header: "Actions",
              render: (creator) => {
                if (!canEnforce) return <span className="metric-hint">Read-only</span>;
                const id = fieldStr(creator, "id");
                const verification = fieldStr(creator, "verification_status", "verificationStatus");
                const monetized = field<boolean>(creator, "monetization_enabled", "monetizationEnabled");
                return (
                  <div className="actions-cell">
                    {verification !== "verified" ? (
                      <AdminApiAction label="Verify" path={`/admin/creators/${id}/verify`} variant="success" />
                    ) : null}
                    {verification === "pending" ? (
                      <AdminApiAction label="Reject" path={`/admin/creators/${id}/reject`} variant="danger" />
                    ) : null}
                    {monetized ? (
                      <AdminApiAction label="Disable monetization" path={`/admin/creators/${id}/disable-monetization`} variant="danger" />
                    ) : (
                      <AdminApiAction label="Enable monetization" path={`/admin/creators/${id}/enable-monetization`} variant="success" />
                    )}
                  </div>
                );
              }
            }
          ]}
          rows={result.data.creators}
        />
      ) : null}
    </>
  );
}
