# Phase 9A cloud foundation

> Phase 9B.1 dependency-security update (2026-07-25): no external account, provider resource, deployment, migration, bootstrap, restore drill, billing check, paid activation, AWS action, or R2 subscription occurred. The documented free-preview profile remains fictional-only with no R2 binding; production is undeployed and real-data approval remains false. A compatible Next patch and build-only OpenNext dependency separation were applied, but the staging release gate is blocked pending Linux OpenNext artifact evidence and runtime-high remediation. See `DEPENDENCY_SECURITY_REVIEW.md`, `REAL_DATA_BOUNDARY.md`, and `CLOUD_DEPLOYMENT_RUNBOOK.md`.

## Deployment gate

`CAPTURE_TRACKER_DEPLOYMENT_PROFILE` defaults to `no-deploy`. There is no generic deployment command. `cloud:deploy:preview` rejects every profile except `free-preview-cloudflare-neon`, requires the exact `DEPLOY_FICTIONAL_STAGING` confirmation, and is the only Cloudflare deployment entry point. It is not called by CI.

The approved first cloud path is Cloudflare Workers with OpenNext, Neon managed PostgreSQL Free, Cloudflare R2 reserved for future private documents, and Cloudflare DNS/TLS/edge protections. PostgreSQL remains the relational store; D1 is not used. The existing AWS CDK foundation remains an independently tested and synthesized **optional future** `production-secure-aws` profile. No AWS deployment is planned or authorized by this phase.

## Free-preview boundary

`free-preview-cloudflare-neon` accepts only staging + Cloudflare execution; `CAPTURE_TRACKER_REAL_DATA_APPROVED=false`; `CAPTURE_TRACKER_DATA_MODE=fictional`; customer onboarding and paid-service activation both explicitly `false`; and a TLS-required Neon pooled runtime URL plus a distinct TLS-required Neon direct migration URL with a non-local, non-Prisma host and expected staging database name. It declares no R2 binding or bucket target.

It rejects production, real-data approval, real banking/payroll/tax/document data, onboarding, paid activation, localhost, and local Prisma Dev targets. Migrations use only `prisma migrate deploy` through `cloud:migrate`, with a profile-specific confirmation and the direct migration URL. The application does not auto-seed any cloud environment. Browser code receives no database or object-storage credentials. The Documents phase may later add private object storage after separate authorization and review; no object URL or bucket is currently configured.

## Current free-tier planning assumptions

These are published allowances checked on 2026-07-23, not promises. Reconfirm both pricing and limits immediately before deployment.

| Service | Planning allowance |
| --- | --- |
| Cloudflare Workers Free | 100,000 requests/day; 10 ms CPU time per invocation |
| Neon Free | $0 plan; 100 compute-unit hours/project/month; 0.5 GB storage/project; automatic scale-to-zero |

The target operating cost for this one-person, very-low-usage fictional staging environment is $0 while it remains inside those published limits. Free plans are neither unlimited nor permanently unchanged. No automatic service-plan upgrade is permitted. Any paid-service activation requires an explicit later approval.

## OpenNext and runtime verification

The repository pins OpenNext exactly as build tooling and pins Wrangler, uses a `nodejs_compat` Worker compatibility flag, standalone Next output, and the adapter's default workerd build condition. Linux CI runs `cloud:build`; `cloud:runtime:verify` and `dependency:separation:verify` check App Router configuration, routes/actions, Better Auth and Prisma server-only boundaries, health/no-store behavior, no R2 staging binding, client-secret isolation, and exclusion of AWS/test/local-DB tooling and unsafe dynamic loading from application source. The local Windows adapter reports that Windows is not fully compatible and aborts before compilation while resolving the Windows/OneDrive path; WSL and Docker are not installed on this workstation. This host limitation is documented rather than bypassed, and Linux CI is the build authority for the OpenNext artifact.

The first Linux verification run exposed a root TypeScript boundary defect before the OpenNext build: root Next type checking discovered the isolated `infra/aws` CDK entrypoint without its separate dependencies. The root project now excludes `infra/aws` and its generated CDK/test outputs, while `infra/aws/tsconfig.json` remains responsible for CDK compile/test/synthesis after the Worker build. The repository guard verifies this order and isolation. A new successful Linux run is still needed; no Linux Worker artifact is claimed by this correction.

The second Linux run passed the ordinary Next build and reached OpenNext bundling. It found `pg-cloudflare@1.4.0` only with its manifest in the traced server-function tree, while the lockfile-installed package correctly contains its Workerd `dist/index.js` entry. This was a conditional-export tracing boundary, not a PostgreSQL, Prisma, or Neon architecture failure. `next.config.ts` now lists only `pg-cloudflare` in `serverExternalPackages`, activating OpenNext `1.20.2`'s supported full-package copy and Workerd-export rewrite. CI verifies the locked source package before build and the generated server-function package, Worker bundle, excluded tooling, secrets, and unresolved external after build. No direct dependency, custom copy script, or runtime/database behavior changed. Linux remains the artifact authority; no successful Worker artifact is claimed until the updated workflow passes.

