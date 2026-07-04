import { AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { AdminApiAction } from "../../../components/AdminApiAction";
import { AdminForm } from "../../../components/AdminForm";
import { ErrorBanner, guardPage } from "../../../components/PageGuard";
import { adminApiFetch } from "../../../lib/adminApi";
import { fieldDate, fieldStr, type Row } from "../../../lib/rows";

export default async function CreativesPage() {
  const { identity, denied } = await guardPage("/ads/creatives");
  if (denied) return denied;
  const canManage = ["platform_superadmin", "admin"].includes(identity.admin.role);

  const [creatives, groups, campaigns] = await Promise.all([
    adminApiFetch<{ creatives: Row[] }>("/admin/ads/creatives"),
    adminApiFetch<{ groups: Row[] }>("/admin/ads/groups"),
    adminApiFetch<{ campaigns: Row[] }>("/admin/ads/campaigns")
  ]);

  return (
    <>
      <AdminPageHeader
        kicker="Ads"
        title="Ad groups & creatives"
        copy="Creatives must be approved before they can serve. Rejected creatives pause automatically."
      />
      <div className="section-header">
        <h2>Ad groups (placement + targeting)</h2>
      </div>
      {canManage && campaigns.ok && campaigns.data.campaigns.length > 0 ? (
        <AdminForm
          title="+ New ad group"
          path="/admin/ads/groups"
          transform={(values) => ({
            ...values,
            placements: [String(values.placements ?? "feed")],
            targeting: {}
          })}
          fields={[
            {
              name: "campaignId",
              label: "Campaign",
              type: "select",
              options: campaigns.data.campaigns.map((campaign) => ({
                value: fieldStr(campaign, "id"),
                label: fieldStr(campaign, "name")
              }))
            },
            { name: "name", label: "Ad group name", required: true },
            {
              name: "placements",
              label: "Placement",
              type: "select",
              options: ["feed", "discover", "profile", "inbox", "post_roll"].map((value) => ({ value, label: value }))
            },
            { name: "frequencyCapPerDay", label: "Frequency cap / viewer / day", type: "number", defaultValue: "4" }
          ]}
        />
      ) : null}
      {groups.ok && groups.data.groups.length > 0 ? (
        <AdminTable<Row>
          columns={[
            { key: "name", header: "Ad group", render: (group) => <strong>{fieldStr(group, "name")}</strong> },
            { key: "status", header: "Status", render: (group) => <AdminStatusBadge status={fieldStr(group, "status")} /> },
            {
              key: "placements",
              header: "Placements",
              render: (group) => ((group.placements as string[]) ?? []).join(", ")
            },
            {
              key: "cap",
              header: "Frequency cap/day",
              render: (group) => fieldStr(group, "frequency_cap_per_day", "frequencyCapPerDay")
            }
          ]}
          rows={groups.data.groups}
        />
      ) : (
        <div className="empty-state">No ad groups yet.</div>
      )}

      <div className="section-header">
        <h2>Creatives</h2>
      </div>
      {canManage && groups.ok && groups.data.groups.length > 0 && campaigns.ok ? (
        <AdminForm
          title="+ New creative"
          path="/admin/ads/creatives"
          fields={[
            {
              name: "adGroupId",
              label: "Ad group",
              type: "select",
              options: groups.data.groups.map((group) => ({
                value: fieldStr(group, "id"),
                label: fieldStr(group, "name")
              }))
            },
            {
              name: "campaignId",
              label: "Campaign",
              type: "select",
              options: campaigns.data.campaigns.map((campaign) => ({
                value: fieldStr(campaign, "id"),
                label: fieldStr(campaign, "name")
              }))
            },
            {
              name: "type",
              label: "Type",
              type: "select",
              options: ["card", "image", "video"].map((value) => ({ value, label: value }))
            },
            { name: "title", label: "Title", required: true },
            { name: "body", label: "Body", type: "textarea" },
            { name: "ctaLabel", label: "CTA label", defaultValue: "Learn more" },
            { name: "ctaUrl", label: "CTA URL", required: true, placeholder: "https://…" },
            { name: "mediaUrl", label: "Media URL (video/image)" },
            { name: "thumbnailUrl", label: "Thumbnail URL" }
          ]}
        />
      ) : null}
      {!creatives.ok ? <ErrorBanner message={creatives.error} /> : null}
      {creatives.ok && creatives.data.creatives.length > 0 ? (
        <AdminTable<Row>
          columns={[
            {
              key: "creative",
              header: "Creative",
              render: (creative) => (
                <>
                  <strong>{fieldStr(creative, "title")}</strong>
                  <br />
                  {fieldStr(creative, "cta_label", "ctaLabel")} → {fieldStr(creative, "cta_url", "ctaUrl").slice(0, 50)}
                </>
              )
            },
            { key: "type", header: "Type", render: (creative) => fieldStr(creative, "type") },
            {
              key: "review",
              header: "Review",
              render: (creative) => <AdminStatusBadge status={fieldStr(creative, "review_status", "reviewStatus")} />
            },
            { key: "status", header: "Status", render: (creative) => <AdminStatusBadge status={fieldStr(creative, "status")} /> },
            { key: "created", header: "Created", render: (creative) => fieldDate(creative, "created_at", "createdAt") },
            {
              key: "actions",
              header: "Actions",
              render: (creative) => {
                if (!canManage) return <span className="metric-hint">Read-only</span>;
                const id = fieldStr(creative, "id");
                const review = fieldStr(creative, "review_status", "reviewStatus");
                return (
                  <div className="actions-cell">
                    {review !== "approved" ? (
                      <AdminApiAction label="Approve" path={`/admin/ads/creatives/${id}/approve`} variant="success" />
                    ) : null}
                    {review !== "rejected" ? (
                      <AdminApiAction label="Reject" path={`/admin/ads/creatives/${id}/reject`} variant="danger" />
                    ) : null}
                  </div>
                );
              }
            }
          ]}
          rows={creatives.data.creatives}
        />
      ) : (
        <div className="empty-state">No creatives yet.</div>
      )}
    </>
  );
}
