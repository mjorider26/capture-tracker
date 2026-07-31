import { z } from "zod";

type EnvironmentInput = Record<string, string | undefined>;

export const practiceAccountError = "Account creation could not be completed.";

const inputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().toLowerCase().max(320).pipe(z.email()),
    password: z.string().min(12).max(128),
    confirmPassword: z.string(),
    invitationCode: z.string().trim().min(1).max(512),
  })
  .refine(({ password, confirmPassword }) => password === confirmPassword);

export type PracticeAccountInput = z.infer<typeof inputSchema>;

export type PracticeAccountEnvironment = EnvironmentInput;

export type PracticeSignupGuardStatus =
  | "ENABLED"
  | "CLOUD_CONFIGURATION_REJECTED"
  | "STAGING_GUARD_REJECTED";

export function fictionalStagingPracticeSignupGuardStatus(
  input: PracticeAccountEnvironment = process.env,
): PracticeSignupGuardStatus {
  // This request executes with the application runtime connection, not the
  // direct migration connection. Requiring migration-only configuration here
  // rejects valid signups before Better Auth is reached.
  return input.CAPTURE_TRACKER_ENVIRONMENT === "staging" &&
    input.CAPTURE_TRACKER_EXECUTION_CONTEXT === "cloudflare" &&
    input.CAPTURE_TRACKER_DEPLOYMENT_PROFILE === "free-preview-cloudflare-neon" &&
    input.CAPTURE_TRACKER_REAL_DATA_APPROVED === "false" &&
    input.CAPTURE_TRACKER_PAID_SERVICE_APPROVED === "false" &&
    input.CAPTURE_TRACKER_CUSTOMER_ONBOARDING_ENABLED === "false" &&
    input.CAPTURE_TRACKER_DATA_MODE === "fictional" &&
    input.CAPTURE_TRACKER_STAGING_DATABASE_NAME === "capture_tracker_staging"
    ? "ENABLED"
    : "STAGING_GUARD_REJECTED";
}

export function isFictionalStagingPracticeSignupEnabled(
  input: PracticeAccountEnvironment = process.env,
) {
  return fictionalStagingPracticeSignupGuardStatus(input) === "ENABLED";
}

async function digest(value: string) {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
}

async function codesMatch(expected: string, received: string) {
  const [expectedDigest, receivedDigest] = await Promise.all([
    digest(expected),
    digest(received),
  ]);
  let difference = 0;
  for (let index = 0; index < expectedDigest.length; index += 1) {
    difference |= expectedDigest[index] ^ receivedDigest[index];
  }
  return difference === 0;
}

export async function validatePracticeAccountInput(
  rawInput: unknown,
  environment: PracticeAccountEnvironment = process.env,
): Promise<PracticeAccountInput | null> {
  if (!isFictionalStagingPracticeSignupEnabled(environment)) return null;

  const parsed = inputSchema.safeParse(rawInput);
  if (!parsed.success) return null;

  const configuredCode =
    environment.CAPTURE_TRACKER_STAGING_INVITATION_CODE?.trim();
  if (!configuredCode) return null;

  if (!(await codesMatch(configuredCode, parsed.data.invitationCode))) {
    return null;
  }

  return parsed.data;
}

export function practiceBusinessId(userId: string) {
  return `practice-${userId}`;
}

export function practiceWorkspaceAuditId(userId: string) {
  return `practice-workspace-created-${userId}`;
}
