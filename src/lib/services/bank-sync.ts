import "server-only";

import { Prisma, type BusinessRole } from "../../generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { decideSync, type BankProvider, type ProviderTransaction } from "./operational-independence-core";
import { fingerprint, normalizedMerchant } from "./financial-ingestion-core";
import { plaidConfigured } from "@/lib/providers/plaid/client";

type Actor = { businessId: string; actorUserId: string; role: BusinessRole };
const validId = (value: unknown) => typeof value === "string" && /^[A-Za-z0-9_-]{1,191}$/.test(value);
const noon = (value: string) => new Date(`${value}T12:00:00.000Z`);

/**
 * Live-provider credentials deliberately do not exist in this service.  A concrete provider is
 * supplied only by a trusted server integration (or the deterministic test provider); the browser
 * can therefore never receive a bank token or provider secret.
 */
export async function createBankConnectionForTrustedProvider(actor: Actor, providerId: string, provider: BankProvider) {
  if (actor.role !== "OWNER" || !/^[a-z0-9_-]{2,64}$/i.test(providerId)) return { ok: false as const, message: "Only the owner can connect a financial institution." };
  const connected = await provider.connect();
  const accounts = await provider.listAccounts(connected.connectionRef);
  return prisma.$transaction(async (tx) => {
    const connection = await tx.bankConnection.upsert({
      where: { businessId_providerId_providerConnectionRef: { businessId: actor.businessId, providerId, providerConnectionRef: connected.connectionRef } },
      create: { businessId: actor.businessId, providerId, providerConnectionRef: connected.connectionRef, institutionName: connected.institutionName, state: "CONNECTED" },
      update: { institutionName: connected.institutionName, state: "CONNECTED", errorCode: null, errorMessage: null, version: { increment: 1 } },
      select: { id: true },
    });
    for (const account of accounts) {
      await tx.connectedFinancialAccount.upsert({
        where: { businessId_bankConnectionId_externalAccountRef: { businessId: actor.businessId, bankConnectionId: connection.id, externalAccountRef: account.id } },
        create: { businessId: actor.businessId, bankConnectionId: connection.id, externalAccountRef: account.id, name: account.name.slice(0, 180), accountType: account.type.slice(0, 64), maskedLastFour: account.lastFour?.replace(/\D/g, "").slice(-4) || null },
        update: { name: account.name.slice(0, 180), accountType: account.type.slice(0, 64), maskedLastFour: account.lastFour?.replace(/\D/g, "").slice(-4) || null, version: { increment: 1 } },
      });
    }
    await tx.auditEvent.create({ data: { actorType: "USER", businessId: actor.businessId, actorMembershipId: actor.actorUserId, action: "CREATE", entityType: "BankConnection", entityId: connection.id, afterJson: { providerId, accountCount: accounts.length }, metadataJson: { credentialsStored: false } } });
    return { ok: true as const, connectionId: connection.id };
  });
}

export async function mapConnectedFinancialAccount(actor: Actor, input: { connectedAccountId: string; financialAccountId: string | null }) {
  if (actor.role !== "OWNER" || !validId(input.connectedAccountId) || (input.financialAccountId !== null && !validId(input.financialAccountId))) return { ok: false as const, message: "The account mapping is invalid." };
  return prisma.$transaction(async (tx) => {
    const connected = await tx.connectedFinancialAccount.findFirst({ where: { id: input.connectedAccountId, businessId: actor.businessId }, select: { id: true, bankConnectionId: true } });
    if (!connected) return { ok: false as const, message: "That connected account is unavailable." };
    if (input.financialAccountId) {
      const account = await tx.financialAccount.findFirst({ where: { id: input.financialAccountId, businessId: actor.businessId, ownership: "BUSINESS", isActive: true }, select: { id: true } });
      if (!account) return { ok: false as const, message: "Choose an active business financial account." };
      const competing = await tx.connectedFinancialAccount.findFirst({ where: { businessId: actor.businessId, financialAccountId: account.id, id: { not: connected.id }, isSelected: true, connection: { state: { not: "DISCONNECTED" } } }, select: { id: true } });
      if (competing) return { ok: false as const, message: "That Capture Tracker account is already mapped to another selected bank feed." };
    }
    await tx.connectedFinancialAccount.update({ where: { id: connected.id }, data: { financialAccountId: input.financialAccountId, version: { increment: 1 } } });
    await tx.auditEvent.create({ data: { actorType: "USER", businessId: actor.businessId, actorMembershipId: actor.actorUserId, action: "UPDATE", entityType: "ConnectedFinancialAccount", entityId: connected.id, afterJson: { financialAccountId: input.financialAccountId }, metadataJson: { accountingEffect: "none" } } });
    return { ok: true as const };
  });
}

