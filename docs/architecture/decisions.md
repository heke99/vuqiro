# Architecture Decisions

Running log of significant technical decisions for Vuqiro. Newest first.

## ADR-005: Vitest as the test runner

All workspaces expose a `test` script (`vitest run --passWithNoTests`) so
`pnpm -r test` and CI stay green while coverage grows batch by batch.

## ADR-004: Expo Router for mobile navigation

The initial prototype used manual state navigation in `App.tsx`. We migrate to
Expo Router (Batch 2) for file-based routes, deep linking, and web support.

## ADR-003: Dedicated API service (`apps/api`, Hono)

Clients talk to Supabase directly (under RLS) for simple reads. Everything
that must not trust the client — entitlements, wallet mutations, payouts,
moderation actions, provider webhooks (RevenueCat, Stripe, Mux) — goes through
`apps/api`, which is the only holder of the Supabase service-role key. Hono
was chosen for its small footprint, first-class TypeScript, and web-standard
request/response (portable to edge runtimes later).

## ADR-002: Mux as the managed video provider

Chosen over Cloudflare Stream and Bunny Stream because it offers direct
uploads, signed playback tokens (needed for server-protected locked content),
webhooks with signature verification, and automatic thumbnails/HLS. The
integration lives behind the `VideoProvider` interface in `packages/services`
with a `MockVideoProvider` fallback, so switching providers is a contained
change and the app runs without credentials.

## ADR-001: Provider adapters with mock fallbacks

Every external provider (video, payments, payouts) is used through an
interface in `packages/services` with a mock implementation. The entire
product must boot and be navigable with zero secrets configured; real
providers activate via environment variables (see `.env.example`).
