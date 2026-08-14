import "server-only";

import { Prisma, type BusinessRole } from "../../generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { fingerprint, normalizedMerchant } from "./financial-ingestion-core";
import { plaidClient, PlaidProviderError, plaidLinkTokenFailureTelemetry, type PlaidAccountEvidence, type PlaidSyncBatch } from "@/lib/providers/plaid/client";
import { decryptPlaidAccessToken, encryptPlaidAccessToken, stablePlaidClientUserId } from "@/lib/providers/plaid/crypto";
import type { ProviderTransaction } from "./operational-independence-core";

type Actor = { businessId: string; actorUserId: string; role: BusinessRole };
type SyncActor = { actorUserId: string; actorType: "USER" | "SYSTEM" };
const validId = (value: unknown) => typeof value === "string" && /^[A-Za-z0-9_-]{1,191}$/u.test(value);
const validPublicToken = (value: unknown): value is string => typeof value === "string" && /^public-(?:sandbox|production)-[A-Za-z0-9-]+$/u.test(value);
const dateAtNoon = (value: string) => new Date(`${value}T12:00:00.000Z`);

function providerUrls() {
  const base = process.env.BETTER_AUTH_URL?.trim();
  let baseUrl: URL | null = null;
  try { baseUrl = base ? new URL(base) : null; } catch { baseUrl = null; }
  const isOrigin = Boolean(baseUrl && baseUrl.origin === base);
  const isSandboxLoopback = Boolean(
    baseUrl &&
    process.env.PLAID_ENV?.trim().toLowerCase() === "sandbox" &&
    baseUrl.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(baseUrl.hostname),
  );
  if (!baseUrl || !isOrigin || (baseUrl.protocol !== "https:" && !isSandboxLoopback)) throw new Error("BETTER_AUTH_URL must be an HTTPS origin for Plaid Link, except for loopback HTTP in Sandbox.");
  const webhookUrl = process.env.PLAID_WEBHOOK_URL?.trim() || `${base}/api/plaid/webhook`;
  const redirectUri = process.env.PLAID_REDIRECT_URI?.trim() || (isSandboxLoopback ? undefined : `${base}/app/money/bank`);
  if (!/^https:\/\//u.test(webhookUrl) || (redirectUri && !/^https:\/\/[^?#]+$/u.test(redirectUri))) throw new Error("Plaid webhook and redirect URLs must use HTTPS.");
  return { webhookUrl, redirectUri };
}

function accountType(account: PlaidAccountEvidence) {
  return [account.type, account.subtype].filter(Boolean).join("_").toUpperCase().slice(0, 64);
}

function cleanMask(mask: string | null | undefined) {
  const value = mask?.replace(/\D/gu, "").slice(-4);
  return value || null;
}

async function accessTokenFor(connection: { encryptedAccessToken: string | null; accessTokenKeyVersion: number | null }) {
  if (!connection.encryptedAccessToken) throw new Error("RECONNECT_REQUIRED");
  return decryptPlaidAccessToken(connection.encryptedAccessToken, connection.accessTokenKeyVersion);
}

export async function createPlaidLinkToken(actor: Actor, connectionId?: string) {
  if (actor.role !== "OWNER" || (connectionId && !validId(connectionId))) return { ok: false as const, message: "Only the owner can start a bank connection." };
  try {
    const urls = providerUrls();
    let accessToken: string | undefined;
    if (connectionId) {
      const connection = await prisma.bankConnection.findFirst({ where: { id: connectionId, businessId: actor.businessId, providerId: "plaid", state: { not: "DISCONNECTED" } }, select: { encryptedAccessToken: true, accessTokenKeyVersion: true } });
      if (!connection) return { ok: false as const, message: "That bank connection is unavailable." };
      accessToken = await accessTokenFor(connection);
    }
    const clientUserId = await stablePlaidClientUserId(actor.businessId, actor.actorUserId);
    const token = await plaidClient.createLinkToken({ clientUserId, webhookUrl: urls.webhookUrl, redirectUri: urls.redirectUri, accessToken });
    await prisma.auditEvent.create({ data: { actorType: "USER", businessId: actor.businessId, actorMembershipId: actor.actorUserId, action: "CREATE", entityType: "PlaidConnectionAttempt", entityId: connectionId ?? actor.businessId, afterJson: { mode: connectionId ? "UPDATE" : "CREATE", product: "transactions" }, metadataJson: { credentialsStored: false, accountingEffect: "none" } } });
    return { ok: true as const, linkToken: token.link_token, mode: connectionId ? "UPDATE" as const : "CREATE" as const };
  } catch (error) {
    console.error(JSON.stringify(plaidLinkTokenFailureTelemetry(error)));
    return { ok: false as const, message: "Secure bank connection setup is temporarily unavailable. CSV import remains available." };
  }
}

function duplicateItem(existing: Array<{ institutionId: string | null; accounts: Array<{ name: string; maskedLastFour: string | null }> }>, institutionId: string | null, accounts: PlaidAccountEvidence[]) {
  if (!institutionId) return false;
  return existing.some((connection) => connection.institutionId === institutionId && accounts.some((incoming) => connection.accounts.some((stored) => stored.name.toLowerCase() === incoming.name.toLowerCase() && Boolean(stored.maskedLastFour) && stored.maskedLastFour === cleanMask(incoming.mask))));
}

export async function exchangePlaidPublicToken(actor: Actor, publicToken: unknown) {
  if (actor.role !== "OWNER" || !validPublicToken(publicToken)) return { ok: false as const, message: "The bank connection response is invalid." };
  let accessToken: string | null = null;
  try {
    const exchanged = await plaidClient.exchangePublicToken(publicToken);
    accessToken = exchanged.access_token;
    const [itemResponse, accountResponse] = await Promise.all([plaidClient.itemGet(accessToken), plaidClient.accountsGet(accessToken)]);
    const itemId = itemResponse.item.item_id;
    const institutionId = itemResponse.item.institution_id ?? null;
    const crossTenant = await prisma.bankConnection.findFirst({ where: { providerId: "plaid", providerConnectionRef: itemId, businessId: { not: actor.businessId } }, select: { id: true } });
    if (crossTenant) { accessToken = null; return { ok: false as const, message: "That provider Item cannot be associated with this business." }; }
    const existingItem = await prisma.bankConnection.findFirst({ where: { businessId: actor.businessId, providerId: "plaid", providerConnectionRef: itemId }, select: { id: true } });
    if (existingItem) { accessToken = null; return { ok: false as const, message: "This institution is already connected. Use reconnect on the existing connection." }; }
    const comparisons = await prisma.bankConnection.findMany({ where: { businessId: actor.businessId, providerId: "plaid", state: { not: "DISCONNECTED" } }, select: { institutionId: true, accounts: { select: { name: true, maskedLastFour: true } } } });
    if (duplicateItem(comparisons, institutionId, accountResponse.accounts)) { await plaidClient.itemRemove(accessToken); return { ok: false as const, message: "This bank and account appear to be connected already. Use reconnect on the existing connection." }; }
    const [institutionName, encrypted] = await Promise.all([plaidClient.institutionName(institutionId), encryptPlaidAccessToken(accessToken)]);
    const result = await prisma.$transaction(async (tx) => {
      const connection = await tx.bankConnection.create({ data: { businessId: actor.businessId, providerId: "plaid", providerConnectionRef: itemId, institutionId, institutionName, encryptedAccessToken: encrypted.ciphertext, accessTokenKeyVersion: encrypted.keyVersion, connectedByUserId: actor.actorUserId, state: "CONNECTED" }, select: { id: true } });
      for (const account of accountResponse.accounts) await tx.connectedFinancialAccount.create({ data: { businessId: actor.businessId, bankConnectionId: connection.id, externalAccountRef: account.account_id, name: account.name.slice(0, 180), accountType: accountType(account), maskedLastFour: cleanMask(account.mask), isSelected: true } });
      await tx.auditEvent.create({ data: { actorType: "USER", businessId: actor.businessId, actorMembershipId: actor.actorUserId, action: "CREATE", entityType: "BankConnection", entityId: connection.id, afterJson: { providerId: "plaid", accountCount: accountResponse.accounts.length, institutionId }, metadataJson: { credentialStorage: "encrypted-envelope", accountingEffect: "none" } } });
      return connection;
    });
    accessToken = null;
    return { ok: true as const, connectionId: result.id, accountCount: accountResponse.accounts.length };
  } catch {
    if (accessToken) await plaidClient.itemRemove(accessToken).catch(() => undefined);
    return { ok: false as const, message: "The bank connection could not be saved safely. No accounting records were changed." };
  }
}

function transactionValues(item: ProviderTransaction, financialAccountId: string) {
  const amount = new Prisma.Decimal(item.amount);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(item.date) || (item.postedDate && !/^\d{4}-\d{2}-\d{2}$/u.test(item.postedDate)) || !amount.isFinite() || !amount.greaterThan(0)) throw new Error("MALFORMED_PROVIDER_EVIDENCE");
  const merchant = normalizedMerchant(item.description);
  const fp = fingerprint(financialAccountId, { transactionDate: item.date, description: item.description, amount: amount.toFixed(2), sourceReference: null });
  return { amount: amount.toDecimalPlaces(2), merchant, fingerprint: fp, transactionDate: dateAtNoon(item.date), postedDate: item.postedDate ? dateAtNoon(item.postedDate) : null };
}

