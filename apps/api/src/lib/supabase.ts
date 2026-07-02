import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadEnv } from "@vuqiro/config";

const env = loadEnv();

let serviceClient: SupabaseClient | null = null;
let anonClient: SupabaseClient | null = null;

/** Service-role client. Server-side only; bypasses RLS. Null in mock mode. */
export function getServiceDb(): SupabaseClient | null {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) return null;
  if (!serviceClient) {
    serviceClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
  return serviceClient;
}

/** Anon client used only to verify user JWTs. Null in mock mode. */
export function getAnonDb(): SupabaseClient | null {
  if (!env.supabaseUrl || !env.supabaseAnonKey) return null;
  if (!anonClient) {
    anonClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
  return anonClient;
}

export function isBackendConfigured(): boolean {
  return getServiceDb() !== null;
}
