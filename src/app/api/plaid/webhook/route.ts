import { after } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyPlaidWebhook } from "@/lib/providers/plaid/webhook-verification";
import { processPlaidWebhookEvent } from "@/lib/services/plaid-bank";

export const dynamic = "force-dynamic";

const safeCode = (value: unknown) => typeof value === "string" && /^[A-Z0-9_]{1,100}$/u.test(value) ? value : null;
const safeItemId = (value: unknown) => typeof value === "string" && /^[A-Za-z0-9_-]{1,191}$/u.test(value) ? value : null;

export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > 65_536) return Response.json({ accepted: false }, { status: 413 });
  const rawBody = await request.text();
  if (rawBody.length === 0 || rawBody.length > 65_536) return Response.json({ accepted: false }, { status: 400 });
  const verified = await verifyPlaidWebhook(rawBody, request.headers.get("plaid-verification"));
  if (!verified.ok) return Response.json({ accepted: false }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = JSON.parse(rawBody) as Record<string, unknown>; } catch { return Response.json({ accepted: false }, { status: 400 }); }
  const itemId = safeItemId(body.item_id), webhookType = safeCode(body.webhook_type), webhookCode = safeCode(body.webhook_code);
  if (!itemId || !webhookType || !webhookCode) return Response.json({ accepted: true });

  // Tenant identity is resolved only from the provider Item id. No business id from a webhook is trusted.
  const connection = await prisma.bankConnection.findFirst({ where: { providerId: "plaid", providerConnectionRef: itemId, state: { not: "DISCONNECTED" } }, select: { id: true, businessId: true } });
  if (!connection) return Response.json({ accepted: true });
  if (webhookType !== "TRANSACTIONS" || webhookCode !== "SYNC_UPDATES_AVAILABLE") return Response.json({ accepted: true });
  try {
    const event = await prisma.$transaction(async (tx) => {
      const created = await tx.bankWebhookEvent.create({ data: { businessId: connection.businessId, bankConnectionId: connection.id, providerId: "plaid", requestBodySha256: verified.bodyHash, verificationSignatureSha256: verified.signatureHash, verificationKeyId: verified.keyId, webhookType, webhookCode }, select: { id: true } });
      await tx.auditEvent.create({ data: { actorType: "SYSTEM", businessId: connection.businessId, action: "CREATE", entityType: "BankWebhookEvent", entityId: created.id, afterJson: { providerId: "plaid", webhookType, webhookCode, verification: "ES256" }, metadataJson: { rawPayloadStored: false, accountingEffect: "none" } } });
      return created;
    });
    after(() => processPlaidWebhookEvent(event.id));
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return Response.json({ accepted: false }, { status: 503 });
    // A repeated signed body is an idempotent provider redelivery.
  }
  return Response.json({ accepted: true });
}
