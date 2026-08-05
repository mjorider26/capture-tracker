# Production logical backup and recovery

Capture Tracker production remains on Neon Free. The available provider history is the current Free-plan window; it is not a seven-day PITR policy and no paid Neon snapshot schedule is used.

## Backup procedure

Run the backup only from native Linux/WSL. Provide the direct, unpooled TLS production connection only to that process through `CAPTURE_TRACKER_PRODUCTION_DIRECT_DATABASE_URL`; never put it in a Windows environment file, repository file, command argument, archive name, or log.

`tsx scripts/backup-production-logical.ts` uses `pg_dump -Fc --no-owner --no-privileges`, holds every local artifact only in `/dev/shm`, encrypts with AES-256-GCM using a scrypt-derived key, calculates SHA-256, uploads only the encrypted archive and a sanitized JSON manifest to `capture-tracker-production-backups`, downloads each object once to verify its checksum, and removes all temporary files in all cases. Its operator credential uses only Object Read & Write on that one bucket; it cannot use the document bucket, staging bucket, or account-wide bucket listing. It records timestamp, database name, source commit, PostgreSQL version, encrypted archive size, checksum, and applied migration count. The passphrase is process-only input and must be handled by the approved secret owner.

The authorized backup bucket is private, not bound to the application Worker, has no public development URL, and uses lifecycle expiration only for `production/daily/` (30 days), `production/pre-acceptance/` (30 days), and `production/restore-verification/` (7 days). The document bucket is never a backup destination.

## Restore verification

`tsx scripts/verify-production-logical-backup.ts` accepts only the encrypted archive and a separately supplied, disposable local database named `capture_tracker_restore_test`. It decrypts only into `/dev/shm`, creates that exact local target, restores with `pg_restore`, verifies migrations, table/function/trigger/constraint counts, membership scoping, and Trial Balance equality, then drops the target and deletes the unencrypted archive. It cannot point at Neon, staging, or the active production database.

For an actual recovery, stop application writes, obtain a separate explicit recovery authorization, restore into an isolated recovery database first, verify catalog and tenant/accounting integrity, and only then plan a separately authorized cutover. Do not reuse staging or restore over production for verification. Perform this restore verification periodically after each approved logical backup and preserve only sanitized evidence.
