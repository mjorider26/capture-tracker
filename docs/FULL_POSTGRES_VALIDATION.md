# Full PostgreSQL accounting-write validation

Capture Tracker uses local PostgreSQL 17 for high-risk accounting-write validation. Prisma Dev/PGlite remains useful for ordinary read-model work, unit tests, and lower-risk integration checks, but its deferred-trigger engine has previously closed during an exact mixed-review write. Do not weaken production constraints to accommodate it.

## Safety boundary

Only these local databases are permitted:

- `capture_tracker_fullpg_validation`
- `capture_tracker_fullpg_integration`

Ignored `.env.full-postgres.local` supplies the local admin, validation, and integration URLs plus `CAPTURE_TRACKER_FULLPG_CONFIRMATION=CAPTURE_TRACKER_FULLPG_VALIDATION_ONLY`. URLs must be PostgreSQL URLs on the discovered local host and port, use those exact database names, and never equal `DATABASE_URL`. Credentials and complete URLs must never be committed or printed.

## Commands

- `npm run fullpg:prepare` validates the local targets, creates only missing approved databases, deploys existing migrations, and checks status.
- `npm run fullpg:seed` requires both existing demo gates and the full-PostgreSQL confirmation, then safely seeds the fictional Jordan Ellis / Northstar Field Solutions validation data.
- `npm run postgres:verify` verifies the validation seed plus the 11 triggers, 23 constraints, and 14 functions.
- `npm run test:integration:postgres` runs business-isolation and transaction-review integration tests only against the dedicated integration database.
- `npm run postgres:write:validate` executes the $125.00 mixed review twice through the real service, proves stale-version conflicts and audit atomicity, restores the baseline twice, and proves invalid split, reimbursement, ledger, period, and locked-period writes fail at commit and roll back.
- `npm run check:accounting` runs the complete full-PostgreSQL suite. It is intentionally separate from `check:phase` and fails rather than falling back when configuration is absent.

## Phase 8 tax-payment evidence

`npm run postgres:write:validate` also exercises the real tax-payment service against the same disposable validation database. It records a deterministic $125.00 external payment with simultaneous same-key calls, proving exactly one persisted payment, estimate-version increment, and audit event. An exact replay returns `ALREADY_RECORDED` without mutation; changed facts with the same key return an idempotency conflict; a fresh stale key and a fresh fabricated-future key each leave no payment row or audit event because the transaction rolls back.

The exercise verifies that recording a tax payment creates no `Transaction` or `JournalEntry` and does not alter payroll or distributions. It restores the known fictional fixture twice and confirms the restored payment baseline while retaining append-only audit evidence. The migration adds a nullable idempotency key and PostgreSQL unique index on `(businessId, estimateId, idempotencyKey)`, preserving historical NULL compatibility while providing database-backed scoped duplicate prevention.

## Result and future use

On local PostgreSQL 17, the exact mixed review commits with two exact splits, increments once, appends one audit event, and creates no journal entry. Invalid deferred writes are rejected at commit and leave no splits, audit event, or version change. The demo restoration is idempotent and preserves append-only audits.

Future accounting-write phases must run `npm run check:accounting` before commit. A disposable PostgreSQL CI service is recommended when a CI workflow is introduced; this repository has no existing CI workflow to extend. Full PostgreSQL validation does not replace production deployment verification.
