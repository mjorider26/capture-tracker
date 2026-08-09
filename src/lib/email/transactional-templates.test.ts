import { describe, expect, it } from "vitest";
import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import { invitationEmail, setupCompleteEmail } from "./transactional-templates";

describe("transactional templates", () => {
  it("escapes invitation content and keeps the action link intact", () => {
    const email = invitationEmail({ ownerDisplayName: "<Owner>", businessDisplayName: "A & B", expiresAt: new Date("2026-08-10T12:00:00Z"), invitationUrl: "https://example.test/invite/one-time" });
    expect(email.subject).toBe("You’re invited to Capture Tracker");
    expect(email.html).toContain("&lt;Owner&gt;");
    expect(email.html).toContain("https://example.test/invite/one-time");
    expect(email.html).not.toContain("database");
  });
  it("adds founding treatment only when requested", () => {
    expect(setupCompleteEmail({ ownerDisplayName: "Owner", businessDisplayName: "Example Corp", todayUrl: "https://example.test/app/today", installUrl: "https://example.test/install", foundingCustomer: true }).text).toContain("Customer #001");
    expect(setupCompleteEmail({ ownerDisplayName: "Owner", businessDisplayName: "Example Corp", todayUrl: "https://example.test/app/today", installUrl: "https://example.test/install", foundingCustomer: false }).text).not.toContain("Customer #001");
  });
});
