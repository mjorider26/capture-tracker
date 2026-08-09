# Capture Tracker Production Operations

> **Current V2 release note (2026-08-08):** payroll reversal is deployed from `6ae2eab7bd2e52277c5178b37f8aa2adb685b45c`; exact-SHA CI `31285960824` passed and the application Worker is `cb88a09b-0c44-4b35-8791-aa184cc96e06`. This application-only release did not redeploy the scanner or apply a migration.

**Status:** CAPTURE TRACKER V1.0.0 — PRODUCTION READY; CURRENT AUTHORITATIVE OPERATIONS RUNBOOK
**Last updated:** 2026-08-08
**Accepted V1 application release:** `78dbb0c37991b1dbf23706bc906687eb6b24b574` (`v1.0.0`)

This runbook is for the operators of the current private production pilot. It is the source of truth for live Capture Tracker operations. Older planning, staging, and phase documents may accurately preserve their original context but can describe superseded states; do not use them as current production instructions.

Do not place credentials, passphrases, connection strings, object keys, or financial values in documentation, command history, or release evidence.

## Environment topology

| Environment | Worker and URL | Data and storage | Operating boundary |
| --- | --- | --- | --- |
| Production | `capture-tracker-production` at `https://capture-tracker-production.mjorider.workers.dev` | Separate Neon production PostgreSQL database; `capture-tracker-production-documents`; `capture-tracker-production-backups` | Live private pilot with real-data approval enabled. |
| Staging | `capture-tracker-staging` | Separate fictional staging database and `capture-tracker-staging-documents` | Live, fictional-only. Do not introduce production or customer data. |
| Unrelated | `quoteready-api` | Not Capture Tracker infrastructure | Never deploy Capture Tracker to it or modify it during Capture Tracker work. |

## Production safety model and account creation

Production is an authenticated private workspace with server-derived tenant/business scope. Financial and document reads are authorized server-side; accounting writes are controlled; journals are immutable; and corrections or reversals preserve history rather than rewriting it.

The initial owner used the production first-owner bootstrap. That bootstrap is available only while no user and no business exist, then closes automatically after workspace initialization. The active production workspace is initialized. Create account is no longer normal public onboarding, existing users sign in normally, and unrestricted public signup is not approved. **V1.0.0 has no supported operator or self-service path to create an additional production client/business.** Do not manually insert users, memberships, or businesses; future multi-client onboarding requires a separately approved product and security change.

The earlier invitation-based first-owner production flow is superseded. Legacy or staging invitation-related implementation details do not mean that production currently requires an invitation.

## Database and migration operations

- Use `npx prisma migrate deploy` for an approved production migration.
- Never run `prisma migrate dev`, `prisma db push`, reset, or seed against production.
- Use a direct, unpooled connection only in approved migration or backup operator workflows; the Worker uses its approved runtime database path.
- Do not copy staging, demo, or local PostgreSQL data into production.
- The required migration inventory is derived from the source checkout. Production has all 18 source migrations applied, including 20260807090000_document_scan_quarantine; the count is not a maintained gate and must not be hardcoded.

## Backup and recovery

Production uses encrypted logical backups and isolated restore verification. The backup command creates a PostgreSQL `pg_dump` custom-format archive, encrypts it with AES-256-GCM and a scrypt-derived key, calculates a SHA-256 checksum, uploads only the encrypted archive and sanitized manifest to the private backup bucket, then verifies the uploaded checksum.

Approved backup prefixes and lifecycle policy are:

- `production/daily/` — 30 days
- `production/pre-acceptance/` — 30 days
- `production/restore-verification/` — 7 days

Run the backup and receipt-based restore verification in the same native WSL/Linux session when required by the current tooling. Temporary plaintext and decrypted artifacts remain in `/dev/shm`, are cleaned up by the tools, and must never be worked around by exposing plaintext files or credentials.

Restore verification accepts only an isolated local WSL PostgreSQL target, checks the encrypted checksum before decryption, uses `pg_restore`, and compares migrations, schema inventory, integrity constraints, and sanitized counts with the source-derived contract. It is not a production cutover. Passphrase loss prevents decryption, so the approved secret owner must maintain the passphrase recovery process. For a real recovery, stop writes, obtain explicit recovery authorization, restore and verify an isolated target first, then plan a separately authorized cutover. Never restore a drill directly over active production.

## Financial reports and exports

