import { AdminMetricCard, AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { ErrorBanner, guardPage } from "../../../components/PageGuard";
import { adminApiFetch } from "../../../lib/adminApi";
import { fieldDate, fieldNum, fieldStr, usd, type Row } from "../../../lib/rows";

export default async function RevenuePage() {
  const { denied } = await guardPage("/monetization/revenue");
  if (denied) return denied;

  const [creatorLedger, platformLedger] = await Promise.all([
    adminApiFetch<{ entries: Row[] }>("/admin/revenue/creator-ledger"),
    adminApiFetch<{ entries: Row[] }>("/admin/revenue/platform-ledger")
  ]);

  const platformTotal = platformLedger.ok
    ? platformLedger.data.entries.reduce((sum, entry) => sum + fieldNum(entry, "amount_cents", "amountCents"), 0)
    : 0;
  const bySource = new Map<string, number>();
  if (platformLedger.ok) {
    for (const entry of platformLedger.data.entries) {
      const source = fieldStr(entry, "source");
      bySource.set(source, (bySource.get(source) ?? 0) + fieldNum(entry, "amount_cents", "amountCents"));
    }
  }

  return (
    <>
      <AdminPageHeader
        kicker="Monetization"
        title="Revenue ledgers"
        copy="Platform revenue (coins, subscriptions, ads, sponsorships) and creator earnings. Both ledgers are append-only."
      />
      <div className="grid">
        <AdminMetricCard label="Platform revenue (window)" value={usd(platformTotal)} />
        {[...bySource.entries()].slice(0, 3).map(([source, cents]) => (
          <AdminMetricCard key={source} label={source} value={usd(cents)} />
        ))}
      </div>
      <div className="row" style={{ marginBottom: 14 }}>
        <a className="button small" href="/api/export/platform-revenue" download>
          Export platform ledger (CSV)
        </a>
        <a className="button small" href="/api/export/creator-revenue" download>
          Export creator ledger (CSV)
        </a>
      </div>

      <div className="section-header">
        <h2>Platform revenue ledger</h2>
      </div>
      {!platformLedger.ok ? <ErrorBanner message={platformLedger.error} /> : null}
      {platformLedger.ok && platformLedger.data.entries.length > 0 ? (
        <AdminTable<Row>
          columns={[
            { key: "source", header: "Source", render: (entry) => <strong>{fieldStr(entry, "source")}</strong> },
            { key: "amount", header: "Amount", render: (entry) => usd(fieldNum(entry, "amount_cents", "amountCents")) },
            { key: "description", header: "Description", render: (entry) => fieldStr(entry, "description").slice(0, 90) },
            { key: "when", header: "Occurred", render: (entry) => fieldDate(entry, "occurred_at", "occurredAt") }
          ]}
          rows={platformLedger.data.entries}
        />
      ) : (
        <div className="empty-state">No platform revenue entries.</div>
      )}

      <div className="section-header">
        <h2>Creator revenue ledger</h2>
      </div>
      {!creatorLedger.ok ? <ErrorBanner message={creatorLedger.error} /> : null}
      {creatorLedger.ok && creatorLedger.data.entries.length > 0 ? (
        <AdminTable<Row>
          columns={[
            {
              key: "creator",
              header: "Creator",
              render: (entry) => {
                const creators = (entry.creators ?? {}) as Row;
                const profile = (creators.profiles ?? {}) as Row;
                return <strong>@{fieldStr(profile, "handle") || fieldStr(entry, "creatorId", "creator_id")}</strong>;
              }
            },
            { key: "type", header: "Type", render: (entry) => fieldStr(entry, "entry_type", "entryType", "type") },
            {
              key: "net",
              header: "Net",
              render: (entry) => usd(fieldNum(entry, "net_amount_cents", "netAmountCents", "netCents"))
            },
            { key: "status", header: "Status", render: (entry) => <AdminStatusBadge status={fieldStr(entry, "status")} /> },
            { key: "when", header: "When", render: (entry) => fieldDate(entry, "created_at", "createdAt") }
          ]}
          rows={creatorLedger.data.entries}
        />
      ) : (
        <div className="empty-state">No creator ledger entries.</div>
      )}
    </>
  );
}
