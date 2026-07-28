# Backup and recovery

## Truthful current posture

Gate 2B completed one manual logical-recovery proof for the fictional Neon staging database. PostgreSQL 18.4 custom-format backup and PostgreSQL 18.4 local restore matched sanitized manifests exactly; the temporary `257,409`-byte archive was deleted after verification. This establishes neither automated daily backups nor retention, provider point-in-time recovery, or production recovery. No Worker or R2 resource exists; R2 remains blocked.

## Later fictional-staging recovery drill

Only after a Neon fictional-staging project exists, confirm its current plan capabilities in the provider console. Record the plan, available backup/restore controls, retention, branch behavior, recovery limits, and who can perform recovery. Create a controlled fictional record, recover only the fictional target according to the provider's then-current procedure, and verify data integrity, access controls, no secret exposure, and expected accounting constraints. Record evidence without recording credentials.

Never download a production dump to a workstation. Never use a fictional-staging drill as evidence for production recovery.

## Fictional-staging teardown

1. Confirm the target is the fictional staging Worker, database, and any future bucket; do not act on production-looking names.
2. Capture only non-secret deployment metadata and validation evidence.
3. Disable Worker traffic, remove its route/DNS mapping, then remove the Worker/version.
4. If an R2 bucket was later approved, confirm it is private, remove fictional objects, verify it is empty, then remove it. R2 remains deferred today.
5. Confirm the Neon target name and fictional classification; remove the staging project or branch and revoke its credentials.
6. Remove dashboard secrets/tokens, review usage and billing, and record final zero-resource/usage evidence.

No restore drill or teardown action occurred in this session.
