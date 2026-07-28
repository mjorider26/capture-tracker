# Gate 1B Linux Workerd review

## Decision

**PASS — READY FOR GATE 2.** This is a non-deployment evidence decision only. It does not authorize Cloudflare or Neon access, provider-resource creation, deployment, credentials, payment configuration, real data, or customer onboarding.

## Provenance and reconciled evidence

GitHub Actions `verification` run `30330025603` completed successfully for `main` push commit `46ab914ae7d0c4769acc0df28852f4ca1b2ba88e`. The reviewed sanitized artifact set contains the matching Gate 1B and direct-preflight reports; both record that exact deployment-candidate SHA. The accompanying inventory and audit reports are the sanitized artifacts from that same successful workflow upload.

| Proof | Result |
| --- | --- |
| Authoritative audit | Endpoint available; `valid-audit-json`; `standard-npm-audit-report`; lockfile clean; registry `registry.npmjs.org`; 0 critical, 6 high, 1 moderate; runtime gate `clear-runtime` |
| OpenNext build and reachability | Linux `cloud:build`, artifact inventory, and reachability steps passed |
| Worker artifact | `worker.js`; SHA-256 `d05223bf4d44c84108a102ab62aa3bc9c5568f0c3ac2064c37be5cc65c64bc45`; 2,278 bytes uncompressed; 734 bytes gzip; `fitsWorkersFree: true` |
| Static assets | 39 files; 1,589,390 bytes |
| Direct health preflight | Pass: live `200` JSON `status: live` (887 ms); ready `503` JSON `status: not_ready` (45 ms); clean shutdown |
| Full Workerd proof | Pass: live `200` JSON `status: live` (914 ms); ready `503` JSON `status: not_ready` (46 ms); 3,549 ms preview; clean SIGTERM shutdown |
| Wrangler dry run | Pass, exit code 0, clean cleanup; the reviewed command uses `--dry-run --no-autoconfig` |

The fail-closed readiness result is expected in this local proof because remote database configuration is intentionally absent. It is not a generic accepted 503: the shared parser requires the documented JSON `status: not_ready` value.

## Sanitization and boundaries

The inventory reports `reportSanitized: true`. The audit reports no sanitizer finding (`sanitizationDetected: false`), meaning it contained no prohibited value. The health reports retain only HTTP status, content-type category, safe top-level field names, safe state/code, bounded durations, child state, and bounded sanitized process diagnostics; they contain no response body, URL, private address, absolute path, credential, environment value, connection string, account identifier, or real data.

Only the fictional local Workerd preview and non-interactive Wrangler dry run were run. CI did not authenticate, contact a provider control plane, upload, deploy, create a resource, or use a provider credential.

## Known runtime CPU risks

This Gate 1B proof establishes local Worker startup, health behavior, artifact boundaries, and configured Free-feasibility guards. It does **not** measure production CPU consumption, database-network latency, traffic volume, cold-start behavior under load, or provider-enforced CPU accounting. The recorded health durations are wall-clock observations, not CPU measurements. The Workers Free planning limit and future CPU/error monitoring remain a separate Gate 2 and human-authorization concern.

This evidence expires on any dependency, lockfile, OpenNext/Next/Prisma, workflow, health-contract, Worker configuration, or release-candidate change.
