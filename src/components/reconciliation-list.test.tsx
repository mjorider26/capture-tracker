import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ReconciliationList } from "./reconciliation-list";

describe("reconciliation account discovery", () => {
  it("shows a masked, actionable card even before a reconciliation record exists", () => { const html = renderToStaticMarkup(<ReconciliationList items={[{ id: null, accountId: "account-private", accountName: "Business Checking", institutionName: "Fictional Bank", lastFour: "1234", accountType: "CHECKING", statementEndDate: null, difference: null, status: "NEEDS_RECONCILIATION", needsReconciliation: true }]}/>); expect(html).toContain("Business Checking"); expect(html).toContain("•••• 1234"); expect(html).toContain("NEEDS RECONCILIATION"); expect(html).toContain("Start reconciliation"); expect(html).toContain("/start/account-private"); });
});
