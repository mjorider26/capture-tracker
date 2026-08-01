# Capture Tracker project instructions

## Purpose and architecture

Capture Tracker is a mobile-first bookkeeping, S-corporation tax-planning, and weekly financial-management application for a solo S-corporation owner. It intentionally provides a focused, real accounting ledger rather than a general-purpose accounting suite.

The application uses Next.js App Router, TypeScript, PostgreSQL, Prisma 7 with `@prisma/adapter-pg`, Zod, Vitest, and Better Auth. Prisma and authentication access are server-only. Business scope is derived on the server and must never be trusted from browser input.

This Next.js version has breaking changes. Read the relevant guide in `node_modules/next/dist/docs/` before writing or changing Next.js-specific code, and heed deprecation notices.

## Security and data rules

- Never print, expose, overwrite, or commit `.env` or `.env.test.local`.
- Never add real customer, owner, credential, or production data to the repository.
- Preserve business-scoped relations, foreign keys, authorization checks, optimistic concurrency, audit protections, database constraints, and triggers.
- Do not edit an already-applied migration unless explicitly instructed.
- Do not weaken protections to make a test or seed succeed.
- Demo data must be deterministic, idempotent, transactional, locally restricted, explicitly opt-in, and unable to run against production-like database URLs.
- Financial route actions must assemble business scope and actor identity from trusted server context; browser input may never supply either value.
- Review mutations must match transaction versions by exact equality, enforce roles server-side, and append audit evidence in the same database transaction.
- Posted, reversed, locked-period, voided, and already-reviewed transaction records are immutable in review workflows. Mixed split input must use exact decimal validation; database integrity triggers remain authoritative.
- High-risk accounting writes and deferred-trigger behavior must be validated with the full-PostgreSQL commands; Prisma Dev/PGlite is not sufficient evidence. Full-PostgreSQL scripts must accept only the exact local validation database names and never fall back to the normal development database.
- Use the documented design tokens and shared UI primitives rather than arbitrary visual values. Preserve the approved logo asset exactly, use no remote fonts, make statuses textual as well as colored, and format financial values with tabular numerals. Keep business logic out of visual components.

## Accounting rules

- Use Prisma Decimal-compatible strings or `Decimal` values for financial amounts; never use JavaScript floating-point arithmetic for money.
- Posted journal entries must balance exactly, with each line debit-only or credit-only.
- Journal-entry dates must belong to open accounting periods.
- Owner distributions are equity movements, never business expenses.
- Personally paid business expenses credit owner reimbursement payable; reimbursement payments debit that payable and credit business cash.
- Transaction splits and reimbursement expenses must reconcile exactly to their parent amount or claim total.
- Payroll net pay must equal gross wages less employee withholding, employee payroll tax, and other deductions. Employer payroll tax remains separately represented.
- Finalized reconciliations are immutable and may finalize only at an exact zero difference.
- Posted journal lines are never edited; corrections use server-derived reversals in an open period.
- High-risk accounting writes require `npm run check:accounting`; demo journal reversal must not mutate normal immutable history.
- Concurrency-sensitive eligibility checks must use atomic conditional writes, not read-then-write checks.
- Tax payments are recorded, never initiated; payment history and idempotency keys are immutable.
- Tax-payment duplicate prevention must be database-backed and proven under real full-PostgreSQL concurrency; version checks do not replace uniqueness.
- Do not hardcode tax-law constants or fabricate safe-harbor or reasonable-compensation conclusions; retain a visible CPA boundary.
- Local development and local PostgreSQL are fictional-data-only: never copy real customer, banking, payroll, tax, receipt, statement, personal, financial, production data, or credentials to a workstation.
- Production and staging must be physically and credential-separate from local development. Never download production database dumps to a personal workstation or store production credentials in repository files or normal local `.env` files; staging uses fictional or formally sanitized data only.
- `free-preview-cloudflare-neon` is fictional staging only. It must reject production, real-data approval, local/Prisma database targets, unsafe names, missing TLS, and runtime/migration URL fallback. Cloud migration may only use `prisma migrate deploy` and the separate direct URL. Never run cloud bootstrap, migration, smoke, Neon verification, or deployment commands without the explicit later-session authorization and confirmations described in `docs/CLOUD_DEPLOYMENT_RUNBOOK.md`.
- Cloud production infrastructure is mandatory before real customer onboarding. Documents must use private encrypted object storage rather than local disk or PostgreSQL blobs, and production access must use authorized server-side application paths; browsers never connect directly to PostgreSQL. For the private single-owner pilot, strict synchronous file validation and private R2 access are required; malware scanning is explicitly deferred. Malware scanning is mandatory before any external, invited, shared, employee, customer, contractor, or other untrusted user may upload a document.

## Testing philosophy

Prioritize authorization, business isolation, data integrity, accounting arithmetic, stale writes, and silent-corruption prevention over test-count vanity. Run the smallest relevant tests while developing, then the required full validation suite before a phase is complete.

## Prohibited commands

Do not run `prisma migrate reset`, `prisma migrate resolve`, `prisma db push`, or `npm audit fix --force`. Do not change the local Git automatic-cleanup setting; it is intentionally disabled because this repository is in OneDrive.

## Phase completion and reporting

Before committing, run the requested formatting, Prisma validation, seed/verification, tests, integrity checks, lint, build, and `git diff --check`. Review the diff for secrets, generated files, unrelated changes, and weakened protections. Stop and report if a migration fails, a destructive database action is requested, or existing tests expose an architectural issue.

`npm run check:phase` is the standard non-destructive phase check. `npm run test:integration:local` manages only the dedicated local integration database and must never be pointed at the normal development database.

## Phase 9B.1 dependency and staging-release gate

- `@opennextjs/cloudflare` is exact build tooling, never an application runtime dependency. Keep AWS CDK, Wrangler, Prisma CLI, test runners, local database tooling, and unsafe dynamic package loading out of `src` and Worker runtime declarations; retain `@prisma/client`, `@prisma/adapter-pg`, and `pg` only through server-only application paths.
- Run `npm run dependency:separation:verify` with cloud checks. It is static evidence only: do not claim an OpenNext package is absent from the Worker until a reviewed Linux `.open-next/worker.js` exists and `npm run cloud:bundle:verify` passes against it.
- `npm run cloud:artifact:inventory` and `npm run cloud:artifact:reachability` produce the sanitized Linux Worker dependency evidence. A package-name mention in a manifest or source map is not executable-runtime evidence; do not clear the staging gate until the Linux report has no unresolved target and no request-time-reachable high target.
- Fictitious `free-preview-cloudflare-neon` staging has one private R2 binding, `capture-tracker-staging-documents`, used only by `capture-tracker-staging`. It must not use public R2 access, queues, D1, or scanning infrastructure. PostgreSQL/Neon remains required; `production-secure-aws` remains optional and undeployed.
- A staging release is blocked while any runtime-reachable high advisory, unreviewed Linux artifact, unsupported dependency path, or unreviewed untrusted-build input remains. Re-run `npm audit --omit=dev --json` after every dependency/lockfile change and immediately before any later explicitly authorized release. Do not use force fixes, lockfile hand edits, unsupported overrides, suppressions, or version downgrades to clear this gate.

Final reports state: outcome; end-to-end behavior; files changed; exact data counts; safety controls; accounting behavior; commands and pass/fail results; commit hash; and remaining risks, assumptions, or follow-up work.
