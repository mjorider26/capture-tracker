import { describe, expect, it } from "vitest";
import { findWorkspaceEntries, isWorkspaceEntryAvailable, quickAddEntries, workspaceEntriesForRole } from "./owner-intent-navigation";

describe("guided owner navigation catalog", () => {
  it("keeps the curated owner launcher complete and business-language only", () => {
    expect(quickAddEntries("OWNER").map((entry) => entry.label)).toEqual(["Create invoice", "Add bill", "Add receipt", "Record mileage", "Record owner-paid expense", "Record owner transfer", "Import transactions"]);
    expect(quickAddEntries("OWNER").some((entry) => entry.label.includes("JournalEntry"))).toBe(false);
  });

  it("finds major workflows through natural owner terms", () => {
    expect(findWorkspaceEntries("invoice", "OWNER").map((entry) => entry.label)).toEqual(expect.arrayContaining(["Create invoice", "Open invoices", "Who owes me money? (AR Aging)"]));
    expect(findWorkspaceEntries("mileage", "OWNER").map((entry) => entry.label)).toEqual(expect.arrayContaining(["Record mileage", "Mileage log"]));
    expect(findWorkspaceEntries("CPA", "OWNER").map((entry) => entry.label)).toEqual(expect.arrayContaining(["Manage CPA access", "CPA package", "Year-End Flight Check"]));
    expect(findWorkspaceEntries("reconcile", "OWNER").map((entry) => entry.label)).toEqual(expect.arrayContaining(["Reconciliation", "Books Current Through"]));
  });

  it("filters every owner mutation from CPA read-only results", () => {
    const cpaEntries = workspaceEntriesForRole("CPA_READ_ONLY");
    expect(cpaEntries.every((entry) => !entry.ownerOnly)).toBe(true);
    expect(quickAddEntries("CPA_READ_ONLY")).toEqual([]);
    expect(findWorkspaceEntries("invoice", "CPA_READ_ONLY").map((entry) => entry.label)).not.toContain("Create invoice");
    expect(findWorkspaceEntries("mileage", "CPA_READ_ONLY").map((entry) => entry.label)).not.toContain("Record mileage");
  });

  it("does not advertise unavailable routes in the fictional demo shell", () => {
    const demoActions = quickAddEntries("OWNER").filter((entry) => isWorkspaceEntryAvailable("/demo", entry));
    expect(demoActions.map((entry) => entry.label)).toEqual(["Add receipt", "Record owner-paid expense", "Record owner transfer", "Import transactions"]);
    expect(demoActions.map((entry) => entry.label)).not.toContain("Create invoice");
  });
});
