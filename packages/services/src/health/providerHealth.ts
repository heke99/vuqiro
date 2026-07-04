/**
 * Shared provider health reporting. Every provider adapter can describe its
 * own status; the API aggregates these into /health and the admin console's
 * integration-health page.
 */

export type ProviderHealthStatus = "ok" | "degraded" | "down" | "unconfigured" | "mock";

export interface ProviderHealth {
  provider: string;
  status: ProviderHealthStatus;
  message?: string;
}
