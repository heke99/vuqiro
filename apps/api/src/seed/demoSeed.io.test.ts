import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { cleanupDemoSeed, runDemoSeed } from "./demoSeed";
import { buildDemoPlan, DEMO_SEED_BATCH } from "./demoSeedData";

/**
 * IO-level seed tests against an in-memory fake of the Supabase client that
 * implements the exact query-builder surface the seed uses (select/insert/
 * update/upsert/delete + eq/in/maybeSingle, auth.admin create/delete with the
 * profile-creation trigger and FK cascades). This proves the seed is
 * idempotent, marks everything demo/synthetic, touches no monetization
 * tables and that cleanup removes every seeded row — without needing a
 * running database.
 */

type Row = Record<string, unknown>;

class FakeDb {
  tables = new Map<string, Row[]>();
  authUsers = new Map<string, { id: string; email: string; metadata: Record<string, string> }>();
  touchedTables = new Set<string>();

  rows(table: string): Row[] {
    if (!this.tables.has(table)) this.tables.set(table, []);
    return this.tables.get(table)!;
  }

  createAuthUser(email: string, metadata: Record<string, string>): { id: string } {
    const id = randomUUID();
    this.authUsers.set(id, { id, email, metadata });
    // Mirrors public.handle_new_auth_user(): a profile row per auth user.
    this.rows("profiles").push({
      id: randomUUID(),
      auth_user_id: id,
      handle: metadata.handle,
      display_name: metadata.display_name,
      seed_batch: null
    });
    return { id };
  }

  deleteAuthUser(id: string): void {
    this.authUsers.delete(id);
    // FK cascade: profiles -> creators -> videos -> memberships.
    const profileIds = this.rows("profiles")
      .filter((row) => row.auth_user_id === id)
      .map((row) => row.id);
    this.tables.set("profiles", this.rows("profiles").filter((row) => row.auth_user_id !== id));
    const creatorIds = this.rows("creators")
      .filter((row) => profileIds.includes(row.profile_id))
      .map((row) => row.id);
    this.tables.set("creators", this.rows("creators").filter((row) => !profileIds.includes(row.profile_id)));
    this.tables.set("creator_profiles", this.rows("creator_profiles").filter((row) => !creatorIds.includes(row.creator_id)));
    this.tables.set("videos", this.rows("videos").filter((row) => !creatorIds.includes(row.creator_id)));
    this.tables.set(
      "creator_memberships",
      this.rows("creator_memberships").filter(
        (row) => !profileIds.includes(row.profile_id) && !creatorIds.includes(row.creator_id)
      )
    );
  }
}

type Filter = { kind: "eq"; column: string; value: unknown } | { kind: "in"; column: string; values: unknown[] };

class FakeQuery implements PromiseLike<{ data: unknown; count: number | null; error: null }> {
  private filters: Filter[] = [];
  private operation: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private payload: Row | Row[] | null = null;
  private onConflict: string[] = [];
  private single = false;

  constructor(
    private readonly db: FakeDb,
    private readonly table: string
  ) {}

  select(_columns?: string, _options?: unknown): this {
    return this;
  }
  insert(payload: Row | Row[]): this {
    this.operation = "insert";
    this.payload = payload;
    this.db.touchedTables.add(this.table);
    return this;
  }
  update(payload: Row): this {
    this.operation = "update";
    this.payload = payload;
    this.db.touchedTables.add(this.table);
    return this;
  }
  upsert(payload: Row | Row[], options?: { onConflict?: string }): this {
    this.operation = "upsert";
    this.payload = payload;
    this.onConflict = options?.onConflict?.split(",").map((column) => column.trim()) ?? ["id"];
    this.db.touchedTables.add(this.table);
    return this;
  }
  delete(_options?: unknown): this {
    this.operation = "delete";
    this.db.touchedTables.add(this.table);
    return this;
  }
  eq(column: string, value: unknown): this {
    this.filters.push({ kind: "eq", column, value });
    return this;
  }
  in(column: string, values: unknown[]): this {
    this.filters.push({ kind: "in", column, values });
    return this;
  }
  maybeSingle(): this {
    this.single = true;
    return this;
  }

  private matches(row: Row): boolean {
    return this.filters.every((filter) =>
      filter.kind === "eq" ? row[filter.column] === filter.value : filter.values.includes(row[filter.column])
    );
  }

  private run(): { data: unknown; count: number | null; error: null } {
    const rows = this.db.rows(this.table);
    switch (this.operation) {
      case "select": {
        const matched = rows.filter((row) => this.matches(row));
        return { data: this.single ? (matched[0] ?? null) : matched, count: matched.length, error: null };
      }
      case "insert": {
        const toInsert = Array.isArray(this.payload) ? this.payload : [this.payload!];
        rows.push(...toInsert.map((row) => ({ ...row })));
        return { data: null, count: toInsert.length, error: null };
      }
      case "update": {
        let updated = 0;
        for (const row of rows) {
          if (this.matches(row)) {
            Object.assign(row, this.payload);
            updated += 1;
          }
        }
        return { data: null, count: updated, error: null };
      }
      case "upsert": {
        const toUpsert = Array.isArray(this.payload) ? this.payload : [this.payload!];
        for (const incoming of toUpsert) {
          const existing = rows.find((row) => this.onConflict.every((column) => row[column] === incoming[column]));
          if (existing) {
            Object.assign(existing, incoming);
          } else {
            rows.push({ id: randomUUID(), ...incoming });
          }
        }
        return { data: null, count: toUpsert.length, error: null };
      }
      case "delete": {
        const remaining = rows.filter((row) => !this.matches(row));
        const deleted = rows.length - remaining.length;
        this.db.tables.set(this.table, remaining);
        return { data: null, count: deleted, error: null };
      }
    }
  }

