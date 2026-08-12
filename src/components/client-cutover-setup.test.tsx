import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./install-capture-tracker", () => ({ InstallCaptureTracker: () => null }));

import { ClientCutoverSetup } from "./client-cutover-setup";

describe("first account activity method", () => {
  it("keeps manual complete by default and never auto-launches Plaid", () => {
    const html = renderToStaticMarkup(<ClientCutoverSetup action={async () => ({ ok: true, message: "" })} defaults={{ displayName: "Example", legalName: "Example, Inc.", timezone: "America/Los_Angeles", fiscalYearStartMonth: 1, ownerDisplayName: "Jordan Owner" }}/>);
    expect(html).toContain("How do you want to bring in this account&#x27;s activity?");
    expect(html).toContain("Connect automatically"); expect(html).toContain("Import manually");
    expect(html).toContain('checked="" value="MANUAL"');
    expect(html).toContain("does not open Plaid during setup");
  });
});
