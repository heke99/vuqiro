import { Hono } from "hono";
import { z } from "zod";
import {
  mockAdAccounts,
  mockAdCampaigns,
  mockAdCreatives,
  mockAdGroups,
  mockAdvertisers,
  mockPlatformRevenue,
  mockSponsorshipDeals
} from "@vuqiro/mock-data";
import { writeAuditLog } from "../lib/audit";
import { csvResponseHeaders, toCsv } from "../lib/csv";
import { badRequest, notFound } from "../lib/errors";
import { getServiceDb, isBackendConfigured } from "../lib/supabase";
import { safeHttpUrl } from "../lib/validation";
import type { AppEnv } from "../middleware/auth";
import { requireAdmin } from "../middleware/auth";

/**
 * Ads administration. Superadmins/admins manage the full chain
 * (advertiser → account → campaign → ad group → creative) including manually
 * sold direct sponsorships where the company never logs in.
 */
export const adminAdsRoutes = new Hono<AppEnv>();

adminAdsRoutes.use("*", requireAdmin());

const manageRoles = requireAdmin("platform_superadmin", "admin");

// ---------------------------------------------------------------------------
// Advertisers
// ---------------------------------------------------------------------------

adminAdsRoutes.get("/ads/advertisers", async (c) => {
  if (!isBackendConfigured()) {
    return c.json({ advertisers: mockAdvertisers, source: "mock" });
  }
  const db = getServiceDb()!;
  const { data, error } = await db.from("advertisers").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) throw badRequest(error.message);
  return c.json({ advertisers: data ?? [], source: "db" });
});

const advertiserBody = z.object({
  name: z.string().trim().min(1).max(200),
  legalName: z.string().trim().max(200).default(""),
  contactEmail: z.string().email().or(z.literal("")).default(""),
  contactName: z.string().trim().max(120).default(""),
  websiteUrl: safeHttpUrl.optional(),
  country: z.string().length(2).optional(),
  notes: z.string().trim().max(2000).default(""),
  /** Platform user who self-manages this advertiser (advertiser portal). */
  ownerProfileId: z.string().max(64).nullable().optional()
});

adminAdsRoutes.post("/ads/advertisers", manageRoles, async (c) => {
  const admin = c.get("admin")!;
  const body = advertiserBody.parse(await c.req.json());

  if (!isBackendConfigured()) {
    await writeAuditLog(admin, {
      action: "advertiser_create",
      targetType: "advertiser",
      targetId: "mock",
      summary: `Created advertiser "${body.name}" (mock mode)`
    });
    return c.json({ advertiser: { id: `mock_adv_${Date.now()}`, ...body, status: "active" }, source: "mock" }, 201);
  }

  const db = getServiceDb()!;
  const { data, error } = await db
    .from("advertisers")
    .insert({
      name: body.name,
      legal_name: body.legalName,
      contact_email: body.contactEmail,
      contact_name: body.contactName,
      website_url: body.websiteUrl,
      country: body.country,
      notes: body.notes,
      owner_profile_id: body.ownerProfileId ?? null,
      created_by_admin_id: admin.id
    })
    .select("*")
    .single();
  if (error) throw badRequest(error.message);

  await writeAuditLog(admin, {
    action: "advertiser_create",
    targetType: "advertiser",
    targetId: data.id,
    summary: `Created advertiser "${body.name}"`
  });
  return c.json({ advertiser: data, source: "db" }, 201);
});

