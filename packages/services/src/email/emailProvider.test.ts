import { describe, expect, it } from "vitest";
import { MockEmailProvider } from "./mockEmailProvider";

describe("mock email provider", () => {
  it("records sent messages and returns ok receipts", async () => {
    const provider = new MockEmailProvider();
    const receipts = await provider.send([
      { to: "user@example.com", subject: "Hello", text: "Body" },
      { to: "other@example.com", subject: "Hi", text: "Body 2" }
    ]);
    expect(receipts).toHaveLength(2);
    expect(receipts.every((receipt) => receipt.status === "ok")).toBe(true);
    expect(receipts.every((receipt) => receipt.messageId)).toBeTruthy();
    expect(provider.sent).toHaveLength(2);
  });

  it("reports mock health", async () => {
    const provider = new MockEmailProvider();
    const health = await provider.healthCheck();
    expect(health.provider).toBe("email");
    expect(health.status).toBe("mock");
  });
});
