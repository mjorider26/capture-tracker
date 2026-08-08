# First-client onboarding runbook

**Status:** V1.0.0 readiness checklist. Do not create a client, invitation, user, business, membership, or document from this runbook unless the owner separately authorizes a supported onboarding procedure.

## Pre-onboarding gate

- Confirm production liveness and readiness endpoints succeed.
- Confirm the accepted V1 release SHA and exact-SHA CI are recorded in the current production state.
- Confirm a current encrypted logical backup completed with checksum verification and private backup-bucket upload.
- Confirm there is no open critical incident, database health issue, scan backlog/DLQ incident, or unresolved authentication failure.
- Confirm the production Queue and private scanner have sanitized healthy operational signals; uploads must remain fail-closed if scanning is unavailable.
- Obtain explicit owner authorization for the named client and the supported account-creation procedure before collecting or entering any client information.

## Required client information

Collect only fields that the existing application actually supports and only after authorization:

- legal business name and display name;
- owner name and email address;
- supported business tax election and fiscal-year settings;
- timezone and currency supported by the existing configuration;
- the client’s own initial financial-account and onboarding settings as entered through an approved product flow.

Do not collect invitation codes, bank credentials, card numbers, tax returns, receipt images, or other data before a supported tenant exists. Do not put client data in local development, staging, shell history, screenshots, tickets, or documentation.

## Current V1.0.0 account-creation result

**BLOCKED — no legitimate additional-client onboarding mechanism exists in V1.0.0.** The production Create account route is intentionally limited to the one-time `production-first-owner` bootstrap. It requires an empty User and Business set and closes after the current workspace is initialized. Existing production onboarding screens configure the current authenticated business; they do not create a new tenant. There is no approved additional-client invitation, public signup, operator console, or business-creation flow.

Do not work around this by re-enabling first-owner bootstrap, manually inserting database rows, creating a backdoor user, reusing a production credential, or altering tenant context. A narrowly scoped, separately approved V1.1 onboarding mechanism must establish user, business, membership, accounting foundation, settings, onboarding state, audit history, and tenant isolation through reviewed application code.

## Procedure after an approved additional-client mechanism exists

1. Re-run the pre-onboarding gate and obtain the owner’s explicit authorization.
2. Use only the approved production UI or approved operator workflow to create the account, business, and owner membership.
3. Complete supported business settings and onboarding; verify the first login and server-derived tenant scope.
4. Verify Today, Money, Taxes, Documents, Reports, Weekly Review, Reconciliation, Ask AI, Activity, and Settings under the new tenant without accessing another tenant’s data.
5. After formal client authorization, accept one legitimate client receipt through Documents. Verify quarantine, private scan, automatic Ready state, and protected view. Never use EICAR or any security fixture in a client workflow.
6. Record only sanitized operational completion evidence. Do not place client data in release evidence.
