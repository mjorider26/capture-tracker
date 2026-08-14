import "server-only";

import { createHash } from "node:crypto";
import type { ProviderTransaction } from "@/lib/services/operational-independence-core";

export type PlaidEnvironment = "sandbox" | "production";
type PlaidErrorBody = { error_code?: unknown; error_type?: unknown; error_message?: unknown; request_id?: unknown };
const plaidRequestTimeoutMs = 15_000;

const safePlaidCode = (value: unknown, fallback: string) => typeof value === "string" && /^[A-Z0-9_]{1,100}$/u.test(value) ? value : fallback;
const safePlaidRequestId = (value: unknown) => typeof value === "string" && /^[A-Za-z0-9_-]{1,100}$/u.test(value) ? value : null;

function safePlaidMessage(value: unknown) {
  if (typeof value !== "string") return null;
  const message = value.replace(/[\u0000-\u001f\u007f]+/gu, " ").trim();
  if (!message || message.length > 500 || /(?:access|link|public)-(?:sandbox|production)-[A-Za-z0-9-]+|client[_ -]?id|secret|access[_ -]?token|link[_ -]?token|public[_ -]?token|encryption[_ -]?key|cookie|session[_ -]?token/iu.test(message)) return null;
  return message;
}

export class PlaidProviderError extends Error {
  constructor(
    public readonly code: string,
    public readonly type: string,
    public readonly status = 500,
    public readonly requestId: string | null = null,
    public readonly providerMessage: string | null = null,
  ) { super(`PLAID_${code}`); this.name = "PlaidProviderError"; }
}

const isOutboundTimeout = (error: unknown) => error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name);

function internalFailureCode(error: unknown) {
  if (!(error instanceof Error)) return "LINK_TOKEN_SETUP_FAILED";
  if (isOutboundTimeout(error)) return "OUTBOUND_REQUEST_TIMEOUT";
  if (error instanceof TypeError) return "OUTBOUND_REQUEST_FAILED";
  if (error.message === "PLAID_TOKEN_ENCRYPTION_KEY is not configured.") return "ENCRYPTION_KEY_MISSING";
  if (error.message === "PLAID_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.") return "ENCRYPTION_KEY_INVALID";
  if (error.message === "PLAID_ENV must be sandbox or production.") return "ENVIRONMENT_INVALID";
  if (error.message === "Plaid server credentials are not configured.") return "CREDENTIAL_BINDING_MISSING";
  if (error.message.startsWith("BETTER_AUTH_URL must be") || error.message === "Plaid webhook and redirect URLs must use HTTPS.") return "PROVIDER_URL_CONFIG_INVALID";
  return "LINK_TOKEN_SETUP_FAILED";
}

export function plaidLinkTokenFailureTelemetry(error: unknown) {
  if (error instanceof PlaidProviderError) return {
    event: "PLAID_LINK_TOKEN_CREATE_FAILED",
    failure_stage: "provider_response",
    http_status: error.status,
    error_type: error.type,
    error_code: error.code,
    error_message: safePlaidMessage(error.providerMessage),
    request_id: error.requestId,
  };
  return {
    event: "PLAID_LINK_TOKEN_CREATE_FAILED",
    failure_stage: error instanceof TypeError || isOutboundTimeout(error) ? "outbound_request" : "local_setup",
    http_status: null,
    error_type: null,
    error_code: internalFailureCode(error),
    error_message: null,
    request_id: null,
  };
}

function configuration() {
  const environment = process.env.PLAID_ENV?.trim().toLowerCase();
  const clientId = process.env.PLAID_CLIENT_ID?.trim();
  const secret = process.env.PLAID_SECRET?.trim();
  if (environment !== "sandbox" && environment !== "production") throw new Error("PLAID_ENV must be sandbox or production.");
  if (!clientId || !secret) throw new Error("Plaid server credentials are not configured.");
  return { environment, clientId, secret, baseUrl: `https://${environment}.plaid.com` };
}

export function plaidConfigured() {
  try { configuration(); return Boolean(process.env.PLAID_TOKEN_ENCRYPTION_KEY?.trim()); } catch { return false; }
}

