# Current Capture Tracker Production State

**Current as of 2026-08-08.** The authoritative operating instructions are in [Capture Tracker Production Operations](CAPTURE_TRACKER_PRODUCTION_OPERATIONS.md).

- Production is live at `capture-tracker-production` and remains a private owner pilot.
- Staging is live at `capture-tracker-staging` and remains fictional-only.
- Production uses a separate Neon PostgreSQL database, `capture-tracker-production-documents`, and `capture-tracker-production-backups`.
- The first-owner bootstrap initialized the current workspace and is now closed; public self-service onboarding is not approved.
- The application Worker is `cd6465ea-8ca7-4474-ac48-a991f8ff0831`; the private scanner Worker is `5a813776-4648-4d9e-b033-77da395b5f07`.
- Production has all 18 source migrations applied, including `20260807090000_document_scan_quarantine`.
- Encrypted logical backups and isolated, source-derived restore verification are established and were revalidated with the current migration inventory.
- Financial report totals use database aggregation; supporting lines paginate; oversized pilot exports fail visibly rather than truncate.
- Mobile navigation is Today, Money, Documents, Reports, and More. More contains Taxes, Weekly Review, Reconciliation, Ask AI, Activity, and Settings.
- Private documents support PDF, PNG, JPEG, and mobile camera capture. Camera receipt photos are normalized locally before upload (orientation correction, no upscaling, approximately 1,920-pixel maximum edge, 0.82 JPEG quality, and no retained EXIF/GPS metadata). PDFs are unchanged.
- Production scanning uses isolated Queue and DLQ resources plus a private standard-1 ClamAV Container with `max_instances=1` and a 15-minute warm window. Cold readiness is approximately 94 seconds; warm-path measurement remains pending authenticated owner acceptance.
- Document deletion commits a tenant-scoped DELETED tombstone and revoked reads before idempotent exact-object private R2 cleanup; stale scan jobs cannot resurrect it.
- Ask AI is read-only and intentionally unavailable for production answers until a separately approved production provider exists.

`quoteready-api` is unrelated infrastructure and is never a Capture Tracker deployment target.
