# Onboarding and Settings

> **SUPERSEDED / HISTORICAL**
>
> This document describes an earlier Capture Tracker implementation state and must not be used as the current production operations source of truth. See [Capture Tracker Production Operations](CAPTURE_TRACKER_PRODUCTION_OPERATIONS.md).

Onboarding stores a fictional, resumable setup acknowledgement for the current business. It is actor-bound and idempotent: repeat submissions update only setup metadata and business display preferences. It never creates balances, transactions, provider accounts, or real-customer data.

Settings keep only future display preferences (default report period, weekly-review day, and retention target). Every settings save appends immutable business-scoped history. These preferences never rewrite posted accounting, historical report periods, or document retention records.

The Activity page is a bounded read-only projection of existing accounting, document, review, Ask AI, settings, and export histories. It does not expose binary content, provider errors, secrets, or hidden reasoning.
