# Phase 14B fictional staging report

## Gate 2B database evidence

Gate 2B created and verified one Free Neon fictional staging project in the approved Ohio region. PostgreSQL 18.4 passed staged preflight, twelve committed migrations, deterministic fictional bootstrap, accounting and business-isolation verification, and a PostgreSQL 18 custom-format logical backup/local restore proof.

The sanitized recovery evidence records a `257,409`-byte archive with SHA-256 `1e4d22b7251ea313a7e1eea918538956a002f97fa4cc4b43febe8b70cffded94`, `12,839 ms` backup duration, `873 ms` restore duration, zero warnings or fatal stderr lines, and an exact pre/post manifest match. The archive was deleted after the proof.

No connection information, local password, provider ID, branch ID, document byte, real data, or real user was used or retained. R2 remains blocked and unused.

## Status

Database technical proof: **PASS**. The post-proof Neon Billing console confirms the Free plan, `$0/month` displayed cost, no paid plan or add-on, and no payment method. Gate 2B is complete.

## Gate 2C fictional staging deployment

Gate 2C subsequently deployed only the existing fictional Worker `capture-tracker-staging` at `https://capture-tracker-staging.mjorider.workers.dev`. The final deployed commit is `253c0aa204c7fad8d47bc793cad9fb98facb7667`, with authoritative Linux workflow `30555414933` passing. The deployed Worker version is `70a83efb-8024-4176-8098-8e1fb191e4ea`.

The final native-Linux and public proof passed: liveness, 30 sequential and 20 concurrent readiness requests, post-idle readiness, post-smoke readiness, unauthenticated application/API/document boundaries, fictional staging smoke, accounting integrity, business isolation, and deliberate local unavailable-database fail-closed behavior. The uploaded package was 18,252.08 KiB raw and 4,146.68 KiB gzip, below the Workers Paid 10 MiB limit. Only the existing Worker was updated; no R2, D1, KV, route, custom domain, production resource, real data, or unrelated Worker was changed.

Exactly three encrypted secret names were verified without values: `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `DOCUMENT_READ_GRANT_SECRET`. Temporary deployment bundles and native-Linux workspaces were removed after proof. This is fictional staging evidence only; it does not authorize production, real data, or real-user onboarding.
