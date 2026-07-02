import { AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { mockNotifications } from "@vuqiro/mock-data";
import type { AppNotification } from "@vuqiro/types";
import { MockAction } from "../../components/MockAction";

export default function NotificationsPage() {
  return (
    <>
      <AdminPageHeader
        kicker="Platform"
        title="Notifications"
        copy="System and product notifications. Broadcast notices go through review; payout information is never sent to non-owners."
        actions={<MockAction label="New system notice" variant="primary" />}
      />
      <AdminTable<AppNotification>
        columns={[
          { key: "id", header: "Notification", render: (item) => <strong>{item.id}</strong> },
          { key: "type", header: "Type", render: (item) => <AdminStatusBadge status={item.type} tone="primary" /> },
          { key: "title", header: "Title", render: (item) => item.title },
          { key: "body", header: "Body", render: (item) => item.body },
          { key: "read", header: "Read", render: (item) => (item.isRead ? "yes" : "no") },
          { key: "created", header: "Created", render: (item) => new Date(item.createdAt).toLocaleString() }
        ]}
        rows={mockNotifications}
      />
    </>
  );
}
