import { beforeEach, describe, expect, it } from "vitest";
import { getMockAuditTrail } from "../lib/audit";
import { resetRateLimits } from "../lib/rateLimit";
import { createApp } from "../app";

const app = createApp();
const adminHeaders = { authorization: "Bearer admin", "content-type": "application/json" };
const userHeaders = { authorization: "Bearer user", "content-type": "application/json" };

beforeEach(() => resetRateLimits());

describe("moderation decisions", () => {
  it("requires admin auth", async () => {
    const res = await app.request("/admin/moderation/cases/mod_001/decide", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "remove_content" })
    });
    expect(res.status).toBe(401);
  });

  it("rejects invalid actions", async () => {
    const res = await app.request("/admin/moderation/cases/mod_001/decide", {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ action: "vaporize" })
    });
    expect(res.status).toBe(400);
  });

  it("resolves cases and audit-logs every decision", async () => {
    const before = getMockAuditTrail().length;
    const res = await app.request("/admin/moderation/cases/mod_001/decide", {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ action: "remove_content", note: "clear violation" })
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; action: string };
    expect(body.status).toBe("resolved");
    expect(body.action).toBe("remove_content");
    const trail = getMockAuditTrail();
    expect(trail.length).toBe(before + 1);
    expect(trail[trail.length - 1].action).toBe("moderation_remove_content");
  });

  it("supports every spec action", async () => {
    const actions = [
      "no_action",
      "limit_distribution",
      "remove_content",
      "age_restrict",
      "suspend_user",
      "ban_user",
      "hold_payout",
      "release_payout",
      "restore_content"
    ];
    for (const action of actions) {
      const res = await app.request("/admin/moderation/cases/mod_00x/decide", {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({ action })
      });
      expect(res.status, action).toBe(200);
    }
  });

  it("returns case detail", async () => {
    const res = await app.request("/admin/moderation/cases/mod_001", { headers: adminHeaders });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { case: { id: string } };
    expect(body.case.id).toBe("mod_001");
  });

  it("supports reopening cases", async () => {
    const res = await app.request("/admin/moderation/cases/mod_001/reopen", {
      method: "POST",
      headers: adminHeaders
    });
    expect(res.status).toBe(200);
  });
});

describe("appeals", () => {
  it("requires auth", async () => {
    const res = await app.request("/appeals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ caseId: "mod_008", message: "This decision was a mistake." })
    });
    expect(res.status).toBe(401);
  });

  it("requires a meaningful message", async () => {
    const res = await app.request("/appeals", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ caseId: "mod_008", message: "no" })
    });
    expect(res.status).toBe(400);
  });

  it("accepts valid appeals", async () => {
    const res = await app.request("/appeals", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ caseId: "mod_008", message: "My video was educational, please re-review." })
    });
    expect(res.status).toBe(201);
  });

  it("requires caseId or videoId", async () => {
    const res = await app.request("/appeals", {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({ message: "Please review this decision again." })
    });
    expect(res.status).toBe(400);
  });
});
