import { Hono } from "hono";
import { z } from "zod";
import { mockLegalDocuments } from "@vuqiro/mock-data";
import { badRequest, notFound } from "../lib/errors";
import { getServiceDb, isBackendConfigured } from "../lib/supabase";
import type { AppEnv } from "../middleware/auth";
import { attachUser, requireUser } from "../middleware/auth";

export const legalRoutes = new Hono<AppEnv>();

legalRoutes.use("*", attachUser);

/** Published legal documents (latest version per type). */
legalRoutes.get("/legal/documents", async (c) => {
  if (!isBackendConfigured()) {
    return c.json({ documents: mockLegalDocuments.filter((doc) => doc.status === "published"), source: "mock" });
  }
  const db = getServiceDb()!;
  const { data, error } = await db
    .from("legal_documents")
    .select("id, type, version, title, status, published_at")
    .eq("status", "published")
    .order("version", { ascending: false });
  if (error) throw badRequest(error.message);

  // Latest published version per type.
  const latest = new Map<string, (typeof data)[number]>();
  for (const doc of data ?? []) {
    if (!latest.has(doc.type)) latest.set(doc.type, doc);
  }
  return c.json({ documents: [...latest.values()], source: "db" });
});

const acceptBody = z.object({
  documentTypes: z
    .array(z.enum(["terms", "privacy", "community_guidelines", "creator_terms", "payout_terms", "copyright_takedown", "refund_policy"]))
    .min(1)
    .max(7)
});

/**
 * Records the caller's acceptance of the latest published version of the
 * given document types. Idempotent per (profile, document).
 */
legalRoutes.post("/legal/accept", requireUser, async (c) => {
  const profile = c.get("profile")!;
  const body = acceptBody.parse(await c.req.json());

  if (!isBackendConfigured()) {
    return c.json({ accepted: body.documentTypes, source: "mock" }, 201);
  }

  const db = getServiceDb()!;
  const accepted: string[] = [];
  for (const type of body.documentTypes) {
    const { data: doc } = await db
      .from("legal_documents")
      .select("id, version")
      .eq("type", type)
      .eq("status", "published")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!doc) throw notFound(`No published ${type} document`);

    const { error } = await db
      .from("legal_acceptances")
      .upsert({ profile_id: profile.id, document_id: doc.id }, { onConflict: "profile_id,document_id" });
    if (error) throw badRequest(error.message);
    accepted.push(`${type} v${doc.version}`);
  }

  return c.json({ accepted, source: "db" }, 201);
});

/** The caller's acceptance history. */
legalRoutes.get("/legal/acceptances", requireUser, async (c) => {
  const profile = c.get("profile")!;

  if (!isBackendConfigured()) {
    return c.json({ acceptances: [], source: "mock" });
  }

  const db = getServiceDb()!;
  const { data, error } = await db
    .from("legal_acceptances")
    .select("accepted_at, legal_documents (type, version, title)")
    .eq("profile_id", profile.id)
    .order("accepted_at", { ascending: false });
  if (error) throw badRequest(error.message);
  return c.json({ acceptances: data ?? [], source: "db" });
});
