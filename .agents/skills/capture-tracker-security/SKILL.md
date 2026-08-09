---
name: capture-tracker-security
description: Security review and implementation workflow for Capture Tracker covering authentication, authorization, tenant isolation, secrets, documents, uploads, database access, production configuration, and sensitive financial data.
---

# Capture Tracker Security

Use this skill whenever work touches:

- authentication
- authorization
- sessions
- users
- organizations
- tenant isolation
- documents/uploads
- secrets
- APIs
- database access
- financial records
- audit logs
- production configuration
- external services

Security is part of implementation, not a cleanup phase.

## Security review workflow

Before editing:

1. Read AGENTS.md.
2. Identify the trust boundary involved.
3. Identify authenticated and unauthenticated actors.
4. Identify organization-owned data.
5. Identify privileged actions.
6. Identify inputs controlled by the client.
7. Identify secrets or sensitive data involved.
8. Inspect existing security patterns before creating new ones.

## Authentication vs authorization

Authentication proves who the user is.

Authorization determines what that user may access.

Never treat successful authentication as sufficient authorization.

Every privileged resource must also verify ownership or permission.

## Organization isolation

Organization/tenant isolation must be enforced server-side.

For any resource lookup consider whether an attacker could change:

- an ID
- URL parameter
- request body
- query string
- cookie
- form field

and access another organization's data.

Prefer queries that scope by both resource identity and trusted organization context.

## Secrets

Never:

- commit secrets
- print secrets
- return secrets to the client
- expose full secrets in errors
- place production credentials in example files
- store production credentials in local project files

Use platform/environment secret management.

If a secret is accidentally exposed, stop exposing it and treat rotation as required.

## Production data

Do not copy real customer financial data into local development.

Local development uses fictional/test data.

Minimize logging of sensitive information.

Do not log:
- credentials
- session tokens
- secret values
- full sensitive documents
- unnecessary customer financial details

## Input validation

Treat client input as untrusted.

Validate:

- type
- format
- permitted values
- size
- ownership
- authorization
- business invariants

Client-side validation improves UX but does not replace server-side validation.

## Documents and uploads

Uploads are hostile until validated.

Preserve:

- file validation
- quarantine behavior
- malware scanning where implemented
- SHA-256 duplicate detection
- size/type restrictions
- secure storage
- scoped document retrieval
- expiring access mechanisms where applicable

A filename or MIME type supplied by the browser is not proof of file safety.

## Financial actions

Consequential financial actions require strong authorization and auditability.

Never weaken protection around:

- posting journal entries
- reversals
- reimbursements
- tax information
- ledger modifications
- document access
- account configuration

## Error handling

Return useful errors without revealing:

- database internals
- stack secrets
- credentials
- privileged IDs unnecessarily
- implementation details useful for bypassing controls

Server logs may contain diagnostic context but must still avoid secrets and unnecessary customer data.

## Dependency/configuration changes

When introducing or updating dependencies:

- verify why the dependency is needed
- prefer maintained packages
- avoid unnecessary attack surface
- inspect security-sensitive configuration
- avoid disabling security checks globally

## Security testing

For security-sensitive changes test both:

- allowed behavior
- denied behavior

Examples:

- authorized owner succeeds
- different organization is rejected
- unauthenticated user is rejected
- malformed input is rejected
- expired/invalid permission is rejected

A successful happy-path test alone is insufficient.

## Final security review

Before calling the task complete ask:

1. Can another organization access this?
2. Can the client forge a privileged identifier?
3. Is authorization server-side?
4. Could a secret leak?
5. Could sensitive data appear in logs?
6. Can the action be replayed or duplicated unsafely?
7. Is there an audit trail where appropriate?
8. Did this change weaken an existing security boundary?

Report unresolved security concerns explicitly.
