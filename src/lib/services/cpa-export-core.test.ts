import { describe, expect, it } from "vitest";
import { createPdfIndex, createZip } from "./cpa-export-core";

describe("CPA export package primitives", () => {
  it("creates a PDF index with a valid header and the supplied report names", () => {
    const pdf = new TextDecoder().decode(createPdfIndex("CPA package", ["Profit and Loss", "Trial Balance"]));
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf).toContain("Profit and Loss");
    expect(pdf).toContain("%%EOF");
  });

  it("stores every requested schedule in a ZIP without truncating names or contents", () => {
    const zip = new TextDecoder().decode(createZip([{ name: "profit-and-loss.csv", content: "all rows" }, { name: "trial-balance.csv", content: "all accounts" }]));
    expect(zip).toContain("profit-and-loss.csv");
    expect(zip).toContain("all rows");
    expect(zip).toContain("trial-balance.csv");
    expect(zip).toContain("all accounts");
  });
});
