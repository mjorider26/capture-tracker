import { describe, expect, it } from "vitest";

import { buildGuidedFinancialRoutine, routineScale } from "./guided-financial-routine";
import type { WeeklyReviewTask } from "./weekly-review-tasks-core";

const task = (category: WeeklyReviewTask["category"], id: string): WeeklyReviewTask => ({ id, category, title: id, explanation: "Owner action is required.", detail: "Fictional evidence", href: "/money", state: "UNRESOLVED" });

describe("guided financial routine", () => {
  it("keeps deterministic order and skips irrelevant steps", () => {
    const steps = buildGuidedFinancialRoutine([task("Payroll", "payroll"), task("Documents", "receipt"), task("Money Coming In", "invoice")]);
    expect(steps.map((step) => step.category)).toEqual(["Documents", "Money Coming In", "Payroll"]);
    expect(steps).toHaveLength(3);
  });

  it("uses factual scale language without invented precision", () => {
    expect(routineScale(0)).toBe("Nothing needs review");
    expect(routineScale(1)).toBe("1 thing needs review");
    expect(routineScale(3)).toContain("A few minutes");
    expect(routineScale(8)).toBe("8 things need review");
  });
});