adminAdsRoutes.patch("/ads/advertisers/:id", manageRoles, async (c) => {
  const admin = c.get("admin")!;
  const id = z.string().min(1).parse(c.req.param("id"));
  const body = advertiserBody.partial().extend({ status: z.enum(["active", "suspended", "archived"]).optional() }).parse(await c.req.json());

  if (!isBackendConfigured()) {
    return c.json({ advertiser: { id, ...body }, source: "mock" });
  }
  const db = getServiceDb()!;
  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.legalName !== undefined) patch.legal_name = body.legalName;
  if (body.contactEmail !== undefined) patch.contact_email = body.contactEmail;
  if (body.contactName !== undefined) patch.contact_name = body.contactName;
  if (body.websiteUrl !== undefined) patch.website_url = body.websiteUrl;
  if (body.country !== undefined) patch.country = body.country;
  if (body.notes !== undefined) patch.notes = body.notes;
  if (body.status !== undefined) patch.status = body.status;
  if (body.ownerProfileId !== undefined) patch.owner_profile_id = body.ownerProfileId;
  const { data, error } = await db.from("advertisers").update(patch).eq("id", id).select("*").single();
  if (error) throw badRequest(error.message);

  await writeAuditLog(admin, {
    action: "advertiser_update",
    targetType: "advertiser",
    targetId: id,
    summary: `Updated advertiser ${data.name}`
  });
  return c.json({ advertiser: data, source: "db" });
});

// ---------------------------------------------------------------------------
// Ad accounts
// ---------------------------------------------------------------------------

adminAdsRoutes.get("/ads/accounts", async (c) => {
  if (!isBackendConfigured()) {
    return c.json({ accounts: mockAdAccounts, source: "mock" });
  }
  const db = getServiceDb()!;
  const { data, error } = await db.from("ad_accounts").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) throw badRequest(error.message);
  return c.json({ accounts: data ?? [], source: "db" });
});

const accountBody = z.object({
  advertiserId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  currency: z.string().length(3).default("USD")
});

adminAdsRoutes.post("/ads/accounts", manageRoles, async (c) => {
  const admin = c.get("admin")!;
  const body = accountBody.parse(await c.req.json());
  if (!isBackendConfigured()) {
    return c.json({ account: { id: `mock_adacct_${Date.now()}`, ...body, status: "active" }, source: "mock" }, 201);
  }
  const db = getServiceDb()!;
  const { data, error } = await db
    .from("ad_accounts")
    .insert({ advertiser_id: body.advertiserId, name: body.name, currency: body.currency })
    .select("*")
    .single();
  if (error) throw badRequest(error.message);
  await writeAuditLog(admin, {
    action: "ad_account_create",
    targetType: "ad_account",
    targetId: data.id,
    summary: `Created ad account "${body.name}"`
  });
  return c.json({ account: data, source: "db" }, 201);
});

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

adminAdsRoutes.get("/ads/campaigns", async (c) => {
  if (!isBackendConfigured()) {
    return c.json({ campaigns: mockAdCampaigns, source: "mock" });
  }
  const db = getServiceDb()!;
  let query = db
    .from("ad_campaigns")
    .select("*, advertisers (name)")
    .order("created_at", { ascending: false })
    .limit(200);
  const status = c.req.query("status");
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw badRequest(error.message);
  return c.json({ campaigns: data ?? [], source: "db" });
});

const campaignBody = z.object({
  adAccountId: z.string().min(1),
  advertiserId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  objective: z.enum(["awareness", "traffic", "conversions", "installs"]).default("awareness"),
  buyingType: z.enum(["cpm", "cpc", "cpa", "fixed_sponsorship"]).default("cpm"),
  totalBudgetCents: z.number().int().nonnegative().optional(),
  dailyBudgetCents: z.number().int().nonnegative().optional(),
  cpmPriceCents: z.number().int().nonnegative().optional(),
  cpcPriceCents: z.number().int().nonnegative().optional(),
  cpaPriceCents: z.number().int().nonnegative().optional(),
  fixedPriceCents: z.number().int().nonnegative().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional()
});

