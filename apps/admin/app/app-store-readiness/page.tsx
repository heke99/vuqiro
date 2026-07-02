import { AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import { mockReadinessItems } from "@vuqiro/mock-data";
import type { ReadinessItem } from "@vuqiro/types";
import { MockAction } from "../../components/MockAction";

const categories: ReadinessItem["category"][] = ["app_store", "google_play", "payments", "moderation", "legal", "backend"];

export default function AppStoreReadinessPage() {
  const done = mockReadinessItems.filter((item) => item.status === "done").length;

  return (
    <>
      <AdminPageHeader
        kicker="Platform"
        title="App store readiness"
        copy={`Submission checklist across Apple, Google, payments, moderation, legal and backend. ${done}/${mockReadinessItems.length} complete. Items marked blocked-external require owner accounts or credentials.`}
      />
      {categories.map((category) => {
        const items = mockReadinessItems.filter((item) => item.category === category);
        if (items.length === 0) return null;
        return (
          <div key={category}>
            <div className="section-header">
              <h2>{category.replaceAll("_", " ")}</h2>
            </div>
            <AdminTable<ReadinessItem>
              columns={[
                { key: "label", header: "Item", render: (item) => <strong>{item.label}</strong> },
                { key: "status", header: "Status", render: (item) => <AdminStatusBadge status={item.status} /> },
                { key: "note", header: "Note", render: (item) => item.note ?? "—" },
                {
                  key: "actions",
                  header: "Actions",
                  render: (item) =>
                    item.status === "done" ? "—" : (
                      <div className="actions-cell">
                        <MockAction label="Mark done" variant="success" />
                      </div>
                    )
                }
              ]}
              rows={items}
            />
          </div>
        );
      })}
    </>
  );
}
