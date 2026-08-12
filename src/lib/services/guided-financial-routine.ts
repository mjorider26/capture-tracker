import type { WeeklyReviewTask, WeeklyReviewTaskCategory } from "./weekly-review-tasks-core";

export type GuidedRoutineStep = {
  category: WeeklyReviewTaskCategory;
  completeLabel: string;
  description: string;
  label: string;
  tasks: WeeklyReviewTask[];
};

const routineCopy: Record<WeeklyReviewTaskCategory, Omit<GuidedRoutineStep, "category" | "tasks">> = {
  Transactions: { label: "Transactions", description: "Decide how unresolved bank and card activity belongs in the books.", completeLabel: "Transactions caught up" },
  Documents: { label: "Receipts & documents", description: "Resolve only evidence that needs an owner decision.", completeLabel: "Receipts and documents caught up" },
  "Money Coming In": { label: "Money coming in", description: "Resolve customer-payment and overdue-invoice exceptions.", completeLabel: "Money coming in looks good" },
  "Money Going Out": { label: "Money going out", description: "Resolve bill and outgoing-payment exceptions that need attention now.", completeLabel: "Money going out looks good" },
  "Owner Money": { label: "Owner Money", description: "Keep transfers and reimbursements between you and the S-Corp explicit.", completeLabel: "Owner Money caught up" },
  Payroll: { label: "Payroll", description: "Resolve only payroll evidence or bank-matching exceptions.", completeLabel: "Payroll looks good" },
  Reconciliation: { label: "Reconciliation", description: "Continue statement work only when reconciliation needs attention.", completeLabel: "Reconciliation looks good" },
  "Periodic Review": { label: "Periodic owner check", description: "Review an occasional tax or workpaper item without making it part of every week.", completeLabel: "Periodic review caught up" },
};

const routineOrder: WeeklyReviewTaskCategory[] = ["Transactions", "Documents", "Money Coming In", "Money Going Out", "Owner Money", "Payroll", "Reconciliation", "Periodic Review"];

export function buildGuidedFinancialRoutine(tasks: WeeklyReviewTask[]): GuidedRoutineStep[] {
  return routineOrder.flatMap((category) => {
    const relevant = tasks.filter((task) => task.category === category);
    return relevant.length ? [{ category, ...routineCopy[category], tasks: relevant }] : [];
  });
}

export function routineScale(taskCount: number) {
  if (taskCount === 0) return "Nothing needs review";
  if (taskCount === 1) return "1 thing needs review";
  if (taskCount <= 4) return `${taskCount} things need review · A few minutes`;
  return `${taskCount} things need review`;
}
