import { randomUUID } from "node:crypto";

import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createPrismaClient } from "../../src/lib/database/create-prisma-client";
import { plaidClient, PlaidProviderError } from "../../src/lib/providers/plaid/client";
import { decryptPlaidAccessToken } from "../../src/lib/providers/plaid/crypto";
import {
  mapConnectedFinancialAccount,
  setFinancialAccountBankFeedMethod,
} from "../../src/lib/services/bank-sync";
import { postExternalTransaction } from "../../src/lib/services/financial-ingestion";
import {
  completePlaidReconnect,
  disconnectPlaidConnection,
  exchangePlaidPublicToken,
  processPlaidWebhookEvent,
  syncPlaidBankConnection,
} from "../../src/lib/services/plaid-bank";

config({ path: ".env.test.local", override: false });
const connectionString = process.env.TEST_DATABASE_URL?.trim();
if (!connectionString) throw new Error("TEST_DATABASE_URL is not configured.");

process.env.PLAID_ENV = "sandbox";
process.env.PLAID_CLIENT_ID = "fictional-integration-client";
process.env.PLAID_SECRET = "fictional-integration-secret";
process.env.PLAID_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 17).toString("base64");
process.env.PLAID_TOKEN_KEY_VERSION = "1";

const prisma = createPrismaClient(connectionString);
const run = randomUUID();
const ids = {
  owner: `plaid-owner-${run}`,
  otherOwner: `plaid-other-owner-${run}`,
  business: `plaid-business-${run}`,
  otherBusiness: `plaid-other-business-${run}`,
  membership: `plaid-membership-${run}`,
  otherMembership: `plaid-other-membership-${run}`,
  account: `plaid-account-${run}`,
  cashLedger: `plaid-cash-${run}`,
  expenseLedger: `plaid-expense-${run}`,
  period: `plaid-period-${run}`,
};
const actor = { businessId: ids.business, actorUserId: ids.owner, role: "OWNER" as const };
const otherActor = { businessId: ids.otherBusiness, actorUserId: ids.otherOwner, role: "OWNER" as const };
const accessToken = `access-sandbox-${run}`;
let connectionId = "";
let connectedAccountId = "";
let externalId = "";

const pending = {
  id: `pending-${run}`,
  accountRef: `provider-account-${run}`,
  date: "2026-08-01",
  postedDate: null,
  description: "Fictional pending card purchase",
  amount: "10.00",
  direction: "OUTFLOW" as const,
  pending: true,
  pendingTransactionRef: null,
  contentHash: "a".repeat(64),
};
const posted = {
  ...pending,
  id: `posted-${run}`,
  postedDate: "2026-08-02",
  description: "Fictional posted card purchase",
  pending: false,
  pendingTransactionRef: pending.id,
  contentHash: "b".repeat(64),
};

