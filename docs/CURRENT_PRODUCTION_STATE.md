# Current Capture Tracker Production State

**CAPTURE TRACKER V2.0.0 — PRODUCTION READY (2026-08-08).** The authoritative operating instructions are in [Capture Tracker Production Operations](CAPTURE_TRACKER_PRODUCTION_OPERATIONS.md).

- Immutable application tag: `v2.0.0` → `6883719f82796a919e53f080d2dcf15f2fc13b0a`.
- Exact-SHA CI: [run 31289437348](https://github.com/mjorider26/capture-tracker/actions/runs/31289437348), passed.
- Production application Worker: `02c67662-2968-47d6-bd44-403f48bfae5b`; the scanner remains `5a813776-4648-4d9e-b033-77da395b5f07`.
- Production has 22 migrations applied, including `20260809013000_add_fixed_asset_approval`.
- A fresh encrypted logical backup completed before release lock: AES-256-GCM+scrypt, private-backup upload, checksum verification, and sanitized manifest receipt. Isolated restore verification remains the only approved restore-drill target.
- Production health liveness and readiness pass. Production remains a private owner pilot with a separate Neon database, private documents bucket, and private backups bucket.
- V2 supports review-first bookkeeping for CSV evidence, owner activity, reimbursements, payroll evidence and immutable reversals, possible fixed assets and owner-confirmed in-service facts, month/year-end readiness, reconciliation, and a protected CPA package. It does not infer tax, depreciation, legal, payroll, or CPA conclusions.
- The first-owner bootstrap is closed. There is no supported additional-client/business onboarding flow. Do not create users, businesses, or memberships through database or operator workarounds.
- August 2026 is not ready to lock: one business-account reconciliation remains unresolved. Use the normal reconciliation workflow; do not bypass, backdate, or force a close.

`quoteready-api` is unrelated infrastructure and is never a Capture Tracker deployment target.
