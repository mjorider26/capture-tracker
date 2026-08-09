# Current Capture Tracker Production State

**CAPTURE TRACKER V2.0.0 — PRODUCTION READY (2026-08-08).** The authoritative operating instructions are in [Capture Tracker Production Operations](CAPTURE_TRACKER_PRODUCTION_OPERATIONS.md).

- Immutable application tag: `v2.0.0` → `6883719f82796a919e53f080d2dcf15f2fc13b0a`.
- Current accepted application release: `16909236550987b101650c71c8e86fad93effa70`; exact-SHA CI [run 31291899019](https://github.com/mjorider26/capture-tracker/actions/runs/31291899019), passed.
- Production application Worker: `19bad3aa-5511-4282-b500-5e17c30c5c15`; the scanner remains `5a813776-4648-4d9e-b033-77da395b5f07`.
- Production has 23 migrations applied, including `20260809180000_add_operator_invitations_and_cutover`.
- A fresh encrypted logical backup completed before release lock: AES-256-GCM+scrypt, private-backup upload, checksum verification, and sanitized manifest receipt. Isolated restore verification remains the only approved restore-drill target.
- Production health liveness and readiness pass. Production remains a private owner pilot with a separate Neon database, private documents bucket, and private backups bucket.
- V2 supports review-first bookkeeping for CSV evidence, owner activity, reimbursements, payroll evidence and immutable reversals, possible fixed assets and owner-confirmed in-service facts, month/year-end readiness, reconciliation, protected CPA packages, operator-controlled invitations, and balanced opening-balance cutover. It does not infer tax, depreciation, legal, payroll, or CPA conclusions.
- The first-owner bootstrap is closed. Additional clients use only the private operator-controlled, email-bound one-time invitation workflow. The operator is allowlisted by secret, never receives tenant membership, and no public signup or database workaround is allowed.
- August 2026 is not ready to lock: one business-account reconciliation remains unresolved. Use the normal reconciliation workflow; do not bypass, backdate, or force a close.

`quoteready-api` is unrelated infrastructure and is never a Capture Tracker deployment target.
