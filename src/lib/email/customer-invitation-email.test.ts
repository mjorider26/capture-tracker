import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  CustomerInvitationEmailError,
  customerInvitationSender,
  sendCustomerInvitationEmail,
} from "./customer-invitation-email";

const input = {
  recipientEmail: "fictional@example.test",
  ownerDisplayName: "Fictional Owner",
  businessDisplayName: "Fictional Consulting",
  expiresAt: new Date("2026-08-18T16:00:00Z"),
  invitationUrl: "https://example.test/invite/fictional-token",
};

describe("customer invitation email adapter", () => {
  it("sets recipient, sender, subject, HTML, and text exclusively on the server", async () => {
    const send = vi.fn().mockResolvedValue({ messageId: "message_123" });
    await expect(sendCustomerInvitationEmail(input, { send })).resolves.toEqual(
      { provider: "CLOUDFLARE_EMAIL_SERVICE", messageId: "message_123" },
    );
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: input.recipientEmail,
        from: { email: customerInvitationSender, name: "Capture Tracker" },
        subject: "You’re invited to Capture Tracker",
        html: expect.stringContaining("Set Up My Account"),
        text: expect.stringContaining(input.invitationUrl),
      }),
    );
  });

  it("fails closed when the binding is unavailable", async () => {
    await expect(sendCustomerInvitationEmail(input, undefined)).rejects.toEqual(
      new CustomerInvitationEmailError("BINDING_UNAVAILABLE"),
    );
  });

  it.each([
    ["E_RECIPIENT_SUPPRESSED", "RECIPIENT_REJECTED"],
    ["E_SENDER_NOT_VERIFIED", "SENDER_CONFIGURATION"],
    ["E_DAILY_LIMIT_EXCEEDED", "RATE_LIMITED"],
    ["E_INTERNAL_SERVER_ERROR", "TRANSIENT_PROVIDER_FAILURE"],
    ["unexpected", "PROVIDER_REJECTED"],
  ])("sanitizes provider error %s", async (providerCode, expected) => {
    const send = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error("provider detail must not persist"), {
          code: providerCode,
        }),
      );
    await expect(
      sendCustomerInvitationEmail(input, { send }),
    ).rejects.toMatchObject({ code: expected });
  });
});
