import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("Customer Onboarding 2.0 surface", () => {
  it("keeps transaction files, statements, and receipts semantically separate", () => {
    expect(source).toContain("Transaction file");
    expect(source).toContain("Bank or card statement");
    expect(source).toContain('label="PDF or image"');
    expect(source).toContain("A statement never creates transactions");
    expect(source).toContain("A receipt never becomes bank activity by itself");
  });

  it("offers equal Plaid and manual choices with an outage fallback", () => {
    expect(source).toContain("Connect automatically");
    expect(source).toContain("Import it myself");
    expect(source).toContain("Use manual import instead");
    expect(source).toContain("no transfers, payments, Auth, or money movement");
  });

  it("requires exact reconciliation, readiness, and all five tour stops", () => {
    expect(source).toContain("exactly $0.00");
    expect(source).toContain("Your starting books are confirmed");
    ["Today tells you what needs attention", "Record things as they happen", "This is your weekly routine", "Once a month", "When it’s time for your CPA"].forEach((text) => expect(source).toContain(text));
  });

  it("allows the optional tour to be skipped and points back to Help", () => {
    expect(source).toContain("Skip tour and go to Today");
    expect(source).toContain("How to Run My Books in Help");
  });
});
