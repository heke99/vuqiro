import { getPushProvider, type PushMessage } from "@vuqiro/services";
import { getServiceDb, isBackendConfigured } from "./supabase";

/**
 * Notification job runner foundation. Picks pending notification_jobs,
 * resolves each recipient's active push tokens, delivers through the push
 * provider and records the outcome. Invoked from the admin ops endpoint or
 * an external scheduler (cron) in production.
 */
export async function processNotificationJobs(batchSize = 100): Promise<{ processed: number; sent: number; failed: number }> {
  if (!isBackendConfigured()) {
    return { processed: 0, sent: 0, failed: 0 };
  }
  const db = getServiceDb()!;
  const provider = getPushProvider();

  const { data: jobs } = await db
    .from("notification_jobs")
    .select("id, profile_id, payload, attempts")
    .eq("status", "pending")
    .eq("channel", "push")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at")
    .limit(batchSize);
  if (!jobs || jobs.length === 0) {
    return { processed: 0, sent: 0, failed: 0 };
  }

  const jobIds = jobs.map((job) => job.id);
  await db.from("notification_jobs").update({ status: "processing" }).in("id", jobIds);

  const profileIds = [...new Set(jobs.map((job) => job.profile_id).filter(Boolean))] as string[];
  const { data: tokens } = await db
    .from("push_tokens")
    .select("profile_id, token")
    .in("profile_id", profileIds)
    .eq("is_active", true);
  const tokensByProfile = new Map<string, string[]>();
  for (const row of tokens ?? []) {
    const list = tokensByProfile.get(row.profile_id) ?? [];
    list.push(row.token);
    tokensByProfile.set(row.profile_id, list);
  }

  let sent = 0;
  let failed = 0;
  for (const job of jobs) {
    const payload = job.payload as { title?: string; body?: string; type?: string };
    const recipientTokens = job.profile_id ? (tokensByProfile.get(job.profile_id) ?? []) : [];
    if (recipientTokens.length === 0) {
      // No devices: job completes as sent-nowhere (not an error state).
      await db
        .from("notification_jobs")
        .update({ status: "sent", sent_at: new Date().toISOString(), last_error: "no active push tokens" })
        .eq("id", job.id);
      sent += 1;
      continue;
    }
    const messages: PushMessage[] = recipientTokens.map((token) => ({
      to: token,
      title: payload.title ?? "Vuqiro",
      body: payload.body ?? "",
      data: { type: payload.type }
    }));
    try {
      const receipts = await provider.send(messages);
      const deadTokens = receipts
        .filter((receipt) => receipt.errorCode === "DeviceNotRegistered")
        .map((receipt) => receipt.token);
      if (deadTokens.length > 0) {
        await db.from("push_tokens").update({ is_active: false }).in("token", deadTokens);
      }
      const anyOk = receipts.some((receipt) => receipt.status === "ok");
      await db
        .from("notification_jobs")
        .update({
          status: anyOk ? "sent" : "failed",
          sent_at: anyOk ? new Date().toISOString() : null,
          attempts: job.attempts + 1,
          last_error: anyOk ? null : (receipts[0]?.errorMessage ?? "delivery failed")
        })
        .eq("id", job.id);
      if (anyOk) sent += 1;
      else failed += 1;
    } catch (error) {
      await db
        .from("notification_jobs")
        .update({
          status: job.attempts + 1 >= 3 ? "failed" : "pending",
          attempts: job.attempts + 1,
          last_error: error instanceof Error ? error.message.slice(0, 300) : "delivery error"
        })
        .eq("id", job.id);
      failed += 1;
    }
  }
  return { processed: jobs.length, sent, failed };
}