async function createNormalizedEvidence(tx: Prisma.TransactionClient, input: { businessId: string; actorUserId: string; providerRecordId: string; financialAccountId: string; item: ProviderTransaction }) {
  const values = transactionValues(input.item, input.financialAccountId);
  const providerIdentity = `plaid:${input.item.id}`;
  const exact = await tx.externalTransaction.findFirst({ where: { businessId: input.businessId, financialAccountId: input.financialAccountId, OR: [{ externalTransactionId: providerIdentity }, { fingerprint: values.fingerprint }] }, select: { id: true } });
  const possible = exact ? null : await tx.externalTransaction.findFirst({ where: { businessId: input.businessId, financialAccountId: input.financialAccountId, transactionDate: values.transactionDate, amount: values.amount, direction: input.item.direction }, select: { id: true } });
  const importRecord = await tx.transactionImport.create({ data: { businessId: input.businessId, financialAccountId: input.financialAccountId, createdByUserId: input.actorUserId, sourceFilename: "Plaid bank sync", sourceSha256: `plaid:${input.providerRecordId}`, mappingJson: { source: "PLAID" }, rowCount: 1, newCount: exact ? 0 : 1, duplicateCount: exact ? 1 : 0, possibleDuplicateCount: possible ? 1 : 0, status: "COMPLETED", confirmedAt: new Date(), completedAt: new Date() }, select: { id: true } });
  if (exact) return { externalTransactionId: exact.id, created: false, duplicate: true };
  const external = await tx.externalTransaction.create({ data: { businessId: input.businessId, transactionImportId: importRecord.id, financialAccountId: input.financialAccountId, rowNumber: 1, transactionDate: values.transactionDate, postedDate: values.postedDate, description: input.item.description.slice(0, 1000), normalizedMerchant: values.merchant, amount: values.amount, direction: input.item.direction, externalTransactionId: providerIdentity, sourceReference: providerIdentity, fingerprint: values.fingerprint, status: possible ? "POSSIBLE_DUPLICATE" : "NEEDS_REVIEW", duplicateOfId: possible?.id, suggestionReason: possible ? "Plaid activity matches the date, amount, and direction of existing imported activity. Review before posting." : input.item.pending ? "Pending Plaid activity. Wait for it to post before approving it." : "Imported from Plaid. Review before posting." }, select: { id: true } });
  return { externalTransactionId: external.id, created: true, duplicate: false };
}

