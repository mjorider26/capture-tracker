# Capture Tracker project state

Capture Tracker is a mobile-first S-corporation bookkeeping and financial-review application using Next.js App Router, PostgreSQL, Prisma, Better Auth, and server-derived business scope.

## Completed foundation

- Phases 1–6 established secure accounting, authentication and business authorization, deterministic fictional demo data, responsive Today/Money surfaces, and full PostgreSQL integrity/concurrency validation.
- Phase 7 added reconciliation and immutable journal reversals.
- Phase 8 added the Taxes workspace, owner compensation information, and database-backed external tax-payment recording.
- Phase 9A established the Cloudflare/OpenNext/Neon repository foundation without creating a provider resource.
- Phase 9B repository preparation added fictional-staging configuration guards, migration/bootstrap safeguards, future smoke and Neon verification tools, Linux CI preparation, bundle verification tooling, and boundary/recovery/cost documentation.
- Phase 9B.1 updated Next to 16.2.12, moved OpenNext to exact build-only tooling, removed the deferred R2 binding from fictional staging, and added dependency-separation release checks. Production audit improved from 12 high/1 moderate to 6 high/1 moderate; the gate was initially blocked by remaining Next/Prisma findings and missing Linux Worker artifact evidence.
- Phase 9B.2 isolated AWS CDK TypeScript from the root Next build and repaired the `pg-cloudflare@1.4.0` Workerd package boundary. The successful Linux OpenNext workflow now produces a 2,278-byte Worker entry below the 3 MiB guard and verifies driver packaging, configured tooling exclusions, and secret/data scans. PostCSS, Sharp, `find-my-way`, and Valibot do not yet have direct artifact-inventory/reachability evidence, so fictional staging remains decision B conditionally blocked.
- Phase 9B.3 adds sanitized Worker dependency inventory and request-entrypoint reachability tooling to the non-deploy Linux workflow. At `770668e`, Linux generated that inventory and the reachability gate rejected at least one targeted high package as request-time reachable. The private sanitized artifact must identify the exact package/path before a remediation claim; fictional staging is decision C blocked.
- Phase 9B.4 reviewed the attached artifact: `sharp@0.34.5` is only Next's unresolved conditional image-optimizer import, with no Sharp code copied into the Worker. Fixed local brand images retain `next/image` but now use the supported `images.unoptimized` configuration, avoiding the unapproved Cloudflare Images binding. The corrected artifact gate is decision B pending new Linux evidence and a fresh audit.

## Current boundary

Local/test data and free-preview staging are fictional-only. Production is undeployed, `CAPTURE_TRACKER_REAL_DATA_APPROVED=false`, and no real customer onboarding is allowed. No Cloudflare, Neon, R2, or AWS resource currently exists. R2 remains deferred and is not declared for fictional staging. No restore drill or live cloud cost verification has occurred.

## Recommended next work

**Phase 9B.3 remediation follow-up — push the inventory gate, review the uploaded sanitized Linux artifact/audit evidence for PostCSS, Sharp, `find-my-way`, and Valibot, then complete the fresh audit and trusted-build review before any fictional staging release.**

Pending external-session work after the conditional release gate is cleared: provider account setup, Neon migrations, fictional cloud bootstrap, Worker deployment, reachable browser testing, Neon integrity and concurrency proof, backup/restore drill, and live cost verification. No R2 resource is in scope.

The existing fictional demo remains deterministic and has nine transactions, six original journal entries, a pending `$125.00` review, and no credentials until a later explicit fictional-staging bootstrap supplies a secure runtime-only fictional login. OneDrive Git cleanup stays disabled; the local integration suite remains intentionally isolated.
