import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { YearEndReadinessExperience } from "./year-end-readiness-experience";

describe("year-end flight check", () => {
  it("separates owner blockers from CPA review across all eight stages", () => {
    const html = renderToStaticMarkup(<YearEndReadinessExperience year={2026} status="ISSUES_REMAIN" checks={[
      { key: "imports", label: "Imports", count: 2, detail: "Review imported activity." },
    ]} cpaReviewItems={[
      { key: "shareholder-benefits", label: "Benefits", count: 1, detail: "Professional judgment remains." },
    ]} />);

    ["Books", "Owner Money", "Payroll", "Basis", "Benefits", "Fixed assets", "CPA review items", "CPA package"].forEach((label) => expect(html).toContain(label));
    expect(html).toContain("NEEDS YOU");
    expect(html).toContain("CPA REVIEW");
    expect(html).not.toContain("TAX RETURN READY");
  });

  it("offers auditable CPA handoff actions only in the ready state", () => {
    const html = renderToStaticMarkup(<YearEndReadinessExperience year={2026} status="READY_FOR_CPA" checks={[]} />);

    expect(html).toContain("READY FOR CPA");
    expect(html).toContain("Invite CPA");
    expect(html).toContain("Open CPA Access");
    expect(html).toContain("Download CPA Package");
  });

  it("keeps demo stage links inside real demo routes", () => {
    const html = renderToStaticMarkup(<YearEndReadinessExperience year={2026} status="ISSUES_REMAIN" checks={[
      { key: "assets", label: "Assets", count: 1, detail: "Review possible fixed assets." },
    ]} basePath="/demo" />);

    expect(html).toContain('href="/demo/taxes"');
    expect(html).not.toContain('href="/app/');
    expect(html).not.toContain('/demo/taxes/fixed-assets');
  });
});
