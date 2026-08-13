import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./plaid-link-button", () => ({ PlaidLinkButton: ({ connectionId }: { connectionId?: string }) => <button>{connectionId ? "Reconnect securely with Plaid" : "Connect securely with Plaid"}</button> }));

import { BankConnections } from "./bank-connections";

const action = async () => ({ ok: true });
const account = { id: "account-1", name: "Business Checking", institutionName: "Example Bank", type: "CHECKING", lastFour: "1234", bankFeedMethod: "MANUAL" as const };
const connection = (state: string) => ({
  id: "connection-1",
  providerId: "plaid",
  institutionName: "Example Bank",
  state,
  lastAttemptedSyncAt: null,
  lastSuccessfulSyncAt: null,
  lastRun: null,
  accounts: [{ id: "connected-1", name: "Checking", type: "CHECKING", lastFour: "1234", isSelected: true, financialAccountId: account.id, financialAccountName: account.name }],
});
const props = { mapAction: action, methodAction: action, selectionAction: action, syncAction: action, disconnectAction: action };

describe("Bank Connections customer choice", () => {
  it("presents automatic and manual paths as equal per-account choices", () => {
    const html = renderToStaticMarkup(<BankConnections liveProviderConfigured canManage accounts={[account]} connections={[]} {...props}/>);
    expect(html).toContain("How would you like Capture Tracker to get your bank activity?");
    expect(html).toContain("Connect automatically"); expect(html).toContain("Import it myself");
    expect(html).toContain("You can change this later. Different accounts can use different methods.");
    expect(html).toContain("Connect bank"); expect(html).toContain("Import CSV");
  });

  it("keeps manual import available when the automatic provider is unavailable", () => {
    const html = renderToStaticMarkup(<BankConnections liveProviderConfigured={false} canManage accounts={[account]} connections={[]} {...props}/>);
    expect(html).toContain("Plaid is not configured");
    expect(html).toContain("Manual transaction CSV import remains fully available");
    expect(html).toContain("Import a transaction CSV");
    expect(html).not.toContain("Connect securely with Plaid");
  });

  it("offers both choices when the provider is configured and no Item exists", () => {
    const html = renderToStaticMarkup(<BankConnections liveProviderConfigured canManage accounts={[account]} connections={[]} {...props}/>);
    expect(html).toContain("Connect securely with Plaid");
    expect(html).toContain("Import a transaction CSV");
    expect(html).toContain("No active Plaid connections");
    expect(html).not.toContain("Plaid is not configured");
  });

  it("shows an existing connection without removing the manual path", () => {
    const html = renderToStaticMarkup(<BankConnections liveProviderConfigured canManage accounts={[account]} connections={[connection("CONNECTED")]} {...props}/>);
    expect(html).toContain("Connected");
    expect(html).toContain("Mapped to Business Checking");
    expect(html).toContain("Import a transaction CSV");
    expect(html).not.toContain("Plaid is not configured");
  });

  it("keeps reconnect guidance distinct from provider configuration", () => {
    const html = renderToStaticMarkup(<BankConnections liveProviderConfigured canManage accounts={[account]} connections={[connection("RECONNECT_REQUIRED")]} {...props}/>);
    expect(html).toContain("Needs attention");
    expect(html).toContain("Reconnect securely with Plaid");
    expect(html).not.toContain("Plaid is not configured");
  });

  it("keeps a configured customer's manual-only choice first-class", () => {
    const html = renderToStaticMarkup(<BankConnections liveProviderConfigured canManage accounts={[account]} connections={[]} {...props}/>);
    expect(html).toContain("Manual CSV");
    expect(html).toContain("Import CSV");
    expect(html).toContain("Nothing starts automatically");
  });

  it("does not expose management controls to a read-only professional", () => {
    const html = renderToStaticMarkup(<BankConnections liveProviderConfigured canManage={false} accounts={[]} connections={[]} {...props}/>);
    expect(html).toContain("read-only professional access"); expect(html).not.toContain("Connect securely with Plaid"); expect(html).not.toContain("Disconnect institution");
  });
});
