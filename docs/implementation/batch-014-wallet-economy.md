# Batch 14 — Wallet, coins, unlocks, tips and boosts

Status: complete

## What changed

- **Atomic wallet functions** (migration `20260702100500_wallet_functions.sql`):
  - `wallet_spend` — row-locks the wallet (`FOR UPDATE`), rejects overdraws
    (balance can never go negative, also backed by the table CHECK),
    idempotent on key (replays return `duplicate=true` without re-deducting),
    writes the coin transaction in the same DB transaction.
  - `wallet_credit` — atomic idempotent credits (purchases/refunds/admin).
  - `wallet_reverse` — refund clawbacks that floor at zero.
  - `boost_campaigns` table (RLS: purchaser/admin read) + `coins_to_usd`.
- **API flows rebuilt on the atomic functions**:
  - **Tip**: creator existence + active-status check → `wallet_spend` →
    creator **revenue ledger entry** (100 coins = $1.00 gross, 20% platform
    + 15% store fee split) → creator **notification** (respecting
    notification preferences).
  - **Unlock**: server-verified price, duplicate-entitlement short-circuit,
    `wallet_spend`, entitlement insert, ledger + notification.
  - **Boost** (new): moderation eligibility gate — only `visible`,
    safety ≥ 80, zero-report videos can be boosted; `wallet_spend` then a
    `boost_campaigns` record. Boost campaigns feed the ranking engine's
    boost factor (normalized by spend), which itself refuses boosts on
    non-eligible content — double enforcement.
  - RevenueCat coin credits/reversals now run through
    `wallet_credit`/`wallet_reverse` (atomic + idempotent, replacing the
    read-modify-write from Batch 13).
- **Ledger integrity tests at the database level**:
  `scripts/validate-migrations.sh` now asserts against real Postgres —
  spend deducts, replayed key doesn't double-deduct, overdraw is rejected
  without balance change, credit is idempotent, reversal floors at zero.
- API tests for the endpoint contracts: auth, amount validation, idempotency
  key requirements on all three spend paths, boost rate limiting, and the
  revenue-split math (fees + non-negative nets).

## Verification

```bash
pnpm lint && pnpm typecheck && pnpm test   # 86 api tests
bash scripts/validate-migrations.sh        # wallet function assertions pass
```

## Acceptance criteria

- [x] coins cannot go negative (CHECK constraint + locked balance checks)
- [x] duplicate purchase/webhook does not double-credit (idempotent functions)
- [x] unlock entitlement works
- [x] tips update creator ledger
- [x] boosts require moderation eligibility (endpoint gate + ranking gate)
- [x] refunds/reversals update balances safely (atomic, floored at zero)
