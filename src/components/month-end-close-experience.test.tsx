import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CloseActionState } from "@/app/app/taxes/close/actions";

import { MonthEndCloseExperience } from "./month-end-close-experience";

const action = async (): Promise<CloseActionState> => ({ status: "idle", message: null });

describe("month-end guided close", () => {
  it("translates deterministic blockers into an ordered owner-language routine", () => {
    const html = renderToStaticMarkup(<MonthEndCloseExperience data={{ month: "2026-07", status: "BLOCKED", journalEntryCount: 12, recordedClose: null, checks: [
      { key: "imports", label: "Unresolved imports", count: 2, detail: "Review imported bank activity." },
      { key: "documents", label: "Documents", count: 0, detail: "Document checks pass." },
    ] }} action={action} />);

    expect(html).toContain("Finish July 2026");
    expect(html).toContain("2 bank transactions still need review");
    expect(html).toContain("NEEDS YOU");
    expect(html).toContain("DONE");
    expect(html).toContain('/app/money/import');
    expect(html).toContain("disabled");
  });

  it("enables the explicit close confirmation only after checks pass", () => {
    const html = renderToStaticMarkup(<MonthEndCloseExperience data={{ month: "2026-07", status: "READY_TO_CLOSE", journalEntryCount: 12, recordedClose: null, checks: [
      { key: "imports", label: "Imported activity", count: 0, detail: "All reviewed." },
    ] }} action={action} />);

    expect(html).toContain("Close July 2026");
    expect(html).toContain("Ready to close");
    expect(html).toContain("I reviewed the checklist");
  });
});
