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
- Use the documented design tokens and shared UI primitives rather than arbitrary visual values. Preserve the approved logo asset exactly, use no remote fonts, make statuses textual as well as colored, and format financial values with tabular numerals. Keep business logic out of visual components.

## Accounting rules

- Use Prisma Decimal-compatible strings or `Decimal` values for financial amounts; never use JavaScript floating-point arithmetic for money.
- Posted journal entries must balance exactly, with each line debit-only or credit-only.
- Journal-entry dates must belong to open accounting periods.
- Owner distributions are equity movements, never business expenses.
- Personally paid business expenses credit owner reimbursement payable; reimbursement payments debit that payable and credit business cash.
- Transaction splits and reimbursement expenses must reconcile exactly to their parent amount or claim total.
- Payroll net pay must equal gross wages less employee withholding, employee payroll tax, and other deductions. Employer payroll tax remains separately represented.

## Testing philosophy

Prioritize authorization, business isolation, data integrity, accounting arithmetic, stale writes, and silent-corruption prevention over test-count vanity. Run the smallest relevant tests while developing, then the required full validation suite before a phase is complete.

## Prohibited commands

Do not run `prisma migrate reset`, `prisma migrate resolve`, `prisma db push`, or `npm audit fix --force`. Do not change the local Git automatic-cleanup setting; it is intentionally disabled because this repository is in OneDrive.

## Phase completion and reporting

Before committing, run the requested formatting, Prisma validation, seed/verification, tests, integrity checks, lint, build, and `git diff --check`. Review the diff for secrets, generated files, unrelated changes, and weakened protections. Stop and report if a migration fails, a destructive database action is requested, or existing tests expose an architectural issue.

`npm run check:phase` is the standard non-destructive phase check. `npm run test:integration:local` manages only the dedicated local integration database and must never be pointed at the normal development database.

Final reports state: outcome; end-to-end behavior; files changed; exact data counts; safety controls; accounting behavior; commands and pass/fail results; commit hash; and remaining risks, assumptions, or follow-up work.
