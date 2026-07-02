import { mockAdminIdentity } from "@vuqiro/mock-data";
import type { AdminUser } from "@vuqiro/types";
import { createSupabaseServerClient, isSupabaseConfigured } from "./supabaseServer";

export type AdminIdentity = {
  mode: "mock" | "real";
  admin: AdminUser;
};

/**
 * Resolves the current admin identity.
 *
 * - Real mode (Supabase env configured): requires a signed-in Supabase user
 *   with an active row in admin_users. Returns null otherwise — the layout
 *   renders the sign-in gate.
 * - Mock mode (no env): returns the mock superadmin so the console remains
 *   fully explorable during development.
 */
export async function getAdminIdentity(): Promise<AdminIdentity | null> {
  if (!isSupabaseConfigured()) {
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
