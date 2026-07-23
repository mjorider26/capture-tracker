# Capture Tracker project state

Capture Tracker is a mobile-first S-corporation bookkeeping and financial-review product.

- Phase 1 secure accounting foundation: `2676949`
- Phase 2 authentication and business authorization: `44f2e99`, `cf071e1`
- Phase 3 safe fictional demo data and CLI Prisma boundary: `e3c586a`
- Phase 4 adds the server-rendered Today read model, local-only demo preview, shared responsive shell, and calculation coverage.
- Phase 5 adds business-scoped Money lists and details plus owner-only transaction review. Pending transactions can be approved as business, excluded as personal, or approved as mixed with exact Decimal splits. Reviews use exact version equality, run atomically with append-only audit evidence, and never alter posted, reversed, locked-period, voided, or already-reviewed records.

The stack remains Next.js App Router, PostgreSQL, Prisma, Better Auth, and server-derived business scope. Money review does not create or post journal entries; Taxes, Documents, and Ask AI remain placeholder destinations. No onboarding, bank sync, imports, uploads, AI calls, bulk review, reversal workflow, or production demo access are implemented.

The fictional demo now has 9 transactions, including one unposted $125.00 pending review transaction. `npm run demo:restore` resets only that known mutable transaction and its splits, never audit evidence; `npm run money:verify` verifies the non-destructive Money baseline.

Next recommended phase: journal correction/reversal and reconciliation workflows for reviewed records, retaining the current immutable accounting boundary.

Local caveats: this repository is in OneDrive, so Git cleanup is intentionally disabled. The integration suite uses its own local PostgreSQL service and `npm run test:integration:local` manages its safe lifecycle.
