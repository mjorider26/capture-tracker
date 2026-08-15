import { describe, expect, it } from "vitest";
import { vi } from "vitest";
vi.mock("server-only", () => ({}));
import { invitationEmail, setupCompleteEmail } from "./transactional-templates";

describe("transactional templates", () => {
  it("escapes invitation content and keeps the action link intact", () => {
    const email = invitationEmail({
      ownerDisplayName: "<Owner>",
      businessDisplayName: "A & B",
      recipientEmail: "client+invite@example.test",
      expiresAt: new Date("2026-08-10T12:00:00Z"),
      invitationUrl: "https://example.test/invite/one-time",
      logoUrl: "https://example.test/brand/logo.png",
    });
    expect(email.subject).toBe("You’re invited to Capture Tracker");
    expect(email.html).toContain("&lt;Owner&gt;");
    expect(email.html).toContain("A &amp; B");
    expect(email.html).toContain("client+invite@example.test");
    expect(email.html).toContain("https://example.test/invite/one-time");
    expect(email.html).toContain("Set Up My Account");
    expect(email.text).toContain(
      "Set Up My Account: https://example.test/invite/one-time",
    );
    expect(email.text).toContain("PDT");
    expect(email.html).not.toContain("database");
  });
  it("remains single-column and useful without the optional logo", () => {
    const email = invitationEmail({
      ownerDisplayName:
        "A very long customer owner name that still needs readable email",
      businessDisplayName:
        "A very long consulting workspace name & advisory services",
      recipientEmail: "fictional@example.test",
      expiresAt: new Date("2026-12-10T20:15:00Z"),
      invitationUrl: "https://example.test/invite/fictional",
    });
    expect(email.html).toContain('name="viewport"');
    expect(email.html).toContain("max-width:600px");
    expect(email.html).toContain("CAPTURE TRACKER");
    expect(email.html).not.toContain("<table");
    expect(email.text).toContain(
      "A very long consulting workspace name & advisory services",
    );
  });
  it("adds founding treatment only when requested", () => {
    expect(
      setupCompleteEmail({
        ownerDisplayName: "Owner",
        businessDisplayName: "Example Corp",
        todayUrl: "https://example.test/app/today",
        installUrl: "https://example.test/install",
        foundingCustomer: true,
      }).text,
    ).toContain("Customer #001");
    expect(
      setupCompleteEmail({
        ownerDisplayName: "Owner",
        businessDisplayName: "Example Corp",
        todayUrl: "https://example.test/app/today",
        installUrl: "https://example.test/install",
        foundingCustomer: false,
      }).text,
    ).not.toContain("Customer #001");
  });
});
