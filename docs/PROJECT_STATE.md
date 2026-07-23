# Capture Tracker project state

Capture Tracker is a mobile-first S-corporation bookkeeping and financial-review product.

- Phase 1 secure accounting foundation: `2676949`
- Phase 2 authentication and business authorization: `44f2e99`, `cf071e1`
- Phase 3 safe fictional demo data and CLI Prisma boundary: `e3c586a`
- Phase 4 adds the server-rendered Today read model, local-only demo preview, shared responsive shell, and calculation coverage.

The stack remains Next.js App Router, PostgreSQL, Prisma, Better Auth, and server-derived business scope. Today is read-only; Money, Taxes, Documents, and Ask AI are intentionally placeholder destinations. No onboarding, mutations, AI calls, uploads, or production demo access are implemented.

Next recommended phase: reviewed transaction workflows and Money views, using the existing scoped access and ledger protections.

Local caveats: this repository is in OneDrive, so Git cleanup is intentionally disabled. The integration suite uses its own local PostgreSQL service and `npm run test:integration:local` manages its safe lifecycle.
