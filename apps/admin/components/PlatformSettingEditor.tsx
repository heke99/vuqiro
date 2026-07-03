"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

/** JSON editor card for one platform setting. */
export function PlatformSettingEditor({
  settingKey,
  value,
  description,
  readOnly
}: {
  settingKey: string;
  value: Record<string, unknown>;
  description: string;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState(JSON.stringify(value, null, 2));
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const save = async () => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text) as Record<string, unknown>;
    } catch {
      setFlash("Invalid JSON");
      return;
    }
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
      }
      const response = await fetch(`${apiBaseUrl}/admin/platform-settings/${settingKey}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ value: parsed })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setFlash(`Failed: ${payload.error ?? response.status}`);
      } else {
        setFlash("Saved (audit-logged).");
        router.refresh();
      }
    } catch (error) {
      setFlash(`Failed: ${error instanceof Error ? error.message : "network error"}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="card-title">{settingKey}</div>
      <div className="metric-hint" style={{ marginBottom: 10 }}>
        {description}
      </div>
      <textarea
        className="input"
        style={{ fontFamily: "ui-monospace, monospace", minHeight: 130 }}
        value={text}
        onChange={(event) => setText(event.target.value)}
        readOnly={readOnly}
      />
      {!readOnly ? (
        <div className="row" style={{ marginTop: 10 }}>
          <button className="button small" onClick={save} disabled={busy}>
            {busy ? "…" : "Save"}
          </button>
          {flash ? <span className="metric-hint">{flash}</span> : null}
        </div>
      ) : (
        <div className="metric-hint" style={{ marginTop: 10 }}>
          Read-only for your role.
        </div>
      )}
    </div>
  );
}
