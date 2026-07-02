"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

export function AdminSignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
    );
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.refresh();
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <form onSubmit={submit} className="card" style={{ width: 380, display: "grid", gap: 12 }}>
        <div className="logo" style={{ marginBottom: 0 }}>
          <div className="logo-mark">V</div>
          <div>
            <div className="logo-title">Vuqiro Admin</div>
            <div className="logo-sub">Diversa Solutions LLC</div>
          </div>
        </div>
        <p className="copy">Sign in with an admin account. Access requires an active admin_users record.</p>
        <input
          className="input"
          type="email"
          placeholder="admin@vuqiro.app"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <input
          className="input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {error ? <p style={{ color: "var(--danger)", fontWeight: 700, margin: 0 }}>{error}</p> : null}
        <button className="button" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
