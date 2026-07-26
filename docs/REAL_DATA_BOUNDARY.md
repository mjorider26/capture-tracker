# Real-data boundary

## Current state

All local development, local PostgreSQL validation, tests, and demo records are fictional-only. Free-preview staging is also fictional-only. Production is undeployed and `CAPTURE_TRACKER_REAL_DATA_APPROVED` remains `false`.

No real client onboarding is allowed. The repository must not contain real customer, banking, payroll, tax, receipt, statement, personal, financial, production, credential, or provider-account data. No Cloudflare, Neon, R2, or AWS resource currently exists.

## Enforced staging boundary

`free-preview-cloudflare-neon` only accepts Cloudflare staging with fictional data, paid-service approval false, customer onboarding false, no R2 binding, a TLS-required Neon pooled runtime URL, and a separate TLS-required direct migration URL. It rejects production, real-data approval, localhost, Prisma Dev, unsafe database names, non-Neon targets, and local `DATABASE_URL` fallback.

The only future bootstrap is `cloud:bootstrap:fictional`. It is a CLI command, not an HTTP endpoint. It needs the exact staging profile, explicit confirmation, secure runtime-only fictional `.demo` login input, and an empty-or-known deterministic fictional database. It is idempotent, refuses foreign identity/business data, and never prints the password. It must never be run automatically.

## Approval gate

Real data requires a later, separate production-readiness decision and cannot be enabled by the staging profile. That decision must include deployed production infrastructure, separate credentials, backup/recovery evidence, document storage controls, access review, and explicit authorization. This Phase 9B preparation grants none of those approvals.
