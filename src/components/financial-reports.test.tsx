import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FinancialReports } from "./financial-reports";

describe("FinancialReports operational navigation", () => {
  it("exposes AR, AP, and mileage reports from the authenticated reports landing page", () => {
    const html = renderToStaticMarkup(
      <FinancialReports
        basePath="/app"
        focus="cash-activity"
        reports={{
          range: { period: "ytd", start: "2026-01-01T00:00:00.000Z", end: "2026-12-31T00:00:00.000Z", label: "Year to date" },
          cashActivity: { openingCash: "0.00", inflows: "0.00", outflows: "0.00", netChange: "0.00", endingCash: "0.00" },
        } as never}
      />,
    );

    ["ar-aging", "ap-aging", "mileage-log", "mileage-reimbursements"].forEach((report) => {
      expect(html).toContain(`href="/app/reports/operations?report=${report}"`);
    });
    expect(html).toContain('href="/app/taxes/owner-money"');
  });
});