adminAdsRoutes.post("/ads/campaigns", manageRoles, async (c) => {
  const admin = c.get("admin")!;
  const body = campaignBody.parse(await c.req.json());
  if (body.buyingType === "fixed_sponsorship" && body.fixedPriceCents === undefined) {
    throw badRequest("fixed_sponsorship campaigns require fixedPriceCents");
  }
  if (!isBackendConfigured()) {
    return c.json(
      { campaign: { id: `mock_adcamp_${Date.now()}`, ...body, status: "draft", spentCents: 0 }, source: "mock" },
      201
    );
  }
  const db = getServiceDb()!;
  const { data, error } = await db
    .from("ad_campaigns")
    .insert({
      ad_account_id: body.adAccountId,
      advertiser_id: body.advertiserId,
      name: body.name,
      objective: body.objective,
      buying_type: body.buyingType,
      total_budget_cents: body.totalBudgetCents,
      daily_budget_cents: body.dailyBudgetCents,
      cpm_price_cents: body.cpmPriceCents,
      cpc_price_cents: body.cpcPriceCents,
      cpa_price_cents: body.cpaPriceCents,
      fixed_price_cents: body.fixedPriceCents,
      starts_at: body.startsAt,
      ends_at: body.endsAt,
      created_by_admin_id: admin.id
    })
    .select("*")
    .single();
  if (error) throw badRequest(error.message);
  await writeAuditLog(admin, {
    action: "ad_campaign_create",
    targetType: "ad_campaign",
    targetId: data.id,
    summary: `Created campaign "${body.name}" (${body.buyingType})`
  });
  return c.json({ campaign: data, source: "db" }, 201);
});

const campaignTransitions: Record<string, { from: string[]; to: string; action: string }> = {
  submit: { from: ["draft"], to: "pending_review", action: "ad_campaign_submit" },
  activate: { from: ["pending_review", "paused", "draft"], to: "active", action: "ad_campaign_activate" },
  pause: { from: ["active"], to: "paused", action: "ad_campaign_pause" },
  resume: { from: ["paused"], to: "active", action: "ad_campaign_resume" },
  reject: { from: ["pending_review", "draft"], to: "rejected", action: "ad_campaign_reject" },
  complete: { from: ["active", "paused"], to: "completed", action: "ad_campaign_complete" }
};

adminAdsRoutes.post("/ads/campaigns/:id/:transition", manageRoles, async (c) => {
  const admin = c.get("admin")!;
  const id = z.string().min(1).parse(c.req.param("id"));
  const transitionName = z.string().parse(c.req.param("transition"));
  const transition = campaignTransitions[transitionName];
  if (!transition) throw notFound("Unknown campaign action");

  if (!isBackendConfigured()) {
    await writeAuditLog(admin, {
      action: transition.action,
      targetType: "ad_campaign",
      targetId: id,
      summary: `Campaign ${transitionName} (mock mode)`
    });
    return c.json({ campaignId: id, status: transition.to, source: "mock" });
  }

  const db = getServiceDb()!;
  const { data: campaign } = await db.from("ad_campaigns").select("id, status, name").eq("id", id).maybeSingle();
  if (!campaign) throw notFound("Campaign not found");
  if (!transition.from.includes(campaign.status)) {
    throw badRequest(`Cannot ${transitionName} a ${campaign.status} campaign`);
  }
  const { error } = await db.from("ad_campaigns").update({ status: transition.to }).eq("id", id);
  if (error) throw badRequest(error.message);

  await writeAuditLog(admin, {
    action: transition.action,
    targetType: "ad_campaign",
    targetId: id,
    summary: `Campaign "${campaign.name}": ${campaign.status} → ${transition.to}`
  });
  return c.json({ campaignId: id, status: transition.to, source: "db" });
});

// ---------------------------------------------------------------------------
// Ad groups
// ---------------------------------------------------------------------------

adminAdsRoutes.get("/ads/groups", async (c) => {
  if (!isBackendConfigured()) {
    return c.json({ groups: mockAdGroups, source: "mock" });
  }
  const db = getServiceDb()!;
  let query = db.from("ad_groups").select("*").order("created_at", { ascending: false }).limit(200);
  const campaignId = c.req.query("campaignId");
  if (campaignId) query = query.eq("campaign_id", campaignId);
  const { data, error } = await query;
  if (error) throw badRequest(error.message);
  return c.json({ groups: data ?? [], source: "db" });
});

const groupBody = z.object({
  campaignId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  placements: z.array(z.enum(["feed", "discover", "profile", "inbox", "post_roll"])).min(1).default(["feed"]),
  targeting: z
    .object({
      countries: z.array(z.string().length(2)).optional(),
      languages: z.array(z.string().min(2).max(8)).optional(),
      interests: z.array(z.string()).optional(),
      minAge: z.number().int().min(13).optional()
    })
    .default({}),
  frequencyCapPerDay: z.number().int().min(1).max(50).default(4)
});

