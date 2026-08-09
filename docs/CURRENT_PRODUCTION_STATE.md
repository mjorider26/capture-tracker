# Current Capture Tracker Production State

**CAPTURE TRACKER V2.2 — PRODUCTION READY (2026-08-09).** The authoritative operating instructions are in [Capture Tracker Production Operations](CAPTURE_TRACKER_PRODUCTION_OPERATIONS.md).

- Immutable application tag: `v2.0.0` → `6883719f82796a919e53f080d2dcf15f2fc13b0a`.
- Current accepted application release: `da40d2d97fa6f106aad647f5a18d1cebb6015dc3`; exact-SHA CI [run 31337501235](https://github.com/mjorider26/capture-tracker/actions/runs/31337501235), passed.
- Production application Worker: `50bfa04c-47c5-4907-a653-ef74a9878e8f`; the scanner remains `5a813776-4648-4d9e-b033-77da395b5f07` and was not redeployed.
- Production has 28 completed migrations, including all V2.2 operational-independence migrations.
- Fresh encrypted pre-migration and post-release logical backups completed: AES-256-GCM+scrypt, private-backup upload, checksum verification, and sanitized version-3 manifests. The pre-migration artifact records the completed 25-migration predecessor; the post-release artifact records exact 28-migration source alignment. Isolated restore verification remains the only approved restore-drill target.
- Production health liveness and readiness pass. Production remains a private owner pilot with a separate Neon database, private documents bucket, and private backups bucket.
- V2 supports review-first bookkeeping for CSV evidence, owner activity, reimbursements, payroll evidence and immutable reversals, possible fixed assets and owner-confirmed in-service facts, month/year-end readiness, reconciliation, protected CPA packages, operator-controlled invitations, and balanced opening-balance cutover. It does not infer tax, depreciation, legal, payroll, or CPA conclusions.
- Plaid is not activated. CSV import remains the complete supported accounting-ingestion fallback.
- The first-owner bootstrap is closed. Additional clients use only the private operator-controlled, email-bound one-time invitation workflow. The operator is allowlisted by secret, never receives tenant membership, and no public signup or database workaround is allowed.
- August 2026 is not ready to lock: one business-account reconciliation remains unresolved. Use the normal reconciliation workflow; do not bypass, backdate, or force a close.

`quoteready-api` is unrelated infrastructure and is never a Capture Tracker deployment target.

## Applied V2.1 S-Corp workpaper boundary

The V2.1 workpaper migration and Owner Money workpaper center are applied in production. Historical production tax facts remain intentionally unfilled: basis defaults to **BASIS WORKPAPER INCOMPLETE**, reimbursement policy to **REIMBURSEMENT POLICY NEEDS REVIEW**, and shareholder benefits to **WORKPAPER NOT CONFIGURED** until documented facts are entered.
