import { describe, expect, it } from "vitest";

import { buildGuidedFinancialRoutine, routineScale } from "./guided-financial-routine";
import type { WeeklyReviewTask, WeeklyReviewTaskCategory } from "../services/weekly-review-tasks-core";

const task = (category: WeeklyReviewTaskCategory, id: string): WeeklyReviewTask => ({ id, category, title: id, explanation: id, detail: id, href: "/money", state: "UNRESOLVED" });

describe("guided financial routine", () => {
  it("orders only relevant owner-action sections", () => {
    const steps = buildGuidedFinancialRoutine([task("Payroll", "payroll"), task("Documents", "receipt"), task("Money Coming In", "invoice")]);
    expect(steps.map((step) => step.category)).toEqual(["Documents", "Money Coming In", "Payroll"]);
    expect(steps.map((step) => step.tasks.length)).toEqual([1, 1, 1]);
  });

  it("uses factual scale copy without invented precision", () => {
    expect(routineScale(0)).toBe("Nothing needs review");
    expect(routineScale(1)).toBe("1 thing needs review");
    expect(routineScale(3)).toContain("A few minutes");
    expect(routineScale(9)).toBe("9 things need review");
  });
});
