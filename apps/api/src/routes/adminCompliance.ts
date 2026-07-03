import { Hono } from "hono";
import { z } from "zod";
import { mockLegalAcceptances, mockLegalDocuments } from "@vuqiro/mock-data";
import { writeAuditLog } from "../lib/audit";
import { badRequest, notFound } from "../lib/errors";
import { getServiceDb, isBackendConfigured } from "../lib/supabase";
import type { AppEnv } from "../middleware/auth";
import { requireAdmin } from "../middleware/auth";

/**
 * Compliance administration: legal documents & versions, acceptances,
 * privacy requests, data exports, account deletion requests, appeals and
 * copyright claims.
 */
export const adminComplianceRoutes = new Hono<AppEnv>();

adminComplianceRoutes.use("*", requireAdmin());

const legalRoles = requireAdmin("platform_superadmin", "admin");
const moderationRoles = requireAdmin("platform_superadmin", "admin", "moderator");

// ---------------------------------------------------------------------------
// Legal documents
// ---------------------------------------------------------------------------

adminComplianceRoutes.get("/legal/documents", async (c) => {
  if (!isBackendConfigured()) {
    return c.json({ documents: mockLegalDocuments, source: "mock" });
  }
  const db = getServiceDb()!;
  const { data, error } = await db.from("legal_documents").select("*").order("type").order("version", { ascending: false });
  if (error) throw badRequest(error.message);
  return c.json({ documents: data ?? [], source: "db" });
});

const documentBody = z.object({
  type: z.enum(["terms", "privacy", "community_guidelines", "creator_terms", "payout_terms", "copyright_takedown", "refund_policy"]),
  title: z.string().trim().min(1).max(200),
  contentMd: z.string().min(1)
});

/** Create a new draft version of a legal document. */
adminComplianceRoutes.post("/legal/documents", legalRoles, async (c) => {
  const admin = c.get("admin")!;
  const body = documentBody.parse(await c.req.json());

  if (!isBackendConfigured()) {
    return c.json({ document: { id: `mock_legal_${Date.now()}`, ...body, version: 2, status: "draft" }, source: "mock" }, 201);
  }
  const db = getServiceDb()!;
  const { data: latest } = await db
    .from("legal_documents")
    .select("version")
    .eq("type", body.type)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await db
    .from("legal_documents")
    .insert({
      type: body.type,
      version: (latest?.version ?? 0) + 1,
      title: body.title,
      content_md: body.contentMd,
      status: "draft"
    })
    .select("*")
    .single();
  if (error) throw badRequest(error.message);

  await writeAuditLog(admin, {
    action: "legal_document_create",
    targetType: "legal_document",
    targetId: data.id,
    summary: `Created ${body.type} v${data.version} (draft)`
  });
  return c.json({ document: data, source: "db" }, 201);
});

/** Publish a version; previous published versions of the type are archived. */
adminComplianceRoutes.post("/legal/documents/:id/publish", legalRoles, async (c) => {
  const admin = c.get("admin")!;
  const id = z.string().min(1).parse(c.req.param("id"));

  if (!isBackendConfigured()) {
    await writeAuditLog(admin, {
      action: "legal_document_publish",
      targetType: "legal_document",
      targetId: id,
      summary: "Published legal document (mock mode)"
    });
    return c.json({ documentId: id, status: "published", source: "mock" });
  }

  const db = getServiceDb()!;
  const { data: doc } = await db.from("legal_documents").select("id, type, version, status").eq("id", id).maybeSingle();
  if (!doc) throw notFound("Legal document not found");
  if (doc.status === "published") throw badRequest("Document is already published");

  await db.from("legal_documents").update({ status: "archived" }).eq("type", doc.type).eq("status", "published");
  const { error } = await db
    .from("legal_documents")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw badRequest(error.message);

  await writeAuditLog(admin, {
    action: "legal_document_publish",
    targetType: "legal_document",
    targetId: id,
    summary: `Published ${doc.type} v${doc.version} — users must re-accept`
  });
  return c.json({ documentId: id, status: "published", source: "db" });
});

adminComplianceRoutes.get("/legal/acceptances", async (c) => {
  if (!isBackendConfigured()) {
    return c.json({ acceptances: mockLegalAcceptances, source: "mock" });
  }
  const db = getServiceDb()!;
  const { data, error } = await db
    .from("legal_acceptances")
    .select("*, profiles (handle), legal_documents (type, version)")
    .order("accepted_at", { ascending: false })
    .limit(200);
  if (error) throw badRequest(error.message);
  return c.json({ acceptances: data ?? [], source: "db" });
});

// ---------------------------------------------------------------------------
// Privacy requests & data exports
// ---------------------------------------------------------------------------

