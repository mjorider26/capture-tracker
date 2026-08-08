import { describe, expect, it } from "vitest";
import { payrollEntrySchema, payrollMatchStatus, payrollPreview } from "./payroll-core";

const input = { payPeriodStart: "2026-08-01", payPeriodEnd: "2026-08-15", payDate: "2026-08-20", grossWages: "1000.00", federalWithholding: "100.00", stateLocalWithholding: "20.00", employeeSocialSecurity: "62.00", employeeMedicare: "14.50", otherDeductions: "3.50", employerSocialSecurity: "62.00", employerMedicare: "14.50", otherEmployerPayrollTax: "10.00", netPay: "800.00", providerFee: "30.00", cashAccountId: "account-a", reviewConfirmed: "on" };
describe("payroll preview", () => {
  it("separates payroll liabilities, cash, wages, taxes, and provider fee into a balanced preview", () => {
    const parsed = payrollEntrySchema.parse(input);
    expect(payrollPreview(parsed)).toMatchObject({ employeeWithholding: "120.00", employeePayrollTax: "76.50", employerPayrollTax: "86.50", payrollLiabilities: "286.50", cashCredit: "830.00", debits: "1116.50", credits: "1116.50", balanced: true, netPayCheck: true });
  });
  it("rejects an invalid pay period and leaves mismatch detection to the deterministic preview", () => {
    expect(payrollEntrySchema.safeParse({ ...input, payPeriodEnd: "2026-07-31" }).success).toBe(false);
    const preview = payrollPreview(payrollEntrySchema.parse({ ...input, netPay: "801.00" }));
    expect(preview.netPayCheck).toBe(false);
  });
  it("does not force ambiguous payroll matches", () => {
    expect(payrollMatchStatus("100.00", "100.00")).toBe("MATCHED");
    expect(payrollMatchStatus("100.00", "40.00")).toBe("PARTIAL");
    expect(payrollMatchStatus("100.00", "150.00")).toBe("DIFFERENCE");
  });
});
