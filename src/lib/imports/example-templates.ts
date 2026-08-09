export type ImportExampleTemplate = "bank" | "credit-card" | "payroll-summary";

const templates: Record<ImportExampleTemplate, { filename: string; content: string }> = {
  bank: {
    filename: "capture-tracker-example-bank-import.csv",
    content: "date,description,amount,posted_date,merchant,memo,external_transaction_id\n2026-01-05,Example client payment,1250.00,2026-01-06,Example Client,Example only,BANK-EXAMPLE-001\n2026-01-07,Example office supplies,-48.25,2026-01-07,Example Office Supply,Example only,BANK-EXAMPLE-002\n",
  },
  "credit-card": {
    filename: "capture-tracker-example-credit-card-import.csv",
    content: "date,description,debit,credit,posted_date,merchant,memo,external_transaction_id\n2026-01-08,Example business software,79.00,,2026-01-09,Example Software,Example only,CARD-EXAMPLE-001\n2026-01-10,Example statement credit,,15.00,2026-01-10,Example Merchant,Example only,CARD-EXAMPLE-002\n",
  },
  "payroll-summary": {
    filename: "capture-tracker-example-payroll-summary.csv",
    content: "pay_date,gross_wages,employee_withholding,employer_taxes,net_pay,provider_reference\n2026-01-15,5000.00,1250.00,382.50,3750.00,EXAMPLE-PAYROLL-001\n",
  },
};

export function importExampleTemplate(kind: string) {
  return templates[kind as ImportExampleTemplate] ?? null;
}