adminAdsRoutes.post("/ads/groups", manageRoles, async (c) => {
  const admin = c.get("admin")!;
  const body = groupBody.parse(await c.req.json());
  if (!isBackendConfigured()) {
    return c.json({ group: { id: `mock_adgrp_${Date.now()}`, ...body, status: "active" }, source: "mock" }, 201);
  }
  const db = getServiceDb()!;
  const { data, error } = await db
    .from("ad_groups")
    .insert({
      campaign_id: body.campaignId,
      name: body.name,
      placements: body.placements,
      targeting: {
        countries: body.targeting.countries,
        languages: body.targeting.languages,
        interests: body.targeting.interests,
        min_age: body.targeting.minAge
      },
      frequency_cap_per_day: body.frequencyCapPerDay
    })
    .select("*")
    .single();
  if (error) throw badRequest(error.message);
  await writeAuditLog(admin, {
    action: "ad_group_create",
    targetType: "ad_group",
    targetId: data.id,
    summary: `Created ad group "${body.name}"`
  });
  return c.json({ group: data, source: "db" }, 201);
});

adminAdsRoutes.patch("/ads/groups/:id", manageRoles, async (c) => {
  const admin = c.get("admin")!;
  const id = z.string().min(1).parse(c.req.param("id"));
  const body = groupBody.partial().extend({ status: z.enum(["active", "paused", "archived"]).optional() }).parse(await c.req.json());
  if (!isBackendConfigured()) {
    return c.json({ group: { id, ...body }, source: "mock" });
  }
  const db = getServiceDb()!;
  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.placements !== undefined) patch.placements = body.placements;
  if (body.targeting !== undefined) {
    patch.targeting = {
      countries: body.targeting.countries,
      languages: body.targeting.languages,
      interests: body.targeting.interests,
      min_age: body.targeting.minAge
    };
  }
  if (body.frequencyCapPerDay !== undefined) patch.frequency_cap_per_day = body.frequencyCapPerDay;
  if (body.status !== undefined) patch.status = body.status;
  const { data, error } = await db.from("ad_groups").update(patch).eq("id", id).select("*").single();
  if (error) throw badRequest(error.message);
  await writeAuditLog(admin, {
    action: "ad_group_update",
    targetType: "ad_group",
    targetId: id,
    summary: `Updated ad group "${data.name}"`
  });
  return c.json({ group: data, source: "db" });
});

// ---------------------------------------------------------------------------
// Creatives
// ---------------------------------------------------------------------------

adminAdsRoutes.get("/ads/creatives", async (c) => {
  if (!isBackendConfigured()) {
    return c.json({ creatives: mockAdCreatives, source: "mock" });
  }
  const db = getServiceDb()!;
  let query = db.from("ad_creatives").select("*").order("created_at", { ascending: false }).limit(200);
  const campaignId = c.req.query("campaignId");
  if (campaignId) query = query.eq("campaign_id", campaignId);
  const reviewStatus = c.req.query("reviewStatus");
  if (reviewStatus) query = query.eq("review_status", reviewStatus);
  const { data, error } = await query;
  if (error) throw badRequest(error.message);
  return c.json({ creatives: data ?? [], source: "db" });
});

const creativeBody = z.object({
  adGroupId: z.string().min(1),
  campaignId: z.string().min(1),
  type: z.enum(["video", "image", "card"]).default("card"),
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().max(500).default(""),
  ctaLabel: z.string().trim().min(1).max(40).default("Learn more"),
  ctaUrl: safeHttpUrl,
  mediaUrl: safeHttpUrl.optional(),
  thumbnailUrl: safeHttpUrl.optional(),
  videoId: z.string().optional()
});

