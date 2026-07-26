# Free fictional staging deployment runbook

This is a later-session runbook. It performs no provider action merely by existing.

## Preconditions

- Reconfirm Cloudflare Workers Free and Neon Free plan terms, limits, backup/restore controls, and that no paid activation or credit-card entry is authorized.
- Confirm production is undeployed, real-data approval is false, fictional staging has no R2 binding, and no AWS resource is in scope.
- Confirm `docs/DEPENDENCY_SECURITY_REVIEW.md` has a current passing separation check, passing `cloud:postgres:verify:installed` and `cloud:postgres:verify:artifact` evidence, and the reviewed Linux 2,278-byte OpenNext Worker entry. The attached inventory identified the prior gate as Next's unresolved conditional Sharp import, not copied Sharp code. The supported `images.unoptimized` remediation retains fixed local brand images while removing the unapproved runtime optimizer. This gate is decision **B**, conditionally blocked until a succeeding Linux artifact proves the generated configuration and passing inventory/reachability report, followed by a fresh audit.
- Create only separately credentialed fictional staging resources after explicit authorization. Do not create R2 unless a later document-storage phase approves it.
- Supply secrets only to provider runtime secret storage. Never commit them, put them in Wrangler configuration, or print them.

## Configuration sequence

1. Configure the pinned `free-preview-cloudflare-neon` Worker variables from `wrangler.jsonc`; do not add an account ID, token, secret, or database URL to the repository.
2. Set the pooled Neon runtime connection and direct migration connection only as secure runtime inputs. Both require TLS; the runtime endpoint must be pooled and the migration endpoint direct.
3. Run `npm run cloud:config:verify`, `npm run cloud:phase-9b:verify`, `npm run dependency:separation:verify`, `npm run cloud:postgres:verify:installed`, the fresh production audit, and the Linux CI workflow. The workflow must retain `cloud:postgres:verify:artifact`, the Linux OpenNext build, actual Worker-bundle measurement, and artifact secret/excluded-tooling checks; it must then pass `cloud:artifact:inventory` and `cloud:artifact:reachability`, upload only the sanitized inventory/audit evidence, and record direct reachability for PostCSS, Sharp, `find-my-way`, and Valibot before this release gate may open.
4. With explicit confirmation only, run `npm run cloud:migrate`. It only invokes `prisma migrate deploy`; it cannot seed, run `migrate dev`, reset, resolve, or push.
5. With a distinct explicit confirmation and secure runtime-only fictional `.demo` credential input, run `npm run cloud:bootstrap:fictional`. It creates only deterministic fictional records and a hashed fictional credential.
6. Build and deploy only when separately authorized. CI contains no deployment command.
7. After a reachable HTTPS staging URL exists, run `npm run cloud:smoke:fictional -- https://<fictional-staging-host>`, then run `npm run cloud:neon:verify` with approved fictional-staging runtime input.

## Smoke criteria

The future smoke tool rejects localhost, missing HTTPS, production-looking hosts, unsafe profiles, and real-data approval. It checks liveness, readiness, login reachability, unauthenticated financial-route protection, noindex/no-store protections, security headers, malformed IDs, not-found behavior, and absence of secret disclosure.

## Cost checklist

Before deployment and again after testing, record:

- current Cloudflare and Neon plans, paid-subscription status, and whether any credit card/overage setting exists;
- Worker requests, CPU time, errors, and bundle size;
- Neon compute, storage, connections, backup/restore capabilities, and current bill;
- whether any R2, production, or AWS resource exists; and
- evidence that the expected target cost remains $0.

Planning assumption only: Cloudflare Workers Free and Neon Free may fit this small fictional preview at $0. There is no permanent-free guarantee, no paid-plan authorization, and no live billing verification.
