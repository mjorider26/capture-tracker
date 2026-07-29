# Gate 2B Neon fictional staging database

**Recorded UTC:** 2026-07-28

## Scope and provenance

- Application deployment evidence: `46ab914ae7d0c4769acc0df28852f4ca1b2ba88e`
- Gate 2A control record: `97c4dcfb8eff8b90fd59c3c532036960ea9f44c4`
- Project: `capture-tracker-staging`
- Plan and region: Neon Free, AWS US East 2 (Ohio)
- Server: PostgreSQL 18.4; Neon Auth, paid features, real data, and additional projects remain off/out of scope.

## Database preparation and verification

The isolated fictional staging target passed TLS preflight, exact expected-database validation, one approved schema, and an empty pre-migration state. Twelve committed migrations applied once. The deterministic fictional bootstrap completed without remote document bytes.

The sanitized staging manifest passed: one fictional business and `.demo` user, one fictional credential, three accounts, nine transactions, six posted journal entries, eighteen journal lines, four document metadata records, one Weekly Review, and zero Ask AI metadata records. Debits and credits both equal `9,263.00`; business isolation and constraint/trigger/function inventory passed. The expected-relation catalog resolved 15 of 15 relations.

## Logical backup and local restore proof

| Evidence | Result |
| --- | --- |
| Client tools and restore server | PostgreSQL 18.4 only |
| Archive | Custom-format; `257,409` bytes |
| SHA-256 | `1e4d22b7251ea313a7e1eea918538956a002f97fa4cc4b43febe8b70cffded94` |
| Backup duration | `12,839 ms` |
| Restore duration | `873 ms` |
| Archive inspection | PostgreSQL 18 `pg_restore --list` passed |
| Restore target | Exact approved local PostgreSQL 18 disposable target only |
| Pre/post manifest | Exact match |
| Verbose progress / warnings / fatal lines | `94` / `0` / `0` |
| Archive cleanup | Complete |

The proof used only the direct TLS staging connection for the source and never reset, truncated, dropped, or otherwise modified Neon. It is a manual logical-recovery proof, not evidence of automated daily backups or retention.

## Boundary and remaining decisions

R2 remains **BLOCKED** and unused; no Worker, bucket, Cloudflare secret, production resource, real data, or real user was created or used. The post-proof Neon Billing console confirmation records the Free plan, `$0/month` displayed cost, no paid plan or add-on, no payment method, and no proof-related charge.

**Gate 2B status: COMPLETE — READY FOR GATE 2C AUTHORIZATION.** Gate 2C still requires separate explicit authorization for a fictional Cloudflare Worker deployment; it does not authorize R2, production, real data, or real users.
