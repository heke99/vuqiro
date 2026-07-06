import { createSupabaseServerClient, isSupabaseConfigured } from "./supabaseServer";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

export type AdvertiserApiResult<T> = { ok: true; data: T; source: string } | { ok: false; error: string };

export type AdvertiserSession = { mode: "real"; email: string } | { mode: "mock" } | null;

/**
 * Resolves the advertiser portal session: any signed-in Supabase user may
 * open the portal — the API scopes everything to advertisers they own.
 * Mock mode (no Supabase env) is allowed outside production only.
 */
export async function getAdvertiserSession(): Promise<AdvertiserSession> {
  if (!isSupabaseConfigured()) {
    if (process.env.NODE_ENV === "production") return null;
    return { mode: "mock" };
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();
  if (!session) return null;
  return { mode: "real", email: session.user.email ?? "" };
}

/** Server-side fetch against the API with the signed-in user's token. */
export async function advertiserApiFetch<T = Record<string, unknown>>(
  path: string,
  init: RequestInit = {}
): Promise<AdvertiserApiResult<T>> {
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
    headers["x-mock-user"] = "1";
    headers.authorization = "Bearer mock-user";
  }

  try {
    const response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers, cache: "no-store" });
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      return { ok: false, error: String(payload.error ?? `API error ${response.status}`) };
    }
    return { ok: true, data: payload as T, source: String(payload.source ?? "unknown") };
  } catch (error) {
    return {
      ok: false,
      error: `API unreachable at ${apiBaseUrl}. (${error instanceof Error ? error.message : "network error"})`
    };
  }
}
