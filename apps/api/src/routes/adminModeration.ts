import { Hono } from "hono";
import { z } from "zod";
import { writeAuditLog } from "../lib/audit";
import { badRequest, notFound } from "../lib/errors";
import { getServiceDb, isBackendConfigured } from "../lib/supabase";
import type { ApiAdmin, AppEnv } from "../middleware/auth";
import { requireAdmin } from "../middleware/auth";

export const adminModerationRoutes = new Hono<AppEnv>();

adminModerationRoutes.use("*", requireAdmin());

const decisionBody = z.object({
  action: z.enum([
    "no_action",
    "limit_distribution",
    "remove_content",
    "age_restrict",
    "suspend_user",
    "ban_user",
    "hold_payout",
    "release_payout",
    "restore_content"
  ]),
  note: z.string().trim().max(1000).optional()
});

type CaseRow = {
  id: string;
  target_type: "video" | "comment" | "profile" | "creator";
  target_id: string;
  status: string;
};

const contentStatusByAction: Record<string, string> = {
  limit_distribution: "limited",
  remove_content: "removed",
  age_restrict: "age_restricted",
  restore_content: "visible"
};

/**
 * Applies a moderation decision to the case target. This is the enforcement
 * core: content state, user state and payout state all change here, and
 * every decision is audit-logged.
 */
async function enforceDecision(
  admin: ApiAdmin,
  caseRow: CaseRow,
  action: z.infer<typeof decisionBody>["action"],
  note: string | undefined
): Promise<string> {
  const db = getServiceDb()!;

  // Content-level actions on videos/comments.
  if (action in contentStatusByAction && (caseRow.target_type === "video" || caseRow.target_type === "comment")) {
    const table = caseRow.target_type === "video" ? "videos" : "comments";
    const moderationStatus = contentStatusByAction[action];
    const update: Record<string, unknown> = { moderation_status: moderationStatus };
    if (caseRow.target_type === "video") {
      if (action === "remove_content") update.status = "removed";
      if (action === "restore_content") update.status = "ready";
    }
    const { error } = await db.from(table).update(update).eq("id", caseRow.target_id);
    if (error) throw badRequest(error.message);
    return `${action} applied to ${caseRow.target_type} ${caseRow.target_id}`;
  }

  // User-level actions.
  if (action === "suspend_user" || action === "ban_user") {
    const nextStatus = action === "suspend_user" ? "suspended" : "banned";
    let profileId: string | null = null;

    if (caseRow.target_type === "profile") {
      profileId = caseRow.target_id;
    } else if (caseRow.target_type === "creator") {
      const { data } = await db.from("creators").select("profile_id").eq("id", caseRow.target_id).maybeSingle();
      profileId = data?.profile_id ?? null;
    } else if (caseRow.target_type === "comment") {
      const { data } = await db.from("comments").select("author_id").eq("id", caseRow.target_id).maybeSingle();
      profileId = data?.author_id ?? null;
    } else if (caseRow.target_type === "video") {
      const { data } = await db
        .from("videos")
        .select("creators (profile_id)")
        .eq("id", caseRow.target_id)
        .maybeSingle();
      profileId = (data?.creators as { profile_id?: string } | null)?.profile_id ?? null;
    }
    if (!profileId) throw badRequest("Could not resolve the user behind this case");

    const { error } = await db.from("profiles").update({ status: nextStatus }).eq("id", profileId);
    if (error) throw badRequest(error.message);

    // Banned users' content is hidden platform-wide.
    if (action === "ban_user") {
      const { data: creator } = await db.from("creators").select("id").eq("profile_id", profileId).maybeSingle();
      if (creator) {
        await db
          .from("videos")
          .update({ moderation_status: "blocked" })
          .eq("creator_id", creator.id)
          .neq("moderation_status", "removed");
      }
      await db.from("comments").update({ moderation_status: "blocked" }).eq("author_id", profileId);
    }
    return `${action}: profile ${profileId} is now ${nextStatus}`;
  }

  // Payout actions target the creator behind the case.
  if (action === "hold_payout" || action === "release_payout") {
    let creatorId: string | null = null;
    if (caseRow.target_type === "creator") {
      creatorId = caseRow.target_id;
    } else if (caseRow.target_type === "video") {
      const { data } = await db.from("videos").select("creator_id").eq("id", caseRow.target_id).maybeSingle();
      creatorId = data?.creator_id ?? null;
    } else if (caseRow.target_type === "profile") {
      const { data } = await db.from("creators").select("id").eq("profile_id", caseRow.target_id).maybeSingle();
      creatorId = data?.id ?? null;
    }
    if (!creatorId) throw badRequest("Could not resolve the creator behind this case");

    if (action === "hold_payout") {
      await db.from("payout_holds").insert({
        creator_id: creatorId,
        reason: "moderation_case",
        note: note ?? `Moderation case ${caseRow.id}`,
        placed_by: admin.id
      });
      await db
        .from("creator_payouts")
        .update({ status: "held" })
        .eq("creator_id", creatorId)
        .in("status", ["pending", "payable"]);
      await db
        .from("creator_revenue_ledger")
        .update({ status: "held" })
        .eq("creator_id", creatorId)
        .in("status", ["pending", "payable"]);
    } else {
      await db
        .from("payout_holds")
        .update({ released_by: admin.id, released_at: new Date().toISOString() })
        .eq("creator_id", creatorId)
        .is("released_at", null);
      await db.from("creator_payouts").update({ status: "payable" }).eq("creator_id", creatorId).eq("status", "held");
      await db
        .from("creator_revenue_ledger")
        .update({ status: "payable" })
        .eq("creator_id", creatorId)
        .eq("status", "held");
    }
    return `${action} for creator ${creatorId}`;
  }

  return "no_action";
}