adminAdsRoutes.post("/ads/creatives", manageRoles, async (c) => {
  const admin = c.get("admin")!;
  const body = creativeBody.parse(await c.req.json());
  if (!isBackendConfigured()) {
    return c.json(
      { creative: { id: `mock_adcr_${Date.now()}`, ...body, reviewStatus: "pending", status: "active" }, source: "mock" },
      201
    );
  }
  const db = getServiceDb()!;
  const { data, error } = await db
    .from("ad_creatives")
    .insert({
      ad_group_id: body.adGroupId,
      campaign_id: body.campaignId,
      type: body.type,
      title: body.title,
      body: body.body,
      cta_label: body.ctaLabel,
      cta_url: body.ctaUrl,
      media_url: body.mediaUrl,
      thumbnail_url: body.thumbnailUrl,
      video_id: body.videoId
    })
    .select("*")
    .single();
  if (error) throw badRequest(error.message);
  await writeAuditLog(admin, {
    action: "ad_creative_create",
    targetType: "ad_creative",
    targetId: data.id,
    summary: `Created creative "${body.title}"`
  });
  return c.json({ creative: data, source: "db" }, 201);
});

const reviewBody = z.object({ note: z.string().trim().max(1000).optional() });

adminAdsRoutes.post("/ads/creatives/:id/approve", manageRoles, async (c) => {
  const admin = c.get("admin")!;
  const id = z.string().min(1).parse(c.req.param("id"));
  const body = reviewBody.parse(await c.req.json().catch(() => ({})));
  if (!isBackendConfigured()) {
    await writeAuditLog(admin, {
      action: "ad_creative_approve",
      targetType: "ad_creative",
      targetId: id,
      summary: "Approved creative (mock mode)"
    });
    return c.json({ creativeId: id, reviewStatus: "approved", source: "mock" });
  }
  const db = getServiceDb()!;
  const { data, error } = await db
    .from("ad_creatives")
    .update({
      review_status: "approved",
      review_note: body.note,
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString()
    })
    .eq("id", id)
    .select("id, title")
    .single();
  if (error) throw badRequest(error.message);
  await writeAuditLog(admin, {
    action: "ad_creative_approve",
    targetType: "ad_creative",
    targetId: id,
    summary: `Approved creative "${data.title}"`
  });
  return c.json({ creativeId: id, reviewStatus: "approved", source: "db" });
});

adminAdsRoutes.post("/ads/creatives/:id/reject", manageRoles, async (c) => {
  const admin = c.get("admin")!;
  const id = z.string().min(1).parse(c.req.param("id"));
  const body = reviewBody.parse(await c.req.json().catch(() => ({})));
  if (!isBackendConfigured()) {
    return c.json({ creativeId: id, reviewStatus: "rejected", source: "mock" });
  }
  const db = getServiceDb()!;
  const { data, error } = await db
    .from("ad_creatives")
    .update({
      review_status: "rejected",
      review_note: body.note,
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
      status: "paused"
    })
    .eq("id", id)
    .select("id, title")
    .single();
  if (error) throw badRequest(error.message);
  await writeAuditLog(admin, {
    action: "ad_creative_reject",
    targetType: "ad_creative",
    targetId: id,
    summary: `Rejected creative "${data.title}"`
  });
  return c.json({ creativeId: id, reviewStatus: "rejected", source: "db" });
});

// ---------------------------------------------------------------------------
// Direct sponsorship deals
// ---------------------------------------------------------------------------

adminAdsRoutes.get("/ads/sponsorships", async (c) => {
  if (!isBackendConfigured()) {
    return c.json({ deals: mockSponsorshipDeals, source: "mock" });
  }
  const db = getServiceDb()!;
  const { data, error } = await db
    .from("direct_sponsorship_deals")
    .select("*, advertisers (name)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw badRequest(error.message);
  return c.json({ deals: data ?? [], source: "db" });
});

const sponsorshipBody = z.object({
  advertiserId: z.string().min(1),
  campaignId: z.string().optional(),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).default(""),
  fixedPriceCents: z.number().int().nonnegative(),
  currency: z.string().length(3).default("USD"),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  invoiceReference: z.string().trim().max(100).optional()
});

