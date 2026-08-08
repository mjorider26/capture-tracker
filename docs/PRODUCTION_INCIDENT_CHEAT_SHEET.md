# Production incident cheat sheet

Start with the deployed Worker version, `GET /api/health/live`, `GET /api/health/ready`, and sanitized production logs. Never use staging, `quoteready-api`, production credentials in logs, or destructive database/R2 repair commands.

## Document stuck pending

Check Queue delivery, scanner readiness, bounded retry state, database document state/version, and partial-promotion recovery state. Do not manually mark a document CLEAN or ACTIVE. If scan processing is unavailable, leave the file quarantined and unreadable.

## Document delete failure

Inspect the tenant-scoped tombstone transaction, linked/authoritative relationship restriction, and post-commit exact-object R2 cleanup. Database authority comes first: never delete R2 bytes first, and never resurrect a tombstoned document after cleanup failure.

## Scanner down

Uploads remain quarantined and reads remain unavailable. Restore only the approved private scanner operation and validate sanitized readiness; do not bypass scanning or use a third-party/public scanning service.

## Queue or DLQ

Inspect sanitized message metadata and retry/DLQ state. Preserve stored tenant, document, and version validation. Never manually activate a document or put document bytes in a message.

## Database issue

Fail closed. Do not run destructive repair, reset, or ad-hoc migration work. Take or confirm an encrypted backup before consequential remediation and use an isolated restore for recovery validation.

## Authentication issue

Check session resolution, Worker exceptions, and tenant context. Do not rotate the Better Auth secret unless that is a proven, authorized cause.

## Accounting issue

Stop the affected financial mutation path if integrity is uncertain. Preserve immutable journal history and use approved correction/reversal workflows; never manually rewrite posted history.
