"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

/**
 * Admin action button that calls the Vuqiro API (NEXT_PUBLIC_API_URL,
 * defaulting to the local dev API) with the admin's Supabase session token.
 * Server-side the action is RBAC-checked and audit-logged. Failures —
 * including an unreachable API — surface as error flashes; there is no
 * client-side mock success path.
 */
export function AdminApiAction({
  label,
  path,
  method = "POST",
  body,
  variant = "ghost"
}: {
  label: string;
  path: string;
  method?: "POST" | "DELETE" | "PATCH" | "PUT";
  body?: Record<string, unknown>;
  variant?: "ghost" | "primary" | "danger" | "success";
}) {
  const router = useRouter();
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!flash) return;
    const timeout = setTimeout(() => setFlash(null), 2600);
    return () => clearTimeout(timeout);
  }, [flash]);

  const run = async () => {
    setBusy(true);
    try {
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        );
        const { data } = await supabase.auth.getSession();
        if (data.session) headers.authorization = `Bearer ${data.session.access_token}`;
      } else {
        headers.authorization = "Bearer mock-admin";
        headers["x-mock-admin"] = "1";
      }
      const response = await fetch(`${apiBaseUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; summary?: string };
      if (!response.ok) {
        setFlash(`Failed: ${payload.error ?? response.status}`);
      } else {
        setFlash(payload.summary ?? `${label}: done (audit-logged)`);
        router.refresh();
      }
    } catch (error) {
      setFlash(`Failed: ${error instanceof Error ? error.message : "network error"}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        className={`button small ${variant === "primary" ? "" : variant}`}
        onClick={run}
        disabled={busy}
      >
        {busy ? "…" : label}
      </button>
      {flash ? <div className="flash">{flash}</div> : null}
    </>
  );
}
