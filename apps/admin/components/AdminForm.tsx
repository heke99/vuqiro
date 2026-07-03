"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

export type AdminFormField = {
  name: string;
  label: string;
  type?: "text" | "number" | "select" | "textarea" | "datetime-local" | "checkbox";
  options?: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
};

/**
 * Config-driven admin form that submits JSON to the Vuqiro API with the
 * admin's session token. Used for create flows (advertisers, campaigns,
 * sponsorships, broadcasts, settings, invitations…).
 */
export function AdminForm({
  title,
  path,
  method = "POST",
  fields,
  submitLabel = "Create",
  transform
}: {
  title: string;
  path: string;
  method?: "POST" | "PUT" | "PATCH";
  fields: AdminFormField[];
  submitLabel?: string;
  transform?: (values: Record<string, unknown>) => Record<string, unknown>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setFlash(null);
    const formData = new FormData(event.currentTarget);
    const values: Record<string, unknown> = {};
    for (const field of fields) {
      if (field.type === "checkbox") {
        values[field.name] = formData.get(field.name) === "on";
        continue;
      }
      const raw = formData.get(field.name);
      if (raw === null || raw === "") continue;
      if (field.type === "number") values[field.name] = Number(raw);
      else if (field.type === "datetime-local") values[field.name] = new Date(String(raw)).toISOString();
      else values[field.name] = String(raw);
    }

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
        body: JSON.stringify(transform ? transform(values) : values)
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setFlash(`Failed: ${payload.error ?? response.status}`);
      } else {
        setFlash("Saved.");
        setOpen(false);
        router.refresh();
      }
    } catch (error) {
      setFlash(`Failed: ${error instanceof Error ? error.message : "network error"}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-form-wrap">
      <button className="button small" onClick={() => setOpen(!open)}>
        {open ? "Cancel" : title}
      </button>
      {flash ? <div className="flash">{flash}</div> : null}
      {open ? (
        <form className="admin-form" onSubmit={submit}>
          {fields.map((field) => (
            <label key={field.name} className="admin-form-field">
              <span>{field.label}</span>
              {field.type === "select" ? (
                <select name={field.name} defaultValue={field.defaultValue} required={field.required}>
                  {(field.options ?? []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : field.type === "textarea" ? (
                <textarea
                  name={field.name}
                  placeholder={field.placeholder}
                  required={field.required}
                  defaultValue={field.defaultValue}
                  rows={4}
                />
              ) : field.type === "checkbox" ? (
                <input name={field.name} type="checkbox" defaultChecked={field.defaultValue === "true"} />
              ) : (
                <input
                  name={field.name}
                  type={field.type ?? "text"}
                  placeholder={field.placeholder}
                  required={field.required}
                  defaultValue={field.defaultValue}
                  step={field.type === "number" ? "any" : undefined}
                />
              )}
            </label>
          ))}
          <button className="button small" type="submit" disabled={busy}>
            {busy ? "…" : submitLabel}
          </button>
        </form>
      ) : null}
    </div>
  );
}
