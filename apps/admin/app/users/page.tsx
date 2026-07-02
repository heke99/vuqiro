import { AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { mockUsers } from "@vuqiro/mock-data";
import type { User } from "@vuqiro/types";
import { MockAction } from "../../components/MockAction";

export default function UsersPage() {
  return (
    <>
      <AdminPageHeader
        kicker="Community"
        title="Users"
        copy="All Vuqiro accounts with wallet, subscription and safety context. Suspend/ban/restore actions are audit-logged."
      />
      <AdminTable<User>
        columns={[
          {
            key: "user",
            header: "User",
            render: (user) => (
              <>
                <strong>{user.displayName}</strong>
                <br />@{user.handle} · {user.id}
                <br />
                {user.email}
              </>
            )
          },
          { key: "status", header: "Status", render: (user) => <AdminStatusBadge status={user.status} /> },
          { key: "wallet", header: "Wallet", render: (user) => `${user.walletBalance.toLocaleString()} coins` },
          { key: "subs", header: "Subscriptions", render: (user) => user.subscriptionCount },
          {
            key: "reports",
            header: "Reports (made / against)",
            render: (user) => `${user.reportsMade} / ${user.reportsAgainst}`
          },
          { key: "blocked", header: "Blocked", render: (user) => user.blockedCount },
          {
            key: "dates",
            header: "Created / last active",
            render: (user) => (
              <>
                {new Date(user.createdAt).toLocaleDateString()}
                <br />
                {new Date(user.lastActiveAt).toLocaleDateString()}
              </>
            )
          },
          {
            key: "actions",
            header: "Actions",
            render: (user) => (
              <div className="actions-cell">
                <MockAction label="View profile" />
                <MockAction label="View wallet" />
                <MockAction label="View subscriptions" />
                <MockAction label="View audit log" />
                {user.status === "active" ? (
                  <>
                    <MockAction label="Suspend" variant="danger" />
                    <MockAction label="Ban" variant="danger" />
                  </>
                ) : (
                  <MockAction label="Restore" variant="success" />
                )}
              </div>
            )
          }
        ]}
        rows={mockUsers}
      />
    </>
  );
}
