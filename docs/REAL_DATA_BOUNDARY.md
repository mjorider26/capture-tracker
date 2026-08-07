# Real-data boundary

> **SUPERSEDED / HISTORICAL**
>
> This document describes an earlier Capture Tracker implementation state and must not be used as the current production operations source of truth. See [Capture Tracker Production Operations](CAPTURE_TRACKER_PRODUCTION_OPERATIONS.md).

## Current state

All local development, local PostgreSQL validation, tests, and demo records are fictional-only. Free-preview staging is also fictional-only. Production is undeployed and `CAPTURE_TRACKER_REAL_DATA_APPROVED` remains `false`.

No real client onboarding is allowed. The repository must not contain real customer, banking, payroll, tax, receipt, statement, personal, financial, production, credential, or provider-account data. No Cloudflare, Neon, R2, or AWS resource currently exists.

Phase 10A document records are fictional metadata only. Phase 10B additionally permits local-fictional PDF/JPEG/PNG bytes only under the ignored `.document-storage/` development root. Those bytes must never be real receipts, banking statements, tax, payroll, customer, personal, financial, production, credential, or provider-account data. The local adapter rejects production and real-data approval; it has no cloud configuration, provider URL, bucket, account ID, access key, or public URL.

Document reads remain authenticated, business-scoped, short-lived, and server-authorized. The future R2 boundary is only a typed Worker binding contract; it does not activate R2 for fictional staging or create any resource. Real document storage requires a separate production-readiness decision with encrypted private storage, scanning operations, access review, recovery evidence, credentials, and explicit authorization.

Phase 10D extraction is fictional-development-only. It has no OCR or AI provider selection, SDK, endpoint, account, credential, or network call. Production and real-data-approved execution reject extraction when no separately approved production provider is configured. Extracted candidates are human-reviewed document evidence only and cannot automatically update transactions, accounting, tax, payroll, or any other financial record.

## Enforced staging boundary

`free-preview-cloudflare-neon` only accepts Cloudflare staging with fictional data, paid-service approval false, customer onboarding false, no R2 binding, a TLS-required Neon pooled runtime URL, and a separate TLS-required direct migration URL. It rejects production, real-data approval, localhost, Prisma Dev, unsafe database names, non-Neon targets, and local `DATABASE_URL` fallback.

The only future bootstrap is `cloud:bootstrap:fictional`. It is a CLI command, not an HTTP endpoint. It needs the exact staging profile, explicit confirmation, secure runtime-only fictional `.demo` login input, and an empty-or-known deterministic fictional database. It is idempotent, refuses foreign identity/business data, and never prints the password. It must never be run automatically.

## Approval gate

Real data requires a later, separate production-readiness decision and cannot be enabled by the staging profile. That decision must include deployed production infrastructure, separate credentials, backup/recovery evidence, document storage controls, access review, and explicit authorization. This Phase 9B preparation grants none of those approvals.
# Pilot readiness clarification

Onboarding, settings, activity viewing, and exports are fictional-only product workflows. They do not authorize real customer onboarding, provider access, deployment, or real-data export.