Profit and Loss, Balance Sheet, Trial Balance, and Cash Activity authoritative totals use tenant-scoped database aggregation over posted journal entries. Totals are not calculated from a capped application-side journal-line set.

Supporting journal lines are database-paginated. CSV report exports remain tenant-scoped, preserve safe formatting, and are complete for the requested report data. Pilot exports with an operational 50,000-record ceiling fail visibly when too large; they never return a partial file as a successful export. Do not describe financial output as complete if an error or explicit safety limit prevents completion.

## Documents and private-pilot limitation

Production accepts PDF, PNG, and JPEG uploads, including mobile camera receipt capture and existing-file selection. Camera receipt images are normalized locally before upload: orientation is corrected by browser decode, the longest edge is capped near 1,920 pixels without upscaling, and JPEG encoding uses 0.82 quality so EXIF/GPS metadata is not carried into the normalized upload. PDFs are unchanged and the existing 10 MB server limit remains authoritative. The upload path performs strict byte, MIME, and extension validation, duplicate detection, tenant-scoped private R2 storage, authorized protected reads, and audit history.

Capture Tracker now quarantines and malware-scans new document uploads before they become readable or trusted. New bytes remain private through QUARANTINED/PENDING → Queue → SCANNING → ACTIVE + CLEAN, or remain fail-closed as QUARANTINED + SCAN_FAILED or REJECTED + INFECTED. Normal reads, signed grants, extraction, matching, transaction evidence, and Ask AI document evidence require the current document to be ACTIVE, CLEAN, private-read eligible, and not deleted.

### Scanner and document-removal operations

- Production uses the private Queue `capture-tracker-production-document-scan`, its isolated DLQ `capture-tracker-production-document-scan-dlq`, and a private ClamAV Container on `standard-1`, `max_instances=1`. No document bytes appear in Queue messages or public URLs.
- The app Worker is `cb88a09b-0c44-4b35-8791-aa184cc96e06`; the scanner Worker is `5a813776-4648-4d9e-b033-77da395b5f07`.
- The scanner has a 15-minute warm window. A measured cold run spent about 93.77 seconds on FreshClam/ClamAV readiness; Queue wait was about 1.63 seconds, private R2 fetch about 1.24 seconds, and scan time about 215 ms. Recheck a scan still pending beyond 60 seconds with sanitized Worker and Queue logs; do not weaken quarantine.
- Queue deliveries are idempotent and version-aware. Scanner unavailable, timeout, malformed response, or exhausted retries leaves the document quarantined and unreadable. Consumer retries are bounded at three with a 30-second delay, then route to the isolated DLQ.
- Promotion is database-authoritative: validate the current document version and CLEAN result, commit ACTIVE plus private-read eligibility, then clean up the quarantine object. A stale delivery cannot promote a deleted or replaced document.
- Removal is database-authoritative: tenant and relationship checks, DELETED tombstone plus private-read revocation plus version increment, commit, then exact-object R2 cleanup. A cleanup failure never resurrects bytes or grants; stale Queue work acknowledges the tombstone safely.
- Sanitized observability covers Worker failures, queue retries/DLQ, scanner readiness and latency, scan finalization/promotion recovery, and R2 cleanup/removal failures. Never log bytes, object keys, credentials, or raw antivirus output.
- The encrypted logical-backup and disposable-restore drill was revalidated with all 18 migrations: AES-256-GCM plus scrypt, SHA-256 receipt validation, private bucket storage, and a disposable restore with matching sanitized counts. Plaintext archives remain temporary only.
- Current provider pricing is usage-based under the existing Workers Paid plan; no separate scanner subscription is used. Conservative incremental estimate with a 15-minute warm window is about $0.03 for 25 scans/month, $1.32 for 100, and $9.53 for 500. Actual per-container usage analytics are provider-side and must be checked before billing decisions.
- The accepted mobile production path confirms automatic scan-status refresh from pending to terminal state without manual page refresh. Continue to measure and record real warm-path timings through sanitized operational telemetry; do not present an estimate as a measured timing.

## Product navigation

The primary mobile navigation is: Today, Money, Documents, Reports, and More. More contains Taxes, Weekly Review, Reconciliation, Activity, and Settings.

- **Today:** daily financial briefing.
- **Money:** transactions and financial activity. **Import transactions** uses bank or card CSV exports to prepare activity for review; imported evidence never posts automatically.
- **Documents:** receipts and supporting evidence.
- **Reports:** financial statements and exports.
- **More:** secondary operational workflows.