async function updateUnpostedExternal(tx: Prisma.TransactionClient, externalId: string, item: ProviderTransaction) {
  const existing = await tx.externalTransaction.findFirst({ where: { id: externalId }, select: { postedTransactionId: true, status: true, financialAccountId: true } });
  if (!existing || existing.postedTransactionId || existing.status === "POSTED") return false;
  const values = transactionValues(item, existing.financialAccountId);
  await tx.externalTransaction.update({ where: { id: externalId }, data: { transactionDate: values.transactionDate, postedDate: values.postedDate, description: item.description.slice(0, 1000), normalizedMerchant: values.merchant, amount: values.amount, direction: item.direction, fingerprint: values.fingerprint, suggestionReason: item.pending ? "Pending Plaid activity. Wait for it to post before approving it." : "Updated by Plaid. Review before posting.", version: { increment: 1 } } });
  return true;
}

type LoadedConnection = Awaited<ReturnType<typeof loadConnection>>;
async function loadConnection(connectionId: string) {
  return prisma.bankConnection.findFirst({ where: { id: connectionId, providerId: "plaid", state: { not: "DISCONNECTED" } }, include: { accounts: { include: { financialAccount: { select: { bankFeedMethod: true } } } } } });
}

async function applyTransaction(tx: Prisma.TransactionClient, connection: NonNullable<LoadedConnection>, runId: string, item: ProviderTransaction, actor: SyncActor, isModified: boolean) {
  const account = connection.accounts.find((candidate) => candidate.externalAccountRef === item.accountRef);
  if (!account) return { imported: 0, duplicates: 0, updated: 0 };
  const prior = await tx.bankProviderTransaction.findFirst({ where: { businessId: connection.businessId, bankConnectionId: connection.id, providerTransactionRef: item.id }, select: { id: true, pending: true, providerContentHash: true, normalizedExternalTransactionId: true } });
  const shouldUpdate = Boolean(isModified || !prior || (prior.pending && !item.pending) || (item.contentHash && prior.providerContentHash !== item.contentHash));
  const record = await tx.bankProviderTransaction.upsert({
    where: { businessId_bankConnectionId_providerTransactionRef: { businessId: connection.businessId, bankConnectionId: connection.id, providerTransactionRef: item.id } },
    create: { businessId: connection.businessId, bankConnectionId: connection.id, connectedFinancialAccountId: account.id, bankSyncRunId: runId, providerTransactionRef: item.id, pendingTransactionRef: item.pendingTransactionRef, transactionDate: dateAtNoon(item.date), postedDate: item.postedDate ? dateAtNoon(item.postedDate) : null, description: item.description.slice(0, 1000), amount: new Prisma.Decimal(item.amount).toDecimalPlaces(2), direction: item.direction, pending: Boolean(item.pending), providerContentHash: item.contentHash, state: "ACTIVE" },
    update: shouldUpdate ? { connectedFinancialAccountId: account.id, bankSyncRunId: runId, pendingTransactionRef: item.pendingTransactionRef, transactionDate: dateAtNoon(item.date), postedDate: item.postedDate ? dateAtNoon(item.postedDate) : null, description: item.description.slice(0, 1000), amount: new Prisma.Decimal(item.amount).toDecimalPlaces(2), direction: item.direction, pending: Boolean(item.pending), providerContentHash: item.contentHash, state: "ACTIVE", removedAt: null, version: { increment: 1 } } : { bankSyncRunId: runId },
    select: { id: true, normalizedExternalTransactionId: true },
  });
  if (item.pendingTransactionRef) {
    const pending = await tx.bankProviderTransaction.findFirst({ where: { businessId: connection.businessId, bankConnectionId: connection.id, providerTransactionRef: item.pendingTransactionRef }, select: { id: true, normalizedExternalTransactionId: true } });
    if (pending) {
      const external = pending.normalizedExternalTransactionId ? await tx.externalTransaction.findFirst({ where: { id: pending.normalizedExternalTransactionId }, select: { id: true, postedTransactionId: true } }) : null;
      if (external && !external.postedTransactionId) {
        await tx.bankProviderTransaction.update({ where: { id: pending.id }, data: { normalizedExternalTransactionId: null, state: "REPLACED", replacedByRef: item.id, version: { increment: 1 } } });
        await updateUnpostedExternal(tx, external.id, item);
        await tx.externalTransaction.update({ where: { id: external.id }, data: { externalTransactionId: `plaid:${item.id}`, sourceReference: `plaid:${item.id}` } });
        await tx.bankProviderTransaction.update({ where: { id: record.id }, data: { normalizedExternalTransactionId: external.id } });
        return { imported: 0, duplicates: 0, updated: 1 };
      }
      await tx.bankProviderTransaction.update({ where: { id: pending.id }, data: { normalizedExternalTransactionId: null, state: "REPLACED", replacedByRef: item.id, version: { increment: 1 } } });
      if (external?.postedTransactionId) {
        await tx.bankProviderTransaction.update({ where: { id: record.id }, data: { normalizedExternalTransactionId: external.id } });
        return { imported: 0, duplicates: 0, updated: 1 };
      }
    }
  }
  if (record.normalizedExternalTransactionId) {
    const changed = shouldUpdate && await updateUnpostedExternal(tx, record.normalizedExternalTransactionId, item);
    return { imported: 0, duplicates: shouldUpdate ? 0 : 1, updated: changed ? 1 : 0 };
  }
  if (!account.isSelected || !account.financialAccountId || account.financialAccount?.bankFeedMethod !== "PLAID") return { imported: 0, duplicates: 0, updated: shouldUpdate && prior ? 1 : 0 };
  const normalized = await createNormalizedEvidence(tx, { businessId: connection.businessId, actorUserId: actor.actorUserId, providerRecordId: record.id, financialAccountId: account.financialAccountId, item });
  await tx.bankProviderTransaction.update({ where: { id: record.id }, data: { normalizedExternalTransactionId: normalized.externalTransactionId } });
  return { imported: normalized.created ? 1 : 0, duplicates: normalized.duplicate ? 1 : 0, updated: shouldUpdate && prior ? 1 : 0 };
}

