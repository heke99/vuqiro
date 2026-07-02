import { AdminMetricCard, AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { mockFraudSignals } from "@vuqiro/mock-data";
import type { FraudSignal } from "@vuqiro/types";
import { MockAction } from "../../components/MockAction";

export default function FraudSafetyPage() {
  const open = mockFraudSignals.filter((signal) => signal.status === "open" || signal.status === "reviewing");

  return (
    <>
      <AdminPageHeader
        kicker="Safety"
        title="Fraud & safety"
        copy="Automated signals for spam, fake engagement, payment fraud and payout risk. High-severity signals can trigger payout holds."
      />
      <div className="grid" style={{ marginBottom: 24 }}>
        <AdminMetricCard label="Open signals" value={open.length} />
        <AdminMetricCard label="High severity" value={mockFraudSignals.filter((signal) => signal.severity === "high").length} />
        <AdminMetricCard label="Actioned (30d)" value={mockFraudSignals.filter((signal) => signal.status === "actioned").length} />
        <AdminMetricCard label="Dismissed (30d)" value={mockFraudSignals.filter((signal) => signal.status === "dismissed").length} />
      </div>
      <AdminTable<FraudSignal>
        columns={[
          { key: "id", header: "Signal", render: (signal) => <strong>{signal.id}</strong> },
          { key: "type", header: "Type", render: (signal) => <AdminStatusBadge status={signal.type} tone="primary" /> },
          {
            key: "severity",
            header: "Severity",
            render: (signal) => (
              <AdminStatusBadge status={signal.severity} tone={signal.severity === "high" ? "danger" : signal.severity === "medium" ? "warning" : "secondary"} />
            )
          },
          { key: "target", header: "Target", render: (signal) => `${signal.targetType}: ${signal.targetId}` },
          { key: "summary", header: "Summary", render: (signal) => signal.summary },
          { key: "status", header: "Status", render: (signal) => <AdminStatusBadge status={signal.status} /> },
          {
            key: "actions",
            header: "Actions",
            render: (signal) =>
              signal.status === "open" || signal.status === "reviewing" ? (
                <div className="actions-cell">
                  <MockAction label="Open case" />
                  <MockAction label="Hold payout" variant="danger" />
                  <MockAction label="Dismiss" />
                </div>
              ) : (
                "—"
              )
          }
        ]}
        rows={mockFraudSignals}
      />
    </>
  );
}
