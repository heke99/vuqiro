"use client";

import React, { useEffect, useState } from "react";

/**
 * Mock admin action button: shows a confirmation flash instead of mutating
 * data. Replaced by real API calls in the backend batches. Every real action
 * will be audit-logged server-side.
 */
export function MockAction({
  label,
  variant = "ghost",
  confirmation
}: {
  label: string;
  variant?: "ghost" | "primary" | "danger" | "success";
  confirmation?: string;
}) {
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (!flash) return;
    const timeout = setTimeout(() => setFlash(null), 2200);
    return () => clearTimeout(timeout);
  }, [flash]);

  return (
    <>
      <button
        className={`button small ${variant === "primary" ? "" : variant}`}
        onClick={() => setFlash(confirmation ?? `${label}: recorded (mock). Real action will be audit-logged.`)}
      >
        {label}
      </button>
      {flash ? <div className="flash">{flash}</div> : null}
    </>
  );
}
