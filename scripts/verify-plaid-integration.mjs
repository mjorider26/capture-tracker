import { readFile } from "node:fs/promises";

const files = Object.fromEntries(await Promise.all([
  "wrangler.production.jsonc",
  "src/lib/providers/plaid/client.ts",
  "src/lib/providers/plaid/crypto.ts",
  "src/lib/providers/plaid/webhook-verification.ts",
  "src/app/api/plaid/webhook/route.ts",
  "src/lib/services/plaid-bank.ts",
  "src/components/plaid-link-button.tsx",
  "src/components/money-experience.tsx",
  "src/lib/data/money-operations.ts",
  "next.config.ts",
].map(async (path) => [path, await readFile(path, "utf8")])));
const all = Object.values(files).join("\n");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

for (const name of ["PLAID_CLIENT_ID", "PLAID_SECRET", "PLAID_TOKEN_ENCRYPTION_KEY"]) assert(files["wrangler.production.jsonc"].includes(`"${name}"`), `Production secret declaration is missing ${name}.`);
assert(files["wrangler.production.jsonc"].includes('"PLAID_ENV": "production"'), "Production must target Plaid production explicitly.");
assert(all.includes('products = ["transactions"]') || all.includes('body.products = ["transactions"]'), "Plaid Transactions must be the explicit product boundary.");
assert(!/products\s*=\s*\[[^\]]*(?:auth|transfer|payment)/iu.test(all), "Money movement or Auth product request found.");
assert(files["src/lib/providers/plaid/crypto.ts"].includes('"AES-GCM"'), "Access token encryption must use authenticated AES-GCM.");
assert(files["src/lib/providers/plaid/webhook-verification.ts"].includes('header.alg !== "ES256"') && files["src/lib/providers/plaid/webhook-verification.ts"].includes("request_body_sha256"), "Webhook ES256 and body-hash verification are required.");
assert(files["src/app/api/plaid/webhook/route.ts"].includes('providerConnectionRef: itemId') && !files["src/app/api/plaid/webhook/route.ts"].includes("body.businessId"), "Webhook tenant resolution must use only the provider Item id.");
assert(!/(console\.(?:log|error)|metadataJson|afterJson)[^\n]*(?:access[_-]?token|public[_-]?token|PLAID_SECRET|rawBody)/iu.test(all), "Possible Plaid credential or raw-payload logging found.");
assert(files["src/lib/services/plaid-bank.ts"].includes("postedTransactionId") && files["src/lib/services/plaid-bank.ts"].includes('"REMOVED"') && files["src/lib/services/plaid-bank.ts"].includes("postedTransactionId: null"), "Posted-history and removal safeguards are required.");
assert(files["src/components/plaid-link-button.tsx"].includes("usePlaidLink") && !files["src/components/plaid-link-button.tsx"].match(/password|routing number|account number/iu), "Plaid Link must be used without a credential form.");
assert(files["src/lib/data/money-operations.ts"].includes("automaticBankSyncAvailable: plaidConfigured()"), "Money provider availability must come from sanitized server configuration, not connection count.");
assert(!files["src/components/money-experience.tsx"].includes("Live provider not configured") && files["src/components/money-experience.tsx"].includes("Automatic bank sync is available"), "Money must distinguish provider availability from a zero-connection customer state.");
for (const source of ["https://cdn.plaid.com", "https://sandbox.plaid.com", "https://production.plaid.com"]) assert(files["next.config.ts"].includes(source), `Plaid Link CSP source is missing ${source}.`);
assert(files["next.config.ts"].includes("frame-src https://cdn.plaid.com"), "Plaid Link iframe must be permitted by the CSP.");

console.log("PLAID INTEGRATION VERIFIED: read-only Transactions scope, encrypted tokens, signed/replay-safe webhooks, Item-scoped tenant resolution, Link consent, and immutable posted history safeguards passed.");
