import { z } from "zod";

import { readCloudEnvironment } from "@/lib/cloud/environment";

type EnvironmentInput = Record<string, string | undefined>;

export const practiceAccountError = "Account creation could not be completed.";

const inputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    email: z.string().trim().toLowerCase().max(320).pipe(z.email()),
    password: z.string().min(12).max(128),
    confirmPassword: z.string(),
    invitationCode: z.string().min(1).max(512),
  })
  .refine(({ password, confirmPassword }) => password === confirmPassword);

export type PracticeAccountInput = z.infer<typeof inputSchema>;

export type PracticeAccountEnvironment = EnvironmentInput;

export function isFictionalStagingPracticeSignupEnabled(
  input: PracticeAccountEnvironment = process.env,
) {
  try {
    const config = readCloudEnvironment(input);
    return (
      config.environment === "staging" &&
      config.executionContext === "cloudflare" &&
      config.deploymentProfile === "free-preview-cloudflare-neon" &&
      !config.realDataApproved &&
      input.CAPTURE_TRACKER_DATA_MODE === "fictional" &&
      input.CAPTURE_TRACKER_CUSTOMER_ONBOARDING_ENABLED === "false"
    );
  } catch {
    return false;
  }
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
