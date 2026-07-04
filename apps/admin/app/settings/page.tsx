import { AdminPageHeader } from "@vuqiro/ui/admin";
import { PlatformSettingEditor } from "../../components/PlatformSettingEditor";
import { ErrorBanner, guardPage } from "../../components/PageGuard";
import { adminApiFetch } from "../../lib/adminApi";
import type { Row } from "../../lib/rows";

export default async function SettingsPage() {
  const { identity, denied } = await guardPage("/settings");
  if (denied) return denied;
  const canEdit = ["platform_superadmin", "admin"].includes(identity.admin.role);
  const result = await adminApiFetch<{ settings: Row[] }>("/admin/platform-settings");

  return (
    <>
      <AdminPageHeader
        kicker="Platform"
        title="Platform settings"
        copy="Feed weights, ad frequency, upload limits and moderation thresholds. Values are JSON documents; changes take effect within 30 seconds (settings cache) and are audit-logged."
      />
      {!result.ok ? <ErrorBanner message={result.error} /> : null}
      {result.ok ? (
        <div className="stack">
          {result.data.settings.map((setting) => (
            <PlatformSettingEditor
              key={String(setting.key)}
              settingKey={String(setting.key)}
              value={(setting.value ?? {}) as Record<string, unknown>}
              description={String(setting.description ?? "")}
              readOnly={!canEdit}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}
