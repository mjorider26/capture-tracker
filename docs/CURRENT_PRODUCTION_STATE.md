# Current Capture Tracker Production State

**CAPTURE TRACKER V2.4 — PRODUCTION READY; PLAID CORRECTIVE RELEASE ACTIVE (2026-08-12).** The authoritative operating instructions are in [Capture Tracker Production Operations](CAPTURE_TRACKER_PRODUCTION_OPERATIONS.md).

- Immutable application tag: `v2.0.0` → `6883719f82796a919e53f080d2dcf15f2fc13b0a`.
- Current accepted application release: `56cb6ce43f15eb01c5613f9103c11f05dfce731c`; exact-SHA CI [run 31668638940](https://github.com/mjorider26/capture-tracker/actions/runs/31668638940), passed. It supersedes failed Plaid candidate `437300964d14a800b9998724355e3011a7938620`.
- Production application Worker: `264c3d32-e8e3-4993-b4d8-8720dad2839e`; deployed OpenNext build ID `omJISJs_EGlZwnD5bkiFJ`. The scanner remains `5a813776-4648-4d9e-b033-77da395b5f07` and was not redeployed.
- Production has 30 completed migrations with zero pending, including the two additive Plaid migrations. Existing financial accounts remained `MANUAL`; the release created no Plaid Item, Plaid-mapped account, webhook event, or fabricated financial history.
- Fresh encrypted pre-release and post-release logical backups completed: AES-256-GCM+scrypt, private-backup upload, checksum verification, sanitized version-3 manifests bound to the accepted source, and isolated restore verification. Both record exact 30-migration source alignment with zero pending; the post-release restore verified 86 tables, 14 functions, 11 triggers, 315 constraints, and matching sanitized counts.
- Production health liveness and readiness pass with `Cache-Control: no-store`; protected application responses remain private/no-store. Production remains a private owner pilot with a separate Neon database, private documents bucket, and private backups bucket.
- V2.4 adds the Guided Financial Routine: Today leads with Books Current Through and Run My Books; Quick Add and Money use owner language; month-end, periodic S-Corp review, year-end CPA handoff, contextual help, and Finder remain guided entry points to the existing protected workflows. It preserves review-first bookkeeping, immutable accounting history, reconciliation, protected CPA packages, operator-controlled invitations, and balanced opening-balance cutover. It does not infer tax, depreciation, legal, payroll, or CPA conclusions.
- Plaid production configuration is active with sanitized secret presence verified, `PLAID_ENV=production`, and key version `1`. Provider availability is independent of connection count: automatic bank sync and first-class manual CSV are both supported, and zero Items is a valid customer state.
- Production has zero real Plaid Items, zero Plaid-mapped accounts, and zero Plaid webhook events. The active webhook endpoint rejects unsigned requests with `401`; JWK retrieval, ES256 verification, exact raw-body hashing, five-minute freshness, tenant resolution, and replay protection passed exact-source automated verification. Plaid-originated Production delivery and authenticated link-token initialization remain deferred to the first physical owner connection acceptance.
- `PLAID_TOKEN_ENCRYPTION_KEY` is durable production infrastructure. Do not rotate it after Items exist without an approved key-version and token-re-encryption procedure.
- The first-owner bootstrap is closed. Additional clients use only the private operator-controlled, email-bound one-time invitation workflow. The operator is allowlisted by secret, never receives tenant membership, and no public signup or database workaround is allowed.
- August 2026 is not ready to lock: one business-account reconciliation remains unresolved. Use the normal reconciliation workflow; do not bypass, backdate, or force a close.

`quoteready-api` is unrelated infrastructure and is never a Capture Tracker deployment target.

## Applied V2.1 S-Corp workpaper boundary

The V2.1 workpaper migration and Owner Money workpaper center are applied in production. Historical production tax facts remain intentionally unfilled: basis defaults to **BASIS WORKPAPER INCOMPLETE**, reimbursement policy to **REIMBURSEMENT POLICY NEEDS REVIEW**, and shareholder benefits to **WORKPAPER NOT CONFIGURED** until documented facts are entered.