async function applyBatch(connection: NonNullable<LoadedConnection>, runId: string, batch: PlaidSyncBatch, actor: SyncActor) {
  let imported = 0, duplicates = 0, updated = 0, removed = 0;
  await prisma.$transaction(async (tx) => {
    for (const item of batch.added) { const result = await applyTransaction(tx, connection, runId, item, actor, false); imported += result.imported; duplicates += result.duplicates; updated += result.updated; }
    for (const item of batch.modified) { const result = await applyTransaction(tx, connection, runId, item, actor, true); imported += result.imported; duplicates += result.duplicates; updated += result.updated; }
    for (const providerTransactionRef of batch.removed) {
      const record = await tx.bankProviderTransaction.findFirst({ where: { businessId: connection.businessId, bankConnectionId: connection.id, providerTransactionRef }, select: { id: true, state: true, normalizedExternalTransactionId: true } });
      if (!record) continue;
      await tx.bankProviderTransaction.update({ where: { id: record.id }, data: { state: record.state === "REPLACED" ? "REPLACED" : "REMOVED", removedAt: new Date(), bankSyncRunId: runId, version: { increment: 1 } } });
      if (record.normalizedExternalTransactionId) await tx.externalTransaction.updateMany({ where: { id: record.normalizedExternalTransactionId, businessId: connection.businessId, postedTransactionId: null, status: { notIn: ["POSTED", "IGNORED"] } }, data: { status: "IGNORED", suggestionReason: "Plaid removed this unposted activity. Ledger history, if any, was not changed.", version: { increment: 1 } } });
      removed += 1;
    }
    await tx.bankSyncRun.update({ where: { id: runId }, data: { status: "COMPLETED", cursorAfter: batch.cursor, importedCount: imported, duplicateCount: duplicates, updatedCount: updated, removedCount: removed, completedAt: new Date() } });
    await tx.bankConnection.update({ where: { id: connection.id }, data: { state: "CONNECTED", syncCursor: batch.cursor, lastSuccessfulSyncAt: new Date(), errorCode: null, errorMessage: null, version: { increment: 1 } } });
    await tx.auditEvent.create({ data: { actorType: actor.actorType, businessId: connection.businessId, actorMembershipId: actor.actorType === "USER" ? actor.actorUserId : null, action: "UPDATE", entityType: "BankSyncRun", entityId: runId, afterJson: { imported, duplicates, updated, removed }, metadataJson: { providerId: "plaid", accountingEffect: "none" } } });
  });
  return { imported, duplicates, updated, removed };
}

