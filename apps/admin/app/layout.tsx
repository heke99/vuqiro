import type { Metadata } from "next";
import { AdminNav } from "../components/AdminNav";
import { AdminSignIn } from "../components/AdminSignIn";
import { getAdminIdentity } from "../lib/adminAuth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vuqiro Admin",
  description: "Superadmin console for Vuqiro by Diversa Solutions LLC"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const identity = await getAdminIdentity();

  if (!identity) {
    return (
      <html lang="en">
        <body>
          <AdminSignIn />
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body>
        <div className="shell">
          <aside className="sidebar">
            <div className="logo">
              <div className="logo-mark">V</div>
              <div>
                <div className="logo-title">Vuqiro</div>
                <div className="logo-sub">Diversa Solutions LLC</div>
              </div>
            </div>
            <AdminNav />
          </aside>
          <main>
            {identity.mode === "mock" ? (
              <div className="mode-banner">
                Mock mode — Supabase env not configured. Sign-in and RBAC activate automatically when
                NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are set.
              </div>
            ) : null}
            <div className="topbar">
              <div className="topbar-identity">
                <div className="topbar-avatar">{identity.admin.displayName.slice(0, 1).toUpperCase()}</div>
                <div>
                  <div className="topbar-name">Logged in as: {identity.admin.displayName}</div>
                  <div className="topbar-role">Role: {identity.admin.role}</div>
                </div>
              </div>
              <div className="topbar-meta">
                App: Vuqiro
                <br />
                Company: Diversa Solutions LLC
              </div>
            </div>
            <div className="content">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
