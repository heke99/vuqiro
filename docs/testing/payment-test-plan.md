# Payment Test Plan (RevenueCat sandbox)

Prerequisites 🔑: EAS development build installed, RevenueCat project with
store products, sandbox tester accounts (Apple) / license testers (Google),
`EXPO_PUBLIC_REVENUECAT_*` + `REVENUECAT_WEBHOOK_SECRET` configured, API
reachable, webhook registered in RevenueCat pointing at
`POST {API_BASE_URL}/revenuecat/webhook`.

## Subscriptions

| # | Test | Expected |
|---|---|---|
| 1 | Open subscribe modal | Offerings load; prices are store-localized |
| 2 | Purchase Support monthly (sandbox) | Store sheet completes; success message |
| 3 | Webhook INITIAL_PURCHASE | `purchases` row completed; `creator_memberships` active with correct tier + creator (intended_creator attribute) |
| 4 | Watch a subscribers-only video of that creator | `GET /videos/:id/access` grants with playback URL |
| 5 | Sandbox auto-renew (accelerated) | RENEWAL event → membership `renews_at` updated |
| 6 | Cancel in store settings | CANCELLATION → membership `cancelled`; access continues until expiry |
| 7 | Let it expire | EXPIRATION → membership `expired`; access check returns 403 |
| 8 | Billing issue simulation | BILLING_ISSUE → `grace_period`; access still granted |

## Coins

| # | Test | Expected |
|---|---|---|
| 9 | Purchase coins.500 | NON_RENEWING_PURCHASE → +525 coins (bonus applied) exactly once |
| 10 | Replay the same webhook event (RevenueCat retry) | `duplicate: true`; balance unchanged |
| 11 | Tip 100 coins | Balance −100; creator ledger entry (gross $1.00 / net $0.65); creator notified |
| 12 | Unlock a coin-locked video | Entitlement created; access check grants; second unlock attempt → duplicate, no charge |
| 13 | Attempt tip > balance | 400 insufficient balance; balance unchanged |
| 14 | Refund the coin purchase (store) | REFUND → coins reversed (floor at 0); purchase `refunded` |

## Restore & edge cases

| # | Test | Expected |
|---|---|---|
| 15 | Restore purchases (Settings) on a re-install | Active entitlements restored; count shown |
| 16 | Purchase cancelled mid-sheet | No success message; no server-side changes |
| 17 | Webhook with wrong secret | 401; nothing stored |
| 18 | Airplane-mode purchase retry | No double-crediting after reconnect |

## Sign-off

All 18 cases pass on both platforms → record build IDs + dates in
go-live-checklist.md.
