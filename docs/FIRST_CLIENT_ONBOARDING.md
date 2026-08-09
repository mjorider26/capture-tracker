# First-client onboarding runbook

**Status:** V2.0.0 cutover assessment. Do not create a client, invitation, user, business, membership, financial account, transaction, or document from this runbook unless the owner separately authorizes a supported onboarding procedure and the named client cutover.

## Current result

**BLOCKED — V2.0.0 has no legitimate additional-client onboarding mechanism.** Production Create account is only the one-time `production-first-owner` bootstrap. It requires empty User and Business sets and closes after the current workspace is initialized. Existing authenticated onboarding configures the current business; it does not create another tenant. There is no approved additional-client invitation, public signup, operator console, or business-creation flow.

Do not re-enable bootstrap, manually insert rows, create a backdoor user, reuse credentials, or alter tenant context. A separately approved onboarding capability must create the user, business, membership, accounting foundation, settings, audit history, and tenant isolation through reviewed application code.

## Preconditions for a future authorized cutover

- Confirm production liveness/readiness, the immutable V2 tag, exact-SHA CI, migration status, and a current encrypted backup receipt.
- Confirm no critical incident, authentication failure, scan backlog/DLQ incident, or database-health issue.
- Obtain explicit authorization for the named client, data set, and approved account-creation workflow before collecting or entering data.
- Use only a reviewed production UI or approved operator workflow. Verify first login and server-derived tenant scope without accessing any other tenant.
- After authorization, accept one legitimate client receipt only through Documents; verify quarantine, private scanning, automatic Ready state, and protected view. Never use security fixtures in a client workflow.

## Data boundary

Before a supported tenant exists, do not collect or store bank credentials, card numbers, tax returns, receipt images, invitations, or client financial data in local development, staging, shell history, screenshots, tickets, or documentation. Record only sanitized operational completion evidence.
