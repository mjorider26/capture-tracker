# Phase 14A production-readiness rehearsal

## Executive summary

This is a local, fictional, non-deploy rehearsal at commit `991bcbf`. Functional v1 is complete, but no staging or production resource is authorized. The repository and local validation gates pass; the authoritative runtime-audit endpoint remains unavailable and blocks staging. The local backup/restore proof passed with PostgreSQL 17.10 client tools and a disposable local rehearsal database.

## Evidence and local inventory

| Item | Result |
| --- | --- |
| Node / npm / Prisma | v24.18.0 / 11.16.0 / 7.9.0 |
| Wrangler / OpenNext | 4.114.0 / 1.20.2 (locked build tooling) |
| PostgreSQL client tools | Absolute PostgreSQL 17.10 executables supplied and used |
| Repository boundary scan | Pass; fictional data only, no detected credentials |
| Git ignores | `.artifacts/`, `.document-storage/`, and `.env*` ignored |
| Cloud state | No Cloudflare, Neon, R2, AWS, provider account, credential, or deployment accessed |

## 1. Database backup and restore proof — READY

**Procedure planned:** create only `capture_tracker_phase14a_rehearsal` on localhost; migrate and seed fictional data; record a sanitized aggregate manifest; run `pg_dump --format=custom --no-owner --no-privileges`; SHA-256 the archive; inspect with `pg_restore --list`; terminate only rehearsal connections; drop/recreate that exact database; restore; `ANALYZE`; compare migration, row-count, ledger, report, history, and integrity manifests.

**Destructive guard:** host must be localhost/127.0.0.1/local socket; database name must contain `phase14a_rehearsal`; environment must not be production; real-data approval must be false; `ALLOW_PHASE14A_DATABASE_DESTROY=true` and a disposable-fictional confirmation must both be supplied. Generic `DATABASE_URL`, remote hosts, and normal development databases are rejected by design.

**Result and timing:** 2026-07-26 UTC proof passed in 1,310 ms. It created/destroyed only `capture_tracker_phase14a_rehearsal`, produced a 262,418-byte custom archive, inspected its table of contents, restored it, ran `ANALYZE`, and reconciled manifests. Sanitized totals: 49 tables; 1 business; 9 transactions; 6 journal entries; 18 lines; $9,263.00 debits and credits; 4 documents; 1 Weekly Review; migration hash `a2c4a528e0470327`. The archive was removed from ignored `.artifacts/` after verification.

**Provisional human targets:** RPO ≤24 hours, RTO ≤4 hours, daily logical export plus provider PITR where available, 30-day operational retention, quarterly restore test, encrypted owner-controlled backup, and an off-provider copy after approval. These are recommendations, not policy.

## 2. Deployment dry run — READY FOR AUTHORIZED PHASE 14B

Local checks: locked install, Prisma format/validate/generate, `check:phase`, `check:accounting`, `v1:verify`, production Next build, dependency separation, Worker package verification, synthetic bundle check, client-secret/data-boundary scans, infrastructure tests, and staging/production synths. Windows cannot produce the authoritative OpenNext Linux artifact; Linux CI remains the authority. Wrangler was not run beyond an installed-version attempt; it attempted only a local log-directory write and no authentication, upload, or provider action occurred. No dry-run command was proven both unauthenticated and non-mutating, so none was run.

**Runbook order:** human approvals → named account/billing owner → region/residency → signed commit and audit gate → build/artifact proof → create fictional database/roles → direct migration → private storage and scanner approval → secrets ownership → Worker configuration/upload → health/smoke → monitoring → backup proof → rollback decision → separate real-data approval/pilot onboarding. Each remote step requires an explicit later authorization and verification before proceeding.

## 3. Monitoring and alerting design — READY FOR IMPLEMENTATION

Signals: `/api/health/live` and `/api/health/ready`; request/5xx/latency; Worker exceptions; database connection/query/migration/backup/restore age; document write/scan/extraction/protected-read failures; authorization/grant failures; journal/reconciliation/report-integrity failures; export, Weekly Review, and Ask AI failures; deployment version and smoke age. Structured logs contain timestamp, severity, environment, release, correlation ID, module, safe code, duration and status only—never document bytes, message content, descriptions, storage keys, grants, URLs, tokens, or credentials.

Proposed thresholds: two failed health checks (SEV-2); 5xx >2% of ≥50 requests for 10 minutes (SEV-2); p95 >2s for 15 minutes (SEV-3); any accounting or cross-business violation (SEV-1); backup older than approved RPO (SEV-1); scanner/storage errors >5% in 15 minutes (SEV-2). SEV-1 targets 15-minute owner response and approved paging; SEV-2 one hour; SEV-3 next business day. Email owner is primary; Slack/Teams and paging require human selection.

