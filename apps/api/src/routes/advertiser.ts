import { Hono } from "hono";
import { z } from "zod";
import { mockAdCampaigns, mockAdvertisers } from "@vuqiro/mock-data";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { enforceRateLimit } from "../lib/rateLimit";
import { getServiceDb, isBackendConfigured } from "../lib/supabase";
import type { AppEnv } from "../middleware/auth";
import { attachUser, requireUser } from "../middleware/auth";

/**
 * Advertiser self-serve surface. An advertiser is linked to a platform user
 * via advertisers.owner_profile_id (set by an admin when the account is
 * sold/onboarded). Owners can only ever see and manage their own advertisers,
 * campaigns and reporting; everything created here starts as a draft and
 * must pass admin review (pending_review → active) before it can serve.
 */
export const advertiserRoutes = new Hono<AppEnv>();

advertiserRoutes.use("*", attachUser);
advertiserRoutes.use("*", requireUser);

async function ownedAdvertiserIds(profileId: string): Promise<Set<string>> {
  const db = getServiceDb()!;
  const { data } = await db.from("advertisers").select("id").eq("owner_profile_id", profileId);
  return new Set((data ?? []).map((row) => row.id));
}

// ---------------------------------------------------------------------------
// Own advertiser accounts
// ---------------------------------------------------------------------------

advertiserRoutes.get("/me", async (c) => {
  const profile = c.get("profile")!;
  if (!isBackendConfigured()) {
    return c.json({ advertisers: [mockAdvertisers[0]], accounts: [], source: "mock" });
  }
  const db = getServiceDb()!;
  const { data: advertisers, error } = await db
    .from("advertisers")
    .select("id, name, legal_name, contact_email, website_url, country, status, created_at")
    .eq("owner_profile_id", profile.id)
    .order("created_at", { ascending: false });
  if (error) throw badRequest(error.message);
  const advertiserIds = (advertisers ?? []).map((row) => row.id);
  const { data: accounts } = advertiserIds.length
    ? await db
        .from("ad_accounts")
        .select("id, advertiser_id, name, currency, balance_cents, status")
        .in("advertiser_id", advertiserIds)
    : { data: [] };
  return c.json({ advertisers: advertisers ?? [], accounts: accounts ?? [], source: "db" });
});

// ---------------------------------------------------------------------------
// Own campaigns
// ---------------------------------------------------------------------------

advertiserRoutes.get("/campaigns", async (c) => {
  const profile = c.get("profile")!;
  if (!isBackendConfigured()) {
    return c.json({ campaigns: mockAdCampaigns, source: "mock" });
  }
  const db = getServiceDb()!;
  const owned = await ownedAdvertiserIds(profile.id);
  if (owned.size === 0) return c.json({ campaigns: [], source: "db" });
  const { data, error } = await db
    .from("ad_campaigns")
    .select("*")
    .in("advertiser_id", [...owned])
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw badRequest(error.message);
  return c.json({ campaigns: data ?? [], source: "db" });
});

const campaignBody = z.object({
  advertiserId: z.string().min(1),
  name: z.string().trim().min(1).max(200),
  objective: z.enum(["awareness", "traffic", "conversions", "installs"]).default("awareness"),
  buyingType: z.enum(["cpm", "cpc"]).default("cpm"),
  totalBudgetCents: z.number().int().positive(),
  dailyBudgetCents: z.number().int().positive().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional()
});

const MIN_BUDGET_CENTS = 1000;