adminComplianceRoutes.get("/privacy-requests", async (c) => {
  if (!isBackendConfigured()) {
    return c.json({ requests: [], source: "mock" });
  }
  const db = getServiceDb()!;
  let query = db
    .from("privacy_requests")
    .select("*, profiles (handle)")
    .order("created_at", { ascending: false })
    .limit(200);
  const status = c.req.query("status");
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw badRequest(error.message);
  return c.json({ requests: data ?? [], source: "db" });
});

const privacyStatusBody = z.object({ status: z.enum(["processing", "completed", "rejected"]) });

adminComplianceRoutes.post("/privacy-requests/:id/status", legalRoles, async (c) => {
  const admin = c.get("admin")!;
  const id = z.string().min(1).parse(c.req.param("id"));
  const body = privacyStatusBody.parse(await c.req.json());

  if (!isBackendConfigured()) {
    return c.json({ requestId: id, status: body.status, source: "mock" });
  }
  const db = getServiceDb()!;
  const { data, error } = await db
    .from("privacy_requests")
    .update({
      status: body.status,
      resolved_by: body.status === "processing" ? null : admin.id,
      resolved_at: body.status === "processing" ? null : new Date().toISOString()
    })
    .eq("id", id)
    .select("id, type")
    .maybeSingle();
  if (error) throw badRequest(error.message);
  if (!data) throw notFound("Privacy request not found");

  await writeAuditLog(admin, {
    action: "privacy_request_update",
    targetType: "privacy_request",
    targetId: id,
    summary: `Privacy request (${data.type}) → ${body.status}`
  });
  return c.json({ requestId: id, status: body.status, source: "db" });
});

