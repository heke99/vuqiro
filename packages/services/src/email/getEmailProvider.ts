import { loadEnv } from "@vuqiro/config";
import type { EmailProvider } from "./emailProvider";
import { MockEmailProvider } from "./mockEmailProvider";
import { ResendEmailProvider } from "./resendEmailProvider";

let cached: EmailProvider | null = null;

/** Resend when EMAIL_PROVIDER=resend + RESEND_API_KEY are set; mock otherwise. */
export function getEmailProvider(): EmailProvider {
  if (cached) return cached;
  const env = loadEnv();
  cached =
    env.emailProvider === "resend" && env.resendApiKey
      ? new ResendEmailProvider({ apiKey: env.resendApiKey, from: env.emailFrom })
      : new MockEmailProvider();
  return cached;
}

export function resetEmailProviderCache(): void {
  cached = null;
}
