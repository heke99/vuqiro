import React from "react";
import { AdminPageHeader } from "@vuqiro/ui/admin";
import type { AdminIdentity } from "../lib/adminAuth";
import { getAdminIdentity } from "../lib/adminAuth";
import { canAccessPath } from "../lib/rbac";

export function AccessDenied({ role, path }: { role: string; path: string }) {
  return (
    <>
      <AdminPageHeader
        kicker="Access denied"
        title="Your role cannot open this page"
        copy={`The ${role} role does not include access to ${path}. Ask a platform superadmin to change your role if you need it.`}
      />
    </>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return <div className="error-banner">{message}</div>;
}

/** Resolve the identity and check page access in one call. */
export async function guardPage(
  path: string
): Promise<{ identity: AdminIdentity; denied: React.ReactElement | null }> {
  const identity = await getAdminIdentity();
  if (!identity || identity.mode === "blocked") {
    // The layout already gates these cases; render nothing extra.
    return {
      identity: identity ?? ({ mode: "blocked", admin: { role: "support" } } as AdminIdentity),
      denied: <ErrorBanner message="Not signed in." />
    };
  }
  if (!canAccessPath(identity.admin.role, path)) {
    return { identity, denied: <AccessDenied role={identity.admin.role} path={path} /> };
  }
  return { identity, denied: null };
}
