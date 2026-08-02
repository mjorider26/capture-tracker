import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActivityViewer, PilotSettings } from "./pilot-experience";

const action = async () => ({ ok: true });
const settings = { business: { displayName: "Northstar", timezone: "America/Los_Angeles", fiscalYearStartMonth: 1 }, onboarding: null, settings: { defaultReportPeriod: "month", weeklyReviewDay: 1, retentionMonths: 84, updatedAt: new Date("2026-08-01T12:00:00Z") } };

describe("Activity and Settings UI", () => {
  it("shows a useful empty Activity state and accessible filters", () => {
    const html = renderToStaticMarkup(<ActivityViewer data={{ events: [], total: 0, page: 1, size: 20, filters: { module: "", q: "", from: "", to: "", order: "newest" } }}/>);
    expect(html).toContain("Your history will appear here");
    expect(html).toContain("Search activity");
    expect(html).not.toContain("No records match");
  });

  it("renders safe activity labels with exact, mobile-safe links", () => {
    const html = renderToStaticMarkup(<ActivityViewer basePath="/app" data={{ events: [{ key: "safe-key", module: "Transactions", label: "Transaction corrected", detail: "Recorded activity", at: new Date(), href: "/money/private-id" }], total: 1, page: 1, size: 20, filters: { module: "", q: "", from: "", to: "", order: "newest" } }}/>);
    expect(html).toContain("Transaction corrected"); expect(html).toContain("/app/money/private-id"); expect(html).not.toContain("safe-key");
  });

  it("renders persisted settings with a stale-update token and labelled controls", () => {
    const html = renderToStaticMarkup(<PilotSettings state={settings} action={action}/>);
    expect(html).toContain('name="expectedUpdatedAt"'); expect(html).toContain("Weekly Review day"); expect(html).toContain("Settings changes are recorded in Activity");
  });
});