async function markSyncFailure(connection: { id: string; businessId: string }, runId: string, error: unknown) {
  const reconnect = error instanceof PlaidProviderError && ["ITEM_LOGIN_REQUIRED", "PENDING_DISCONNECT", "ITEM_NOT_FOUND"].includes(error.code) || error instanceof Error && error.message === "RECONNECT_REQUIRED";
  const code = reconnect ? "RECONNECT_REQUIRED" : "SYNC_FAILED", message = reconnect ? "Reconnect required before the next sync." : "Plaid sync failed safely; retry later or use CSV import.";
  await prisma.$transaction([
    prisma.bankSyncRun.update({ where: { id: runId }, data: { status: "FAILED", errorCode: code, errorMessage: message, completedAt: new Date() } }),
    prisma.bankConnection.update({ where: { id: connection.id }, data: { state: reconnect ? "RECONNECT_REQUIRED" : "NEEDS_ATTENTION", errorCode: code, errorMessage: message, version: { increment: 1 } } }),
    prisma.auditEvent.create({ data: { actorType: "SYSTEM", businessId: connection.businessId, action: "UPDATE", entityType: "BankConnection", entityId: connection.id, afterJson: { state: reconnect ? "RECONNECT_REQUIRED" : "NEEDS_ATTENTION", errorCode: code }, metadataJson: { providerId: "plaid", sensitiveProviderErrorStored: false, accountingEffect: "none" } } }),
  ]);
  return { ok: false as const, message: reconnect ? "Reconnect this institution before syncing again." : "Plaid is temporarily unavailable. Your history is safe, and CSV import remains available." };
}

