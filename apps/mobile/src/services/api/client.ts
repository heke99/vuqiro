import { supabase } from "../supabase/client";

const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL ?? null;

export function isApiConfigured(): boolean {
  return apiBaseUrl !== null;
}

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

/**
 * Calls the Vuqiro API with the current Supabase access token.
 * Throws ApiClientError on non-2xx responses. Callers must check
 * `isApiConfigured()` (or catch) and fall back to mock behaviour.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!apiBaseUrl) {
    throw new ApiClientError(0, "API not configured (set EXPO_PUBLIC_API_URL)");
  }
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      headers.set("authorization", `Bearer ${data.session.access_token}`);
    }
  }
  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // keep default message
    }
    throw new ApiClientError(response.status, message);
  }
  return (await response.json()) as T;
}
