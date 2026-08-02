# Production logical backup and recovery

Capture Tracker production remains on Neon Free. The available provider history is the current Free-plan window; it is not a seven-day PITR policy and no paid Neon snapshot schedule is used.

## Backup procedure

Run the backup only from native Linux/WSL. Provide the direct, unpooled TLS production connection only to that process through `CAPTURE_TRACKER_PRODUCTION_DIRECT_DATABASE_URL`; never put it in a Windows environment file, repository file, command argument, archive name, or log.

`tsx scripts/backup-production-logical.ts` uses `pg_dump -Fc --no-owner --no-privileges`, holds the unencrypted archive only in `/dev/shm`, encrypts it with AES-256-GCM using a scrypt-derived key, writes a 0600 encrypted archive and sanitized JSON manifest to the explicitly approved private destination, calculates SHA-256, and removes the unencrypted archive in all cases. It records timestamp, database name, source commit, PostgreSQL version, encrypted archive size, checksum, and applied migration count. The passphrase is process-only input and must be handled by the approved secret owner.

The current document bucket is not a backup destination: it has no separately approved backup access-control or retention policy. Before a production backup can be persisted, the owner must identify an approved private, non-document destination (or explicitly authorize creation of a separate private backup bucket). This procedure intentionally refuses an unapproved or Windows-mounted destination.

## Restore verification

`tsx scripts/verify-production-logical-backup.ts` accepts only the encrypted archive and a separately supplied, disposable local database named `capture_tracker_production_restore_verification`. It decrypts only into `/dev/shm`, creates that exact local target, restores with `pg_restore`, verifies migrations, table/function/trigger/constraint counts, membership scoping, and Trial Balance equality, then drops the target and deletes the unencrypted archive. It cannot point at Neon, staging, or the active production database.

For an actual recovery, stop application writes, obtain a separate explicit recovery authorization, restore into an isolated recovery database first, verify catalog and tenant/accounting integrity, and only then plan a separately authorized cutover. Do not reuse staging or restore over production for verification. Perform this restore verification periodically after each approved logical backup and preserve only sanitized evidence.
