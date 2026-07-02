import type { Context, Next } from "hono";
import { forbidden, unauthorized } from "../lib/errors";
import { getAnonDb, getServiceDb, isBackendConfigured } from "../lib/supabase";

export type ApiProfile = {
  id: string;
  authUserId: string;
  handle: string;
  role: string;
  status: string;
  isCreator: boolean;
};

export type ApiAdmin = {
  id: string;
  role: "platform_superadmin" | "admin" | "moderator" | "finance" | "support";
  email: string;
};

export type AppEnv = {
  Variables: {
    profile?: ApiProfile;
    admin?: ApiAdmin;
  };
};

const mockProfile: ApiProfile = {
  id: "user_me",
  authUserId: "mock-auth-user",
  handle: "vuqiro_user",
  role: "user",
  status: "active",
  isCreator: false
};

const mockAdmin: ApiAdmin = {
  id: "admin_001",
  role: "platform_superadmin",
  email: "superadmin@vuqiro.app"
};

async function resolveProfile(c: Context): Promise<ApiProfile | null> {
  const header = c.req.header("authorization");
  if (!isBackendConfigured()) {
    // Mock mode: any bearer token (or the x-mock-user header) signs you in
    // as the demo user so the API is fully exercisable without credentials.
    if (header?.startsWith("Bearer ") || c.req.header("x-mock-user")) {
      return { ...mockProfile, id: c.req.header("x-mock-user") ?? mockProfile.id };
    }
    return null;
  }

  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length);

  const anon = getAnonDb();
  const service = getServiceDb();
  if (!anon || !service) return null;

  const {
    data: { user },
    error
  } = await anon.auth.getUser(token);
  if (error || !user) return null;

  const { data } = await service
    .from("profiles")
    .select("id, auth_user_id, handle, role, status, is_creator")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!data) return null;

  return {
    id: data.id,
    authUserId: data.auth_user_id,
    handle: data.handle,
    role: data.role,
    status: data.status,
    isCreator: data.is_creator
  };
}

/** Attach the caller's profile when a valid token is present (never throws). */
export async function attachUser(c: Context, next: Next) {
  const profile = await resolveProfile(c);
  if (profile) c.set("profile", profile);
  await next();
}

/** Require an authenticated, active (not banned/suspended) user. */
export async function requireUser(c: Context, next: Next) {
  const profile = c.get("profile") as ApiProfile | undefined;
  if (!profile) throw unauthorized();
  if (profile.status !== "active") {
    throw forbidden(`Account is ${profile.status}`);
  }
  await next();
}

/** Require an active admin. Superadmin-only routes pass roles. */
export function requireAdmin(...allowedRoles: ApiAdmin["role"][]) {
  return async (c: Context, next: Next) => {
    if (!isBackendConfigured()) {
      // Mock mode: the console runs as the mock superadmin.
      if (c.req.header("authorization") || c.req.header("x-mock-admin")) {
        c.set("admin", mockAdmin);
        await next();
        return;
      }
      throw unauthorized("Admin authentication required");
    }

    const header = c.req.header("authorization");
    if (!header?.startsWith("Bearer ")) throw unauthorized("Admin authentication required");
    const token = header.slice("Bearer ".length);

    const anon = getAnonDb();
    const service = getServiceDb();
    if (!anon || !service) throw unauthorized("Admin authentication required");

    const {
      data: { user },
      error
    } = await anon.auth.getUser(token);
    if (error || !user) throw unauthorized("Admin authentication required");

    const { data } = await service
      .from("admin_users")
      .select("id, role, email, is_active")
      .eq("auth_user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();
    if (!data) throw forbidden("Admin access required");
    if (allowedRoles.length > 0 && !allowedRoles.includes(data.role)) {
      throw forbidden(`Requires role: ${allowedRoles.join(" or ")}`);
    }

    c.set("admin", { id: data.id, role: data.role, email: data.email });
    await next();
  };
}
