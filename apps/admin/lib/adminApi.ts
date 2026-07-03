import { createSupabaseServerClient, isSupabaseConfigured } from "./supabaseServer";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

export type AdminApiResult<T> = { ok: true; data: T; source: string } | { ok: false; error: string };

/**
 * Server-side fetch against the Vuqiro API using the signed-in admin's
 * Supabase access token. In credential-free development the API itself
 * serves deterministic mock data (tagged source:"mock"); the console renders
 * the same components either way — there is no separate mock read path in
 * the admin app anymore.
 */
export async function adminApiFetch<T = Record<string, unknown>>(
  path: string,
  init: RequestInit = {}
): Promise<AdminApiResult<T>> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...((init.headers as Record<string, string>) ?? {})
  };

  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { session }
    } = await supabase.auth.getSession();
    if (session) headers.authorization = `Bearer ${session.access_token}`;
  } else {
    headers["x-mock-admin"] = "1";
    headers.authorization = "Bearer mock-admin";
  }

  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers,
      cache: "no-store"
    });
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      return { ok: false, error: String(payload.error ?? `API error ${response.status}`) };
    }
    return { ok: true, data: payload as T, source: String(payload.source ?? "unknown") };
  } catch (error) {
    return {
      ok: false,
      error: `API unreachable at ${apiBaseUrl} — start it with \`pnpm dev:api\`. (${
        error instanceof Error ? error.message : "network error"
      })`
    };
  }
}
