import { describe, expect, it } from "vitest";

import { importExampleTemplate } from "./example-templates";

describe("import example templates", () => {
  it("contains only fictional bank and card examples with supported columns", () => {
    expect(importExampleTemplate("bank")?.content).toContain("date,description,amount");
    expect(importExampleTemplate("credit-card")?.content).toContain("date,description,debit,credit");
  });

  it("provides a fictional payroll summary and rejects an unknown kind", () => {
    expect(importExampleTemplate("payroll-summary")?.content).toContain("pay_date,gross_wages");
    expect(importExampleTemplate("unknown")).toBeNull();
  });
});
