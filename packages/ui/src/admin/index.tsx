import React from "react";

/**
 * Vuqiro admin design-system components (web only).
 * Styled via the admin app's global stylesheet class names, themed with the
 * shared Vuqiro tokens. Import from "@vuqiro/ui/admin".
 */

export function AdminPageHeader({
  kicker,
  title,
  copy,
  actions
}: {
  kicker: string;
  title: string;
  copy?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="header">
      <div>
        <div className="kicker">{kicker}</div>
        <h1>{title}</h1>
        {copy ? <p className="copy">{copy}</p> : null}
      </div>
      {actions ? <div className="header-actions">{actions}</div> : null}
    </div>
  );
}

export function AdminCard({
  title,
  children,
  className
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`card ${className ?? ""}`}>
      {title ? <div className="card-title">{title}</div> : null}
      {children}
    </div>
  );
}

export function AdminMetricCard({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="card">
      <div className="metric">{label}</div>
      <div className="metric-value">{value}</div>
      {hint ? <div className="metric-hint">{hint}</div> : null}
    </div>
  );
}

const toneByStatus: Record<string, "primary" | "secondary" | "warning" | "danger" | "success"> = {
  // generic
  active: "success",
  published: "success",
  live: "success",
  done: "success",
  paid: "success",
  verified: "success",
  visible: "success",
  ready: "success",
  approved: "success",
  synced: "success",
  configured: "secondary",
  enabled: "success",
  resolved: "secondary",
  in_progress: "secondary",
  processing: "secondary",
  payable: "secondary",
  reviewing: "warning",
  open: "warning",
  pending: "warning",
  pending_store_config: "warning",
  ready_to_publish: "secondary",
  under_review: "warning",
  limited: "warning",
  grace_period: "warning",
  held: "warning",
  todo: "warning",
  draft: "primary",
  onboarding_started: "primary",
  age_restricted: "warning",
  appealed: "warning",
  suspended: "warning",
  restricted: "warning",
  deletion_requested: "warning",
  blocked_external: "warning",
  missing: "danger",
  failed: "danger",
  error: "danger",
  removed: "danger",
  blocked: "danger",
  banned: "danger",
  refunded: "danger",
  reversed: "danger",
  disputed: "danger",
  cancelled: "danger",
  retired: "danger",
  disabled: "danger",
  not_onboarded: "primary",
  archived: "primary"
};

export function AdminStatusBadge({ status, tone }: { status: string; tone?: "primary" | "secondary" | "warning" | "danger" | "success" }) {
  const resolved = tone ?? toneByStatus[status] ?? "primary";
  return <span className={`badge ${resolved}`}>{status.replaceAll("_", " ")}</span>;
}

export type AdminColumn<Row> = {
  key: string;
  header: string;
  render: (row: Row) => React.ReactNode;
};

export function AdminTable<Row extends { id?: string }>({
  columns,
  rows,
  emptyLabel = "No records"
}: {
  columns: AdminColumn<Row>[];
  rows: Row[];
  emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return <div className="empty-state">{emptyLabel}</div>;
  }
  return (
    <div className="card table-card">
      <table className="table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id ?? index}>
              {columns.map((column) => (
                <td key={column.key}>{column.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminSectionHeader({ title, copy }: { title: string; copy?: string }) {
  return (
    <div className="section-header">
      <h2>{title}</h2>
      {copy ? <p className="copy">{copy}</p> : null}
    </div>
  );
}

export function AdminEmptyState({ title, copy }: { title: string; copy?: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      {copy ? <p>{copy}</p> : null}
    </div>
  );
}
