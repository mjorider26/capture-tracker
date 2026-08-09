---
name: capture-tracker-engineering
description: Engineering workflow for Capture Tracker application changes including Next.js, TypeScript, Prisma, PostgreSQL, financial logic, ledger behavior, documents, APIs, and production-safe implementation.
---

# Capture Tracker Engineering

Use this skill when implementing, debugging, refactoring, or reviewing application code in Capture Tracker.

## Start every task by inspecting

Before changing code:

1. Read the root AGENTS.md.
2. Check git status and active branch.
3. Locate the existing implementation related to the task.
4. Inspect related tests.
5. Inspect relevant Prisma schema, migrations, database constraints, triggers, server actions, API routes, and shared utilities when applicable.
6. Identify existing conventions before creating new abstractions.

Do not assume architecture from filenames alone.

## Implementation philosophy

Prefer the smallest complete change that solves the requested problem.

Preserve:
- existing interfaces where practical
- financial integrity
- auditability
- organization scoping
- authorization boundaries
- backwards compatibility
- working behavior outside the requested scope

Do not perform broad rewrites unless the task genuinely requires one.

## Financial logic

Treat accounting code as high-integrity code.

For ledger-affecting changes verify:

- debits equal credits
- journal entries balance
- posted entries remain immutable
- corrections use reversal/adjustment flows
- duplicate reversal prevention remains intact
- transaction splits reconcile to their parent transaction
- accounting period rules remain enforced
- closed periods remain protected
- organization ownership is validated
- history remains auditable

Never silently delete or rewrite posted financial history.

Financial calculations should execute server-side.

Use deterministic calculations for money whenever possible.

Avoid floating-point arithmetic for stored monetary values when the existing architecture provides decimal/integer-safe handling.

## Data access

Every organization-owned resource must be scoped server-side.

Never rely solely on:
- client-provided organization IDs
- hidden form fields
- route parameters
- UI visibility

Validate ownership/authorization using trusted server-side context.

## Prisma and PostgreSQL

Before modifying the schema:

1. inspect existing schema
2. inspect recent migrations
3. inspect database-level constraints/triggers
4. understand production implications

Prefer enforcement at the strongest appropriate layer.

Application validation does not replace important database integrity constraints.

Do not:
- reset production databases
- delete production records to resolve migrations
- weaken constraints just to make code pass
- create destructive migrations without explicit justification

## Server/client boundaries

Keep sensitive logic server-side.

Do not expose:
- secrets
- privileged database operations
- authorization decisions
- financial posting logic
- secure document URLs beyond intended lifetimes

Keep client components focused on presentation and interaction.

## Documents

When touching receipt/document code preserve:

- PENDING_VALIDATION
- ACTIVE
- QUARANTINED
- SHA-256 duplicate detection
- secure access
- validation/quarantine behavior
- retention expectations
- organization scoping

Never assume a browser-accepted upload is trusted.

## AI features

AI may recommend and explain.

AI must not silently:
- post accounting entries
- delete records
- submit taxes
- approve consequential financial actions
- bypass user approval

Preserve an auditable human approval boundary.

## UI implementation

When changing UI:

- preserve backend behavior unless explicitly part of scope
- maintain responsive behavior
- maintain accessibility
- reuse existing components/tokens where appropriate
- avoid duplicate design systems
- keep financial information easy to scan
- prioritize mobile usability

Do not modify business logic merely to achieve a visual effect.

## Verification

After implementation run the checks appropriate to the changed area.

At minimum consider:

- targeted tests
- TypeScript
- lint
- production build
- Prisma/schema validation
- migration validation
- integration tests
- financial integrity tests

Do not declare success if relevant verification has not run.

## Completion report

Report:

1. what changed
2. important files changed
3. tests/checks executed
4. results
5. anything not physically verified
6. deployment status when applicable
7. commit SHA when available
