import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OnboardingProgress } from "./onboarding-progress";

describe("first-time setup roadmap", () => {
  it("explains the product and presents one seven-step path using existing setup state", () => {
    const html = renderToStaticMarkup(<OnboardingProgress state={{ openingBalancesPosted: false, ownerMoneyInitialized: false, payrollYtdEstablished: false, fixedAssetsReviewed: false, initialReconciliationComplete: false }} />);

    ["Business", "Accounts", "Starting books", "Owner &amp; payroll", "First activity", "Initial reconciliation", "Ready"].forEach((label) => expect(html).toContain(label));
    expect(html).toContain("Keep the company");
    expect(html).toContain('aria-current="step"');
    expect(html).toContain("1 of 7 complete");
  });
});
