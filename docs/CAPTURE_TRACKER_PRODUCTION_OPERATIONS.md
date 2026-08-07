# Capture Tracker Production Operations

**Status:** CURRENT AUTHORITATIVE OPERATIONS RUNBOOK  
**Last updated:** 2026-08-06  
**Source commit:** `45b70ed3e3a69de3d6421ac46638b2bd1e0f2081`

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

The initial owner used the production first-owner bootstrap. That bootstrap is available only while no user and no business exist, then closes automatically after workspace initialization. The active production workspace is initialized. Create account is no longer normal public onboarding, existing users sign in normally, and unrestricted public signup is not approved. Future multi-client self-service onboarding requires a separate product and security approval.

The earlier invitation-based first-owner production flow is superseded. Legacy or staging invitation-related implementation details do not mean that production currently requires an invitation.

## Database and migration operations

- Use `npx prisma migrate deploy` for an approved production migration.
- Never run `prisma migrate dev`, `prisma db push`, reset, or seed against production.
- Use a direct, unpooled connection only in approved migration or backup operator workflows; the Worker uses its approved runtime database path.
- Do not copy staging, demo, or local PostgreSQL data into production.
- The required migration inventory is derived from the source checkout. The current count at time of writing is 17, but the count is not a maintained gate and must not be hardcoded.

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

Production accepts PDF, PNG, and JPEG uploads, including mobile camera receipt capture and existing-file selection. The upload path performs strict byte, MIME, and extension validation, duplicate detection, tenant-scoped private R2 storage, authorized protected reads, and audit history.

**Current private-pilot limitation:** malware scanning and quarantine are not implemented for the live upload path. Only trusted owner/private-pilot documents may be uploaded. Untrusted external uploads, including a second-client or broader external rollout, are not approved until malware scanning and quarantine are implemented.

## Product navigation and Ask AI

The primary mobile navigation is: Today, Money, Documents, Reports, and More. More contains Taxes, Weekly Review, Reconciliation, Ask AI, Activity, and Settings.

- **Today:** daily financial briefing.
- **Money:** transactions and financial activity.
- **Documents:** receipts and supporting evidence.
- **Reports:** financial statements and exports.
- **More:** secondary operational workflows.

Ask AI is read-only, uses bounded structured evidence, refuses mutation requests, and retains private-document protections. In production or when real-data approval is enabled, its local fictional adapter responds fail-closed until a separately approved production provider is configured. It cannot mutate financial data.

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
