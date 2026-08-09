# V2 S-Corp accounting scope and boundaries

Capture Tracker V2 records reviewed accounting facts for a target single-owner service-business S-Corp. It is not a payroll processor, tax filing service, bank, or replacement for owner/CPA judgment.

## Supported, verified accounting workflows

- CSV bank and card ingestion with parser validation, duplicate controls, tenant scope, review-first posting, and balanced journals.
- Explicit owner/company transfer review, personally-paid expense claims, reimbursement payable settlement, and immutable audit events.
- Provider-neutral payroll-result entry with deterministic arithmetic, balanced payroll journals, exact bank-evidence matching, missing-evidence attention, and immutable reversal/void journals.
- Ledger-backed tax cockpit facts: income, salary, payroll-tax activity, distributions, estimated-tax records, and owner/CPA compensation workpapers.
- Fixed-asset register workpapers. Possible assets require explicit review; the product does not select capitalization or depreciation policy.
- Month-end close checklist, year-end readiness review, reconciliation, private supporting documents, audit history, and CSV exports.
- A protected CPA export package that creates a ZIP of tenant-scoped CSV schedules plus a PDF index. It never contains document bytes, private-object URLs, secrets, or raw R2 keys.

## Acceptance evidence

- Automated service and integration coverage verifies input validation, authorization, tenant scope, persistence, balanced posting, duplicate behavior, error handling, and downstream attention behavior for payroll evidence and reimbursements.
- The physical CSV/file-picker and CPA-download interactions are **ASSUMED — AUTOMATED COVERAGE** when the protected route, parser/output content, authorization, tenant isolation, and downstream behavior are covered. They are not represented as a manual production upload/download.
- A fictional production payroll acceptance record was corrected through the supported immutable reversal workflow; posted history was not manually deleted.

## Deliberately not automated

- Payroll calculation, payroll payment, tax filing, tax payment, reasonable-compensation determination, depreciation method, shareholder basis calculation, or other professional tax conclusions.
- Automatic capitalization, automatic classification of owner transfers, or forced matching of ambiguous payroll evidence.

## Remaining product boundaries

- A CPA must independently review the exported schedules and choose any tax, payroll, depreciation, basis, or filing treatment. Capture Tracker does not make those professional conclusions.
- It is a single-owner service-business operating system, not a general multi-entity ERP, payroll processor, or tax filing platform.