  then<TResult1, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; count: number | null; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }
}

function fakeSupabase(db: FakeDb): SupabaseClient {
  return {
    from: (table: string) => new FakeQuery(db, table),
    auth: {
      admin: {
        createUser: async (params: { email: string; user_metadata: Record<string, string> }) => {
          const user = db.createAuthUser(params.email, params.user_metadata);
          return { data: { user }, error: null };
        },
        deleteUser: async (id: string) => {
          db.deleteAuthUser(id);
          return { data: {}, error: null };
        }
      }
    }
  } as unknown as SupabaseClient;
}

const MONETIZATION_TABLES = [
  "creator_revenue_ledger",
  "platform_revenue_ledger",
  "purchases",
  "creator_payouts",
  "ad_campaigns",
  "ad_impressions",
  "ad_billing_events",
  "wallets",
  "coin_transactions"
];

describe("demo seed IO (fake supabase)", () => {
  it("creates creators, videos, users, memberships and synthetic events", async () => {
    const db = new FakeDb();
    const summary = await runDemoSeed(fakeSupabase(db), buildDemoPlan());

    expect(summary.profiles.created).toBe(15); // 12 creators + 3 users
    expect(summary.creators.created).toBe(12);
    expect(summary.videos.created).toBe(120);
    expect(summary.memberships.created).toBe(2);
    expect(summary.syntheticEvents.created).toBeGreaterThan(0);
    expect(summary.skippedReasons).toEqual([]);

    for (const video of db.rows("videos")) {
      expect(video.is_demo).toBe(true);
      expect(video.seed_batch).toBe(DEMO_SEED_BATCH);
    }
    for (const membership of db.rows("creator_memberships")) {
      expect(membership.is_demo).toBe(true);
      expect(membership.status).toBe("active");
    }
    for (const event of db.rows("video_events")) {
      expect(event.is_synthetic).toBe(true);
      expect(event.seed_batch).toBe(DEMO_SEED_BATCH);
    }
  });

  it("is idempotent: reruns update in place, never duplicate", async () => {
    const db = new FakeDb();
    const client = fakeSupabase(db);
    await runDemoSeed(client, buildDemoPlan());
    const firstCounts = {
      profiles: db.rows("profiles").length,
      creators: db.rows("creators").length,
      videos: db.rows("videos").length,
      memberships: db.rows("creator_memberships").length,
      events: db.rows("video_events").length
    };

    const rerun = await runDemoSeed(client, buildDemoPlan());
    expect(rerun.profiles.created).toBe(0);
    expect(rerun.profiles.updated).toBe(15);
    expect(rerun.videos.created).toBe(0);
    expect(rerun.videos.updated).toBe(120);
    expect(rerun.memberships.created).toBe(0);
    expect({
      profiles: db.rows("profiles").length,
      creators: db.rows("creators").length,
      videos: db.rows("videos").length,
      memberships: db.rows("creator_memberships").length,
      events: db.rows("video_events").length
    }).toEqual(firstCounts);
  });

  it("never writes to monetization/payout/ad tables", async () => {
    const db = new FakeDb();
    await runDemoSeed(fakeSupabase(db), buildDemoPlan());
    for (const table of MONETIZATION_TABLES) {
      expect(db.touchedTables.has(table), table).toBe(false);
      expect(db.rows(table).length, table).toBe(0);
    }
  });

  it("skips handles that belong to non-demo (real) accounts", async () => {
    const db = new FakeDb();
    db.rows("profiles").push({
      id: randomUUID(),
      auth_user_id: randomUUID(),
      handle: "demo_forkful",
      display_name: "A Real Person Who Took This Handle",
      seed_batch: null
    });
    const summary = await runDemoSeed(fakeSupabase(db), buildDemoPlan());
    expect(summary.profiles.skipped).toBe(1);
    expect(summary.skippedReasons.some((reason) => reason.includes("demo_forkful"))).toBe(true);
    // The real profile is untouched.
    const real = db.rows("profiles").find((row) => row.handle === "demo_forkful")!;
    expect(real.display_name).toBe("A Real Person Who Took This Handle");
    expect(real.is_demo).toBeUndefined();
  });

  it("cleanup removes every seeded row (and only seeded rows)", async () => {
    const db = new FakeDb();
    const client = fakeSupabase(db);
    // A pre-existing real user must survive cleanup.
    db.createAuthUser("real@person.example", { handle: "real_person", display_name: "Real Person" });

    await runDemoSeed(client, buildDemoPlan());
    expect(db.rows("videos").length).toBe(120);

    const cleanup = await cleanupDemoSeed(client, DEMO_SEED_BATCH);
    expect(cleanup.authUsersDeleted).toBe(15);
    expect(db.rows("videos").length).toBe(0);
    expect(db.rows("creators").length).toBe(0);
    expect(db.rows("creator_memberships").length).toBe(0);
    expect(db.rows("video_events").length).toBe(0);
    expect(db.rows("profiles").map((row) => row.handle)).toEqual(["real_person"]);
  });
});
