import { z } from "zod";

const money = z.string().trim().regex(/^\d{1,12}(?:\.\d{1,2})?$/, "Enter a non-negative amount with at most two decimals.");
const positiveMoney = money.refine((value) => Number(value) > 0, "Enter an amount greater than zero.");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.");

export const payrollEntrySchema = z.object({
  payPeriodStart: date,
  payPeriodEnd: date,
  payDate: date,
  grossWages: positiveMoney,
  federalWithholding: money.default("0"),
  stateLocalWithholding: money.default("0"),
  employeeSocialSecurity: money.default("0"),
  employeeMedicare: money.default("0"),
  otherDeductions: money.default("0"),
  employerSocialSecurity: money.default("0"),
  employerMedicare: money.default("0"),
  otherEmployerPayrollTax: money.default("0"),
  netPay: money,
  providerFee: money.default("0"),
  cashAccountId: z.string().regex(/^[A-Za-z0-9_-]{1,191}$/),
  payrollProvider: z.string().trim().max(120).optional().default(""),
  externalReference: z.string().trim().max(120).optional().default(""),
  documentId: z.string().regex(/^[A-Za-z0-9_-]{1,191}$/).optional().or(z.literal("")),
  reviewConfirmed: z.literal("on", { error: "Review the deterministic accounting preview before recording payroll." }),
}).superRefine((value, context) => {
  if (value.payPeriodEnd < value.payPeriodStart) context.addIssue({ code: "custom", path: ["payPeriodEnd"], message: "The pay period cannot end before it begins." });
  if (value.payDate < value.payPeriodEnd) context.addIssue({ code: "custom", path: ["payDate"], message: "The pay date cannot precede the pay-period end." });
});

const cents = (value: string) => Math.round(Number(value) * 100);
const asMoney = (value: number) => (value / 100).toFixed(2);

export function payrollPreview(input: z.infer<typeof payrollEntrySchema>) {
  const employeeWithholding = cents(input.federalWithholding) + cents(input.stateLocalWithholding);
  const employeePayrollTax = cents(input.employeeSocialSecurity) + cents(input.employeeMedicare);
  const employerPayrollTax = cents(input.employerSocialSecurity) + cents(input.employerMedicare) + cents(input.otherEmployerPayrollTax);
  const liabilities = employeeWithholding + employeePayrollTax + employerPayrollTax + cents(input.otherDeductions);
  const cash = cents(input.netPay) + cents(input.providerFee);
  const debits = cents(input.grossWages) + employerPayrollTax + cents(input.providerFee);
  const credits = liabilities + cash;
  return {
    employeeWithholding: asMoney(employeeWithholding),
    employeePayrollTax: asMoney(employeePayrollTax),
    employerPayrollTax: asMoney(employerPayrollTax),
    payrollLiabilities: asMoney(liabilities),
    cashCredit: asMoney(cash),
    debits: asMoney(debits),
    credits: asMoney(credits),
    balanced: debits === credits,
    netPayCheck: cents(input.grossWages) - employeeWithholding - employeePayrollTax - cents(input.otherDeductions) === cents(input.netPay),
  };
}

export function payrollMatchStatus(expected: string, actual: string) {
  const difference = cents(actual) - cents(expected);
  if (difference === 0) return "MATCHED" as const;
  if (cents(actual) === 0) return "UNMATCHED" as const;
  return cents(actual) > 0 && cents(actual) < cents(expected) ? "PARTIAL" as const : "DIFFERENCE" as const;
}
