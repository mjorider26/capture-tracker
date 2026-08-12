import { Prisma } from "../../generated/prisma/client";

export type AccountingBasis = "CASH" | "ACCRUAL" | "NEEDS_REVIEW";
export type OpenItemStatus = "CURRENT" | "1_30" | "31_60" | "61_90" | "90_PLUS";

/** No implicit cash/accrual assumption: an absent, malformed, or stale policy remains review-only. */
export function accountingBasisFromPolicy(content: string | null | undefined): AccountingBasis {
  const normalized = content?.trim().toUpperCase() ?? "";
  if (/\bACCRUAL\b/.test(normalized) && !/\bCASH\b/.test(normalized)) return "ACCRUAL";
  if (/\bCASH\b/.test(normalized) && !/\bACCRUAL\b/.test(normalized)) return "CASH";
  return "NEEDS_REVIEW";
}

export function paymentStatus(total: string, paid: string, issued: boolean, dueDate: Date | null, now = new Date()): "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" {
  const due = new Prisma.Decimal(total), received = new Prisma.Decimal(paid);
  if (received.greaterThanOrEqualTo(due) && due.greaterThan(0)) return "PAID";
  if (received.greaterThan(0)) return "PARTIALLY_PAID";
  if (!issued) return "DRAFT";
  return dueDate && dueDate < now ? "OVERDUE" : "ISSUED";
}

export function openItemAge(dueDate: Date | null, now = new Date()): OpenItemStatus {
  if (!dueDate || dueDate >= now) return "CURRENT";
  const days = Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate())) / 86_400_000);
  return days <= 30 ? "1_30" : days <= 60 ? "31_60" : days <= 90 ? "61_90" : "90_PLUS";
}

export type ProviderTransaction = { id: string; accountRef: string; date: string; postedDate?: string | null; description: string; amount: string; direction: "INFLOW" | "OUTFLOW"; pending?: boolean; pendingTransactionRef?: string | null; contentHash?: string | null; updatedAt?: string | null };
export type ProviderPage = { cursor: string | null; transactions: ProviderTransaction[] };

export interface BankProvider {
  connect(): Promise<{ connectionRef: string; institutionName: string }>;
  exchangeToken(token: string): Promise<{ connectionRef: string }>;
  listAccounts(connectionRef: string): Promise<Array<{ id: string; name: string; type: string; lastFour: string | null }>>;
  syncTransactions(connectionRef: string, cursor: string | null): Promise<ProviderPage>;
  refreshConnection(connectionRef: string): Promise<"CONNECTED" | "RECONNECT_REQUIRED">;
  disconnect(connectionRef: string): Promise<void>;
  getConnectionHealth(connectionRef: string): Promise<"CONNECTED" | "RECONNECT_REQUIRED" | "DISCONNECTED">;
}

/** Deterministic test provider: redelivery and pending-to-posted transitions are intentional. */
export class FakeBankProvider implements BankProvider {
  #connected = true;
  constructor(private readonly pages: ProviderPage[], private readonly accounts = [{ id: "fake-checking", name: "Operating checking", type: "CHECKING", lastFour: "1234" }]) {}
  async connect() { return { connectionRef: "fake-connection", institutionName: "Capture Test Bank" }; }
  async exchangeToken(token: string) { if (token !== "fake-token") throw new Error("Provider token rejected."); return { connectionRef: "fake-connection" }; }
  async listAccounts() { return this.accounts; }
  async syncTransactions(_connectionRef: string, cursor: string | null) { if (!this.#connected) throw new Error("RECONNECT_REQUIRED"); return this.pages[Number(cursor ?? "0")] ?? { cursor: null, transactions: [] }; }
  async refreshConnection() { return this.#connected ? "CONNECTED" : "RECONNECT_REQUIRED"; }
  async disconnect() { this.#connected = false; }
  async getConnectionHealth() { return this.#connected ? "CONNECTED" : "DISCONNECTED"; }
}

export type SyncDecision = "CREATE" | "UPDATE" | "REDLIVERED";
export function decideSync(existing: Pick<ProviderTransaction, "id" | "pending" | "updatedAt" | "contentHash"> | null, incoming: ProviderTransaction): SyncDecision {
  if (!existing) return "CREATE";
  if (existing.pending && !incoming.pending) return "UPDATE";
  if (incoming.contentHash && incoming.contentHash !== existing.contentHash) return "UPDATE";
  if ((incoming.updatedAt ?? "") > (existing.updatedAt ?? "")) return "UPDATE";
  return "REDLIVERED";
}

export function mileageAmount(miles: string, ratePerMile: string): string {
  const distance = new Prisma.Decimal(miles), rate = new Prisma.Decimal(ratePerMile);
  if (!distance.greaterThan(0) || !rate.greaterThan(0)) throw new Error("Miles and the configured policy rate must be greater than zero.");
  return distance.mul(rate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2);
}

export function canMutateBusiness(role: "OWNER" | "ADVISOR" | "CPA_READ_ONLY") { return role !== "CPA_READ_ONLY"; }
