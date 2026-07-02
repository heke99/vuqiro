import { AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { mockAuditLogs } from "@vuqiro/mock-data";
import type { AuditLogEntry } from "@vuqiro/types";

export default function AuditLogPage() {
  return (
    <>
      <AdminPageHeader
        kicker="Platform"
        title="Audit log"
        copy="Immutable record of every superadmin, moderation and payout action. Entries cannot be edited or deleted."
      />
      <AdminTable<AuditLogEntry>
        columns={[
          { key: "id", header: "Entry", render: (entry) => <strong>{entry.id}</strong> },
          { key: "action", header: "Action", render: (entry) => <AdminStatusBadge status={entry.action} tone="primary" /> },
          {
            key: "actor",
            header: "Actor",
            render: (entry) => (
              <>
                {entry.actorId}
                <br />
                {entry.actorRole}
              </>
            )
          },
          { key: "target", header: "Target", render: (entry) => `${entry.targetType}: ${entry.targetId}` },
          { key: "summary", header: "Summary", render: (entry) => entry.summary },
          { key: "created", header: "When", render: (entry) => new Date(entry.createdAt).toLocaleString() }
        ]}
        rows={[...mockAuditLogs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))}
      />
    </>
  );
}