adminAdsRoutes.post("/ads/sponsorships", manageRoles, async (c) => {
  const admin = c.get("admin")!;
  const body = sponsorshipBody.parse(await c.req.json());
  if (!isBackendConfigured()) {
    return c.json({ deal: { id: `mock_spon_${Date.now()}`, ...body, status: "draft" }, source: "mock" }, 201);
  }
  const db = getServiceDb()!;
  const { data, error } = await db
    .from("direct_sponsorship_deals")
    .insert({
      advertiser_id: body.advertiserId,
      campaign_id: body.campaignId,
      name: body.name,
      description: body.description,
      fixed_price_cents: body.fixedPriceCents,
      currency: body.currency,
      starts_at: body.startsAt,
      ends_at: body.endsAt,
      invoice_reference: body.invoiceReference,
      created_by_admin_id: admin.id
    })
    .select("*")
    .single();
  if (error) throw badRequest(error.message);
  await writeAuditLog(admin, {
    action: "sponsorship_create",
    targetType: "direct_sponsorship_deal",
    targetId: data.id,
    summary: `Created sponsorship "${body.name}" ($${(body.fixedPriceCents / 100).toFixed(2)})`
  });
  return c.json({ deal: data, source: "db" }, 201);
});

/**
 * Activating a sponsorship books its fixed price as platform revenue and an
 * ad-account billing event (idempotent per deal).
 */
adminAdsRoutes.post("/ads/sponsorships/:id/activate", manageRoles, async (c) => {
  const admin = c.get("admin")!;
  const id = z.string().min(1).parse(c.req.param("id"));
  if (!isBackendConfigured()) {
    await writeAuditLog(admin, {
      action: "sponsorship_activate",
      targetType: "direct_sponsorship_deal",
      targetId: id,
      summary: "Activated sponsorship (mock mode)"
    });
    return c.json({ dealId: id, status: "active", source: "mock" });
  }
  const db = getServiceDb()!;
  const { data: deal } = await db
    .from("direct_sponsorship_deals")
    .select("id, name, status, advertiser_id, campaign_id, fixed_price_cents, currency")
    .eq("id", id)
    .maybeSingle();
  if (!deal) throw notFound("Sponsorship deal not found");
  if (deal.status !== "draft") throw badRequest(`Cannot activate a ${deal.status} deal`);

  const { error } = await db.from("direct_sponsorship_deals").update({ status: "active" }).eq("id", id);
  if (error) throw badRequest(error.message);

  // Book revenue (idempotent on the deal id).
  await db.from("platform_revenue_ledger").insert({
    source: "sponsorship",
    reference_type: "direct_sponsorship_deal",
    reference_id: deal.id,
    amount_cents: deal.fixed_price_cents,
    currency: deal.currency,
    description: `Direct sponsorship: ${deal.name}`,
    idempotency_key: `sponsorship:${deal.id}`
  });

  const { data: account } = await db
    .from("ad_accounts")
    .select("id")
    .eq("advertiser_id", deal.advertiser_id)
    .limit(1)
    .maybeSingle();
  if (account) {
    await db.from("ad_billing_events").insert({
      ad_account_id: account.id,
      campaign_id: deal.campaign_id,
      type: "fixed_fee",
      amount_cents: deal.fixed_price_cents,
      currency: deal.currency,
      description: `Fixed sponsorship fee: ${deal.name}`,
      idempotency_key: `sponsorship-fee:${deal.id}`
    });
  }

  await writeAuditLog(admin, {
    action: "sponsorship_activate",
    targetType: "direct_sponsorship_deal",
    targetId: id,
    summary: `Activated sponsorship "${deal.name}" — $${(deal.fixed_price_cents / 100).toFixed(2)} booked`
  });
  return c.json({ dealId: id, status: "active", source: "db" });
});

adminAdsRoutes.post("/ads/sponsorships/:id/complete", manageRoles, async (c) => {
  const admin = c.get("admin")!;
  const id = z.string().min(1).parse(c.req.param("id"));
  if (!isBackendConfigured()) {
    return c.json({ dealId: id, status: "completed", source: "mock" });
  }
  const db = getServiceDb()!;
  const { data: deal } = await db.from("direct_sponsorship_deals").select("id, name, status").eq("id", id).maybeSingle();
  if (!deal) throw notFound("Sponsorship deal not found");
  if (deal.status !== "active") throw badRequest(`Cannot complete a ${deal.status} deal`);
  const { error } = await db.from("direct_sponsorship_deals").update({ status: "completed" }).eq("id", id);
  if (error) throw badRequest(error.message);
  await writeAuditLog(admin, {
    action: "sponsorship_complete",
    targetType: "direct_sponsorship_deal",
    targetId: id,
    summary: `Completed sponsorship "${deal.name}"`
  });
  return c.json({ dealId: id, status: "completed", source: "db" });
});

