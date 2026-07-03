import { mockAdminIdentity } from "@vuqiro/mock-data";
import type { AdminUser } from "@vuqiro/types";
import { createSupabaseServerClient, isSupabaseConfigured } from "./supabaseServer";

export type AdminIdentity = {
  mode: "mock" | "real" | "blocked";
  admin: AdminUser;
};

/**
 * Mock mode is only permitted outside production builds, and only when it is
 * explicitly enabled. A production deployment without Supabase credentials
 * renders a hard configuration error instead of silently impersonating a
 * mock superadmin.
 */
function isMockModeAllowed(): boolean {
  // ADMIN_ALLOW_MOCK is read at runtime (NEXT_PUBLIC_ vars are inlined at
  // build time, which would make the override unusable on a prebuilt image).
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ADMIN_ALLOW_MOCK !== "true" &&
    process.env.NEXT_PUBLIC_ADMIN_ALLOW_MOCK !== "true"
  ) {
    return false;
  }
  return true;
}

/**
 * Resolves the current admin identity.
 *
 * - Real mode (Supabase env configured): requires a signed-in Supabase user
 *   with an active row in admin_users. Returns null otherwise — the layout
 *   renders the sign-in gate.
 * - Mock mode (no env, non-production): returns the mock superadmin so the
 *   console remains fully explorable during development.
 * - Blocked (no env, production): the layout renders a configuration error.
 */
export async function getAdminIdentity(): Promise<AdminIdentity | null> {
  if (!isSupabaseConfigured()) {
    if (!isMockModeAllowed()) {
      return { mode: "blocked", admin: mockAdminIdentity };
    }
    return { mode: "mock", admin: mockAdminIdentity };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("admin_users")
    .select("id, email, display_name, role, is_active, created_at")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!data) return null;

  return {
    mode: "real",
    admin: {
      id: data.id,
      email: data.email,
      displayName: data.display_name,
      role: data.role,
      isActive: data.is_active,
      createdAt: data.created_at
    }
  };
}