## 4. Incident response — READY FOR HUMAN APPROVAL

1. **Integrity/security SEV-1:** stop writes/traffic if authorized, preserve sanitized evidence, verify scope, notify incident commander, use immutable histories, and restore only after approval.
2. **Availability/database SEV-2:** check health, release, connection and provider status; rollback to prior verified release if approved; do not run unsafe migration reversal.
3. **Document pipeline SEV-2:** quarantine failures, disable affected fictional workflow, never expose private bytes, investigate scanner/storage evidence.
4. **Secret/access incident SEV-1:** revoke/rotate through provider controls after authorization, invalidate grants/sessions as applicable, preserve minimal audit evidence, notify required parties.

## 5. Provider decision packet — READY FOR HUMAN DECISION

Preferred: Cloudflare Workers/OpenNext + Neon PostgreSQL + private R2, matching repository architecture and its server-only Prisma path. Second choice: AWS ECS/Fargate/RDS/S3, stronger consolidated controls but materially more operational burden and code/configuration work. Simpler alternative: a managed Next.js host plus managed PostgreSQL/object storage, but it needs a fresh runtime/security review and has less alignment with the current Worker configuration.

Public pricing checked 2026-07-26: Cloudflare publishes Workers Free at 100,000 requests/day ([pricing](https://www.cloudflare.com/plans/developer-platform-pricing/)); current Neon plan/pricing must be rechecked by the authorized account owner before any action; AWS Lightsail container services publish a $7/month minimum and examples from $10/month, plus transfer overages ([AWS documentation](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-faq-containers.html)). Planning ranges, excluding AI/OCR: fictional pilot best/expected/upper $0/$20–45/$60 monthly; modest production $40/$90–185/$250+ monthly. Costs, regions, retention, monitoring, and exit plan are unapproved assumptions.

## 6. Ordered go-live checklist

| # | Item / owner | Evidence and blocking consequence |
| --- | --- | --- |
| 1 | Repository owner: signed release, tests, audit | Missing evidence blocks all infrastructure work |
| 2 | Security owner: authoritative audit and reachable-high review | Blocks fictional staging |
| 3 | Business owner: provider, budget, account/billing owner | Blocks account creation |
| 4 | Privacy owner: region, notice, retention | Blocks real data |
| 5 | Operations owner: secrets, roles, migration plan | Blocks deploy |
| 6 | Operations owner: backup/restore proof | Blocks staging/production promotion |
| 7 | Incident owner: monitoring channels/playbooks | Blocks production |
| 8 | Product owner: scanner/OCR/AI decision or fail-closed confirmation | Blocks related activation |
| 9 | Approver: fictional staging authorization and smoke | Blocks Worker/database creation |
| 10 | Approver: production authorization, real-data sign-off, controlled pilot | Blocks production and onboarding |

## Ready / Not Ready summary

| Workstream | Status | Evidence | Remaining blocker |
| --- | --- | --- | --- |
| Database backup/restore | READY | guarded local custom-archive destroy/restore proof passed | provider backup/PITR plan still needs human approval |
| Deployment rehearsal | READY FOR AUTHORIZED PHASE 14B | local builds/scans/synths | audit endpoint and human authorization |
| Monitoring design | READY FOR IMPLEMENTATION | signal/severity/log design above | owners/channels/provider approval |
| Incident response | READY FOR HUMAN APPROVAL | four playbooks above | incident commander and communications approval |
| Provider packet | READY FOR HUMAN DECISION | options/pricing assumptions above | provider, region, budget decisions |
| Go-live checklist | NOT READY | ordered blockers above | all listed approvals and evidence |

## Human approval register and Phase 14B entry criteria

Required approvals: architecture, account/billing owners, pilot/production cost caps, database/storage regions, residency/privacy/retention, RPO/RTO/backup/off-provider policy, monitoring provider/channels/recipients, incident commander, secrets owner/rotation, scanning/OCR/Ask-AI provider decisions, fictional staging, production, real-data use, and pilot onboarding. No decision is implied by this report.

**Phase 14B entry:** explicit written authorization; reviewed passing authoritative runtime audit; provider/budget/owner/region decisions; the passing fictional restore proof recorded above; approved alert/incident ownership; signed fictional-staging checklist; and confirmation that real-data approval remains false. Phase 14B is not authorized by this phase.

## Confirmation

No real infrastructure, provider account, credential, remote workflow, remote deployment, real customer, or real data was accessed or created. The report itself performs no provider action.
