import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { plaidClient, PlaidProviderError, plaidLinkTokenFailureTelemetry } from "./client";

describe("Plaid typed HTTPS client", () => {
  beforeEach(() => {
    process.env.PLAID_ENV = "sandbox"; process.env.PLAID_CLIENT_ID = "client"; process.env.PLAID_SECRET = "secret";
    vi.restoreAllMocks();
  });

  it("collects every transactions/sync page before returning a cursor", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ added: [{ transaction_id: "pending-1", account_id: "account-1", date: "2026-08-01", name: "Supplier", amount: 12, pending: true }], modified: [], removed: [], next_cursor: "cursor-1", has_more: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ added: [], modified: [{ transaction_id: "posted-1", account_id: "account-1", date: "2026-08-02", authorized_date: "2026-08-01", name: "Supplier", amount: 12, pending: false, pending_transaction_id: "pending-1" }], removed: [{ transaction_id: "pending-1" }], next_cursor: "cursor-2", has_more: false }), { status: 200 }));
    const batch = await plaidClient.transactionsSync("access-sandbox-test-1", null);
    expect(batch.cursor).toBe("cursor-2"); expect(batch.added).toHaveLength(1); expect(batch.modified[0].pendingTransactionRef).toBe("pending-1"); expect(batch.removed).toEqual(["pending-1"]);
    const firstBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(firstBody).toMatchObject({ count: 500, access_token: "access-sandbox-test-1" });
    expect(firstBody).not.toHaveProperty("cursor");
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({ cursor: "cursor-1" });
  });

  it("restarts from the original cursor after a mutation-during-pagination response", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ added: [], modified: [], removed: [], next_cursor: "partial", has_more: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error_code: "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION", error_type: "TRANSACTIONS_ERROR" }), { status: 400 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ added: [], modified: [], removed: [], next_cursor: "complete", has_more: false }), { status: 200 }));
    await expect(plaidClient.transactionsSync("access-sandbox-test-1", "original")).resolves.toMatchObject({ cursor: "complete" });
    expect(JSON.parse(String(fetchMock.mock.calls[2][1]?.body))).toMatchObject({ cursor: "original" });
  });

  it("omits new products in update mode", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ link_token: "link-sandbox-test", expiration: "2026-08-12T00:00:00Z" }), { status: 200 }));
    await plaidClient.createLinkToken({ clientUserId: "ct_user", webhookUrl: "https://example.com/api/plaid/webhook", redirectUri: "https://example.com/app/money/bank", accessToken: "access-sandbox-test-1" });
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body).toMatchObject({ access_token: "access-sandbox-test-1" }); expect(body).not.toHaveProperty("products");
  });

  it("retains only sanitized Plaid response diagnostics", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      error_code: "INVALID_FIELD",
      error_type: "INVALID_REQUEST",
      error_message: "redirect_uri must be configured in the Plaid Dashboard",
      request_id: "request_AbC123",
    }), { status: 400 }));
    let caught: unknown;
    try { await plaidClient.createLinkToken({ clientUserId: "ct_user", webhookUrl: "https://example.com/api/plaid/webhook", redirectUri: "https://example.com/app/money/bank" }); } catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(PlaidProviderError);
    expect(plaidLinkTokenFailureTelemetry(caught)).toEqual({
      event: "PLAID_LINK_TOKEN_CREATE_FAILED",
      failure_stage: "provider_response",
      http_status: 400,
      error_type: "INVALID_REQUEST",
      error_code: "INVALID_FIELD",
      error_message: "redirect_uri must be configured in the Plaid Dashboard",
      request_id: "request_AbC123",
    });
  });

  it("drops sensitive provider messages and classifies pre-provider failures", () => {
    const sensitive = new PlaidProviderError("INVALID_FIELD", "INVALID_REQUEST", 400, "request_1", "link-production-sensitive-token was rejected");
    expect(plaidLinkTokenFailureTelemetry(sensitive)).toMatchObject({ error_message: null, request_id: "request_1" });
    expect(plaidLinkTokenFailureTelemetry(new Error("PLAID_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key."))).toMatchObject({
      failure_stage: "local_setup",
      http_status: null,
      error_code: "ENCRYPTION_KEY_INVALID",
      request_id: null,
    });
  });
});
