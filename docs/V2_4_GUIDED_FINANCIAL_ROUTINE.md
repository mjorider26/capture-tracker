# Capture Tracker V2.4 — Guided Financial Routine

## Product outcome

V2.4 reduces perceived complexity for one owner operating one service-business S-Corp. The authenticated product is organized around what needs attention, when it is due, and the next protected action—not around learning a feature directory.

The primary weekly action is **Run My Books**. It is a deterministic presentation and orchestration layer over existing transaction, document, invoice, bill, Owner Money, payroll, reconciliation, books-current, month-close, and year-end services. It adds no accounting feature, schema state, automatic posting, or autonomous financial action.

## Guided horizons

- **First setup:** seven owner-language milestones derived from existing persisted onboarding/cutover state.
- **Today:** Books Current Through, one primary Run My Books action, current attention, and four frequent capture actions.
- **Weekly:** relevant exception groups only; factual step progress; cleared groups disappear automatically; final current-through state.
- **Monthly:** owner-language close blockers link directly to their existing protected workflows before explicit close confirmation.
- **Periodic:** payroll, estimated-tax, distribution-readiness, compensation, basis, and benefit work remain an occasional review rather than everyday navigation.
- **Year-end:** Books → Owner Money → Payroll → Basis → Benefits → Fixed Assets → CPA Review Items → CPA Package, with DONE / NEEDS YOU / CPA REVIEW states and a final READY FOR CPA state.

## Simplified navigation

The primary mobile bar remains Today, Money, Documents, Reports, More. Desktop shows the same core destinations, a prominent Run My Books entry, and grouped disclosure for monthly routine, Owner & professional work, and tools/support. No functionality is removed.

+ New groups actions as Money in, Money out, Capture, Owner, and Import. Finder remains role-filtered and secondary.

## Integrity and security

- All resource reads remain scoped by the trusted server-side business context.
- Authenticated owner actions retain their existing server mutation boundary.
- CPA read-only viewers may inspect guided tasks but receive no start, complete, reopen, Quick Add, or other owner mutation controls.
- Documents keep their validation, quarantine, scan, duplicate, and ACTIVE+CLEAN boundaries.
- Weekly completion remains acknowledgement only and cannot hide unresolved underlying records.
- Month close remains an explicit owner-confirmed lock using the existing readiness and audit flow.
- No migration or Prisma schema change is introduced.

## Acceptance

The first meaningful screen explicitly teaches: Today surfaces attention, + New captures activity, Run My Books is weekly, reconciliation/close is monthly, and Year-End Flight Check prepares CPA records. Focused tests verify irrelevant-step skipping, factual progress, owner-language discovery, role-safe presentation, and deterministic task ordering.

Production deployment is intentionally outside this change authorization. A green exact-SHA candidate requires separate V2.4 production authorization.
