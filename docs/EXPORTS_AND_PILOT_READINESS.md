# Safe exports and pilot readiness

> **SUPERSEDED / HISTORICAL**
>
> This document describes an earlier Capture Tracker implementation state and must not be used as the current production operations source of truth. See [Capture Tracker Production Operations](CAPTURE_TRACKER_PRODUCTION_OPERATIONS.md).

Authenticated exports are business-scoped, bounded CSV downloads. They formula-neutralize spreadsheet cells and audit each export with its included row count and a manifest. Exports never include document bytes, private storage keys, local paths, grants, secrets, database connection information, or Ask AI hidden reasoning.

The pilot smoke boundary remains fictional-only. Product readiness does not clear the cloud audit, provider, deployment, backup/restore, real-data approval, or real-customer onboarding blockers.
