import { Hono } from "hono";
import { z } from "zod";
import { mockFraudSignals } from "@vuqiro/mock-data";
import { writeAuditLog } from "../lib/audit";
import { badRequest, notFound } from "../lib/errors";
import { getServiceDb, isBackendConfigured } from "../lib/supabase";
import type { AppEnv } from "../middleware/auth";
import { requireAdmin } from "../middleware/auth";

export const adminFraudRoutes = new Hono<AppEnv>();

adminFraudRoutes.use("*", requireAdmin());

adminFraudRoutes.get("/fraud-signals", async (c) => {
  if (!isBackendConfigured()) {
    return c.json({ signals: mockFraudSignals, source: "mock" });
  }
  const db = getServiceDb()!;
  const { data, error } = await db
    .from("fraud_signals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw badRequest(error.message);
  return c.json({ signals: data ?? [], source: "db" });
});

const resolveBody = z.object({
  resolution: z.enum(["dismissed", "actioned", "reviewing"])
});

adminFraudRoutes.post("/fraud-signals/:id/resolve", requireAdmin("platform_superadmin", "admin", "moderator"), async (c) => {
  const admin = c.get("admin")!;
  const id = z.string().min(1).parse(c.req.param("id"));
  const body = resolveBody.parse(await c.req.json());

  if (!isBackendConfigured()) {
    const signal = mockFraudSignals.find((candidate) => candidate.id === id);
    if (!signal) throw notFound("Signal not found");
    await writeAuditLog(admin, {
      action: "settings_change",
      targetType: "fraud_signal",
      targetId: id,
      summary: `Fraud signal marked ${body.resolution} (mock mode)`
    });
    return c.json({ signalId: id, status: body.resolution, source: "mock" });
  }

  const db = getServiceDb()!;
  const { error } = await db.from("fraud_signals").update({ status: body.resolution }).eq("id", id);
  if (error) throw badRequest(error.message);

  await writeAuditLog(admin, {
    action: "settings_change",
    targetType: "fraud_signal",
    targetId: id,
    summary: `Fraud signal marked ${body.resolution}`
  });

  return c.json({ signalId: id, status: body.resolution, source: "db" });
});