export async function setFinancialAccountBankFeedMethod(actor: Actor, input: { financialAccountId: string; method: "MANUAL" | "PLAID" }) {
  if (actor.role !== "OWNER" || !validId(input.financialAccountId) || !["MANUAL", "PLAID"].includes(input.method)) return { ok: false as const, message: "The account method is invalid." };
  return prisma.$transaction(async (tx) => {
    const account = await tx.financialAccount.findFirst({ where: { id: input.financialAccountId, businessId: actor.businessId, ownership: "BUSINESS", isActive: true }, select: { id: true, bankFeedMethod: true } });
    if (!account) return { ok: false as const, message: "That business account is unavailable." };
    await tx.financialAccount.update({ where: { id: account.id }, data: { bankFeedMethod: input.method, version: { increment: 1 } } });
    await tx.auditEvent.create({ data: { actorType: "USER", businessId: actor.businessId, actorMembershipId: actor.actorUserId, action: "UPDATE", entityType: "FinancialAccount", entityId: account.id, beforeJson: { bankFeedMethod: account.bankFeedMethod }, afterJson: { bankFeedMethod: input.method }, metadataJson: { historyPreserved: true, accountingEffect: "none" } } });
    return { ok: true as const };
  });
}

export async function setConnectedFinancialAccountSelection(actor: Actor, input: { connectedAccountId: string; selected: boolean }) {
  if (actor.role !== "OWNER" || !validId(input.connectedAccountId) || typeof input.selected !== "boolean") return { ok: false as const, message: "The account selection is invalid." };
  return prisma.$transaction(async (tx) => {
    const connected = await tx.connectedFinancialAccount.findFirst({ where: { id: input.connectedAccountId, businessId: actor.businessId, connection: { state: { not: "DISCONNECTED" } } }, select: { id: true, isSelected: true } });
    if (!connected) return { ok: false as const, message: "That connected account is unavailable." };
    await tx.connectedFinancialAccount.update({ where: { id: connected.id }, data: { isSelected: input.selected, version: { increment: 1 } } });
    await tx.auditEvent.create({ data: { actorType: "USER", businessId: actor.businessId, actorMembershipId: actor.actorUserId, action: "UPDATE", entityType: "ConnectedFinancialAccount", entityId: connected.id, beforeJson: { isSelected: connected.isSelected }, afterJson: { isSelected: input.selected }, metadataJson: { providerItemDisconnected: false, historyPreserved: true, accountingEffect: "none" } } });
    return { ok: true as const };
  });
}

function externalFingerprint(item: ProviderTransaction, financialAccountId: string) {
  return fingerprint(financialAccountId, { transactionDate: item.date, description: item.description, amount: item.amount, sourceReference: null });
}

