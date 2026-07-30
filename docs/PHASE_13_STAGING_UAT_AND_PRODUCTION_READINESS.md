# Phase 13 staging UAT and production readiness

## Scope and safety boundary

This package applies only to fictional staging at `https://capture-tracker-staging.mjorider.workers.dev`. Use deterministic fictional data and fictional UAT records only. It does not authorize production infrastructure, real data, real users, billing changes, R2, or staging configuration changes. Never record credentials, connection strings, tokens, document bytes, or private provider details in UAT evidence.

## Test setup

1. Use an approved fictional staging login in a new browser profile/private session.
2. Use clearly fictional names, vendors, dates, amounts, and document samples; label each test-created record uniquely.
3. Record test ID, tester, UTC time, browser/device, pass/fail, severity, and a safe observation.
4. Stop and raise Severity 0 if cross-business data, unauthenticated protected data, a secret, or a production-looking target becomes visible.

## Click-by-click UAT checklist

| ID | Steps | Expected result | Pass/fail record |
| --- | --- | --- | --- |
| AUTH-01 | Open staging in a new private session, open **Sign in**, and submit fictional credentials. | HTTPS sign-in is reachable; protected routes are unavailable before sign-in; success reaches the intended app surface without displaying credentials. | PASS / FAIL; browser; safe note |
| AUTH-02 | Use **Sign out**, then use Back and open `/app/money` and `/api/me`. | Session ends; page redirects/rejects and API rejects; prior business data is not visible. | PASS / FAIL; redirect/status only |
| ONBOARD-01 | Complete onboarding with a fictional business name and confirm chart-of-accounts choices. | Required fields and validation are clear; completion creates only the intended fictional business context. | PASS / FAIL; fictional label |
| ONBOARD-02 | Change an allowed fictional business setting, review **Activity**, then submit an invalid setting value. | Allowed change is scoped and audited; invalid input is rejected without a partial update. | PASS / FAIL; event type only |
| MONEY-01 | In **Money**, create a clearly fictional transaction with required fields. | Validation is clear; record is active-business scoped; exact money formatting is retained; no unrelated accounting change occurs. | PASS / FAIL; label |
| MONEY-02 | Open/review the transaction, reload, then attempt an action outside the permitted role/session. | Review evidence persists; stale/unauthorized write is rejected. | PASS / FAIL; permitted/denied result |
| DOC-01 | In **Documents**, upload an approved fictional PDF/JPEG/PNG within the shown limit, wait for scan/loading, then open it. | Type/size feedback and scan state are truthful; authenticated viewer opens only the requested fictional document. | PASS / FAIL; type/state |
| DOC-02 | In another unauthenticated session, attempt the protected document URL. | Content is denied; no bytes, key, grant, hash, or internal path is exposed. | PASS / FAIL; denial status only |
| DOC-03 | Link the clean document to the fictional transaction; unlink and relink once. | Eligible choices are active-business scoped; link/unlink/relink history persists; transaction/accounting values do not change. | PASS / FAIL; state sequence |
| DOC-04 | Open **Extraction review**; accept/reject candidates where available; reload. | Extraction is evidence-only; review history persists; no transaction or journal entry is created/altered. | PASS / FAIL; decision/state |
| DOC-05 | Open **Suggested matching**, inspect reasons, reject one suggestion, and approve a valid one. | Reasons are retained; stale suggestions are identified; approval creates only the normal document relationship. | PASS / FAIL; decision/state |
| REC-01 | Open **Reconciliations**, make a fictional mismatch, correct it, and finalize only at zero. | Difference is visible; nonzero finalization is rejected; finalized zero-difference reconciliation is immutable. | PASS / FAIL; zero/nonzero result |
| TAX-01 | Open **Taxes**, estimates, owner compensation, and payroll guidance; use only fictional planning inputs. | CPA boundary is visible; payments are recorded rather than initiated; invalid/duplicate actions fail safely. | PASS / FAIL; screen/state |
| WEEKLY-01 | In **Review**, inspect counts, acknowledge an unresolved fictional item, complete/reopen the review, and reload. | Counts are active-business scoped; evidence persists; unresolved work is not hidden. | PASS / FAIL; state sequence |
| REPORT-01 | In **Reports**, view Profit and Loss, Balance Sheet, Trial Balance, and Cash Activity for a fictional date range. | Reports are posted-ledger-backed, readable, and balance where applicable; viewing does not change records. | PASS / FAIL for each report |
| EXPORT-01 | Export each available report CSV and inspect it locally. | Export matches fictional selection and excludes document bytes, keys, grants, credentials, secrets, and hidden reasoning. | PASS / FAIL; export kind |
| AI-01 | In **Ask AI**, ask a fictional read-only question and inspect evidence/feedback. | Assistance is labelled, scoped, read-only, audited, and causes no accounting or transaction write. | PASS / FAIL; safe classification |
| UI-01 | On desktop, navigate Today, Money, Documents, Review, Reports, Taxes, Ask AI, Activity, Settings at normal/narrow widths. | Shell, focus order, labels, tables, textual status, and financial numerals remain usable without hiding essential controls. | PASS / FAIL; browser/viewport |
| UI-02 | On mobile/mobile emulation, repeat Money, Documents, Review, Reports; rotate and use form keyboard. | Tabs/drawer, safe area, keyboard behavior, touch targets, and status text remain usable. | PASS / FAIL; device/browser |
| STATE-01 | In major workspaces: use a no-result filter, refresh during loading, submit invalid input, and attempt a role-restricted action. | Empty, loading, error, and permission states are distinct, honest, and disclose no protected data. | PASS / FAIL; workspace/state |
| RESILIENCE-01 | Repeatedly reload Review/Reports; navigate Today → Money → Documents → Review → Reports; confirm private-session denial. | No indefinitely loading shell or exposed P1017/connection-closed error; protected boundaries remain fail-closed. | PASS / FAIL; browser/device |