The updated Linux workflow passed at commit `e34684a`: OpenNext saved `.open-next/worker.js`, and the configured bundle check measured **2,278 bytes**, below the 3 MiB fictional-preview guard. Artifact verification confirmed `pg-cloudflare@1.4.0`, `pg-cloudflare/dist/index.js`, Workerd exports, and no unresolved driver external. It also confirmed the configured exclusions for AWS CDK, Prisma CLI/Dev, Vitest, TypeScript/ESLint, and local PGlite tooling, plus no database URL, secret marker, credential, workstation path, or detected real-data pattern. The Linux build reported no OpenNext runtime-safety warning. It used compatibility date `2026-07-23` with `nodejs_compat` and `global_fetch_strictly_public`. The archived evidence does not inventory PostCSS, Sharp, `find-my-way`, or Valibot in the actual deployment tree, so their runtime reachability remains unproven and fictional staging is conditionally blocked pending that evidence.

Phase 9B.3 adds a sanitized artifact report for the next Linux build. It starts from generated Worker and server-function request entrypoints, treats esbuild metafile inputs as bundled executable evidence, copied `node_modules` manifests as runtime-package evidence, and records build manifests/source maps separately without treating their package-name strings as executable. The report never includes artifact text, URLs, credentials, environment values, absolute paths, or user data; it is ignored locally and uploaded only as sanitized CI evidence. CI rejects a missing/unsafe report, unresolved target, or request-time-reachable high target. This is repository tooling only: it does not change application, PostgreSQL, accounting, authentication, or deployment behavior.

The application intentionally keeps its existing behavior. No Edge runtime export is added. Prisma uses `@prisma/adapter-pg`; Node compatibility is required for the Prisma/`pg`/Better Auth server dependency path. The readiness probe performs a bounded `SELECT 1`; it returns `503` without exposing failure details. Both health endpoints are dynamic, `no-store`, and `noindex`. Financial application/demo routes remain dynamic and noindex.

## Monitoring, usage, alerts, and logs

- Cloudflare: Workers Logs is enabled in `wrangler.jsonc`; review Workers & Pages analytics for requests, errors, CPU time, and invocation duration. No R2 metrics are applicable because fictional staging declares no R2 resource. Set dashboard notifications/alerts where the account plan and provider controls support them, and review usage before any provider-plan change.
- Neon: review project compute hours, storage, branch activity, and connection metrics in the Neon console. Configure usage notifications or spend/usage controls where Neon makes them available for the chosen plan.
- Application: structured server logs omit URL, secret, password, token, key, and request-body fields. Readiness failure logs only the event name.

No external log export, production alert destination, provider account, Worker, database, bucket, DNS record, or paid service has been created by Phase 9A.

## Security review

Repository security controls and client/data-boundary scans pass. `npm audit --omit=dev` currently reports six high-severity upstream advisories through the latest available Prisma 7.9.0 and Next 16.2.12 dependency chains (including `@prisma/dev`/`find-my-way`, Next's bundled PostCSS, and Sharp). The registry reports no non-forced upgrade for either direct dependency. This does not authorize deployment: re-run the audit and apply an upstream fix before Phase 9B deployment. No audit finding introduced real data, credentials, or browser-visible secrets.

## Backup, recovery, and fictional-staging teardown

Neon remains the database system of record. Before staging deployment, document the Neon project's backup/restore and branch/recovery controls available on the then-current plan, and rehearse a restore only with fictional data. Future Documents work must define encrypted private-object retention, restore, and deletion validation before uploading any real document.

To tear down fictional staging completely:

1. Confirm the target is the fictional staging Worker/project/bucket and that no production resource name is selected.
2. Export only needed deployment metadata and test evidence; do not export credentials or any data outside the approved fictional set.
3. Disable Worker traffic, then delete the Worker/version and its preview route/DNS record if one was created.
4. Delete the fictional Neon project/branch only after confirming it is the staging database by name and data classification. Revoke its credentials.
5. Revoke Cloudflare and Neon deployment tokens, remove staging secrets from provider dashboards, and verify billing/usage screens show no remaining staging resources.
6. Record the teardown date, resource identifiers (not credentials), and final usage evidence.

Never apply this procedure to production. Production remains undeployed and real-data approval remains false.

## Phase 9B entry criteria

**Phase 9B — Free Cloudflare/Neon Staging Deployment, Reachable Browser Validation, Backup Review, and Cost Verification.**

Phase 9B.3 decision **B** conditionally blocks fictional staging today. The reviewed Linux entry Worker exists and passes the 3 MiB guard, driver packaging, defined excluded-tooling, and secret/data checks. Before a later authorized deployment, run the new Linux inventory/reachability gate for PostCSS, Sharp, `find-my-way`, and Valibot; rerun the fresh audit; complete trusted-build review; retain the approved fictional Cloudflare/Neon profile, no R2 binding, no customer onboarding, and passing separation checks; and obtain explicit deployment confirmation. It must then perform reachable browser validation, review provider usage and $0 free-tier fit, review the available Neon backup/recovery controls, and document any unsupported runtime dependency. It must not deploy production, create AWS resources, enable real-data approval, introduce real data or credentials, or activate a paid plan. Real-data onboarding stays blocked pending a separate explicit production-readiness decision.
