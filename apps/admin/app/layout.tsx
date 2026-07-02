import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vuqiro Admin",
  description: "Superadmin foundation for Vuqiro by Diversa Solutions LLC"
};

const nav = [
  ["/", "Overview"],
  ["/users", "Users"],
  ["/creators", "Creators"],
  ["/videos", "Videos"],
  ["/moderation", "Moderation"],
  ["/monetization", "Monetization"],
  ["/payouts", "Payouts"],
  ["/legal", "Legal"],
  ["/audit-log", "Audit log"],
  ["/settings", "Settings"]
];

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
            <nav className="nav">
              {nav.map(([href, label]) => <Link href={href} key={href}>{label}</Link>)}
            </nav>
          </aside>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