Ask AI is available only inside the authenticated tenant boundary. It may use document evidence only when the authoritative document state is ACTIVE + CLEAN; quarantined, failed, rejected, deleted, cross-tenant, and unreadable document bytes are not eligible evidence.

### CSV import and review

Money imports bank or credit-card CSV exports; it does not provide a bank feed. The operator selects the financial account, reviews detected or corrected mappings, then sees total rows, new rows, duplicates, possible duplicates, and invalid rows before confirmation. Repeating the same file is duplicate-safe. Imported activity remains separate bank evidence until an authorized reviewer accepts a deterministic classification and creates the corresponding balanced accounting entry. Ambiguous transfers, owner activity, payroll withdrawals, and possible duplicates stay unresolved rather than receiving guessed treatment. Today and Weekly Review show unresolved import exceptions only.

V2 automated acceptance uses fictional fixtures and protected application/service boundaries. Physical CSV-picker, file-picker, and CPA-download interaction is documented as **ASSUMED — AUTOMATED COVERAGE** only when route health, parser/output content, authorization, tenant scope, persistence, downstream accounting behavior, and failure handling are verified. Do not use database/operator workarounds to create or remove records.

### V2 accounting operations

- Payroll results are reviewed provider facts, not payroll execution. Payroll journals are balanced before posting. Required payroll components without imported bank evidence appear as explicit Weekly Review/Today tax attention; partial and differing evidence stays unresolved. Matching uses an idempotent tenant-scoped key and creates no additional journal.
- A processed payroll correction uses the owner-confirmed reversal workflow: create and post an opposite reversing journal, link it to the original journal, mark the payroll result VOIDED, and retain the original record and audit history. Never manually delete posted payroll history.
- A personally paid reimbursement approval posts debit expense / credit reimbursement payable exactly once. Exact company-bank payment evidence later posts debit reimbursement payable / credit company cash and marks the claim PAID. It is neither wages nor an owner distribution; ambiguous amounts are rejected rather than forced.
- The protected CPA package endpoint returns only tenant-scoped CSV schedules and a PDF index in a ZIP. It never includes receipt bytes, R2 keys, signed grants, credentials, or raw private-document URLs. Any export requires the authenticated owner context.

## Release process

1. Start from clean `main` and record the source SHA.
2. Run canonical local verification.
3. Require CI for that exact SHA; use `workflow_dispatch` if an automatic run is missing.
4. In native WSL/Linux, use NVM 0.40.3 with Node 22.23.2 and npm 10.9.8.
5. Run `npm ci`, Prisma generation, the OpenNext/Workerd build, artifact and secret scans, and a production Wrangler dry run.
6. Deploy the exact verified SHA to `capture-tracker-production` only.
7. Record both the Worker entry-shim size and the complete Wrangler upload size; they are different measurements.
8. Verify liveness and readiness without reading private financial data.

Windows OpenNext output is not the trusted native release artifact. Never print secrets while building, deploying, or collecting release evidence.

## V1 change freeze and emergency hotfixes

`v1.0.0` is feature frozen. Put visual polish, convenience features, optional automation, analytics, new AI capability, and non-critical workflow enhancements in the V1.1 backlog. A production hotfix is limited to a proven security, data-integrity, accounting, authentication, availability, or serious client-blocking UX defect. Start from the accepted release or current approved hotfix baseline, preserve the exact-SHA CI and native-release gates, and record the deployed Worker version. Do not move the `v1.0.0` tag.

## Health and incident response

- `GET /api/health/live` proves that the Worker can serve its liveness contract.
- `GET /api/health/ready` proves that required runtime dependencies are ready for service.

For an incident:

1. Confirm the deployed Worker version and source commit.
2. Check `/api/health/live` and `/api/health/ready`.
3. Inspect sanitized Worker logs and the recent deployment record.
4. Check database connectivity and private R2 access failures.
5. Roll back only the Worker when it is safe to do so.
6. Do not destructively roll back database migrations; use a specific recovery plan.

## Never do this

- Never use staging or local PostgreSQL as production.
- Never copy staging user, transaction, or document data into production.
- Never store production credentials in tracked files or print secrets during deployment.
- Never run `prisma migrate dev` or seed production.
- Never expose either R2 bucket publicly.
- Never treat `quoteready-api` as a Capture Tracker resource.
- Never restore a backup over active production during a drill or truncate production for acceptance cleanup.
- Never present partial financial report output as complete.
