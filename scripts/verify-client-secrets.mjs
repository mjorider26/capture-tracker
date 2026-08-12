import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
const root = join(process.cwd(), ".next", "static");
if (!existsSync(root)) throw new Error("Production build output is missing.");
const forbidden = ["DATABASE_URL", "DIRECT_DATABASE_URL", "CLOUDFLARE_API_TOKEN", "PLAID_CLIENT_ID", "PLAID_SECRET", "PLAID_TOKEN_ENCRYPTION_KEY", "postgresql://", "-----BEGIN PRIVATE KEY-----"];
const files = []; const walk = (dir) => { for (const item of readdirSync(dir, { withFileTypes: true })) { if (item.isDirectory()) walk(join(dir, item.name)); else if (item.name.endsWith(".js")) files.push(join(dir, item.name)); } }; walk(root);
const envFile = join(process.cwd(), ".env");
const secretValues = existsSync(envFile)
  ? readFileSync(envFile, "utf8").split(/\r?\n/).flatMap((line) => {
      const match = line.match(/^\s*(BETTER_AUTH_SECRET|DATABASE_URL|DIRECT_DATABASE_URL|CLOUDFLARE_API_TOKEN|PLAID_CLIENT_ID|PLAID_SECRET|PLAID_TOKEN_ENCRYPTION_KEY)=(.*)$/);
      if (!match) return [];
      const value = match[2].trim().replace(/^(?:"|')|(?:"|')$/g, "");
      return value ? [[match[1], value]] : [];
    })
  : [];
for (const file of files) {
  const content = readFileSync(file, "utf8");
  for (const pattern of forbidden) if (content.includes(pattern)) throw new Error(`Client bundle secret-name scan failed: ${pattern}.`);
  // Better Auth's supported browser client contains a lazy getter named
  // BETTER_AUTH_SECRET. The name is not a secret; check the configured value
  // itself so a client artifact can never contain that credential.
  for (const [name, value] of secretValues) if (content.includes(value)) throw new Error(`Client bundle secret-value scan failed: ${name}.`);
}
console.log("CLIENT SECRET VERIFIED: built browser JavaScript contains no database URL, Plaid server binding, or secret identifier.");
