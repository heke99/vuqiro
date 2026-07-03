import { AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { AdminApiAction } from "../../components/AdminApiAction";
import { ErrorBanner, guardPage } from "../../components/PageGuard";
import { adminApiFetch } from "../../lib/adminApi";
import { fieldDate, fieldStr, type Row } from "../../lib/rows";

export default async function CopyrightClaimsPage() {
  const { identity, denied } = await guardPage("/copyright-claims");
  if (denied) return denied;
  const canDecide = ["platform_superadmin", "admin", "moderator"].includes(identity.admin.role);
  const result = await adminApiFetch<{ claims: Row[] }>("/admin/copyright-claims");

  return (
    <>
      <AdminPageHeader
        kicker="Safety"
        title="Copyright claims"
        copy="DMCA-style takedown requests. Accepting a claim removes the video; the uploader can appeal."
      />
      {!result.ok ? <ErrorBanner message={result.error} /> : null}
      {result.ok && result.data.claims.length === 0 ? <div className="empty-state">No copyright claims.</div> : null}
      {result.ok && result.data.claims.length > 0 ? (
        <AdminTable<Row>
          columns={[
            {
              key: "claimant",
              header: "Claimant",
              render: (claim) => (
                <>
                  <strong>{fieldStr(claim, "claimant_name", "claimantName")}</strong>
                  <br />
                  {fieldStr(claim, "claimant_email", "claimantEmail")}
                  {fieldStr(claim, "claimant_organization", "claimantOrganization") ? (
                    <>
                      <br />
                      {fieldStr(claim, "claimant_organization", "claimantOrganization")}
                    </>
                  ) : null}
                </>
              )
            },
            {
              key: "video",
              header: "Target video",
              render: (claim) => fieldStr(claim, "target_video_id", "targetVideoId")
            },
            { key: "description", header: "Description", render: (claim) => fieldStr(claim, "description").slice(0, 110) },
            { key: "status", header: "Status", render: (claim) => <AdminStatusBadge status={fieldStr(claim, "status")} /> },
            { key: "when", header: "When", render: (claim) => fieldDate(claim, "created_at", "createdAt") },
            {
              key: "actions",
              header: "Decision",
              render: (claim) => {
                if (!canDecide) return <span className="metric-hint">Read-only</span>;
                const id = fieldStr(claim, "id");
                const status = fieldStr(claim, "status");
                if (["accepted", "rejected", "withdrawn"].includes(status)) {
                  return <span className="metric-hint">Decided</span>;
                }
                return (
                  <div className="actions-cell">
                    <AdminApiAction
                      label="Accept (takedown)"
                      path={`/admin/copyright-claims/${id}/decide`}
                      body={{ decision: "accepted" }}
                      variant="danger"
                    />
                    <AdminApiAction
                      label="Reject"
                      path={`/admin/copyright-claims/${id}/decide`}
                      body={{ decision: "rejected" }}
                    />
                  </div>
                );
              }
            }
          ]}
          rows={result.data.claims}
        />
      ) : null}
    </>
  );
}
