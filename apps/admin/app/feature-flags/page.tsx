import { AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { AdminApiAction } from "../../components/AdminApiAction";
import { ErrorBanner, guardPage } from "../../components/PageGuard";
import { adminApiFetch } from "../../lib/adminApi";
import { field, fieldStr, type Row } from "../../lib/rows";

export default async function FeatureFlagsPage() {
  const { identity, denied } = await guardPage("/feature-flags");
  if (denied) return denied;
  const canToggle = ["platform_superadmin", "admin"].includes(identity.admin.role);
  const result = await adminApiFetch<{ flags: Row[] }>("/admin/feature-flags");

  return (
    <>
      <AdminPageHeader
        kicker="Platform"
        title="Feature flags"
        copy="Runtime toggles scoped per environment. Changes are audit-logged."
      />
      {!result.ok ? <ErrorBanner message={result.error} /> : null}
      {result.ok && result.data.flags.length === 0 ? <div className="empty-state">No feature flags.</div> : null}
      {result.ok && result.data.flags.length > 0 ? (
        <AdminTable<Row>
          columns={[
            {
              key: "flag",
              header: "Flag",
              render: (flag) => (
                <>
                  <strong>{fieldStr(flag, "key")}</strong>
                  <br />
                  {fieldStr(flag, "description")}
                </>
              )
            },
            {
              key: "enabled",
              header: "State",
              render: (flag) => <AdminStatusBadge status={field<boolean>(flag, "enabled") ? "enabled" : "disabled"} />
            },
            { key: "environment", header: "Environment", render: (flag) => fieldStr(flag, "environment") },
            {
              key: "actions",
              header: "Actions",
              render: (flag) => {
                if (!canToggle) return <span className="metric-hint">Read-only</span>;
                const key = fieldStr(flag, "key");
                const enabled = field<boolean>(flag, "enabled") ?? false;
                return (
                  <AdminApiAction
                    label={enabled ? "Disable" : "Enable"}
                    path={`/admin/feature-flags/${key}`}
                    method="PATCH"
                    body={{ enabled: !enabled }}
                    variant={enabled ? "danger" : "success"}
                  />
                );
              }
            }
          ]}
          rows={result.data.flags}
        />
      ) : null}
    </>
  );
}