async function syncLoadedConnection(connection: NonNullable<LoadedConnection>, actor: SyncActor) {
  const claimedAt = new Date();
  const run = await prisma.$transaction(async (tx) => {
    const claimed = await tx.bankConnection.updateMany({
      where: {
        id: connection.id,
        version: connection.version,
        state: { not: "SYNCING" },
      },
      data: { state: "SYNCING", lastAttemptedSyncAt: claimedAt, errorCode: null, errorMessage: null, version: { increment: 1 } },
    });
    if (claimed.count !== 1) return null;
    return tx.bankSyncRun.create({ data: { businessId: connection.businessId, bankConnectionId: connection.id, cursorBefore: connection.syncCursor, status: "STARTED" }, select: { id: true } });
  });
  if (!run) return { ok: false as const, message: "A Plaid sync is already in progress. Refresh before retrying." };
  try {
    const token = await accessTokenFor(connection);
    const batch = await plaidClient.transactionsSync(token, connection.syncCursor);
    return { ok: true as const, ...(await applyBatch(connection, run.id, batch, actor)) };
  } catch (error) { return markSyncFailure(connection, run.id, error); }
}

export async function syncPlaidBankConnection(actor: Actor, connectionId: string) {
  if (actor.role !== "OWNER" || !validId(connectionId)) return { ok: false as const, message: "The sync request is invalid." };
  const connection = await loadConnection(connectionId);
  if (!connection || connection.businessId !== actor.businessId) return { ok: false as const, message: "That bank connection is unavailable." };
  return syncLoadedConnection(connection, { actorType: "USER", actorUserId: actor.actorUserId });
}

