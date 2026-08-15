import "server-only";

import { invitationEmail } from "./transactional-templates";

export const customerInvitationEmailProvider = "CLOUDFLARE_EMAIL_SERVICE";
export const customerInvitationSender = "welcome@capturetracker.app";

type EmailAddress = { email: string; name?: string };
type EmailMessageBuilder = {
  to: string | EmailAddress;
  from: string | EmailAddress;
  subject: string;
  html?: string;
  text?: string;
};
export type CustomerInvitationEmailBinding = {
  send(message: EmailMessageBuilder): Promise<{ messageId: string }>;
};
export type CustomerInvitationEmailInput = {
  recipientEmail: string;
  ownerDisplayName: string;
  businessDisplayName: string;
  expiresAt: Date;
  invitationUrl: string;
  logoUrl?: string;
};
export type CustomerInvitationEmailResult = {
  provider: typeof customerInvitationEmailProvider;
  messageId: string | null;
};
export type CustomerInvitationEmailFailureCode =
  | "BINDING_UNAVAILABLE"
  | "INVALID_MESSAGE"
  | "RECIPIENT_REJECTED"
  | "SENDER_CONFIGURATION"
  | "RATE_LIMITED"
  | "TRANSIENT_PROVIDER_FAILURE"
  | "PROVIDER_REJECTED";

export class CustomerInvitationEmailError extends Error {
  constructor(public readonly code: CustomerInvitationEmailFailureCode) {
    super(code);
    this.name = "CustomerInvitationEmailError";
  }
}

export async function sendCustomerInvitationEmail(
  input: CustomerInvitationEmailInput,
  binding:
    CustomerInvitationEmailBinding | undefined = cloudflareEmailBinding(),
): Promise<CustomerInvitationEmailResult> {
  if (!binding) throw new CustomerInvitationEmailError("BINDING_UNAVAILABLE");
  const template = invitationEmail(input);
  try {
    const result = await binding.send({
      to: input.recipientEmail,
      from: { email: customerInvitationSender, name: "Capture Tracker" },
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
    return {
      provider: customerInvitationEmailProvider,
      messageId: safeMessageId(result.messageId),
    };
  } catch (error) {
    if (error instanceof CustomerInvitationEmailError) throw error;
    throw new CustomerInvitationEmailError(classifyProviderError(error));
  }
}

function cloudflareEmailBinding() {
  const context = (
    globalThis as typeof globalThis & {
      [key: symbol]:
        | {
            env?: CloudflareEnv & {
              CAPTURE_TRACKER_TRANSACTIONAL_EMAIL?: CustomerInvitationEmailBinding;
            };
          }
        | undefined;
    }
  )[Symbol.for("__cloudflare-context__")];
  return context?.env?.CAPTURE_TRACKER_TRANSACTIONAL_EMAIL;
}

function classifyProviderError(
  error: unknown,
): CustomerInvitationEmailFailureCode {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : "";
  if (
    ["E_VALIDATION_ERROR", "E_FIELD_MISSING", "E_CONTENT_TOO_LARGE"].includes(
      code,
    )
  )
    return "INVALID_MESSAGE";
  if (
    [
      "E_RECIPIENT_NOT_ALLOWED",
      "E_RECIPIENT_SUPPRESSED",
      "E_DELIVERY_FAILED",
    ].includes(code)
  )
    return "RECIPIENT_REJECTED";
  if (["E_SENDER_NOT_VERIFIED", "E_SENDER_DOMAIN_NOT_AVAILABLE"].includes(code))
    return "SENDER_CONFIGURATION";
  if (["E_RATE_LIMIT_EXCEEDED", "E_DAILY_LIMIT_EXCEEDED"].includes(code))
    return "RATE_LIMITED";
  if (code === "E_INTERNAL_SERVER_ERROR") return "TRANSIENT_PROVIDER_FAILURE";
  return "PROVIDER_REJECTED";
}

function safeMessageId(value: unknown) {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= 200 &&
    /^[A-Za-z0-9._:@+-]+$/.test(value)
    ? value
    : null;
}
