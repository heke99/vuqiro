import { checkProductionSafety, loadEnv } from "@vuqiro/config";
import { getPayoutsProvider, getPushProvider, getVideoProvider, type ProviderHealth } from "@vuqiro/services";
import { getServiceDb, isBackendConfigured } from "./supabase";

export interface HealthReport {
  ok: boolean;
  service: string;
  appEnv: string;
  version: string;
  time: string;
  database: ProviderHealth;
  video: ProviderHealth;
  payments: ProviderHealth;
  payouts: ProviderHealth;
  push: ProviderHealth;
  warnings: string[];
}

async function checkDatabase(): Promise<ProviderHealth> {
  if (!isBackendConfigured()) {
    return { provider: "database", status: "mock", message: "Supabase not configured — mock data mode" };
  }
  try {
    const db = getServiceDb()!;
    const { error } = await db.from("profiles").select("id", { count: "exact", head: true }).limit(1);
    if (error) {
      return { provider: "database", status: "down", message: error.message.slice(0, 200) };
    }
    return { provider: "database", status: "ok", message: "Supabase reachable" };
  } catch (error) {
    return {
      provider: "database",
      status: "down",
      message: error instanceof Error ? error.message.slice(0, 200) : "Supabase unreachable"
    };
  }
}

function checkPayments(): ProviderHealth {
  const env = loadEnv();
  if (env.revenueCatWebhookSecret) {
    return { provider: "payments", status: "ok", message: "RevenueCat webhook secret configured" };
  }
  return {
    provider: "payments",
    status: "mock",
    message: "RevenueCat not configured — purchases run in mock mode"
  };
}

/** Aggregated health for /health and the admin integration-health page. Never exposes secrets. */
export async function getHealthReport(options: { deep?: boolean } = {}): Promise<HealthReport> {
  const env = loadEnv();
  const videoProvider = getVideoProvider();
  const payoutsProvider = getPayoutsProvider();
  const pushProvider = getPushProvider();

  // Shallow mode reports configuration state without external calls (fast,
  // suitable for load-balancer probes). Deep mode pings each provider.
  const [database, video, payouts, push] = await Promise.all([
    checkDatabase(),
    options.deep || videoProvider.name === "mock"
      ? videoProvider.healthCheck()
      : Promise.resolve<ProviderHealth>({ provider: "video", status: "ok", message: `${videoProvider.name} configured` }),
    options.deep || payoutsProvider.name === "mock"
      ? payoutsProvider.healthCheck()
      : Promise.resolve<ProviderHealth>({
          provider: "payouts",
          status: "ok",
          message: `${payoutsProvider.name} configured`
        }),
    options.deep || pushProvider.name === "mock"
      ? pushProvider.healthCheck()
      : Promise.resolve<ProviderHealth>({ provider: "push", status: "ok", message: `${pushProvider.name} configured` })
  ]);
  const payments = checkPayments();

  const safety = checkProductionSafety(env);
  const statuses = [database, video, payments, payouts, push];
  const ok =
    safety.fatal.length === 0 && statuses.every((entry) => entry.status === "ok" || entry.status === "mock");

  return {
    ok,
    service: "vuqiro-api",
    appEnv: env.appEnv,
    version: env.appVersion,
    time: new Date().toISOString(),
    database,
    video,
    payments,
    payouts,
    push,
    warnings: [...safety.fatal, ...safety.warnings]
  };
}