adminModerationRoutes.get("/moderation/cases/:id", async (c) => {
  const id = z.string().min(1).parse(c.req.param("id"));

  if (!isBackendConfigured()) {
    return c.json({
      case: { id, targetType: "video", targetId: "video_002", reason: "copyright", status: "reviewing" },
      reports: [],
      actions: [],
      source: "mock"
    });
  }

  const db = getServiceDb()!;
  const [{ data: caseRow }, { data: reports }, { data: actions }] = await Promise.all([
    db.from("moderation_cases").select("*").eq("id", id).maybeSingle(),
    db.from("reports").select("*").eq("moderation_case_id", id).order("created_at", { ascending: false }),
    db.from("moderation_actions").select("*").eq("case_id", id).order("created_at", { ascending: false })
  ]);
  if (!caseRow) throw notFound("Case not found");

  return c.json({ case: caseRow, reports: reports ?? [], actions: actions ?? [], source: "db" });
});

adminModerationRoutes.post("/moderation/cases/:id/decide", requireAdmin("platform_superadmin", "admin", "moderator"), async (c) => {
  const admin = c.get("admin")!;
  const id = z.string().min(1).parse(c.req.param("id"));
  const body = decisionBody.parse(await c.req.json());

  if (!isBackendConfigured()) {
    await writeAuditLog(admin, {
      action: `moderation_${body.action}`,
      targetType: "moderation_case",
      targetId: id,
      summary: `Decision ${body.action} (mock mode)`
    });
    return c.json({ caseId: id, action: body.action, status: "resolved", source: "mock" });
  }

  const db = getServiceDb()!;
  const { data: caseRow } = await db
    .from("moderation_cases")
    .select("id, target_type, target_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!caseRow) throw notFound("Case not found");
  if (caseRow.status === "resolved" && body.action !== "restore_content") {
    throw badRequest("Case already resolved; reopen it first");
  }

  const summary = await enforceDecision(admin, caseRow as CaseRow, body.action, body.note);

  await db.from("moderation_actions").insert({
    case_id: id,
    action: body.action,
    actor_id: admin.id,
    note: body.note
  });
  await db
    .from("moderation_cases")
    .update({ status: "resolved", resolved_action: body.action, resolved_at: new Date().toISOString() })
    .eq("id", id);

  await writeAuditLog(admin, {
    action: `moderation_${body.action}`,
    targetType: caseRow.target_type,
    targetId: caseRow.target_id,
    summary
  });

  return c.json({ caseId: id, action: body.action, status: "resolved", summary, source: "db" });
});

adminModerationRoutes.post("/moderation/cases/:id/reopen", requireAdmin("platform_superadmin", "admin", "moderator"), async (c) => {
  const admin = c.get("admin")!;
  const id = z.string().min(1).parse(c.req.param("id"));

  if (!isBackendConfigured()) {
    return c.json({ caseId: id, status: "reviewing", source: "mock" });
  }

  const db = getServiceDb()!;
  const { error } = await db.from("moderation_cases").update({ status: "reviewing" }).eq("id", id);
  if (error) throw badRequest(error.message);

  await writeAuditLog(admin, {
    action: "moderation_case_reopen",
    targetType: "moderation_case",
    targetId: id,
    summary: "Reopened moderation case"
  });

  return c.json({ caseId: id, status: "reviewing", source: "db" });
});
