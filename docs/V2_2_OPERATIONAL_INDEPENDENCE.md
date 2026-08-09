# Capture Tracker V2.2 operational independence

V2.2 supports a focused single-owner service-business S-Corp workflow. It records owner-confirmed facts and balanced accounting; it does not make tax, legal, or CPA conclusions.

## Bank and card evidence

CSV import remains first-class. The Bank Connections surface is provider-ready and intentionally says **LIVE BANK PROVIDER NOT CONFIGURED** until a separately authorized real provider is enabled. Test providers are never exposed in the authenticated production product. Imported/provider activity is evidence, enters the same review queue, and never posts accounting automatically.

## Invoices and receivables

Owners can create customers, draft and issue service invoices, provide payment instructions, share a strongly tokenized read-only public invoice, and download its PDF. Under an explicit accrual policy, issue records Accounts Receivable and revenue; payment clears AR and records cash. Under cash policy, issuance remains operational and payment records the accounting event. Missing policy stays **ACCOUNTING POLICY NEEDS REVIEW**. Partial/full payment, exact-amount evidence matching, and later corroborating bank evidence avoid duplicate settlement journals.

## Bills and payables

Owners can create vendors, record supported bills, approve them, and record partial/full payment. Supporting documents must be ACTIVE and CLEAN. Accrual approval records expense/asset and Accounts Payable; payment clears AP. Cash-basis treatment does not expense both approval and payment. A later matching bank item corroborates rather than duplicates an existing payment.

## Mileage and accountable-plan workpapers

Mileage trips retain substantiation facts and the dated policy/rate applied. Owners enter an authoritative source when establishing the policy; Capture Tracker does not guess IRS rates or mileage eligibility. Missing policy is **MILEAGE POLICY NEEDS REVIEW**. A substantiated trip may create an accountable-plan reimbursement claim through the existing Owner Money workflow, where salary, distribution, reimbursement, contribution, shareholder loan, basis, and benefits remain distinct.

## CPA access

Owners invite a CPA with a secure, copied invitation link, can revoke pending/accepted access, and control CPA document access. CPA access is business-scoped and read-only. Document access requires CPA_READ_ONLY, owner permission, ACTIVE status, and CLEAN scan state; private document retrieval rechecks that policy. CPA packages are owner-only and exclude invitation/public tokens, provider tokens, document bytes, storage URLs, and infrastructure metadata.

## Reporting and handoff

Operational reports cover invoice/bill registers, open items, AR/AP aging, payments, mileage logs, and reimbursement summaries. The owner-only CPA package includes those V2.2 schedules plus bank/import summary, ledger reports, S-Corp workpapers, and a PDF index. Report detail pagination never turns a partial result into a complete total.

## Release boundary

V2.2 source verification does not authorize production backup, production database migration, production Worker deployment, or real provider activation. Those actions require separate explicit owner authorization after an exact-source CI result.
