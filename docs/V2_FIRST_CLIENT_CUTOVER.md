# V2 first-client cutover plan

## Decision and release baseline

**Do not cut over a new client in V2.0.0.** The application release is locked at `v2.0.0` → `6883719f82796a919e53f080d2dcf15f2fc13b0a`; exact-SHA CI `31289437348` passed, the production application Worker is `02c67662-2968-47d6-bd44-403f48bfae5b`, and production has 22 migrations applied. The decisive blocker is the absence of an approved additional-client tenant-creation and invitation workflow.

This document is a preparation checklist, not authority to enter client data. Use it only after a separately approved onboarding capability and explicit written authorization for the named client.

## Recommended QuickBooks migration approach

Use a controlled opening-balance cutover with current-year detail when the client needs operational continuity. Do not bulk-import unreviewed historical transactions simply to recreate QuickBooks.

1. Agree the cutover date, reporting basis, fiscal year, source reports, and preparer/CPA responsibilities.
2. Export and retain the approved source reports: chart of accounts, trial balance, balance sheet, profit and loss, aged receivables/payables if in scope, bank and card reconciliation reports, and payroll summaries.
3. Map accounts deliberately. Preserve account purpose and opening balances; never force an uncertain mapping. Mark missing evidence as `UNKNOWN`, unresolved matching as `NEEDS REVIEW`, and tax/depreciation/payroll judgments as `CPA REVIEW`.
4. Enter only authorized opening balances and any approved in-scope current-year detail through the supported product workflow. Reconcile each financial account to the agreed cutoff statement before relying on reports.
5. Preserve source-system access and an export archive until the owner and CPA accept the first reconciled reporting period. Capture Tracker is not a QuickBooks database clone and does not replace CPA review.

## Required data and evidence after authorization

- legal business identity, ownership, tax election, timezone, fiscal year, and supported currency;
- chart of accounts and agreed mapping;
- cutover trial balance, retained earnings/equity support, and opening balances by financial account;
- cutoff bank/card statements, outstanding transactions, and completed reconciliation evidence;
- owner contributions, distributions, reimbursements, loans, and shareholder-basis questions;
- payroll year-to-date facts, filings/payment evidence, and provider reports;
- fixed-asset register, acquisition and placed-in-service evidence, and any existing depreciation schedule for CPA review;
- open customer/vendor balances only if a separately approved scope supports them;
- source reports and explicit decisions for anything excluded from the cutover.

## Cutover checklist

- [ ] Approved onboarding capability exists and owner authorizes the named-client cutover.
- [ ] Production health/readiness, V2 tag, CI, migrations, and fresh encrypted backup receipt are verified.
- [ ] Tenant created only through the approved workflow; first login and tenant isolation verified.
- [ ] Business configuration and accounting foundation reviewed with the client/CPA.
- [ ] Source reports archived outside the application with appropriate access controls.
- [ ] Opening balances and authorized in-scope details entered, reviewed, and reconciled.
- [ ] Unknown, unresolved, and CPA-review items recorded visibly; no assumptions converted into journals.
- [ ] One authorized receipt proves the quarantine-to-Ready document path.
- [ ] Reports and trial balance reviewed against the agreed source cutoff.
- [ ] Owner approves cutover completion and the first Weekly Review date.

## First seven days of monitoring

- Daily: liveness/readiness, authentication errors, Worker errors, database connectivity, document scan Queue/DLQ, and backup receipt health.
- Daily: import duplicate/invalid rows, unresolved classifications, posted-journal balance, and report/trial-balance agreement.
- Daily: reconciliation differences, owner-money/reimbursement/payroll exceptions, fixed-asset review items, and any `UNKNOWN`/`NEEDS REVIEW`/`CPA REVIEW` label.
- At day 3 and day 7: owner review of Today, Weekly Review, Reports, and Activity; compare to source evidence and escalate discrepancies without editing history destructively.
- Never bypass month close, scanner quarantine, tenant scope, or accounting controls to make the dashboard look complete.

## August 2026 production close gate

The current production period remains **not ready to lock** because one business financial-account reconciliation is unresolved. Complete its normal statement-to-book reconciliation, leave unsupported items unresolved, and finalize only at an exact zero difference. Do not backdate, force, or bypass the August close; it is independent of the client-onboarding blocker.