// ---------------------------------------------------------------------------
// Reporting & billing
// ---------------------------------------------------------------------------

adminAdsRoutes.get("/ads/reporting", async (c) => {
  const wantsCsv = c.req.query("format") === "csv";
  if (!isBackendConfigured()) {
    const reporting = mockAdCampaigns.map((campaign) => ({
      campaignId: campaign.id,
      campaignName: campaign.name,
      status: campaign.status,
      buyingType: campaign.buyingType,
      impressions: campaign.id === "adcamp_001" ? 66540 : 27733,
      clicks: campaign.id === "adcamp_001" ? 1220 : 2773,
      conversions: 0,
      spentCents: campaign.spentCents
    }));
    if (wantsCsv) {
      return c.newResponse(toCsv(reporting), 200, csvResponseHeaders("ad-reporting.csv"));
    }
    return c.json({ reporting, source: "mock" });
  }
  const db = getServiceDb()!;
  const { data: campaigns, error } = await db
    .from("ad_campaigns")
    .select("id, name, status, buying_type, spent_cents")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw badRequest(error.message);

  const reporting = await Promise.all(
    (campaigns ?? []).map(async (campaign) => {
      const [impressions, clicks, conversions] = await Promise.all([
        db.from("ad_impressions").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id),
        db.from("ad_clicks").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id),
        db.from("ad_conversions").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id)
      ]);
      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        status: campaign.status,
        buyingType: campaign.buying_type,
        impressions: impressions.count ?? 0,
        clicks: clicks.count ?? 0,
        conversions: conversions.count ?? 0,
        spentCents: campaign.spent_cents
      };
    })
  );
  if (wantsCsv) {
    return c.newResponse(toCsv(reporting), 200, csvResponseHeaders("ad-reporting.csv"));
  }
  return c.json({ reporting, source: "db" });
});

adminAdsRoutes.get("/ads/billing", requireAdmin("platform_superadmin", "admin", "finance"), async (c) => {
  if (!isBackendConfigured()) {
    return c.json({ events: [], source: "mock" });
  }
  const db = getServiceDb()!;
  const { data, error } = await db
    .from("ad_billing_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw badRequest(error.message);
  return c.json({ events: data ?? [], source: "db" });
});

adminAdsRoutes.get("/ads/reports", async (c) => {
  if (!isBackendConfigured()) {
    return c.json({ reports: [], source: "mock" });
  }
  const db = getServiceDb()!;
  const { data, error } = await db.from("ad_reports").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) throw badRequest(error.message);
  return c.json({ reports: data ?? [], source: "db" });
});

// Platform revenue ledger (finance/superadmin).
adminAdsRoutes.get("/revenue/platform-ledger", requireAdmin("platform_superadmin", "admin", "finance"), async (c) => {
  const wantsCsv = c.req.query("format") === "csv";
  if (!isBackendConfigured()) {
    if (wantsCsv) {
      return c.newResponse(
        toCsv(mockPlatformRevenue as unknown as Record<string, unknown>[]),
        200,
        csvResponseHeaders("platform-revenue.csv")
      );
    }
    return c.json({ entries: mockPlatformRevenue, source: "mock" });
  }
  const db = getServiceDb()!;
  const { data, error } = await db
    .from("platform_revenue_ledger")
    .select("*")
    .order("occurred_at", { ascending: false })
    .limit(wantsCsv ? 5000 : 200);
  if (error) throw badRequest(error.message);
  if (wantsCsv) {
    return c.newResponse(
      toCsv((data ?? []) as Record<string, unknown>[]),
      200,
      csvResponseHeaders("platform-revenue.csv")
    );
  }
  return c.json({ entries: data ?? [], source: "db" });
});
