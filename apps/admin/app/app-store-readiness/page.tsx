import { AdminPageHeader, AdminStatusBadge, AdminTable } from "@vuqiro/ui/admin";
import type { ReadinessItem } from "@vuqiro/types";
import { guardPage } from "../../components/PageGuard";

/**
 * Store submission checklist. This is operational documentation (owner
 * accounts, credentials and store consoles live outside this codebase), so
 * items are maintained here in code review rather than in the database.
 * Detailed guides: docs/app-store/, docs/launch/go-live-checklist.md.
 */
const readinessItems: ReadinessItem[] = [
  { id: "ready_001", category: "app_store", label: "App icon and splash uploaded", status: "in_progress" },
  { id: "ready_002", category: "app_store", label: 'Screenshots for 6.7" and 5.5"', status: "todo" },
  { id: "ready_003", category: "app_store", label: "Privacy nutrition labels", status: "todo" },
  { id: "ready_004", category: "app_store", label: "IAP products approved", status: "blocked_external", note: "Requires Apple Developer account" },
  { id: "ready_005", category: "google_play", label: "Data safety form", status: "todo" },
  { id: "ready_006", category: "google_play", label: "UGC policy declaration", status: "todo" },
  { id: "ready_007", category: "payments", label: "RevenueCat offerings configured", status: "blocked_external", note: "Requires RevenueCat project keys" },
  { id: "ready_008", category: "payments", label: "Sandbox purchase test passed", status: "blocked_external", note: "Requires store sandbox accounts" },
  { id: "ready_009", category: "moderation", label: "Moderation staffing plan documented", status: "todo" },
  { id: "ready_010", category: "moderation", label: "Report/appeal flows verified on device", status: "todo" },
  { id: "ready_011", category: "legal", label: "Legal documents reviewed by counsel", status: "blocked_external", note: "Outlines in docs/legal/ need attorney sign-off" },
  { id: "ready_012", category: "legal", label: "Public legal URLs published", status: "todo" },
  { id: "ready_013", category: "backend", label: "Production Supabase project migrated", status: "blocked_external", note: "supabase db push + first superadmin row" },
  { id: "ready_014", category: "backend", label: "Provider credentials configured (Mux, Stripe, Expo push)", status: "blocked_external" }
];

const categories: ReadinessItem["category"][] = ["app_store", "google_play", "payments", "moderation", "legal", "backend"];

export default async function AppStoreReadinessPage() {
  const { denied } = await guardPage("/app-store-readiness");
  if (denied) return denied;

  const done = readinessItems.filter((item) => item.status === "done").length;

  return (
    <>
      <AdminPageHeader
        kicker="Platform"
        title="App store readiness"
        copy={`Submission checklist across Apple, Google, payments, moderation, legal and backend. ${done}/${readinessItems.length} complete. Items marked blocked-external require owner accounts or credentials; the source of truth is docs/launch/go-live-checklist.md.`}
      />
      {categories.map((category) => {
        const items = readinessItems.filter((item) => item.category === category);
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
                { key: "note", header: "Note", render: (item) => item.note ?? "—" }
              ]}
              rows={items}
            />
          </div>
        );
      })}
    </>
  );
}
