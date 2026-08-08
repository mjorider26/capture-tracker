import { z } from "zod";

const id = z.string().regex(/^[A-Za-z0-9_-]{1,191}$/);
const text = z.string().trim().max(1000).refine((value) => !/[\x00-\x1F\x7F]/.test(value), "Notes contain unsupported characters.");
export const ownerTransferSchema = z.object({
  externalTransactionId: id,
  direction: z.enum(["COMPANY_TO_OWNER", "OWNER_TO_COMPANY"]),
  classification: z.enum(["UNRESOLVED", "PAYROLL_NET_SALARY", "SHAREHOLDER_DISTRIBUTION", "REIMBURSEMENT", "SHAREHOLDER_LOAN_REPAYMENT", "OWNER_CONTRIBUTION", "SHAREHOLDER_LOAN", "OTHER"]),
  notes: text.optional().transform((value) => value || null),
});
export function classificationMatchesDirection(direction: "COMPANY_TO_OWNER" | "OWNER_TO_COMPANY", classification: string) {
  if (classification === "UNRESOLVED" || classification === "OTHER") return true;
  return direction === "COMPANY_TO_OWNER"
    ? ["PAYROLL_NET_SALARY", "SHAREHOLDER_DISTRIBUTION", "REIMBURSEMENT", "SHAREHOLDER_LOAN_REPAYMENT"].includes(classification)
    : ["OWNER_CONTRIBUTION", "SHAREHOLDER_LOAN"].includes(classification);
}
