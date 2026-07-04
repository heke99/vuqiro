import { AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { AdminApiAction } from "../../components/AdminApiAction";
import { AdminForm } from "../../components/AdminForm";
import { ErrorBanner, guardPage } from "../../components/PageGuard";
import { adminApiFetch } from "../../lib/adminApi";
import { fieldDate, fieldStr, type Row } from "../../lib/rows";

export default async function LegalPage() {
  const { identity, denied } = await guardPage("/legal");
  if (denied) return denied;
  const canManage = ["platform_superadmin", "admin"].includes(identity.admin.role);

  const [documents, acceptances] = await Promise.all([
    adminApiFetch<{ documents: Row[] }>("/admin/legal/documents"),
    adminApiFetch<{ acceptances: Row[] }>("/admin/legal/acceptances")
  ]);

  return (
    <>
      <AdminPageHeader
        kicker="Compliance"
        title="Legal documents"
        copy="Versioned legal documents. Publishing a new version archives the previous one — users are asked to re-accept on next launch."
      />
      {canManage ? (
        <AdminForm
          title="+ New document version"
          path="/admin/legal/documents"
          fields={[
            {
              name: "type",
              label: "Document type",
              type: "select",
              options: [
                "terms",
                "privacy",
                "community_guidelines",
                "creator_terms",
                "payout_terms",
                "copyright_takedown",
                "refund_policy"
              ].map((value) => ({ value, label: value }))
            },
            { name: "title", label: "Title", required: true },
            { name: "contentMd", label: "Content (markdown)", type: "textarea", required: true }
          ]}
        />
      ) : null}
      {!documents.ok ? <ErrorBanner message={documents.error} /> : null}
      {documents.ok && documents.data.documents.length > 0 ? (
        <AdminTable<Row>
          columns={[
            {
              key: "document",
              header: "Document",
              render: (doc) => (
                <>
                  <strong>{fieldStr(doc, "title")}</strong>
                  <br />
                  {fieldStr(doc, "type")} · v{fieldStr(doc, "version")}
                </>
              )
            },
            { key: "status", header: "Status", render: (doc) => <AdminStatusBadge status={fieldStr(doc, "status")} /> },
            { key: "published", header: "Published", render: (doc) => fieldDate(doc, "published_at", "publishedAt") },
            {
              key: "actions",
              header: "Actions",
              render: (doc) => {
                if (!canManage) return <span className="metric-hint">Read-only</span>;
                if (fieldStr(doc, "status") !== "draft") return <span className="metric-hint">—</span>;
                return (
                  <AdminApiAction
                    label="Publish (forces re-acceptance)"
                    path={`/admin/legal/documents/${fieldStr(doc, "id")}/publish`}
                    variant="success"
                  />
                );
              }
            }
          ]}
          rows={documents.data.documents}
        />
      ) : (
        <div className="empty-state">No legal documents.</div>
      )}

      <div className="section-header">
        <h2>Recent acceptances</h2>
      </div>
      {acceptances.ok && acceptances.data.acceptances.length > 0 ? (
        <AdminTable<Row>
          columns={[
            {
              key: "who",
              header: "User",
              render: (acceptance) => {
                const profile = (acceptance.profiles ?? {}) as Row;
                return <strong>@{fieldStr(profile, "handle") || fieldStr(acceptance, "profileId", "profile_id")}</strong>;
              }
            },
            {
              key: "document",
              header: "Document",
              render: (acceptance) => {
                const doc = (acceptance.legal_documents ?? {}) as Row;
                return `${fieldStr(doc, "type") || fieldStr(acceptance, "documentId", "document_id")} v${fieldStr(doc, "version") || "?"}`;
              }
            },
            { key: "when", header: "Accepted", render: (acceptance) => fieldDate(acceptance, "accepted_at", "acceptedAt") }
          ]}
          rows={acceptances.data.acceptances.slice(0, 30)}
        />
      ) : (
        <div className="empty-state">No acceptances recorded.</div>
      )}
    </>
  );
}
