import { AdminCard, AdminPageHeader, AdminStatusBadge } from "@vuqiro/ui/admin";
import { MockAction } from "../../components/MockAction";

export default function SettingsPage() {
  return (
    <>
      <AdminPageHeader
        kicker="Platform"
        title="App settings"
        copy="Global platform configuration. Changes are audit-logged and take effect via feature flags and API config."
      />
      <div className="grid-3">
        <AdminCard title="Identity">
          <p className="copy">
            App: Vuqiro
            <br />
            Company: Diversa Solutions LLC
            <br />
            iOS bundle: com.diversasolutions.vuqiro
            <br />
            Android package: com.diversasolutions.vuqiro
            <br />
            Support: support@vuqiro.app
          </p>
        </AdminCard>
        <AdminCard title="Upload limits">
          <p className="copy">
            Max duration: 180 seconds
            <br />
            Max file size: 500 MB
            <br />
            Formats: mp4, mov, webm
            <br />
            Rate limit: 10 uploads / hour / creator
          </p>
          <MockAction label="Edit limits" />
        </AdminCard>
        <AdminCard title="Safety defaults">
          <p className="copy">
            New-creator cold start: controlled exposure
            <br />
            Report threshold for auto-limit: 5 distinct reports
            <br />
            Minor-safety reports: always escalate
          </p>
          <MockAction label="Edit safety rules" />
        </AdminCard>
        <AdminCard title="Providers">
          <p className="copy">
            Video: <AdminStatusBadge status="mock" tone="primary" /> (Mux when credentials exist)
            <br />
            Payments: <AdminStatusBadge status="mock" tone="primary" /> (RevenueCat)
            <br />
            Payouts: <AdminStatusBadge status="mock" tone="primary" /> (Stripe Connect)
            <br />
            All providers activate via environment variables. See .env.example.
          </p>
        </AdminCard>
        <AdminCard title="Fees">
          <p className="copy">
            Platform fee: 20%
            <br />
            Store fee estimate: 15–30% (charged by Apple/Google)
            <br />
            Minimum payout: $25.00
          </p>
          <MockAction label="Edit fees" />
        </AdminCard>
        <AdminCard title="Danger zone">
          <p className="copy">Emergency switches. Every use is audit-logged and requires superadmin role.</p>
          <div className="actions-cell">
            <MockAction label="Pause uploads" variant="danger" />
            <MockAction label="Pause purchases" variant="danger" />
            <MockAction label="Pause payouts" variant="danger" />
          </div>
        </AdminCard>
      </div>
    </>
  );
}
