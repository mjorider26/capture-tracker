import { existsSync, readFileSync } from "node:fs";

function text(path) {
  if (!existsSync(path)) throw new Error(`Required file is missing: ${path}`);
  return readFileSync(path, "utf8");
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const wrangler = text("wrangler.jsonc");
const nextConfig = text("next.config.ts");
const openNext = text("open-next.config.ts");
const live = text("src/app/api/health/live/route.ts");
const ready = text("src/app/api/health/ready/route.ts");
const robots = text("public/robots.txt");
const prisma = text("src/lib/prisma.ts");
const auth = text("src/lib/auth.ts");

assert(wrangler.includes('"nodejs_compat"'), "Cloudflare Node compatibility flag is required.");
assert(wrangler.includes('"global_fetch_strictly_public"') && wrangler.includes('"compatibility_date": "2026-07-23"'), "Pinned Worker compatibility date and required flags are required.");
assert(!/account_id|api[_-]?token|postgres(?:ql)?:\/\/|BETTER_AUTH_SECRET/i.test(wrangler), "Wrangler configuration must remain non-secret and account-free.");
assert(!/r2_buckets|CAPTURE_TRACKER_DOCUMENTS_BUCKET|r2\.dev|custom_domains|public[_ -]?access/i.test(wrangler), "Fictional staging must not configure R2 or public object access.");
assert(wrangler.includes('"CAPTURE_TRACKER_REAL_DATA_APPROVED": "false"'), "Free preview must keep real-data approval false.");
assert(wrangler.includes('"CAPTURE_TRACKER_CUSTOMER_ONBOARDING_ENABLED": "false"'), "Free preview must block customer onboarding.");
assert(wrangler.includes('"observability"'), "Worker logging must be enabled.");
assert(nextConfig.includes('output: "standalone"') && nextConfig.includes("initOpenNextCloudflareForDev"), "Next.js must retain standalone and OpenNext development support.");
assert(nextConfig.includes("turbopack: { root: projectRoot }"), "Next.js must pin Turbopack to this repository root.");
assert(nextConfig.includes('X-Content-Type-Options') && nextConfig.includes('X-Frame-Options'), "Cloud staging must set baseline security headers.");
assert(openNext.includes("defineCloudflareConfig"), "OpenNext configuration is required.");
assert(!openNext.includes("r2IncrementalCache"), "Financial application routes must not opt into R2 incremental caching.");
for (const [label, route] of [["liveness", live], ["readiness", ready]]) {
  assert(route.includes('dynamic = "force-dynamic"') && route.includes('"Cache-Control": "no-store"'), `${label} endpoint must be dynamic and no-store.`);
}
assert(ready.includes("SELECT 1") && ready.includes("status: 503"), "Readiness must check PostgreSQL and fail closed.");
assert(robots.includes("Disallow: /app/") && robots.includes("Disallow: /demo/") && robots.includes("Disallow: /api/"), "Financial paths must be excluded from crawling.");
assert(prisma.includes('import "server-only"') && auth.includes('import "server-only"'), "Prisma and Better Auth must be server-only.");
assert(text("src/app/app/money/[transactionId]/actions.ts").startsWith('"use server"') && text("src/app/app/taxes/estimates/[estimateId]/actions.ts").startsWith('"use server"'), "Transaction and payment write entry points must be Server Actions.");
assert(!text("src/components/tax-payment-form.tsx").includes("@/lib/services/tax-payment") && !text("src/components/transaction-review-form.tsx").includes("@/lib/services/review-transaction-core"), "Client components must not import transaction or payment write services.");
console.log("CLOUDFLARE RUNTIME VERIFIED: App Router build configuration, route handlers, Server Actions, Better Auth, Prisma/Neon Node compatibility, no-store/noindex, health endpoints, no-R2 staging, and server-secret boundaries passed static verification.");
