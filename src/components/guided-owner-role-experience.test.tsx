import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BillCenter } from "./bill-center";
import { InvoiceCenter } from "./invoice-center";
import { MileageCenter } from "./mileage-center";

const action = (async () => ({ status: "idle", message: null })) as never;

describe("CPA read-only guided workflow presentation", () => {
  it("keeps invoice, bill, and mileage evidence visible without mutation controls", () => {
    const invoices = renderToStaticMarkup(<InvoiceCenter customers={[]} accounts={[]} invoices={[]} customerAction={action} invoiceAction={action} issueAction={action} paymentAction={action} canMutate={false} />);
    const bills = renderToStaticMarkup(<BillCenter vendors={[]} accounts={[]} financialAccounts={[]} bills={[]} vendorAction={action} billAction={action} approveAction={action} paymentAction={action} canMutate={false} />);
    const mileage = renderToStaticMarkup(<MileageCenter policies={[]} trips={[]} policyAction={action} tripAction={action} reimbursementAction={action} canMutate={false} />);
    [invoices, bills, mileage].forEach((html) => expect(html).toContain("Read-only professional review"));
    expect(invoices).not.toContain("Create invoice</button>");
    expect(bills).not.toContain("Add bill</button>");
    expect(mileage).not.toContain("Save trip");
    expect(mileage).not.toContain("Mileage policy</button>");
  });
});
