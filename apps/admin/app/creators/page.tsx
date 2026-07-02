import { AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { mockCreators, mockPayoutAccounts, mockPayoutHolds } from "@vuqiro/mock-data";
import type { Creator } from "@vuqiro/types";
import { MockAction } from "../../components/MockAction";

export default function CreatorsPage() {
  const accountByCreator = new Map(mockPayoutAccounts.map((account) => [account.creatorId, account]));
  const heldCreators = new Set(mockPayoutHolds.filter((hold) => !hold.releasedAt).map((hold) => hold.creatorId));

  return (
    <>
      <AdminPageHeader
        kicker="Community"
        title="Creators"
        copy="Creator accounts with verification, revenue and payout state. Verification and payout actions are audit-logged."
      />
      <AdminTable<Creator>
        columns={[
          {
            key: "creator",
            header: "Creator",
            render: (creator) => (
              <>
                <strong>{creator.displayName}</strong>
                <br />@{creator.handle} · {creator.id}
              </>
            )
          },
          {
            key: "verification",
            header: "Verification",
            render: (creator) => <AdminStatusBadge status={creator.verificationStatus ?? "unverified"} />
          },
          {
            key: "audience",
            header: "Audience",
            render: (creator) => (
              <>
                {creator.subscriberCount.toLocaleString()} subs
                <br />
                {creator.followerCount.toLocaleString()} followers
              </>
            )
          },
          { key: "videos", header: "Videos", render: (creator) => creator.totalVideos ?? 0 },
          {
            key: "revenue",
            header: "Revenue (coins / subs)",
            render: (creator) =>
              `$${(creator.coinRevenue ?? 0).toLocaleString()} / $${(creator.subscriptionRevenue ?? 0).toLocaleString()}`
          },
          {
            key: "payout",
            header: "Payout / Stripe",
            render: (creator) => {
              const account = accountByCreator.get(creator.id);
              return (
                <>
                  <AdminStatusBadge status={heldCreators.has(creator.id) ? "held" : account?.payoutsEnabled ? "payable" : "pending"} />
                  <br />
                  <AdminStatusBadge status={account?.status ?? "not_onboarded"} />
                </>
              );
            }
          },
          {
            key: "warnings",
            header: "Warnings",
            render: (creator) =>
              creator.moderationWarnings ? <AdminStatusBadge status={`${creator.moderationWarnings} warnings`} tone="warning" /> : "—"
          },
          {
            key: "actions",
            header: "Actions",
            render: (creator) => (
              <div className="actions-cell">
                {creator.isVerified ? (
                  <MockAction label="Unverify" variant="danger" />
                ) : (
                  <MockAction label="Verify" variant="success" />
                )}
                {heldCreators.has(creator.id) ? (
                  <MockAction label="Release payouts" variant="success" />
                ) : (
                  <MockAction label="Hold payouts" variant="danger" />
                )}
                <MockAction
                  label={creator.monetizationEnabled ? "Disable monetization" : "Enable monetization"}
                  variant={creator.monetizationEnabled ? "danger" : "success"}
                />
                <MockAction label="View content" />
                <MockAction label="View ledger" />
              </div>
            )
          }
        ]}
        rows={mockCreators}
      />
    </>
  );
}
