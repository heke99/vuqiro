import { getServiceDb } from "./supabase";

/**
 * RevenueCat webhook event processing.
 *
 * Idempotency model: the raw event is stored in revenuecat_webhook_events
 * with a unique event_id BEFORE processing. Coin credits additionally use an
 * idempotency key derived from the event id, so even a partial retry can
 * never double-credit.
 *
 * The server is the entitlement authority: memberships and coin balances
 * only change here (or in admin flows), never from client claims.
 */

export type RevenueCatEvent = {
  id: string;
  type: string;
  app_user_id?: string;
  product_id?: string;
  transaction_id?: string;
  price?: number;
  currency?: string;
  period_type?: string;
  expiration_at_ms?: number;
  cancel_reason?: string;
};

export type ProcessResult = {
  status: "processed" | "skipped" | "error";
  detail: string;
};

async function resolveProfileId(appUserId: string | undefined): Promise<string | null> {
  const db = getServiceDb()!;
  if (!appUserId) return null;
  // App user ids are Supabase auth user ids (set at SDK configure time).
  const { data } = await db.from("profiles").select("id").eq("auth_user_id", appUserId).maybeSingle();
  if (data) return data.id;
  // Fallback: direct profile id (useful for tests/manual grants).
  const { data: byId } = await db.from("profiles").select("id").eq("id", appUserId).maybeSingle();
  return byId?.id ?? null;
}

type ProductMapping = {
  packageVersionId: string;
  packageType: string;
  packageCode: string;
  coinsAmount: number | null;
  bonusCoinsAmount: number | null;
  priceAmount: number;
  platformFeePercent: number;
  creatorSharePercent: number;
};

async function resolveProduct(storeProductId: string | undefined): Promise<ProductMapping | null> {
  const db = getServiceDb()!;
  if (!storeProductId) return null;
  const { data } = await db
    .from("store_products")
    .select(
      "package_version_id, monetization_package_versions (id, coins_amount, bonus_coins_amount, price_amount, platform_fee_percent, creator_share_percent, monetization_packages (type, code))"
    )
    .eq("store_product_id", storeProductId)
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const version = data.monetization_package_versions as unknown as {
    id: string;
    coins_amount: number | null;
    bonus_coins_amount: number | null;
    price_amount: number;
    platform_fee_percent: number;
    creator_share_percent: number;
    monetization_packages: { type: string; code: string } | null;
  } | null;
  if (!version) return null;
  return {
    packageVersionId: version.id,
    packageType: version.monetization_packages?.type ?? "coin_pack",
    packageCode: version.monetization_packages?.code ?? "",
    coinsAmount: version.coins_amount,
    bonusCoinsAmount: version.bonus_coins_amount,
    priceAmount: Number(version.price_amount),
    platformFeePercent: Number(version.platform_fee_percent),
    creatorSharePercent: Number(version.creator_share_percent)
  };
}

async function upsertPurchase(
  event: RevenueCatEvent,
  profileId: string,
  product: ProductMapping | null,
  status: "completed" | "refunded" | "revoked" | "cancelled"
): Promise<string | null> {
  const db = getServiceDb()!;
  const platform = event.product_id?.includes(".") ? "ios" : "android"; // refined by store below
  const { data, error } = await db
    .from("purchases")
    .upsert(
      {
        profile_id: profileId,
        package_version_id: product?.packageVersionId ?? null,
        platform,
        store_product_id: event.product_id ?? "unknown",
        store_transaction_id: event.transaction_id ?? event.id,
        status,
        price_amount: event.price ?? product?.priceAmount ?? 0,
        currency: event.currency ?? "USD",
        coins_credited:
          status === "completed" && product?.coinsAmount
            ? product.coinsAmount + (product.bonusCoinsAmount ?? 0)
            : null
      },
      { onConflict: "platform,store_transaction_id" }
    )
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[revenuecat] purchase upsert failed", error.message);
    return null;
  }
  return data?.id ?? null;
}

async function creditCoins(
  event: RevenueCatEvent,
  profileId: string,
  product: ProductMapping,
  purchaseId: string | null
): Promise<string> {
  const db = getServiceDb()!;
  const totalCoins = (product.coinsAmount ?? 0) + (product.bonusCoinsAmount ?? 0);
  if (totalCoins <= 0) return "no coins on product";

  let { data: wallet } = await db.from("wallets").select("id, coin_balance").eq("profile_id", profileId).maybeSingle();
  if (!wallet) {
    const { data: created } = await db
      .from("wallets")
      .insert({ profile_id: profileId })
      .select("id, coin_balance")
      .single();
    wallet = created!;
  }

  // Idempotent credit: the coin transaction key is derived from the event id.
  const { error } = await db.from("coin_transactions").insert({
    wallet_id: wallet.id,
    type: "purchase",
    amount: totalCoins,
    label: `${product.packageCode} purchase`,
    related_purchase_id: purchaseId,
    idempotency_key: `rc:${event.id}`
  });
  if (error) {
    if (error.code === "23505") return "duplicate credit skipped";
    throw new Error(error.message);
  }
  await db.from("wallets").update({ coin_balance: wallet.coin_balance + totalCoins }).eq("id", wallet.id);
  return `credited ${totalCoins} coins`;
}