export async function processPlaidWebhookEvent(eventId: string) {
  if (!validId(eventId)) return;
  const event = await prisma.bankWebhookEvent.findFirst({ where: { id: eventId, status: "RECEIVED" }, select: { id: true, bankConnectionId: true } });
  if (!event) return;
  const claimed = await prisma.bankWebhookEvent.updateMany({ where: { id: event.id, status: "RECEIVED" }, data: { status: "PROCESSING" } });
  if (claimed.count !== 1) return;
  const connection = await loadConnection(event.bankConnectionId);
  if (!connection?.connectedByUserId) { await prisma.bankWebhookEvent.update({ where: { id: event.id }, data: { status: "FAILED", errorCode: "CONNECTION_CONTEXT_UNAVAILABLE", processedAt: new Date() } }); return; }
  const result = await syncLoadedConnection(connection, { actorType: "SYSTEM", actorUserId: connection.connectedByUserId });
  await prisma.bankWebhookEvent.update({ where: { id: event.id }, data: { status: result.ok ? "COMPLETED" : "FAILED", errorCode: result.ok ? null : "SYNC_FAILED", processedAt: new Date() } });
}

export async function completePlaidReconnect(actor: Actor, connectionId: string) {
  if (actor.role !== "OWNER" || !validId(connectionId)) return { ok: false as const, message: "The reconnect request is invalid." };
  const connection = await loadConnection(connectionId);
  if (!connection || connection.businessId !== actor.businessId) return { ok: false as const, message: "That bank connection is unavailable." };
  await prisma.$transaction([
    prisma.bankConnection.update({ where: { id: connection.id }, data: { state: "CONNECTED", errorCode: null, errorMessage: null, version: { increment: 1 } } }),
    prisma.auditEvent.create({ data: { actorType: "USER", businessId: actor.businessId, actorMembershipId: actor.actorUserId, action: "UPDATE", entityType: "BankConnection", entityId: connection.id, afterJson: { state: "CONNECTED", reconnectCompleted: true }, metadataJson: { providerId: "plaid", accountingEffect: "none" } } }),
  ]);
  const refreshed = await loadConnection(connection.id);
  if (!refreshed) return { ok: false as const, message: "The reconnected bank connection could not be reloaded safely." };
  return syncLoadedConnection(refreshed, { actorType: "USER", actorUserId: actor.actorUserId });
}

export async function disconnectPlaidConnection(actor: Actor, connectionId: string) {
  if (actor.role !== "OWNER" || !validId(connectionId)) return { ok: false as const, message: "The disconnect request is invalid." };
  const connection = await loadConnection(connectionId);
  if (!connection || connection.businessId !== actor.businessId) return { ok: false as const, message: "That bank connection is unavailable." };
  try { await plaidClient.itemRemove(await accessTokenFor(connection)); } catch { return { ok: false as const, message: "Plaid could not confirm disconnection. The Item remains connected; switch accounts to CSV while you retry." }; }
  await prisma.$transaction(async (tx) => {
    await tx.bankConnection.update({ where: { id: connection.id }, data: { state: "DISCONNECTED", encryptedAccessToken: null, accessTokenKeyVersion: null, disconnectedAt: new Date(), errorCode: null, errorMessage: null, version: { increment: 1 } } });
    await tx.financialAccount.updateMany({ where: { businessId: actor.businessId, bankFeedMethod: "PLAID", connectedFinancialAccounts: { some: { bankConnectionId: connection.id } } }, data: { bankFeedMethod: "MANUAL", version: { increment: 1 } } });
    await tx.auditEvent.create({ data: { actorType: "USER", businessId: actor.businessId, actorMembershipId: actor.actorUserId, action: "UPDATE", entityType: "BankConnection", entityId: connection.id, afterJson: { state: "DISCONNECTED" }, metadataJson: { providerItemRemoved: true, historyPreserved: true, accountingEffect: "none" } } });
  });
  return { ok: true as const };
}
