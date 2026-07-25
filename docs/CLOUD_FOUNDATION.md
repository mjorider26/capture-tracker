# Phase 9A cloud foundation

> Phase 9B repository preparation update (2026-07-25): no external account, provider resource, deployment, migration, bootstrap, restore drill, billing check, paid activation, AWS action, or R2 subscription occurred. The documented free-preview profile remains fictional-only; production is undeployed and real-data approval remains false. Linux OpenNext build, actual bundle measurement, reachable browser testing, Neon verification/concurrency proof, backup/restore drill, and live cost verification remain pending for the later external session. See `REAL_DATA_BOUNDARY.md`, `BACKUP_AND_RECOVERY.md`, and `CLOUD_DEPLOYMENT_RUNBOOK.md`.

## Deployment gate

`CAPTURE_TRACKER_DEPLOYMENT_PROFILE` defaults to `no-deploy`. There is no generic deployment command. `cloud:deploy:preview` rejects every profile except `free-preview-cloudflare-neon`, requires the exact `DEPLOY_FICTIONAL_STAGING` confirmation, and is the only Cloudflare deployment entry point. It is not called by CI.

The approved first cloud path is Cloudflare Workers with OpenNext, Neon managed PostgreSQL Free, Cloudflare R2 reserved for future private documents, and Cloudflare DNS/TLS/edge protections. PostgreSQL remains the relational store; D1 is not used. The existing AWS CDK foundation remains an independently tested and synthesized **optional future** `production-secure-aws` profile. No AWS deployment is planned or authorized by this phase.

## Free-preview boundary

`free-preview-cloudflare-neon` accepts only staging + Cloudflare execution; `CAPTURE_TRACKER_REAL_DATA_APPROVED=false`; `CAPTURE_TRACKER_DATA_MODE=fictional`; customer onboarding and paid-service activation both explicitly `false`; a TLS-required Neon pooled runtime URL and a distinct TLS-required Neon direct migration URL; a non-local, non-Prisma database host and the expected staging database name; and a private R2 document-bucket binding with no `r2.dev`, custom-domain, public-object, or browser credential configuration.

It rejects production, real-data approval, real banking/payroll/tax/document data, onboarding, paid activation, localhost, and local Prisma Dev targets. Migrations use only `prisma migrate deploy` through `cloud:migrate`, with a profile-specific confirmation and the direct migration URL. The application does not auto-seed any cloud environment. Browser code receives neither database nor R2 credentials. The Documents phase may later add short-lived, server-authorized object access after separate authorization and review; no object URL is currently exposed.

## Current free-tier planning assumptions

These are published allowances checked on 2026-07-23, not promises. Reconfirm both pricing and limits immediately before deployment.

| Service | Planning allowance |
| --- | --- |
| Cloudflare Workers Free | 100,000 requests/day; 10 ms CPU time per invocation |
| Neon Free | $0 plan; 100 compute-unit hours/project/month; 0.5 GB storage/project; automatic scale-to-zero |
| Cloudflare R2 Standard | 10 GB-month/month; 1 million Class A operations/month; 10 million Class B operations/month; no egress bandwidth charge |

The target operating cost for this one-person, very-low-usage fictional staging environment is $0 while it remains inside those published limits. Free plans are neither unlimited nor permanently unchanged. No automatic service-plan upgrade is permitted. Any paid-service activation requires an explicit later approval.

## OpenNext and runtime verification

The repository pins `@opennextjs/cloudflare` and Wrangler, uses a `nodejs_compat` Worker compatibility flag, standalone Next output, and the adapter's default workerd build condition. Linux CI runs `cloud:build`; `cloud:runtime:verify` verifies the App Router configuration, route handlers, Server Actions, Better Auth and Prisma server-only boundaries, health routes, no-store financial data behavior, robots exclusions, private R2 binding, and client-secret isolation. The local Windows adapter reports that Windows is not fully compatible and aborts before compilation while resolving the Windows/OneDrive path; WSL and Docker are not installed on this workstation. This host limitation is documented rather than bypassed, and Linux CI is the build authority for the OpenNext artifact.

The application intentionally keeps its existing behavior. No Edge runtime export is added. Prisma uses `@prisma/adapter-pg`; Node compatibility is required for the Prisma/`pg`/Better Auth server dependency path. The readiness probe performs a bounded `SELECT 1`; it returns `503` without exposing failure details. Both health endpoints are dynamic, `no-store`, and `noindex`. Financial application/demo routes remain dynamic and noindex.

## Monitoring, usage, alerts, and logs

- Cloudflare: Workers Logs is enabled in `wrangler.jsonc`; review Workers & Pages analytics for requests, errors, CPU time, and invocation duration. Review R2 bucket storage and Class A/B operations in the R2 dashboard. Set dashboard notifications/alerts where the account plan and provider controls support them, and review usage before any provider-plan change.
- Neon: review project compute hours, storage, branch activity, and connection metrics in the Neon console. Configure usage notifications or spend/usage controls where Neon makes them available for the chosen plan.
- Application: structured server logs omit URL, secret, password, token, key, and request-body fields. Readiness failure logs only the event name.

No external log export, production alert destination, provider account, Worker, database, bucket, DNS record, or paid service has been created by Phase 9A.

## Security review

Repository security controls and client/data-boundary scans pass. `npm audit --omit=dev` currently reports six high-severity upstream advisories through the latest available Prisma 7.9.0 and Next 16.2.11 dependency chains (including `@prisma/dev`/`find-my-way`, Next's bundled PostCSS, and Sharp). The registry reports no non-forced upgrade for either direct dependency. This does not authorize deployment: re-run the audit and apply an upstream fix before Phase 9B deployment. No audit finding introduced real data, credentials, or browser-visible secrets.

## Backup, recovery, and fictional-staging teardown

Neon remains the database system of record. Before staging deployment, document the Neon project's backup/restore and branch/recovery controls available on the then-current plan, and rehearse a restore only with fictional data. Future Documents work must define encrypted private-object retention, restore, and deletion validation before uploading any real document.

To tear down fictional staging completely:

1. Confirm the target is the fictional staging Worker/project/bucket and that no production resource name is selected.
2. Export only needed deployment metadata and test evidence; do not export credentials or any data outside the approved fictional set.
3. Disable Worker traffic, then delete the Worker/version and its preview route/DNS record if one was created.
4. Delete objects from the fictional R2 document bucket, verify zero objects and no public/custom-domain access, then delete the bucket.
5. Delete the fictional Neon project/branch only after confirming it is the staging database by name and data classification. Revoke its credentials.
6. Revoke Cloudflare and Neon deployment tokens, remove staging secrets from provider dashboards, and verify billing/usage screens show no remaining staging resources.
7. Record the teardown date, resource identifiers (not credentials), and final usage evidence.

Never apply this procedure to production. Production remains undeployed and real-data approval remains false.

## Phase 9B entry criteria

**Phase 9B — Free Cloudflare/Neon Staging Deployment, Reachable Browser Validation, Backup Review, and Cost Verification.**

Phase 9B may deploy only the approved free-preview Cloudflare/Neon profile with fictional staging data, explicit deployment confirmation, verified Neon pooled/direct URLs, private R2 settings, and no customer onboarding. It must perform reachable browser validation, review provider usage and $0 free-tier fit, review the available Neon backup/recovery controls, and document any unsupported runtime dependency. It must not deploy production, create AWS resources, enable real-data approval, introduce real data or credentials, or activate a paid plan. Real-data onboarding stays blocked pending a separate explicit production-readiness decision.
