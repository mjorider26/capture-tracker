# Current Capture Tracker Production State

> Current release note (2026-08-08): V2 payroll reversal is deployed from `6ae2eab7bd2e52277c5178b37f8aa2adb685b45c`; exact-SHA CI run `31285960824` passed and the production application Worker is `cb88a09b-0c44-4b35-8791-aa184cc96e06`. No scanner deployment or schema migration was included in that release.

> V2 records reviewed bank/card evidence, owner transfers, reimbursements, payroll results, immutable payroll reversals, fixed-asset workpapers, month/year-end readiness, reconciliation, and protected CPA export schedules. Import, classification, posting, matching, and correction remain review-first; no imported activity posts automatically.

**CAPTURE TRACKER V1.0.0 — PRODUCTION READY (2026-08-08).** The authoritative operating instructions are in [Capture Tracker Production Operations](CAPTURE_TRACKER_PRODUCTION_OPERATIONS.md).

- The accepted V1 application release is `78dbb0c37991b1dbf23706bc906687eb6b24b574` (`v1.0.0`); exact-SHA CI run `31275008219` passed.
- Production is live at `capture-tracker-production` and remains a private owner pilot.
- Staging is live at `capture-tracker-staging` and remains fictional-only.
- Production uses a separate Neon PostgreSQL database, `capture-tracker-production-documents`, and `capture-tracker-production-backups`.
- The first-owner bootstrap initialized the current workspace and is now closed; public self-service onboarding is not approved.
- The application Worker is `cb88a09b-0c44-4b35-8791-aa184cc96e06`; the private scanner Worker is `5a813776-4648-4d9e-b033-77da395b5f07`.
- Production has the approved additive document-scan and V2 accounting migrations applied; the payroll-reversal release required no additional migration.
- A fresh encrypted logical backup was completed before first-client readiness confirmation: AES-256-GCM+scrypt archive, private-backup upload, checksum verification, and the current 18-migration inventory. Isolated, source-derived restore verification already covers that migration inventory.
- Financial report totals use database aggregation; supporting lines paginate; oversized pilot exports fail visibly rather than truncate.
- Mobile navigation is Today, Money, Documents, Reports, and More. More contains Taxes, Weekly Review, Reconciliation, Activity, and Settings.
- Private documents support PDF, PNG, JPEG, and mobile camera capture. Camera receipt photos are normalized locally before upload (orientation correction, no upscaling, approximately 1,920-pixel maximum edge, 0.82 JPEG quality, and no retained EXIF/GPS metadata). PDFs are unchanged. New uploads remain private and quarantined until the private ClamAV scan reaches ACTIVE + CLEAN; the signed-read, extraction, matching, and Ask AI evidence boundaries all recheck that current state.
- Production scanning uses isolated Queue and DLQ resources plus a private standard-1 ClamAV Container with `max_instances=1` and a 15-minute warm window. Cold readiness is approximately 94 seconds. The accepted mobile path confirms automatic status refresh from pending to terminal scan state.
- Document deletion commits a tenant-scoped DELETED tombstone and revoked reads before idempotent exact-object private R2 cleanup; stale scan jobs cannot resurrect it.
- Ask AI remains gated by tenant scope and ACTIVE + CLEAN document evidence; it does not receive quarantined, rejected, or unreadable document bytes.
- The initial owner bootstrap is closed. V1.0.0 has no supported additional-client/business onboarding flow; do not create users, businesses, or memberships through operator/database workarounds.

`quoteready-api` is unrelated infrastructure and is never a Capture Tracker deployment target.
