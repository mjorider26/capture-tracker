# First-client first-week monitoring

Use this lightweight, privacy-preserving checklist for the first seven days after a separately approved client onboarding. Inspect sanitized counts, status categories, timings, and exception classes only; do not create invasive analytics or copy client content.

## Daily checks (days 1-7)

- **Application:** liveness/readiness, authenticated error categories, Worker exceptions, and reported navigation/session friction.
- **Documents:** upload outcomes, clean/rejected/failed scan categories, queue wait and scan latency, pending documents older than the operational threshold, retries, and DLQ activity.
- **Database:** availability, applied migration inventory, and unexpected constraint/transaction failures.
- **Accounting:** journal balance checks, reconciliation anomalies, and report-consistency exceptions.
- **Storage:** private R2 access/cleanup failures and detectable orphaned quarantine or active objects; do not enumerate or expose object keys.
- **Auth:** sign-in/session problems and authorization denials by sanitized category.
- **UX:** reported receipt-camera, file-picker, scan-wait, document-view, and removal friction.

## Escalation

Treat an accounting-integrity, cross-tenant, authorization, or document-read-gating failure as critical: pause the affected write/access workflow, preserve sanitized evidence, and follow the production incident cheat sheet. A scanner outage is fail-closed: documents remain quarantined and unreadable.

## Day 7 review

Review only aggregate operational evidence, support themes, the V1.1 backlog, and incremental infrastructure usage. Do not turn monitoring observations into production feature changes without the V1 change-control decision.