describe("Plaid Sandbox-equivalent lifecycle with full PostgreSQL integrity", () => {
  beforeAll(async () => {
    await prisma.user.createMany({ data: [
      { id: ids.owner, email: `plaid-owner-${run}@capturetracker.local`, displayName: "Plaid integration owner" },
      { id: ids.otherOwner, email: `plaid-other-${run}@capturetracker.local`, displayName: "Other integration owner" },
    ] });
    await prisma.business.createMany({ data: [
      { id: ids.business, legalName: "Plaid Integration LLC", displayName: "Plaid Integration" },
      { id: ids.otherBusiness, legalName: "Other Plaid LLC", displayName: "Other Plaid" },
    ] });
    await prisma.businessMember.createMany({ data: [
      { id: ids.membership, businessId: ids.business, userId: ids.owner, role: "OWNER" },
      { id: ids.otherMembership, businessId: ids.otherBusiness, userId: ids.otherOwner, role: "OWNER" },
    ] });
    await prisma.financialAccount.create({ data: { id: ids.account, businessId: ids.business, name: "Fictional checking", institutionName: "Sandbox Bank", type: "CHECKING", ownership: "BUSINESS", lastFour: "1111" } });
    await prisma.ledgerAccount.createMany({ data: [
      { id: ids.cashLedger, businessId: ids.business, code: "1000", name: "Fictional checking", type: "ASSET", subtype: "BANK", normalBalance: "DEBIT", financialAccountId: ids.account },
      { id: ids.expenseLedger, businessId: ids.business, code: "5900", name: "Fictional expense", type: "EXPENSE", subtype: "OTHER_EXPENSE", normalBalance: "DEBIT" },
    ] });
    await prisma.accountingPeriod.create({ data: { id: ids.period, businessId: ids.business, startsAt: new Date("2026-01-01T00:00:00.000Z"), endsAt: new Date("2026-12-31T23:59:59.999Z"), status: "OPEN" } });

    vi.spyOn(plaidClient, "exchangePublicToken").mockResolvedValue({ access_token: accessToken, item_id: `item-${run}` });
    vi.spyOn(plaidClient, "itemGet").mockResolvedValue({ item: { item_id: `item-${run}`, institution_id: `ins-${run}` } });
    vi.spyOn(plaidClient, "accountsGet").mockResolvedValue({ accounts: [{ account_id: pending.accountRef, name: "Fictional checking", official_name: null, mask: "1111", type: "depository", subtype: "checking" }] });
    vi.spyOn(plaidClient, "institutionName").mockResolvedValue("Plaid Sandbox Bank");
    vi.spyOn(plaidClient, "itemRemove").mockResolvedValue({ removed: true });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await prisma.bankWebhookEvent.deleteMany({ where: { businessId: { in: [ids.business, ids.otherBusiness] } } });
    await prisma.auditEvent.deleteMany({ where: { businessId: { in: [ids.business, ids.otherBusiness] } } });
    await prisma.bankProviderTransaction.deleteMany({ where: { businessId: { in: [ids.business, ids.otherBusiness] } } });
    await prisma.externalTransaction.deleteMany({ where: { businessId: { in: [ids.business, ids.otherBusiness] } } });
    await prisma.transactionImport.deleteMany({ where: { businessId: { in: [ids.business, ids.otherBusiness] } } });
    await prisma.bankSyncRun.deleteMany({ where: { businessId: { in: [ids.business, ids.otherBusiness] } } });
    await prisma.connectedFinancialAccount.deleteMany({ where: { businessId: { in: [ids.business, ids.otherBusiness] } } });
    await prisma.bankConnection.deleteMany({ where: { businessId: { in: [ids.business, ids.otherBusiness] } } });
    await prisma.transaction.deleteMany({ where: { businessId: { in: [ids.business, ids.otherBusiness] } } });
    await prisma.ledgerAccount.deleteMany({ where: { businessId: { in: [ids.business, ids.otherBusiness] } } });
    await prisma.accountingPeriod.deleteMany({ where: { businessId: { in: [ids.business, ids.otherBusiness] } } });
    await prisma.financialAccount.deleteMany({ where: { businessId: { in: [ids.business, ids.otherBusiness] } } });
    await prisma.businessMember.deleteMany({ where: { businessId: { in: [ids.business, ids.otherBusiness] } } });
    await prisma.business.deleteMany({ where: { id: { in: [ids.business, ids.otherBusiness] } } });
    await prisma.user.deleteMany({ where: { id: { in: [ids.owner, ids.otherOwner] } } });
    await prisma.$disconnect();
  });

  it("exchanges a Sandbox public token, encrypts the access token, maps one account, and rejects duplicate Items", async () => {
    const result = await exchangePlaidPublicToken(actor, `public-sandbox-${run}`);
    expect(result).toMatchObject({ ok: true, accountCount: 1 });
    if (!result.ok) throw new Error("Sandbox exchange failed.");
    connectionId = result.connectionId;
    const connection = await prisma.bankConnection.findUniqueOrThrow({ where: { id: connectionId }, include: { accounts: true } });
    connectedAccountId = connection.accounts[0]!.id;
    expect(connection.encryptedAccessToken).not.toContain(accessToken);
    expect(await decryptPlaidAccessToken(connection.encryptedAccessToken!, connection.accessTokenKeyVersion)).toBe(accessToken);
    await expect(mapConnectedFinancialAccount(actor, { connectedAccountId, financialAccountId: ids.account })).resolves.toMatchObject({ ok: true });
    await expect(setFinancialAccountBankFeedMethod(actor, { financialAccountId: ids.account, method: "PLAID" })).resolves.toMatchObject({ ok: true });

    const remove = vi.mocked(plaidClient.itemRemove);
    const before = remove.mock.calls.length;
    await expect(exchangePlaidPublicToken(actor, `public-sandbox-replay-${run}`)).resolves.toMatchObject({ ok: false, message: expect.stringContaining("already connected") });
    expect(remove.mock.calls.length).toBe(before);

    vi.mocked(plaidClient.itemGet).mockResolvedValueOnce({ item: { item_id: `duplicate-item-${run}`, institution_id: `ins-${run}` } });
    await expect(exchangePlaidPublicToken(actor, `public-sandbox-duplicate-${run}`)).resolves.toMatchObject({ ok: false, message: expect.stringContaining("appear to be connected already") });
    expect(remove.mock.calls.length).toBe(before + 1);
  });

  it("handles pending to posted, modifications, removals, replay-safe webhooks, and tenant isolation without rewriting posted history", async () => {
    const sync = vi.spyOn(plaidClient, "transactionsSync");
    sync.mockResolvedValueOnce({ cursor: "cursor-1", added: [pending], modified: [], removed: [] });
    await expect(syncPlaidBankConnection(actor, connectionId)).resolves.toMatchObject({ ok: true, imported: 1 });
    const pendingEvidence = await prisma.bankProviderTransaction.findFirstOrThrow({ where: { businessId: ids.business, providerTransactionRef: pending.id } });
    externalId = pendingEvidence.normalizedExternalTransactionId!;
    await expect(postExternalTransaction(actor, { externalTransactionId: externalId, ledgerAccountId: ids.expenseLedger })).resolves.toMatchObject({ ok: false, message: expect.stringContaining("pending") });
    await expect(syncPlaidBankConnection(otherActor, connectionId)).resolves.toMatchObject({ ok: false, message: expect.stringContaining("unavailable") });

    const postedTransaction = await prisma.transaction.create({ data: { businessId: ids.business, accountId: ids.account, postedAt: new Date("2026-08-01T12:00:00.000Z"), description: pending.description, amount: pending.amount, direction: pending.direction, intent: "BUSINESS", status: "APPROVED", sourceReference: `plaid-posted-${run}` } });
    await prisma.externalTransaction.update({ where: { id: externalId }, data: { status: "POSTED", postedTransactionId: postedTransaction.id } });

    sync.mockResolvedValueOnce({ cursor: "cursor-2", added: [posted], modified: [], removed: [] });
    await expect(syncPlaidBankConnection(actor, connectionId)).resolves.toMatchObject({ ok: true, imported: 0, updated: 1 });
    const postedEvidence = await prisma.bankProviderTransaction.findFirstOrThrow({ where: { businessId: ids.business, providerTransactionRef: posted.id } });
    expect(postedEvidence.normalizedExternalTransactionId).toBe(externalId);
    expect(await prisma.externalTransaction.count({ where: { businessId: ids.business } })).toBe(1);

    sync.mockResolvedValueOnce({ cursor: "cursor-3", added: [], modified: [{ ...posted, amount: "12.34", description: "Provider-corrected evidence", contentHash: "c".repeat(64) }], removed: [] });
    await expect(syncPlaidBankConnection(actor, connectionId)).resolves.toMatchObject({ ok: true });
    const immutableExternal = await prisma.externalTransaction.findUniqueOrThrow({ where: { id: externalId } });
    expect(immutableExternal.amount.toFixed(2)).toBe("10.00");
    expect(immutableExternal.description).toBe(pending.description);
    expect((await prisma.transaction.findUniqueOrThrow({ where: { id: postedTransaction.id } })).amount.toFixed(2)).toBe("10.00");

    sync.mockResolvedValueOnce({ cursor: "cursor-4", added: [], modified: [], removed: [posted.id] });
    await expect(syncPlaidBankConnection(actor, connectionId)).resolves.toMatchObject({ ok: true, removed: 1 });
    expect((await prisma.externalTransaction.findUniqueOrThrow({ where: { id: externalId } })).status).toBe("POSTED");
    expect((await prisma.bankProviderTransaction.findFirstOrThrow({ where: { businessId: ids.business, providerTransactionRef: posted.id } })).state).toBe("REMOVED");

    const webhook = await prisma.bankWebhookEvent.create({ data: { businessId: ids.business, bankConnectionId: connectionId, providerId: "plaid", requestBodySha256: "d".repeat(64), verificationSignatureSha256: randomUUID().replaceAll("-", "").padEnd(64, "e"), verificationKeyId: `key-${run}`, webhookType: "TRANSACTIONS", webhookCode: "SYNC_UPDATES_AVAILABLE" } });
    sync.mockResolvedValueOnce({ cursor: "cursor-5", added: [], modified: [], removed: [] });
    const runsBefore = await prisma.bankSyncRun.count({ where: { bankConnectionId: connectionId } });
    await processPlaidWebhookEvent(webhook.id);
    await processPlaidWebhookEvent(webhook.id);
    expect(await prisma.bankSyncRun.count({ where: { bankConnectionId: connectionId } })).toBe(runsBefore + 1);
    expect((await prisma.bankWebhookEvent.findUniqueOrThrow({ where: { id: webhook.id } })).status).toBe("COMPLETED");
  });

  it("fails closed on provider errors, supports reconnect, and disconnects without deleting history", async () => {
    const sync = vi.mocked(plaidClient.transactionsSync);
    sync.mockRejectedValueOnce(new PlaidProviderError("ITEM_LOGIN_REQUIRED", "ITEM_ERROR"));
    await expect(syncPlaidBankConnection(actor, connectionId)).resolves.toMatchObject({ ok: false, message: expect.stringContaining("Reconnect") });
    expect((await prisma.bankConnection.findUniqueOrThrow({ where: { id: connectionId } })).state).toBe("RECONNECT_REQUIRED");

    sync.mockResolvedValueOnce({ cursor: "cursor-6", added: [], modified: [], removed: [] });
    await expect(completePlaidReconnect(actor, connectionId)).resolves.toMatchObject({ ok: true });
    await expect(disconnectPlaidConnection(actor, connectionId)).resolves.toMatchObject({ ok: true });
    const connection = await prisma.bankConnection.findUniqueOrThrow({ where: { id: connectionId } });
    expect(connection.state).toBe("DISCONNECTED");
    expect(connection.encryptedAccessToken).toBeNull();
    expect((await prisma.financialAccount.findUniqueOrThrow({ where: { id: ids.account } })).bankFeedMethod).toBe("MANUAL");
    expect((await prisma.externalTransaction.findUniqueOrThrow({ where: { id: externalId } })).status).toBe("POSTED");
  });
});