adminComplianceRoutes.get("/data-exports", async (c) => {
  if (!isBackendConfigured()) {
    return c.json({ exports: [], source: "mock" });
  }
  const db = getServiceDb()!;
  const { data, error } = await db
    .from("data_exports")
    .select("*, profiles (handle)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw badRequest(error.message);
  return c.json({ exports: data ?? [], source: "db" });
});

// ---------------------------------------------------------------------------
// Account deletion requests
// ---------------------------------------------------------------------------

adminComplianceRoutes.get("/deletion-requests", async (c) => {
  if (!isBackendConfigured()) {
    return c.json({ requests: [], source: "mock" });
  }
  const db = getServiceDb()!;
  const { data, error } = await db
    .from("account_deletion_requests")
    .select("*, profiles (handle, status)")
    .order("requested_at", { ascending: false })
    .limit(200);
  if (error) throw badRequest(error.message);
  return c.json({ requests: data ?? [], source: "db" });
});

/** Process a deletion: anonymize the profile and complete the request. */
adminComplianceRoutes.post("/deletion-requests/:id/process", legalRoles, async (c) => {
  const admin = c.get("admin")!;
  const id = z.string().min(1).parse(c.req.param("id"));

  if (!isBackendConfigured()) {
    await writeAuditLog(admin, {
      action: "account_deletion_process",
      targetType: "account_deletion_request",
      targetId: id,
      summary: "Processed account deletion (mock mode)"
    });
    return c.json({ requestId: id, status: "completed", source: "mock" });
  }

  const db = getServiceDb()!;
  const { data: request } = await db
    .from("account_deletion_requests")
    .select("id, profile_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!request) throw notFound("Deletion request not found");
  if (request.status === "completed") throw badRequest("Request already completed");

  // Anonymize the profile: content is retired, handle is recycled.
  const anonHandle = `deleted_${id.slice(0, 8)}`;
  await db
    .from("profiles")
    .update({
      status: "deleted",
      handle: anonHandle,
      display_name: "Deleted account",
      bio: "",
      avatar_url: null,
      website_url: null
    })
    .eq("id", request.profile_id);
  await db.from("videos").update({ status: "deleted", deleted_at: new Date().toISOString() }).in(
    "creator_id",
    (
      (await db.from("creators").select("id").eq("profile_id", request.profile_id)).data ?? []
    ).map((row) => row.id)
  );
  await db.from("push_tokens").update({ is_active: false }).eq("profile_id", request.profile_id);
  const { error } = await db
    .from("account_deletion_requests")
    .update({ status: "completed", processed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw badRequest(error.message);

  await writeAuditLog(admin, {
    action: "account_deletion_process",
    targetType: "account_deletion_request",
    targetId: id,
    summary: `Processed deletion for profile ${request.profile_id}`
  });
  return c.json({ requestId: id, status: "completed", source: "db" });
});

// ---------------------------------------------------------------------------
// Appeals
// ---------------------------------------------------------------------------

adminComplianceRoutes.get("/appeals", moderationRoles, async (c) => {
  if (!isBackendConfigured()) {
    return c.json({ appeals: [], source: "mock" });
  }
  const db = getServiceDb()!;
  let query = db
    .from("appeals")
    .select("*, profiles (handle)")
    .order("created_at", { ascending: false })
    .limit(200);
  const status = c.req.query("status");
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw badRequest(error.message);
  return c.json({ appeals: data ?? [], source: "db" });
});

const appealDecisionBody = z.object({
  decision: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(2000).optional()
});

adminComplianceRoutes.post("/appeals/:id/decide", moderationRoles, async (c) => {
  const admin = c.get("admin")!;
  const id = z.string().min(1).parse(c.req.param("id"));
  const body = appealDecisionBody.parse(await c.req.json());

  if (!isBackendConfigured()) {
    await writeAuditLog(admin, {
      action: "appeal_decide",
      targetType: "appeal",
      targetId: id,
      summary: `Appeal ${body.decision} (mock mode)`
    });
    return c.json({ appealId: id, status: body.decision, source: "mock" });
  }

  const db = getServiceDb()!;
  const { data: appeal } = await db
    .from("appeals")
    .select("id, status, target_type, target_id, profile_id")
    .eq("id", id)
    .maybeSingle();
  if (!appeal) throw notFound("Appeal not found");
  if (appeal.status === "approved" || appeal.status === "rejected") {
    throw badRequest("Appeal already decided");
  }

  const { error } = await db
    .from("appeals")
    .update({
      status: body.decision,
      decided_by: admin.id,
      decision_note: body.note,
      decided_at: new Date().toISOString()
    })
    .eq("id", id);
  if (error) throw badRequest(error.message);

  // Approving a video appeal restores the content.
  if (body.decision === "approved" && appeal.target_type === "video") {
    await db.from("videos").update({ moderation_status: "visible", status: "ready" }).eq("id", appeal.target_id);
  }

  await db.from("notifications").insert({
    profile_id: appeal.profile_id,
    type: "moderation_warning",
    title: body.decision === "approved" ? "Appeal approved" : "Appeal decision",
    body:
      body.decision === "approved"
        ? "Your appeal was approved and the content has been restored."
        : "Your appeal was reviewed and the original decision stands."
  });

  await writeAuditLog(admin, {
    action: "appeal_decide",
    targetType: "appeal",
    targetId: id,
    summary: `Appeal ${body.decision} (${appeal.target_type} ${appeal.target_id})`
  });
  return c.json({ appealId: id, status: body.decision, source: "db" });
});

// ---------------------------------------------------------------------------
// Copyright claims
// ---------------------------------------------------------------------------

adminComplianceRoutes.get("/copyright-claims", moderationRoles, async (c) => {
  if (!isBackendConfigured()) {
    return c.json({ claims: [], source: "mock" });
  }
  const db = getServiceDb()!;
  let query = db.from("copyright_claims").select("*").order("created_at", { ascending: false }).limit(200);
  const status = c.req.query("status");
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw badRequest(error.message);
  return c.json({ claims: data ?? [], source: "db" });
});

const claimDecisionBody = z.object({
  decision: z.enum(["accepted", "rejected"]),
  note: z.string().trim().max(2000).optional()
});

adminComplianceRoutes.post("/copyright-claims/:id/decide", moderationRoles, async (c) => {
  const admin = c.get("admin")!;
  const id = z.string().min(1).parse(c.req.param("id"));
  const body = claimDecisionBody.parse(await c.req.json());

  if (!isBackendConfigured()) {
    return c.json({ claimId: id, status: body.decision, source: "mock" });
  }

  const db = getServiceDb()!;
  const { data: claim } = await db
    .from("copyright_claims")
    .select("id, status, target_video_id")
    .eq("id", id)
    .maybeSingle();
  if (!claim) throw notFound("Copyright claim not found");
  if (claim.status === "accepted" || claim.status === "rejected") {
    throw badRequest("Claim already decided");
  }

  const { error } = await db
    .from("copyright_claims")
    .update({ status: body.decision, decided_by: admin.id, decided_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw badRequest(error.message);

  // Accepted claim = takedown.
  if (body.decision === "accepted") {
    await db
      .from("videos")
      .update({ moderation_status: "removed", status: "removed" })
      .eq("id", claim.target_video_id);
  }

  await writeAuditLog(admin, {
    action: "copyright_claim_decide",
    targetType: "copyright_claim",
    targetId: id,
    summary: `Copyright claim ${body.decision}${body.decision === "accepted" ? " — video taken down" : ""}`
  });
  return c.json({ claimId: id, status: body.decision, source: "db" });
});
