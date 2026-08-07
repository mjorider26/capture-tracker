# Production provisioning plan

> **SUPERSEDED / HISTORICAL**
>
> This document describes an earlier Capture Tracker implementation state and must not be used as the current production operations source of truth. See [Capture Tracker Production Operations](CAPTURE_TRACKER_PRODUCTION_OPERATIONS.md).

This plan is for a separate private-pilot production environment. It does not authorize a provider write, deployment, migration, seed, or real-data onboarding.

## Isolated resource contract

| Resource | Proposed value | Required isolation |
| --- | --- | --- |
| Cloudflare Worker | `capture-tracker-production` | A new Worker; never deploy through `capture-tracker-staging`. |
| Public URL | `https://capture-tracker-production.<account-subdomain>.workers.dev` until an approved custom domain is added | The checked-in configuration deliberately uses `.example.invalid` and cannot be used as a real auth origin. |
| R2 bucket | `capture-tracker-production-documents` | Private only, no `r2.dev` URL, no public/custom object domain, and no staging object copy. |
| PostgreSQL | A new Neon project and primary branch named `capture_tracker_production` | Separate project, database, roles, endpoints, credentials, backups, and data from staging. |

Proposed database region is Neon on AWS `us-west-2` (Oregon), chosen for the owner’s Pacific-time operation. The owner must confirm that region satisfies the applicable data-residency and privacy requirements before creation.

`wrangler.production.jsonc` is a placeholder-only, non-deploy authorization artifact. Its `CAPTURE_TRACKER_PAID_SERVICE_APPROVED` flag remains `false`, its auth URL is invalid, and it contains no account ID, token, database URL, or secret.

## Configuration and secret contract

| Name | Classification | Consumer | Production rule |
| --- | --- | --- | --- |
| `DATABASE_URL` | Worker secret | Prisma runtime and readiness | New pooled Neon runtime URL with TLS; never copy staging. |
| `BETTER_AUTH_SECRET` | Worker secret | Better Auth | Generate new high-entropy value; never copy staging. |
| `DOCUMENT_READ_GRANT_SECRET` | Worker secret | document read-grant signing | Generate new high-entropy value; never copy staging. |
| `CAPTURE_TRACKER_PRODUCTION_INVITATION_CODE` | Worker secret | invitation account route | Generate new value; never copy staging. |
| `CAPTURE_TRACKER_PRODUCTION_DATABASE_URL` | private provisioning input only | configuration preflight | New pooled Neon URL with `sslmode=verify-full`; do not keep it in a normal local `.env` file or Worker secret. |
| `CAPTURE_TRACKER_PRODUCTION_DIRECT_DATABASE_URL` | private migration input only | `prisma migrate deploy` | New direct Neon URL with `sslmode=verify-full`; never enter the Worker runtime. |
| `BETTER_AUTH_URL` | public Worker variable | Better Auth trusted origin | Set only after the exact Workers URL/custom domain is known. |
| `CAPTURE_TRACKER_ENVIRONMENT` | public Worker variable | environment guard | `production`. |
| `CAPTURE_TRACKER_EXECUTION_CONTEXT` | public Worker variable | environment guard | `cloudflare`. |
| `CAPTURE_TRACKER_DEPLOYMENT_PROFILE` | public Worker variable | environment guard | `production-cloudflare-neon`. |
| `CAPTURE_TRACKER_PRODUCTION_DATABASE_NAME` | public Worker variable | environment guard | `capture_tracker_production`. |
| `CAPTURE_TRACKER_PRODUCTION_DOCUMENT_BUCKET` | public Worker variable | environment guard | `capture-tracker-production-documents`. |
| `CAPTURE_TRACKER_PAID_SERVICE_APPROVED` | public Worker variable | environment guard | Change from `false` to `true` only after the owner authorizes provider costs. |
| `CAPTURE_TRACKER_REAL_DATA_APPROVED` | public Worker variable | environment guard | Keep `false` for acceptance; set `true` only in the separately authorized real-data release. |
| `CAPTURE_TRACKER_CUSTOMER_ONBOARDING_ENABLED` | public Worker variable | environment guard | Keep `false` for acceptance; set `true` only with real-data approval. |
| `CAPTURE_TRACKER_DATA_MODE` | public Worker variable | environment guard | `fictional` for acceptance, then `production` only with real-data approval. |

The production profile fails closed if it targets staging resources, lacks a distinct pooled/direct TLS Neon pair, lacks paid-service approval, or mixes fictional acceptance with enabled onboarding. The invitation route accepts production only under that profile and only with the production invitation secret; staging keeps its separate staging-only guard and secret.

## Database creation, migration, and recovery