async function normalizeProviderTransaction(tx: Prisma.TransactionClient, businessId: string, actorUserId: string, providerItemId: string, item: ProviderTransaction, financialAccountId: string) {
  const value = new Prisma.Decimal(item.amount);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date) || !value.isFinite() || !value.greaterThan(0)) throw new Error("Provider returned malformed transaction evidence.");
  const importRecord = await tx.transactionImport.create({ data: { businessId, financialAccountId, createdByUserId: actorUserId, sourceFilename: "bank-provider-sync", sourceSha256: `provider:${providerItemId}`, mappingJson: { providerTransactionId: providerItemId }, rowCount: 1, newCount: 0, status: "PROCESSING" }, select: { id: true } });
  const transactionId = `bank:${providerItemId}`;
  const fp = externalFingerprint(item, financialAccountId);
  // A provider ID is source-specific.  The exact same statement activity can instead have
  // arrived through CSV, so retain a conservative date/amount/normalized-merchant fallback.
  const existing = await tx.externalTransaction.findFirst({ where: { businessId, financialAccountId, OR: [{ externalTransactionId: transactionId }, { fingerprint: fp }, { transactionDate: noon(item.date), amount: value.toDecimalPlaces(2), normalizedMerchant: normalizedMerchant(item.description) }] }, select: { id: true, externalTransactionId: true, fingerprint: true } });
  if (existing) {
    await tx.transactionImport.update({ where: { id: importRecord.id }, data: { status: "COMPLETED", completedAt: new Date(), duplicateCount: 1, rowCount: 1, version: { increment: 1 } } });
    return { created: false, duplicate: true, externalTransactionId: existing.id };
  }
  const external = await tx.externalTransaction.create({ data: { businessId, transactionImportId: importRecord.id, financialAccountId, rowNumber: 1, transactionDate: noon(item.date), postedDate: item.postedDate && /^\d{4}-\d{2}-\d{2}$/.test(item.postedDate) ? noon(item.postedDate) : null, description: item.description.slice(0, 1000), normalizedMerchant: normalizedMerchant(item.description), amount: value.toDecimalPlaces(2), direction: item.direction, externalTransactionId: transactionId, sourceReference: `bank-provider:${providerItemId}`, fingerprint: fp, status: "NEEDS_REVIEW", suggestionReason: "Imported from a connected financial institution. Review before posting." }, select: { id: true } });
  await tx.transactionImport.update({ where: { id: importRecord.id }, data: { status: "COMPLETED", completedAt: new Date(), newCount: 1, rowCount: 1, version: { increment: 1 } } });
  return { created: true, duplicate: false, externalTransactionId: external.id };
}

export async function syncBankConnection(actor: Actor, connectionId: string, provider: BankProvider) {
  if (actor.role !== "OWNER" || !validId(connectionId)) return { ok: false as const, message: "The bank sync request is invalid." };
  const connection = await prisma.bankConnection.findFirst({ where: { id: connectionId, businessId: actor.businessId, state: { not: "DISCONNECTED" } }, include: { accounts: true } });
  if (!connection) return { ok: false as const, message: "That bank connection is unavailable." };
  const run = await prisma.bankSyncRun.create({ data: { businessId: actor.businessId, bankConnectionId: connection.id, cursorBefore: connection.syncCursor, status: "STARTED" } });
  await prisma.bankConnection.update({ where: { id: connection.id }, data: { state: "SYNCING", lastAttemptedSyncAt: new Date(), errorCode: null, errorMessage: null, version: { increment: 1 } } });
  try {
    const page = await provider.syncTransactions(connection.providerConnectionRef, connection.syncCursor);
    let imported = 0, duplicates = 0, updated = 0;
    await prisma.$transaction(async (tx) => {
      for (const item of page.transactions) {
        const account = connection.accounts.find((candidate) => candidate.externalAccountRef === item.accountRef);
        if (!account) continue;
        const prior = await tx.bankProviderTransaction.findFirst({ where: { businessId: actor.businessId, bankConnectionId: connection.id, providerTransactionRef: item.id }, select: { id: true, pending: true, providerUpdatedAt: true, normalizedExternalTransactionId: true } });
        const decision = decideSync(prior ? { id: item.id, pending: prior.pending, updatedAt: prior.providerUpdatedAt?.toISOString() ?? null } : null, item);
        const record = await tx.bankProviderTransaction.upsert({ where: { businessId_bankConnectionId_providerTransactionRef: { businessId: actor.businessId, bankConnectionId: connection.id, providerTransactionRef: item.id } }, create: { businessId: actor.businessId, bankConnectionId: connection.id, connectedFinancialAccountId: account.id, bankSyncRunId: run.id, providerTransactionRef: item.id, transactionDate: noon(item.date), postedDate: item.postedDate ? noon(item.postedDate) : null, description: item.description.slice(0, 1000), amount: new Prisma.Decimal(item.amount).toDecimalPlaces(2), direction: item.direction, pending: Boolean(item.pending), providerUpdatedAt: item.updatedAt ? new Date(item.updatedAt) : null }, update: decision === "UPDATE" ? { bankSyncRunId: run.id, transactionDate: noon(item.date), postedDate: item.postedDate ? noon(item.postedDate) : null, description: item.description.slice(0, 1000), amount: new Prisma.Decimal(item.amount).toDecimalPlaces(2), direction: item.direction, pending: Boolean(item.pending), providerUpdatedAt: item.updatedAt ? new Date(item.updatedAt) : null, version: { increment: 1 } } : { bankSyncRunId: run.id }, select: { id: true, normalizedExternalTransactionId: true } });
        if (decision === "UPDATE") updated += 1;
        if (decision === "REDLIVERED") { duplicates += 1; continue; }
        if (!account.financialAccountId || record.normalizedExternalTransactionId) continue;
        const outcome = await normalizeProviderTransaction(tx, actor.businessId, actor.actorUserId, record.id, item, account.financialAccountId);
        if (outcome.created) imported += 1;
        if (outcome.created || outcome.duplicate) await tx.bankProviderTransaction.update({ where: { id: record.id }, data: { normalizedExternalTransactionId: outcome.externalTransactionId } });
        if (outcome.duplicate) duplicates += 1;
      }
      await tx.bankSyncRun.update({ where: { id: run.id }, data: { status: "COMPLETED", cursorAfter: page.cursor, importedCount: imported, duplicateCount: duplicates, updatedCount: updated, completedAt: new Date() } });
      await tx.bankConnection.update({ where: { id: connection.id }, data: { state: "CONNECTED", syncCursor: page.cursor, lastSuccessfulSyncAt: new Date(), errorCode: null, errorMessage: null, version: { increment: 1 } } });
      await tx.auditEvent.create({ data: { actorType: "USER", businessId: actor.businessId, actorMembershipId: actor.actorUserId, action: "UPDATE", entityType: "BankSyncRun", entityId: run.id, afterJson: { imported, duplicates, updated }, metadataJson: { providerId: connection.providerId, accountingEffect: "none" } } });
    });
    return { ok: true as const, imported, duplicates, updated };
  } catch (error) {
    const reconnect = error instanceof Error && /RECONNECT_REQUIRED/i.test(error.message);
    // Provider errors can contain sensitive implementation detail; persist only a stable state.
    const message = reconnect ? "Reconnect required before the next sync." : "Provider sync failed; retry after reviewing the connection.";
    await prisma.$transaction([prisma.bankSyncRun.update({ where: { id: run.id }, data: { status: "FAILED", errorCode: reconnect ? "RECONNECT_REQUIRED" : "SYNC_FAILED", errorMessage: message, completedAt: new Date() } }), prisma.bankConnection.update({ where: { id: connection.id }, data: { state: reconnect ? "RECONNECT_REQUIRED" : "NEEDS_ATTENTION", errorCode: reconnect ? "RECONNECT_REQUIRED" : "SYNC_FAILED", errorMessage: message, version: { increment: 1 } } })]);
    return { ok: false as const, message: reconnect ? "Reconnect this financial institution before syncing again." : "The bank sync failed safely; review the connection before retrying." };
  }
}

