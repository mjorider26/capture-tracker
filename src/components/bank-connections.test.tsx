import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./plaid-link-button", () => ({ PlaidLinkButton: () => <button>Connect securely with Plaid</button> }));

import { BankConnections } from "./bank-connections";

const action = async () => ({ ok: true });

describe("Bank Connections customer choice", () => {
  it("presents automatic and manual paths as equal per-account choices", () => {
    const html = renderToStaticMarkup(<BankConnections liveProviderConfigured canManage accounts={[{ id: "account-1", name: "Business Checking", institutionName: "Example Bank", type: "CHECKING", lastFour: "1234", bankFeedMethod: "MANUAL" }]} connections={[]} mapAction={action} methodAction={action} selectionAction={action} syncAction={action} disconnectAction={action}/>);
    expect(html).toContain("How would you like Capture Tracker to get your bank activity?");
    expect(html).toContain("Connect automatically"); expect(html).toContain("Import it myself");
    expect(html).toContain("You can change this later. Different accounts can use different methods.");
    expect(html).toContain("Connect bank"); expect(html).toContain("Import CSV");
  });

  it("does not expose management controls to a read-only professional", () => {
    const html = renderToStaticMarkup(<BankConnections liveProviderConfigured canManage={false} accounts={[]} connections={[]} mapAction={action} methodAction={action} selectionAction={action} syncAction={action} disconnectAction={action}/>);
    expect(html).toContain("read-only professional access"); expect(html).not.toContain("Connect securely with Plaid"); expect(html).not.toContain("Disconnect institution");
  });
});
