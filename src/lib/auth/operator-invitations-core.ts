import { z } from "zod";

export const invitationLifetimeHours = 72;

const createSchema = z.object({
  invitedEmail: z.string().trim().toLowerCase().max(320).pipe(z.email()),
  ownerDisplayName: z.string().trim().min(1).max(120),
  businessLegalName: z.string().trim().min(1).max(160),
  businessDisplayName: z.string().trim().min(1).max(160),
  foundingCustomer: z.boolean().optional().default(false),
});

export type CreateOperatorInvitationInput = z.infer<typeof createSchema>;

export function parseOperatorInvitationInput(input: unknown): CreateOperatorInvitationInput | null {
  const parsed = createSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

export function invitationExpiresAt(now = new Date()) {
  return new Date(now.getTime() + invitationLifetimeHours * 60 * 60 * 1000);
}

export function generateInvitationToken(random: Uint8Array) {
  if (random.length < 32) throw new Error("Invitation entropy is insufficient.");
  return Array.from(random, (value) => value.toString(16).padStart(2, "0")).join("");
}

export function newInvitationToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return generateInvitationToken(bytes);
}

export async function invitationTokenHash(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

export function invitationUsable(record: { status: string; expiresAt: Date; revokedAt: Date | null; acceptedAt: Date | null }, now = new Date()) {
  return record.status === "PENDING" && !record.revokedAt && !record.acceptedAt && record.expiresAt > now;
}
