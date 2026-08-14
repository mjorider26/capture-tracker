# First-client onboarding runbook

**Status:** Operator-controlled invitation capability. Do not issue an invitation or enter client information unless the owner separately authorizes the named-client cutover.

## Platform boundary

Public signup remains closed. Customers are created only through `/operator/onboarding` by an authenticated account whose normalized email appears in the private `CAPTURE_TRACKER_OPERATOR_EMAILS` allowlist. Business ownership never grants operator authority, and an operator never becomes a member of the client business.

The operator creates one email-bound invitation and sends its private link through an owner-approved channel. Invitations use a cryptographically random token; only its SHA-256 hash is stored. An invitation expires after 72 hours, can be revoked or explicitly expired, is single-use, and is accepted only by an authenticated account with the invited email.

## Acceptance and provisioning

When the invited owner accepts, one serializable transaction creates the S-Corp business, exactly one OWNER membership, the standard chart and accounting foundation, settings, cutover record, onboarding state, and audit evidence. If it cannot commit, the invitation remains unaccepted and no partial tenant is usable.

The new owner is sent to the dedicated customer setup shell, not an empty dashboard. Normal workspace routes remain server-side locked while `BusinessOnboarding.status` is `IN_PROGRESS`; only the narrow owner-only onboarding context can load setup routes and actions. The persisted phase resumes deterministically after sign-out or refresh.

## Customer sequence

1. Create or sign into the account bound to the invited email and accept the invitation.
2. Read the welcome and confirm S-Corp details and the accounting start date.
3. Choose Plaid Transactions or manual transaction CSV per business bank or card account. Plaid and manual methods may coexist.
4. Add every intended business account. Do not add personal accounts.
5. Confirm all opening balances from statements or another approved source. Non-zero balances post atomically in one balanced `OPENING_BALANCE` journal; an all-zero start records confirmation without creating an empty journal.
6. Review Owner Money, payroll context, fixed assets, and any Unknown / Needs review / CPA review items.
7. Review first activity, or confirm that no activity exists yet.
8. Complete the initial reconciliation at an exact `$0.00` difference.
9. Confirm readiness, complete the five-screen tour, and enter Today.

A transaction CSV can add activity to the duplicate-safe review queue. Statement PDFs/images and receipts are private document evidence and never create transactions. Every uploaded document remains quarantined and unavailable until its security scan succeeds.

## Setup completion

Capture Tracker keeps the workspace locked until the business, account methods, approved opening balances, Owner Money state, applicable payroll facts, fixed-asset review, first-activity checkpoint, initial exact reconciliation, readiness check, and tour are complete. Reconciliation never creates a plug or automatic balancing entry. Imported activity never posts without an explicit owner decision.

After the tour, Today opens with the daily, weekly, monthly, and year-end routine and **Run My Books** as the dominant weekly action. An operator may apply the presentation-only **Founding Customer - Customer #001** designation when creating the invitation; it has no accounting or authorization effect.

## Recovery and support

The invitation surfaces plain recovery for invalid, expired, revoked, already-used, existing-account, wrong-email, and temporary failure states without revealing secrets. A signed-in incomplete owner who visits `/app` is returned to the saved setup phase. Completed journals and reconciliations cannot be silently rewritten by revisiting an earlier screen; use a controlled correction or support-assisted restart.

Never use database inserts, a backdoor user, a transferred invitation, public signup, or tenant-context changes as an onboarding workaround. Never request passwords, bank credentials, invitation tokens, or financial source data in chat or logs.

## Release and customer safety

Use fictional local data for rehearsal. Never create a real invitation, Plaid Item, bank connection, document, or financial record without separate owner authorization. Before production release, validate the migration and full PostgreSQL write path, build the Cloudflare artifact, scan for secrets, push the exact commit, and require explicit production release authorization. A source-ready commit is not deployment authorization.
