# Current Capture Tracker Production State

**CAPTURE TRACKER V2.3 — PRODUCTION READY (2026-08-11).** The authoritative operating instructions are in [Capture Tracker Production Operations](CAPTURE_TRACKER_PRODUCTION_OPERATIONS.md).

- Immutable application tag: `v2.0.0` → `6883719f82796a919e53f080d2dcf15f2fc13b0a`.
- Current accepted application release: `fbe81db1625f634c5ff4cfcb3ba0ee47a84dff00`; exact-SHA CI [run 31462481881](https://github.com/mjorider26/capture-tracker/actions/runs/31462481881), passed.
- Production application Worker: `03ca7100-130a-4f8f-827a-a1f25ea66420`; the scanner remains `5a813776-4648-4d9e-b033-77da395b5f07` and was not redeployed.
- Production has 28 completed migrations, including all V2.2 operational-independence migrations.
- Fresh encrypted V2.3 pre-release and post-release logical backups completed: AES-256-GCM+scrypt, private-backup upload, checksum verification, sanitized version-3 manifests, and isolated restore verification. Both record exact 28-migration source alignment with zero pending migrations; the post-release restore verified the source-derived structural inventory and matching sanitized counts.
- Production health liveness and readiness pass with `Cache-Control: no-store`; protected application responses remain private/no-store. Production remains a private owner pilot with a separate Neon database, private documents bucket, and private backups bucket.
- V2 supports review-first bookkeeping for CSV evidence, owner activity, reimbursements, payroll evidence and immutable reversals, possible fixed assets and owner-confirmed in-service facts, month/year-end readiness, reconciliation, protected CPA packages, operator-controlled invitations, and balanced opening-balance cutover. It does not infer tax, depreciation, legal, payroll, or CPA conclusions.
- Plaid is not activated. CSV import remains the complete supported accounting-ingestion fallback.
- The first-owner bootstrap is closed. Additional clients use only the private operator-controlled, email-bound one-time invitation workflow. The operator is allowlisted by secret, never receives tenant membership, and no public signup or database workaround is allowed.
- August 2026 is not ready to lock: one business-account reconciliation remains unresolved. Use the normal reconciliation workflow; do not bypass, backdate, or force a close.

`quoteready-api` is unrelated infrastructure and is never a Capture Tracker deployment target.

## Applied V2.1 S-Corp workpaper boundary

The V2.1 workpaper migration and Owner Money workpaper center are applied in production. Historical production tax facts remain intentionally unfilled: basis defaults to **BASIS WORKPAPER INCOMPLETE**, reimbursement policy to **REIMBURSEMENT POLICY NEEDS REVIEW**, and shareholder benefits to **WORKPAPER NOT CONFIGURED** until documented facts are entered.