### UAT exit criteria

All applicable tests pass, all test-created records are confirmed fictional, and no Severity 0/1 issue remains. Severity 2 requires a named owner, remediation date, and written risk acceptance. Staging UAT is not production or real-data approval.

## Issue severity scale

| Severity | Meaning | Response |
| --- | --- | --- |
| 0 — Critical | Cross-business/unauthenticated disclosure, secret exposure, data loss/corruption, accounting imbalance, real-data boundary breach, or production-target risk. | Stop UAT and block production. Preserve safe evidence only. |
| 1 — High | Core workflow unavailable, unauthorized mutation possible, invariant broken, protected-document failure, or persistent readiness failure. | Block production; fix and repeat affected UAT/regression checks. |
| 2 — Medium | Important workflow wrong/confusing with safe workaround; no integrity/security failure. | Fix before production unless approved mitigation/risk acceptance exists. |
| 3 — Low | Cosmetic, copy, or minor usability issue that does not conceal a control/state. | Track for remediation. |

## Production-readiness checklist

### Human decisions

- [ ] Explicit production-infrastructure, real-data, and real-user/pilot authorization.
- [ ] Named production, billing, incident, database, backup, document-storage, security, and secrets owners.
- [ ] Approved privacy/residency/retention, cost ceiling, alert recipients, escalation path, RPO/RTO, and CPA/payroll operating boundary.

### Application and security

- [ ] All UAT rows pass and evidence is signed.
- [ ] Exact-candidate authoritative Linux CI, audit, dependency review, artifact inventory/reachability, client-secret, and data-boundary gates pass.
- [ ] Full PostgreSQL accounting, authorization/business isolation, immutable-history, concurrency, and export checks pass.
- [ ] Production authentication/session/recovery, least privilege, and audit-log access are reviewed.
- [ ] Production document storage is encrypted/private, scanned, recovered, and server-authorized; it must not rely on staging local-file behavior.
- [ ] OCR/Ask AI data handling, retention, opt-in, and fail-closed provider behavior have separate approval.

### Operations and recovery

- [ ] Production resources and credentials are separate from staging.
- [ ] Backup frequency, retention, encryption, off-provider copy policy, RPO/RTO, and a restore drill against a disposable production-like target are approved/demonstrated.
- [ ] Safe logs, health checks, request/error/CPU/database alerts, on-call routing, and incident runbooks are active.
- [ ] Rollback is rehearsed with a prior immutable Worker version and forward-compatible migrations; no destructive migration reversal is automatic.
- [ ] Launch go/no-go records owners, evidence, outstanding risks, and rollback authority.

## Proposed production architecture — not provisioned

```text
Browser
  -> separate production Worker: capture-tracker-production
       -> Better Auth and server-derived business authorization
       -> separate production Neon project/database (pooled runtime URL)
       -> encrypted private production document storage + approved scan pipeline
       -> approved read-only AI/OCR providers only when separately enabled

Restricted migration operator
  -> separate direct production migration URL
  -> prisma migrate deploy only, with reviewed forward-compatible migrations

Operations
  -> provider secret storage, CI release evidence, safe logs/alerts,
     encrypted backups/restore drills, and immutable Worker versions
```

Production uses a distinct Worker name, Neon project/database, runtime/migration URLs, Better Auth secret, document-read grant secret, and document namespace. Secrets exist only in approved provider/CI secret storage, never source, browser code, or logs. The proposed release sequence is: approve exact commit → provision isolated resources → apply reviewed migration → bind secrets → deploy immutable version → verify health/auth/empty/document fail-closed/monitoring → authorize pilot. No demo seed, reset, automatic restore, or automatic rollback is permitted.

## Limited first-user pilot — Robert

Robert may be the sole first pilot user only after this checklist and a separate written real-data authorization are complete; until then he tests fictional staging only.

1. Create one production business context only after authorization; provide a secure onboarding channel and named support contact. Do not import historical data or bank feeds in the first session.
2. Start with the explicitly approved minimum: sign-in, onboarding, a small number of manual entries, Weekly Review, and read-only reports. Keep documents, OCR, external AI, payroll execution, tax-payment recording, integrations, and multi-user access disabled unless separately approved.
3. Observe the first session, confirm business scope/sign-out/report accuracy, and record only safe operational evidence.
4. Review safe alerts, readiness, errors, backup status, costs, and Robert's feedback daily during the agreed pilot period.
5. Expand only after reviewing incidents, accounting verification, backup/restore evidence, costs, and feedback. Any Severity 0/1 issue, accounting discrepancy, access-control concern, document-security failure, missing backup evidence, or cost surprise pauses the pilot.

## Manual testing required before production authorization

A human must complete every UAT row on supported desktop and mobile devices, inspect fictional CSV output locally, verify sign-out/denial in a separate session, and sign the UAT exit record. An operations/security owner must separately verify region, billing, secret ownership, monitoring, backup/restore, document controls, incident/rollback runbook, and exact-candidate CI evidence. Production authorization is a separate written decision after those checks.
