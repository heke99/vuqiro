import type { Metadata } from "next";
import { mockAdminIdentity } from "@vuqiro/mock-data";
import { AdminNav } from "../components/AdminNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vuqiro Admin",
  description: "Superadmin console for Vuqiro by Diversa Solutions LLC"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
            <div className="topbar">
              <div className="topbar-identity">
                <div className="topbar-avatar">S</div>
                <div>
                  <div className="topbar-name">Logged in as: {mockAdminIdentity.displayName}</div>
                  <div className="topbar-role">Role: {mockAdminIdentity.role}</div>
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
