# V2 S-Corp accounting scope and boundaries

Capture Tracker V2 records reviewed accounting facts for a target single-owner service-business S-Corp. It is not a payroll processor, tax filing service, bank, or substitute for owner/CPA judgment.

## Included

- CSV bank and card ingestion with duplicate controls and reviewed double-entry posting.
- Explicit owner/company transfer review, personally-paid expense claims, and reimbursement workpapers.
- Provider-neutral payroll-result entry with deterministic arithmetic, balanced payroll journals, and explicit bank-evidence matching.
- Ledger-backed tax cockpit facts: income, salary, payroll-tax activity, distributions, estimated-tax records, and owner/CPA compensation workpapers.
- Fixed-asset register workpapers. Possible assets require explicit review; the product does not select capitalization or depreciation policy.
- Month-end close checklist and period lock, only after deterministic blockers are resolved.
- Existing ledger reports, reconciliation workflow, private supporting documents, audit history, and CSV exports.

## Deliberately not automated

- Payroll calculation, payroll payment, tax filing, tax payment, reasonable-compensation determination, depreciation method, shareholder basis calculation, or other professional tax conclusions.
- Automatic capitalization, automatic classification of owner transfers, or forced matching of ambiguous payroll evidence.

## Remaining product gaps

PDF and ZIP CPA packages are not produced by this release; existing protected CSV report and ledger exports remain the supported export boundary. A CPA may use the report print view to produce a PDF only after independently reviewing it. No raw R2 URLs are exported.
