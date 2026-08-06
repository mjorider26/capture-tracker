import { createHash } from "node:crypto";

import { z } from "zod";

type EnvironmentInput = Record<string, string | undefined>;

export const productionBootstrapError = "Account creation could not be completed.";
export const productionBootstrapClosedMessage = "This private workspace has already been set up. Sign in to continue.";

const inputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().max(320).pipe(z.email()),
  password: z.string().min(12).max(128),
  confirmPassword: z.string(),
}).refine(({ password, confirmPassword }) => password === confirmPassword);

export type ProductionBootstrapInput = z.infer<typeof inputSchema>;

export function isProductionOwnerBootstrapEnabled(input: EnvironmentInput = process.env) {
  return input.CAPTURE_TRACKER_ENVIRONMENT === "production" &&
    input.CAPTURE_TRACKER_EXECUTION_CONTEXT === "cloudflare" &&
    input.CAPTURE_TRACKER_DEPLOYMENT_PROFILE === "production-cloudflare-neon" &&
    input.CAPTURE_TRACKER_REAL_DATA_APPROVED === "true" &&
    input.CAPTURE_TRACKER_CUSTOMER_ONBOARDING_ENABLED === "true" &&
    input.CAPTURE_TRACKER_DATA_MODE === "production" &&
    input.CAPTURE_TRACKER_PRODUCTION_DATABASE_NAME === "capture_tracker_production";
}

export function validateProductionBootstrapInput(rawInput: unknown): ProductionBootstrapInput | null {
  const parsed = inputSchema.safeParse(rawInput);
  return parsed.success ? parsed.data : null;
}

// Retaining only a one-way digest lets a retry resume an interrupted bootstrap
// without persisting a second copy of the owner's email address.
export function productionBootstrapEmailHash(email: string) {
  return createHash("sha256").update(email).digest("hex");
}
