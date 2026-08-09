# First-client onboarding runbook

**Status:** Operator-controlled invitation capability. Do not issue an invitation or enter client information unless the owner separately authorizes the named-client cutover.

## Platform boundary

The original first-owner bootstrap remains closed. Additional clients are created only through `/operator/onboarding` by an authenticated account whose normalized email appears in the private `CAPTURE_TRACKER_OPERATOR_EMAILS` allowlist. Business ownership never grants operator authority, and an operator never becomes a member of the client business.

The operator creates one email-bound invitation, copies its link, and sends it manually. Capture Tracker sends no email. Invitations use a cryptographically random URL token; only its SHA-256 hash is stored. An invitation expires after 72 hours, can be revoked or explicitly expired, is single-use, and is accepted only by an authenticated account with the invited email.

## Acceptance and provisioning

When the invited owner accepts, one serializable transaction creates the S-Corp business, exactly one OWNER membership, the standard chart and accounting foundation, settings, cutover record, onboarding state, and audit evidence. If it cannot commit, the invitation remains unaccepted and no partial tenant is usable.

The new owner is sent to the ordinary cutover setup, not an empty dashboard. They confirm the business, cutover date, approved source reference, primary business checking or credit-card account, and an owner-approved opening balance. The application posts a balanced `OPENING_BALANCE` journal and records an audit event. It does not invent values or recreate unreviewed QuickBooks history.

## Setup completion

Capture Tracker shows **Books setup incomplete** until the approved opening balance, Owner Money state, applicable payroll YTD facts, fixed-asset review, and an initial normal reconciliation are complete. Financial accounts reconcile only from statement facts and finalize only at an exact `$0.00` difference. Current-year checking/card CSV files use the existing duplicate-safe review and posting workflow.

Do not use database inserts, a backdoor user, transferred invitation, public signup, or tenant-context change as an onboarding workaround. Do not upload source reports, create client accounts, or issue a real invitation until separately authorized.
