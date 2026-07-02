import { AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { mockFeatureFlags } from "@vuqiro/mock-data";
import type { FeatureFlag } from "@vuqiro/types";
import { MockAction } from "../../components/MockAction";

export default function FeatureFlagsPage() {
  return (
    <>
      <AdminPageHeader
        kicker="Platform"
        title="Feature flags"
        copy="Runtime switches for risky or launch-gated features. Flag changes are audit-logged."
        actions={<MockAction label="New flag" variant="primary" />}
      />
      <AdminTable<FeatureFlag & { id?: string }>
        columns={[
          {
            key: "flag",
            header: "Flag",
            render: (flag) => (
              <>
                <strong>{flag.key}</strong>
                <br />
                {flag.description}
              </>
            )
          },
          {
            key: "state",
            header: "State",
            render: (flag) => <AdminStatusBadge status={flag.enabled ? "enabled" : "disabled"} />
          },
          { key: "env", header: "Environment", render: (flag) => <AdminStatusBadge status={flag.environment} tone="primary" /> },
          { key: "updated", header: "Updated", render: (flag) => new Date(flag.updatedAt).toLocaleDateString() },
          {
            key: "actions",
            header: "Actions",
            render: (flag) => (
              <div className="actions-cell">
                <MockAction label={flag.enabled ? "Disable" : "Enable"} variant={flag.enabled ? "danger" : "success"} />
              </div>
            )
          }
        ]}
        rows={mockFeatureFlags.map((flag) => ({ ...flag, id: flag.key }))}
      />
    </>
  );
}
