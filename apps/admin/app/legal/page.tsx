import { AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { mockLegalAcceptances, mockLegalDocuments } from "@vuqiro/mock-data";
import type { LegalAcceptance, LegalDocument } from "@vuqiro/types";
import { MockAction } from "../../components/MockAction";

export default function LegalPage() {
  return (
    <>
      <AdminPageHeader
        kicker="Platform"
        title="Legal documents"
        copy="Versioned legal documents and user acceptances. Publishing a new version prompts users to re-accept where required. Outlines are not final legal advice; attorney review is required before launch."
        actions={<MockAction label="New document version" variant="primary" />}
      />
      <AdminTable<LegalDocument>
        columns={[
          {
            key: "doc",
            header: "Document",
            render: (doc) => (
              <>
                <strong>{doc.title}</strong> v{doc.version}
                <br />
                {doc.id}
              </>
            )
          },
          { key: "type", header: "Type", render: (doc) => <AdminStatusBadge status={doc.type} tone="primary" /> },
          { key: "status", header: "Status", render: (doc) => <AdminStatusBadge status={doc.status} /> },
          {
            key: "published",
            header: "Published",
            render: (doc) => (doc.publishedAt ? new Date(doc.publishedAt).toLocaleDateString() : "—")
          },
          {
            key: "actions",
            header: "Actions",
            render: (doc) => (
              <div className="actions-cell">
                {doc.status === "draft" ? <MockAction label="Publish" variant="success" /> : <MockAction label="New version" />}
                <MockAction label="Preview" />
              </div>
            )
          }
        ]}
        rows={mockLegalDocuments}
      />

      <div className="section-header">
        <h2>Recent acceptances</h2>
      </div>
      <AdminTable<LegalAcceptance>
        columns={[
          { key: "id", header: "Acceptance", render: (item) => <strong>{item.id}</strong> },
          { key: "user", header: "User", render: (item) => item.userId },
          { key: "doc", header: "Document", render: (item) => `${item.documentType} v${item.documentVersion}` },
          { key: "at", header: "Accepted", render: (item) => new Date(item.acceptedAt).toLocaleString() }
        ]}
        rows={mockLegalAcceptances}
      />
    </>
  );
}
