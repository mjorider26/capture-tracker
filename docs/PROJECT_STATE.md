# Capture Tracker project state

Capture Tracker is a mobile-first S-corporation bookkeeping and financial-review application using Next.js App Router, PostgreSQL, Prisma, Better Auth, and server-derived business scope.

## Completed foundation

- Phases 1–6 established secure accounting, authentication and business authorization, deterministic fictional demo data, responsive Today/Money surfaces, and full PostgreSQL integrity/concurrency validation.
- Phase 7 added reconciliation and immutable journal reversals.
- Phase 8 added the Taxes workspace, owner compensation information, and database-backed external tax-payment recording.
- Phase 9A established the Cloudflare/OpenNext/Neon repository foundation without creating a provider resource.
- Phase 9B repository preparation added fictional-staging configuration guards, migration/bootstrap safeguards, future smoke and Neon verification tools, Linux CI preparation, bundle verification tooling, and boundary/recovery/cost documentation.
- Phase 9B.1 updated Next to 16.2.12, moved OpenNext to exact build-only tooling, removed the deferred R2 binding from fictional staging, and added dependency-separation release checks. Production audit improved from 12 high/1 moderate to 6 high/1 moderate, but the staging gate is blocked by the remaining Next/Prisma findings and missing Linux Worker artifact evidence.

## Current boundary

Local/test data and free-preview staging are fictional-only. Production is undeployed, `CAPTURE_TRACKER_REAL_DATA_APPROVED=false`, and no real customer onboarding is allowed. No Cloudflare, Neon, R2, or AWS resource currently exists. R2 remains deferred and is not declared for fictional staging. No restore drill or live cloud cost verification has occurred.

## Recommended next work

**Phase 9B.1 remediation follow-up — obtain a supported upstream fix for runtime-relevant Next/Prisma findings, then run the Linux OpenNext artifact gate before any fictional staging release.**

Pending external-session work after the blocked release gate is cleared: Linux OpenNext build and actual bundle measurement, provider account setup, Neon migrations, fictional cloud bootstrap, Worker deployment, reachable browser testing, Neon integrity and concurrency proof, backup/restore drill, and live cost verification. No R2 resource is in scope.

The existing fictional demo remains deterministic and has nine transactions, six original journal entries, a pending `$125.00` review, and no credentials until a later explicit fictional-staging bootstrap supplies a secure runtime-only fictional login. OneDrive Git cleanup stays disabled; the local integration suite remains intentionally isolated.