async function reverseCoins(event: RevenueCatEvent, profileId: string, product: ProductMapping): Promise<string> {
  const db = getServiceDb()!;
  const totalCoins = (product.coinsAmount ?? 0) + (product.bonusCoinsAmount ?? 0);
  if (totalCoins <= 0) return "no coins to reverse";

  const { data: wallet } = await db.from("wallets").select("id, coin_balance").eq("profile_id", profileId).maybeSingle();
  if (!wallet) return "no wallet";

  const { error } = await db.from("coin_transactions").insert({
    wallet_id: wallet.id,
    type: "reversal",
    amount: -totalCoins,
    label: `${product.packageCode} refund reversal`,
    idempotency_key: `rc-reversal:${event.id}`
  });
  if (error) {
    if (error.code === "23505") return "duplicate reversal skipped";
    throw new Error(error.message);
  }
  // Balances never go below zero even if coins were already spent.
  await db
    .from("wallets")
    .update({ coin_balance: Math.max(0, wallet.coin_balance - totalCoins) })
    .eq("id", wallet.id);
  return `reversed ${totalCoins} coins`;
}

function tierFromCode(code: string): "support" | "plus" | "premium" {
  if (code.includes("premium")) return "premium";
  if (code.includes("plus")) return "plus";
  return "support";
}

async function activateMembership(
  event: RevenueCatEvent,
  profileId: string,
  product: ProductMapping,
  status: "active" | "grace_period"
): Promise<string> {
  const db = getServiceDb()!;
  // Creator attribution for tier subscriptions arrives via subscriber
  // attributes in a full integration; V1 memberships are platform-scoped
  // until the purchase flow passes the creator id through RevenueCat
  // attributes. Store with a null-safe lookup.
  const creatorId = await resolveSubscribedCreator(event, profileId);
  if (!creatorId) return "no creator attribution; membership pending attribution";

  const { error } = await db.from("creator_memberships").upsert(
    {
      profile_id: profileId,
      creator_id: creatorId,
      tier: tierFromCode(product.packageCode),
      status,
      platform: "ios",
      store_product_id: event.product_id,
      renews_at: event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null
    },
    { onConflict: "profile_id,creator_id" }
  );
  if (error) throw new Error(error.message);
  return `membership ${status} (${product.packageCode})`;
}

async function endMembership(
  event: RevenueCatEvent,
  profileId: string,
  status: "cancelled" | "expired"
): Promise<string> {
  const db = getServiceDb()!;
  const { error } = await db
    .from("creator_memberships")
    .update({
      status,
      cancelled_at: status === "cancelled" ? new Date().toISOString() : undefined,
      expires_at: event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : new Date().toISOString()
    })
    .eq("profile_id", profileId)
    .eq("store_product_id", event.product_id ?? "");
  if (error) throw new Error(error.message);
  return `membership ${status}`;
}

/**
 * Resolves which creator a subscription belongs to. The client sets the
 * "intended_creator" subscriber attribute before purchase; RevenueCat
 * forwards it in `subscriber_attributes`.
 */
async function resolveSubscribedCreator(event: RevenueCatEvent, _profileId: string): Promise<string | null> {
  const attributes = (event as { subscriber_attributes?: Record<string, { value?: string }> })
    .subscriber_attributes;
  const creatorId = attributes?.intended_creator?.value;
  if (!creatorId) return null;
  const db = getServiceDb()!;
  const { data } = await db.from("creators").select("id").eq("id", creatorId).maybeSingle();
  return data?.id ?? null;
}

export async function processRevenueCatEvent(event: RevenueCatEvent): Promise<ProcessResult> {
  const db = getServiceDb();
  if (!db) return { status: "skipped", detail: "backend not configured" };

  const profileId = await resolveProfileId(event.app_user_id);
  if (!profileId) {
    return { status: "skipped", detail: `unknown app_user_id ${event.app_user_id}` };
  }

  const product = await resolveProduct(event.product_id);

  try {
    switch (event.type) {
      case "INITIAL_PURCHASE":
      case "RENEWAL":
      case "NON_RENEWING_PURCHASE": {
        const purchaseId = await upsertPurchase(event, profileId, product, "completed");
        if (product?.packageType === "coin_pack" || product?.packageType === "boost_pack") {
          const detail = await creditCoins(event, profileId, product, purchaseId);
          return { status: "processed", detail };
        }
        if (product?.packageType === "creator_subscription_tier") {
          const detail = await activateMembership(event, profileId, product, "active");
          return { status: "processed", detail };
        }
        return { status: "processed", detail: "purchase recorded (unmapped product)" };
      }
      case "CANCELLATION": {
        const detail = await endMembership(event, profileId, "cancelled");
        return { status: "processed", detail };
      }
      case "EXPIRATION": {
        const detail = await endMembership(event, profileId, "expired");
        return { status: "processed", detail };
      }
      case "BILLING_ISSUE": {
        if (product?.packageType === "creator_subscription_tier") {
          const detail = await activateMembership(event, profileId, product, "grace_period");
          return { status: "processed", detail };
        }
        return { status: "processed", detail: "billing issue noted" };
      }
      case "REFUND":
      case "REFUND_REVERSED":
      case "REVOKED": {
        await upsertPurchase(event, profileId, product, event.type === "REFUND" ? "refunded" : "revoked");
        if (product?.packageType === "coin_pack" || product?.packageType === "boost_pack") {
          const detail = await reverseCoins(event, profileId, product);
          return { status: "processed", detail };
        }
        if (product?.packageType === "creator_subscription_tier") {
          const detail = await endMembership(event, profileId, "expired");
          // Revoke membership-derived entitlements.
          await db
            .from("creator_membership_entitlements")
            .update({ revoked_at: new Date().toISOString() })
            .eq("profile_id", profileId)
            .eq("source", "membership")
            .is("revoked_at", null);
          return { status: "processed", detail: `${detail}; entitlements revoked` };
        }
        return { status: "processed", detail: "refund recorded" };
      }
      case "TEST":
        return { status: "processed", detail: "test event acknowledged" };
      default:
        return { status: "skipped", detail: `unhandled event type ${event.type}` };
    }
  } catch (error) {
    return { status: "error", detail: error instanceof Error ? error.message : "processing failed" };
  }
}
