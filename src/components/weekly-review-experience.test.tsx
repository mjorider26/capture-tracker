import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WeeklyReviewExperience } from "./weekly-review-experience";

const action = async () => ({ ok: true });

describe("WeeklyReviewExperience", () => {
  it("renders grouped, mobile-safe per-record tasks without raw IDs", () => {
    const html = renderToStaticMarkup(<WeeklyReviewExperience review={null} tasks={[{ id: "transaction-awaiting-review:private-record-id", category: "Transactions", title: "Review Office supplies", explanation: "Classify this transaction.", detail: "Aug 1, 2026 · $25.00 · pending review", href: "/money/private-record-id", state: "UNRESOLVED" }]} basePath="/app" startAction={action} completeAction={action} reopenAction={action} />);
    expect(html).toContain("Transactions");
    expect(html).toContain("Unresolved");
    expect(html).toContain("/app/money/private-record-id");
    expect(html).not.toContain("transaction-awaiting-review:private-record-id");
    expect(html).toContain("sm:px-6");
  });

  it("renders the empty state", () => {
    const html = renderToStaticMarkup(<WeeklyReviewExperience review={null} tasks={[]} basePath="/app" startAction={action} completeAction={action} reopenAction={action} />);
    expect(html).toContain("Nothing needs your attention right now.");
  });
});
