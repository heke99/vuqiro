import { getServiceDb } from "./supabase";
import type { ApiAdmin } from "../middleware/auth";

export type AuditEntry = {
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  metadata?: Record<string, unknown>;
};

const mockAuditTrail: (AuditEntry & { actorId: string; actorRole: string; createdAt: string })[] = [];

/**
 * Writes an audit log entry. Every sensitive admin/moderation/payout action
 * must call this. In mock mode entries are kept in memory (inspectable in
 * tests via getMockAuditTrail).
 */
export async function writeAuditLog(actor: ApiAdmin, entry: AuditEntry): Promise<void> {
  const db = getServiceDb();
  if (!db) {
    mockAuditTrail.push({
      ...entry,
      actorId: actor.id,
      actorRole: actor.role,
      createdAt: new Date().toISOString()
    });
    return;
  }
  const { error } = await db.from("audit_logs").insert({
    actor_admin_id: actor.id,
    actor_role: actor.role,
    action: entry.action,
    target_type: entry.targetType,
    target_id: entry.targetId,
    summary: entry.summary,
    metadata: entry.metadata ?? {}
  });
  if (error) {
    // Audit failures must be loud: sensitive actions should not proceed silently.
    throw new Error(`audit log write failed: ${error.message}`);
  }
}

export function getMockAuditTrail() {
  return mockAuditTrail;
}
