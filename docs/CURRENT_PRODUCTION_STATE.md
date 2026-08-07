# Current Capture Tracker Production State

**Current as of 2026-08-06.** The authoritative operating instructions are in [Capture Tracker Production Operations](CAPTURE_TRACKER_PRODUCTION_OPERATIONS.md).

- Production is live at `capture-tracker-production` and remains a private owner pilot.
- Staging is live at `capture-tracker-staging` and remains fictional-only.
- Production uses a separate Neon PostgreSQL database, `capture-tracker-production-documents`, and `capture-tracker-production-backups`.
- The first-owner bootstrap initialized the current workspace and is now closed; public self-service onboarding is not approved.
- Encrypted logical backups and isolated, source-derived restore verification are established.
- Financial report totals use database aggregation; supporting lines paginate; oversized pilot exports fail visibly rather than truncate.
- Mobile navigation is Today, Money, Documents, Reports, and More. More contains Taxes, Weekly Review, Reconciliation, Ask AI, Activity, and Settings.
- Private documents support PDF, PNG, JPEG, and mobile camera capture. Malware scanning and quarantine are not implemented, so untrusted external uploads are not approved.
- Ask AI is read-only and intentionally unavailable for production answers until a separately approved production provider exists.

`quoteready-api` is unrelated infrastructure and is never a Capture Tracker deployment target.
