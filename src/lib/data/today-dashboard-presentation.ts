export type TodayAttentionCounts = {
  transactions: number;
  documents: number;
  matches: number;
  reconciliations: number;
  tax: number;
  payroll: number;
  reviewTasks: number;
};

export type TodayAttentionItem = {
  id: keyof TodayAttentionCounts;
  count: number;
  label: string;
  description: string;
  destination: "money" | "documents" | "review" | "taxes";
  tone: "urgent" | "warning" | "info";
};

const definitions: Array<Omit<TodayAttentionItem, "count">> = [
  {
    id: "transactions",
    label: "Transactions awaiting review",
    description: "Classify pending business activity before it reaches the books.",
    destination: "money",
    tone: "urgent",
  },
  {
    id: "reconciliations",
    label: "Reconciliations in progress",
    description: "Finish statement evidence before closing the period.",
    destination: "money",
    tone: "urgent",
  },
  {
    id: "documents",
    label: "Documents needing review",
    description: "Validate document evidence or resolve an extraction exception.",
    destination: "documents",
    tone: "warning",
  },
  {
    id: "matches",
    label: "Suggested document matches",
    description: "Confirm a proposed link; suggestions never change the books automatically.",
    destination: "documents",
    tone: "info",
  },
  {
    id: "tax",
    label: "Tax planning items",
    description: "Review the current estimate and recorded payment evidence.",
    destination: "taxes",
    tone: "warning",
  },
  {
    id: "payroll",
    label: "Payroll items",
    description: "Review payroll records and the separately tracked tax obligation.",
    destination: "taxes",
    tone: "warning",
  },
  {
    id: "reviewTasks",
    label: "Weekly Review tasks remaining",
    description: "Continue the current review without claiming unresolved work is complete.",
    destination: "review",
    tone: "info",
  },
];

export function prioritizeTodayAttention(
  counts: TodayAttentionCounts,
): TodayAttentionItem[] {
  return definitions
    .map((definition) => ({ ...definition, count: counts[definition.id] }))
    .filter((item) => item.count > 0);
}