1. The owner creates/authorizes a separate Neon project in the approved region, a primary production branch, and least-privilege roles: a runtime role limited to application DML and a migration role allowed only for controlled schema changes. Enforce TLS and connection limits at Neon; use the pooled endpoint for `DATABASE_URL` and a direct endpoint only for migrations.
2. Record the Neon Backup & Restore/PITR retention and automated snapshot schedule before the first migration. Minimum proposed retention is 7 days; retain an off-provider encrypted logical export only after the owner approves its location, encryption, and retention. Do not download a production dump to a workstation.
3. From an approved secure Linux/CI migration runner, inject the direct migration URL into the process memory only, set `DATABASE_URL` to that direct URL for the child process, and run exactly `npx prisma migrate deploy`. Do not run seed, `migrate dev`, `db push`, reset, resolve, or local PostgreSQL commands. The direct credential never enters Worker secrets.
4. Verify `_prisma_migrations`, database constraints/triggers/functions, tenant constraints, and balanced-ledger invariants with read-only production-safe queries before allowing any account onboarding. The database begins empty: no staging, demo, session, document, or fictional rows are copied.
5. If migration verification fails, stop the release. Restore the primary branch to the pre-migration Neon PITR/snapshot point or create an isolated recovery branch, verify it read-only, rotate affected credentials, and redeploy only the production Worker if required. Never roll back staging or touch `quoteready-api`.

## R2 document plan

Bind only `CAPTURE_TRACKER_DOCUMENTS` to `capture-tracker-production-documents`. The application already uses tenant-scoped metadata and `active/` object keys, server-side authenticated reads, duplicate detection, synchronous type/size checks, and private R2 access. Configure no public development URL, custom object domain, anonymous S3 token, or object-key logging. Define the pilot retention period before enabling uploads; object deletion must follow the application metadata retention/deletion policy and be verified with a controlled restore/export procedure.

Malware scanning and quarantine are deferred. Production remains a private single-owner pilot. External-party, employee, customer, contractor, shared, or otherwise untrusted uploads must stay disabled until scanning and quarantine exist.

## Monitoring, incident response, and rollback

Enable the existing Worker observability binding and configure Cloudflare dashboard alerts where the selected plan permits them. Review Worker exceptions (including 1101), request/CPU limits, auth failures, readiness failures, R2 binding/read errors, and log redaction. In Neon, monitor compute, storage, active connections, failed connections, branch/PITR status, migrations, and backup/snapshot status. Run scheduled read-only accounting-integrity, tenant-isolation, migration-drift, and readiness checks; alert on failed financial mutations, document access denials, and unexpected cross-business denials without logging document keys or personal/financial values.

For an incident: freeze production writes/onboarding, preserve sanitized Worker/Neon evidence, assess the affected production resource only, restore through the documented Neon recovery path if needed, rotate production-only credentials, validate readiness and ledger integrity, then authorize a replacement deployment. Staging and `quoteready-api` are out of scope for every production incident action.

## Pre-real-data production acceptance

After the isolated environment exists but before any real onboarding, create one temporary fictional production account through the production invitation route. Verify invitation signup, sign-in/sign-out, session persistence, workspace provisioning, empty Today, transaction posting, balanced journal, correction/reversal, private document upload/read and unauthenticated denial, reports/CSV, tax pages, Weekly Review, reconciliation, Ask AI’s approved-production boundary, Activity, Settings, tenant isolation, mobile, desktop, backup status, and readiness. Record only sanitized evidence.

Delete the temporary account and its tenant-scoped database rows/documents through a reviewed production cleanup procedure, or isolate it permanently as an explicitly fictional non-customer tenant. Confirm no temporary sessions, objects, invitation code, or fictional records remain reachable before changing data mode/onboarding to real production.

## Costs and owner actions

Cloudflare Workers Paid is a likely required new recurring cost for a production Worker: $5/month minimum, including 10 million requests and 30 million CPU-ms; overage is $0.30/million requests and $0.02/million CPU-ms. R2 Standard includes 10 GB-month, 1 million Class A writes, and 10 million Class B reads monthly; current published overage is $0.015/GB-month, $4.50/million Class A, and $0.36/million Class B, with no egress charge. Neon Launch is usage-based (currently described as typical $15/month): $0.106/CU-hour and $0.35/GB-month, plus backup/PITR retention storage; Scale adds higher usage and longer retention. Custom domains, external monitoring, encrypted off-provider backups, malware scanning, and a production extraction/AI provider are optional future costs and are not authorized by this plan.

Before any provider write, the owner must explicitly authorize: creation and billing for the new Cloudflare Worker/R2 bucket and Neon production project; the selected US-West region; the Worker public URL or custom domain; new production-only secrets; the paid Workers/Neon plans and backup retention; the temporary fictional acceptance; and the later, separate real-data/onboarding release. No staging secret, session, object, database, or invitation may be reused.
