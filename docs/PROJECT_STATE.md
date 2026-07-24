# Capture Tracker project state

## Phase 8 — Taxes workspace

Phase 8 adds the scoped Taxes overview and an immutable manual external-payment service. Tax payment intent is protected by a nullable UUID-style idempotency key and business/estimate-scoped unique index; exact replays add nothing, while mismatched replays conflict. The workspace shows stored estimates, exact recorded totals, payroll, distributions, truthful safe-harbor readiness, and CPA boundaries without invented tax rules. Added `npm run taxes:verify`.

**Recommended next phase: Phase 9 — Cloud Production Foundation and Real-Data Boundary.** It is mandatory before Robert or any real-client onboarding, real documents, banking, tax, payroll, or AI financial-data access. Local databases remain fictional-only.

## Phase 7 — Account reconciliation and immutable journal reversal

Phase 7 adds Money reconciliation list/detail routes and journal activity/detail routes for `/app` and fail-closed `/demo`. Reconciliation uses exact opening-plus-cleared-inflows-minus-cleared-outflows arithmetic, with a statement-minus-book difference and immutable exact-zero completion. Reversals create server-derived, exact inverted `REVERSING_ENTRY` lines in an open period while preserving original posted lines. The deterministic demo now contains one empty checking draft (statement ending `$3,550.00`); normal Today/Money counts remain 9 transactions, 6 original journal entries, `$3,550.00` cash, `$1,500.00` projected tax, one pending `$125.00` review, five tasks, six journal events, and zero credentials. Added `npm run reconciliation:verify`; high-risk evidence remains `npm run check:accounting`. Phase 8 should consider bank ingestion and statement artifacts, never historical rewrites.

Capture Tracker is a mobile-first S-corporation bookkeeping and financial-review product.

- Phase 1 secure accounting foundation: `2676949`
- Phase 2 authentication and business authorization: `44f2e99`, `cf071e1`
- Phase 3 safe fictional demo data and CLI Prisma boundary: `e3c586a`
- Phase 4 adds the server-rendered Today read model, local-only demo preview, shared responsive shell, and calculation coverage.
- Phase 5 adds business-scoped Money lists and details plus owner-only transaction review. Pending transactions can be approved as business, excluded as personal, or approved as mixed with exact Decimal splits. Reviews use exact version equality, run atomically with append-only audit evidence, and never alter posted, reversed, locked-period, voided, or already-reviewed records.
- Phase 5.5 adopts the official Capture Tracker logo, tokenized product design system, refined Today and Money list/detail/review surfaces, intentional placeholder states, responsive shell, metadata, and a fail-closed local `/demo/design-system` preview route.
- Phase 6 validates migrations, integrity triggers, secure review writes, exact optimistic concurrency, audit atomicity, and deferred-constraint rollback on local PostgreSQL 17. The exact $125.00 mixed review commits successfully on full PostgreSQL; Prisma Dev/PGlite remains unsuitable for this high-risk deferred-trigger verification path.

The stack remains Next.js App Router, PostgreSQL, Prisma, Better Auth, and server-derived business scope. Money review does not create or post journal entries; Taxes, Documents, and Ask AI remain placeholder destinations. No onboarding, bank sync, imports, uploads, AI calls, bulk review, reversal workflow, or production demo access are implemented.

The fictional demo now has 9 transactions, including one unposted $125.00 pending review transaction. `npm run demo:restore` resets only that known mutable transaction and its splits, never audit evidence; `npm run money:verify` verifies the non-destructive Money baseline.

Next recommended phase: journal correction/reversal and reconciliation workflows for reviewed records, retaining the current immutable accounting boundary and running `npm run check:accounting` before accounting-write commits.

The exact mixed-review write now passes on full PostgreSQL 17 with real commit-time deferred constraints. The remaining caveat is limited to Prisma Dev/PGlite, which may close during this deferred-trigger path; the secure workflow and trigger remain unchanged.

Local caveats: this repository is in OneDrive, so Git cleanup is intentionally disabled. The integration suite uses its own local PostgreSQL service and `npm run test:integration:local` manages its safe lifecycle.