async function request<T>(path: string, input: Record<string, unknown>): Promise<T> {
  const config = configuration();
  const response = await fetch(`${config.baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "Plaid-Version": "2020-09-14" },
    body: JSON.stringify({ client_id: config.clientId, secret: config.secret, ...input }),
    cache: "no-store",
    signal: AbortSignal.timeout(plaidRequestTimeoutMs),
  });
  const payload = await response.json().catch(() => ({})) as T & PlaidErrorBody;
  if (!response.ok) {
    const code = safePlaidCode(payload.error_code, "PROVIDER_REQUEST_FAILED");
    const type = safePlaidCode(payload.error_type, "PROVIDER_ERROR");
    throw new PlaidProviderError(code, type, response.status, safePlaidRequestId(payload.request_id), safePlaidMessage(payload.error_message));
  }
  return payload;
}

type PlaidAccount = { account_id: string; name: string; official_name?: string | null; mask?: string | null; type: string; subtype?: string | null };
type PlaidTransaction = { transaction_id: string; account_id: string; date: string; authorized_date?: string | null; name: string; merchant_name?: string | null; amount: number; pending: boolean; pending_transaction_id?: string | null };
type RemovedTransaction = { transaction_id: string };

function normalizedTransaction(item: PlaidTransaction): ProviderTransaction {
  const contentHash = createHash("sha256").update(JSON.stringify([item.account_id, item.date, item.authorized_date, item.name, item.merchant_name, item.amount, item.pending, item.pending_transaction_id])).digest("hex");
  return {
    id: item.transaction_id,
    accountRef: item.account_id,
    date: item.authorized_date ?? item.date,
    postedDate: item.pending ? null : item.date,
    description: (item.merchant_name?.trim() || item.name.trim()).slice(0, 1000),
    amount: Math.abs(item.amount).toFixed(2),
    direction: item.amount < 0 ? "INFLOW" : "OUTFLOW",
    pending: item.pending,
    pendingTransactionRef: item.pending_transaction_id ?? null,
    contentHash,
  };
}

export type PlaidSyncBatch = { cursor: string; added: ProviderTransaction[]; modified: ProviderTransaction[]; removed: string[] };

export const plaidClient = {
  async createLinkToken(input: { clientUserId: string; webhookUrl: string; redirectUri?: string; accessToken?: string }) {
    const body: Record<string, unknown> = { user: { client_user_id: input.clientUserId }, client_name: "Capture Tracker", country_codes: ["US"], language: "en", webhook: input.webhookUrl };
    if (input.accessToken) body.access_token = input.accessToken;
    else body.products = ["transactions"];
    if (input.redirectUri) body.redirect_uri = input.redirectUri;
    return request<{ link_token: string; expiration: string }>("/link/token/create", body);
  },
  exchangePublicToken(publicToken: string) {
    return request<{ access_token: string; item_id: string }>("/item/public_token/exchange", { public_token: publicToken });
  },
  itemGet(accessToken: string) {
    return request<{ item: { item_id: string; institution_id?: string | null; consent_expiration_time?: string | null } }>("/item/get", { access_token: accessToken });
  },
  accountsGet(accessToken: string) {
    return request<{ accounts: PlaidAccount[] }>("/accounts/get", { access_token: accessToken });
  },
  itemRemove(accessToken: string) { return request<{ removed: boolean }>("/item/remove", { access_token: accessToken }); },
  async institutionName(institutionId: string | null | undefined) {
    if (!institutionId) return null;
    const response = await request<{ institution: { name: string } }>("/institutions/get_by_id", { institution_id: institutionId, country_codes: ["US"] });
    return response.institution.name.slice(0, 180);
  },
  webhookVerificationKey(keyId: string) {
    return request<{ key: JsonWebKey & { kid: string; alg: string; expired_at?: number | null } }>("/webhook_verification_key/get", { key_id: keyId });
  },
  async transactionsSync(accessToken: string, initialCursor: string | null): Promise<PlaidSyncBatch> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      let cursor = initialCursor ?? "";
      const added: ProviderTransaction[] = [], modified: ProviderTransaction[] = [], removed: string[] = [];
      try {
        do {
          const page = await request<{ added: PlaidTransaction[]; modified: PlaidTransaction[]; removed: RemovedTransaction[]; next_cursor: string; has_more: boolean }>("/transactions/sync", { access_token: accessToken, ...(cursor ? { cursor } : {}), count: 500 });
          added.push(...page.added.map(normalizedTransaction));
          modified.push(...page.modified.map(normalizedTransaction));
          removed.push(...page.removed.map((item) => item.transaction_id));
          cursor = page.next_cursor;
          if (!page.has_more) return { cursor, added, modified, removed };
        } while (true);
      } catch (error) {
        if (!(error instanceof PlaidProviderError) || error.code !== "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION" || attempt === 2) throw error;
      }
    }
    throw new PlaidProviderError("SYNC_RETRY_EXHAUSTED", "TRANSACTIONS_ERROR", 500, null, null);
  },
};

export type PlaidAccountEvidence = Awaited<ReturnType<typeof plaidClient.accountsGet>>["accounts"][number];