advertiserRoutes.post("/campaigns", async (c) => {
  const profile = c.get("profile")!;
  enforceRateLimit(`advertiser-campaign:${profile.id}`, 10, 3_600_000);
  const body = campaignBody.parse(await c.req.json());
  if (body.totalBudgetCents < MIN_BUDGET_CENTS) {
    throw badRequest(`Minimum campaign budget is $${(MIN_BUDGET_CENTS / 100).toFixed(2)}`);
  }

  if (!isBackendConfigured()) {
    return c.json(
      { campaign: { id: `mock_selfserve_${Date.now()}`, ...body, status: "draft" }, source: "mock" },
      201
    );
  }

  const db = getServiceDb()!;
  const owned = await ownedAdvertiserIds(profile.id);
  if (!owned.has(body.advertiserId)) throw forbidden("You do not manage this advertiser");

  const { data: account } = await db
    .from("ad_accounts")
    .select("id")
    .eq("advertiser_id", body.advertiserId)
    .limit(1)
    .maybeSingle();
  if (!account) throw badRequest("No ad account exists for this advertiser yet — contact Vuqiro support.");

  // Prices come from platform defaults; self-serve advertisers cannot set
  // their own CPM/CPC. Admins can adjust per campaign during review.
  const { data, error } = await db
    .from("ad_campaigns")
    .insert({
      ad_account_id: account.id,
      advertiser_id: body.advertiserId,
      name: body.name,
      objective: body.objective,
      buying_type: body.buyingType,
      total_budget_cents: body.totalBudgetCents,
      daily_budget_cents: body.dailyBudgetCents,
      starts_at: body.startsAt,
      ends_at: body.endsAt
    })
    .select("*")
    .single();
  if (error) throw badRequest(error.message);
  return c.json({ campaign: data, source: "db" }, 201);
});

// Owners can submit drafts for review and pause/resume delivery; they can
// never activate, reject or complete — those transitions are admin-only.
const ownerTransitions: Record<string, { from: string[]; to: string }> = {
  submit: { from: ["draft"], to: "pending_review" },
  pause: { from: ["active"], to: "paused" },
  resume: { from: ["paused"], to: "active" }
};

advertiserRoutes.post("/campaigns/:id/:transition", async (c) => {
  const profile = c.get("profile")!;
  const id = z.string().min(1).parse(c.req.param("id"));
  const transitionName = z.string().parse(c.req.param("transition"));
  const transition = ownerTransitions[transitionName];
  if (!transition) throw notFound("Unknown campaign action");

  if (!isBackendConfigured()) {
    return c.json({ campaignId: id, status: transition.to, source: "mock" });
  }

  const db = getServiceDb()!;
  const owned = await ownedAdvertiserIds(profile.id);
  const { data: campaign } = await db
    .from("ad_campaigns")
    .select("id, advertiser_id, status, name")
    .eq("id", id)
    .maybeSingle();
  if (!campaign || !owned.has(campaign.advertiser_id)) throw notFound("Campaign not found");
  if (!transition.from.includes(campaign.status)) {
    throw badRequest(`Cannot ${transitionName} a ${campaign.status} campaign`);
  }
  const { error } = await db.from("ad_campaigns").update({ status: transition.to }).eq("id", id);
  if (error) throw badRequest(error.message);
  return c.json({ campaignId: id, status: transition.to, source: "db" });
});

// ---------------------------------------------------------------------------
// Own reporting
// ---------------------------------------------------------------------------

advertiserRoutes.get("/reporting", async (c) => {
  const profile = c.get("profile")!;
  if (!isBackendConfigured()) {
    return c.json({
      reporting: mockAdCampaigns.map((campaign) => ({
        campaignId: campaign.id,
        campaignName: campaign.name,
        status: campaign.status,
        impressions: 12040,
        clicks: 220,
        spentCents: campaign.spentCents
      })),
      source: "mock"
    });
  }
  const db = getServiceDb()!;
  const owned = await ownedAdvertiserIds(profile.id);
  if (owned.size === 0) return c.json({ reporting: [], source: "db" });

  const { data: campaigns, error } = await db
    .from("ad_campaigns")
    .select("id, name, status, buying_type, spent_cents")
    .in("advertiser_id", [...owned])
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw badRequest(error.message);

  const reporting = await Promise.all(
    (campaigns ?? []).map(async (campaign) => {
      const [impressions, clicks] = await Promise.all([
        db.from("ad_impressions").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id),
        db.from("ad_clicks").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id)
      ]);
      return {
        campaignId: campaign.id,
        campaignName: campaign.name,
        status: campaign.status,
        buyingType: campaign.buying_type,
        impressions: impressions.count ?? 0,
        clicks: clicks.count ?? 0,
        spentCents: campaign.spent_cents
      };
    })
  );
  return c.json({ reporting, source: "db" });
});
