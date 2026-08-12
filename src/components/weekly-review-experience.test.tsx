import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WeeklyReviewExperience } from "./weekly-review-experience";

const action = async () => ({ ok: true });

describe("Run My Books", () => {
  it("renders factual progress and protected task links without raw IDs", () => {
    const html = renderToStaticMarkup(<WeeklyReviewExperience review={null} tasks={[{ id: "transaction-awaiting-review:private-record-id", category: "Transactions", title: "Review Office supplies", explanation: "Classify this transaction.", detail: "Aug 1, 2026 · $25.00 · pending review", href: "/money/private-record-id", state: "UNRESOLVED" }]} booksCurrent={{ date: "2026-08-07T12:00:00.000Z", blocker: { count: 1, date: "2026-08-08T12:00:00.000Z", label: "Transactions" } }} basePath="/app" startAction={action} completeAction={action} reopenAction={action} />);
    expect(html).toContain("Run My Books");
    expect(html).toContain("Step 1 of 1");
    expect(html).toContain("/app/money/private-record-id");
    expect(html).not.toContain("transaction-awaiting-review:private-record-id");
    expect(html).toContain("Almost done");
  });

  it("skips irrelevant sections and renders the current-through finish state", () => {
    const html = renderToStaticMarkup(<WeeklyReviewExperience review={null} tasks={[]} booksCurrent={{ date: "2026-08-07T12:00:00.000Z", blocker: null }} basePath="/app" startAction={action} completeAction={action} reopenAction={action} />);
    expect(html).toContain("Every active review step is clear.");
    expect(html).toContain("Books current through: Aug 7, 2026");
    expect(html).not.toContain("Step 1 of");
  });

  it("does not expose mutation controls to a CPA read-only reviewer", () => {
    const html = renderToStaticMarkup(<WeeklyReviewExperience review={null} tasks={[]} booksCurrent={{ date: null, blocker: null }} basePath="/app" startAction={action} completeAction={action} reopenAction={action} canMutate={false} />);
    expect(html).toContain("Read-only professional review");
    expect(html).not.toContain("Start Run My Books</button>");
  });
});