export async function getBankConnectionWorkspace(businessId: string) {
  const [connections, accounts] = await Promise.all([prisma.bankConnection.findMany({ where: { businessId }, include: { accounts: { include: { financialAccount: { select: { name: true } } }, orderBy: { name: "asc" } }, syncRuns: { orderBy: { startedAt: "desc" }, take: 1 } }, orderBy: { createdAt: "desc" } }), prisma.financialAccount.findMany({ where: { businessId, ownership: "BUSINESS", isActive: true }, select: { id: true, name: true, institutionName: true, type: true, lastFour: true, bankFeedMethod: true }, orderBy: { name: "asc" } })]);
  return { liveProviderConfigured: plaidConfigured(), accounts, connections: connections.map((connection) => ({ id: connection.id, providerId: connection.providerId, institutionName: connection.institutionName, state: connection.state, lastAttemptedSyncAt: connection.lastAttemptedSyncAt?.toISOString() ?? null, lastSuccessfulSyncAt: connection.lastSuccessfulSyncAt?.toISOString() ?? null, lastRun: connection.syncRuns[0] ? { status: connection.syncRuns[0].status, imported: connection.syncRuns[0].importedCount, duplicates: connection.syncRuns[0].duplicateCount, updated: connection.syncRuns[0].updatedCount, removed: connection.syncRuns[0].removedCount, error: connection.syncRuns[0].errorMessage } : null, accounts: connection.accounts.map((account) => ({ id: account.id, name: account.name, type: account.accountType, lastFour: account.maskedLastFour, isSelected: account.isSelected, financialAccountId: account.financialAccountId, financialAccountName: account.financialAccount?.name ?? null })) })) };
}
