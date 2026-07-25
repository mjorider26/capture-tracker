import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
const root = join(process.cwd(), ".next", "static");
if (!existsSync(root)) throw new Error("Production build output is missing.");
const forbidden = ["DATABASE_URL", "DIRECT_DATABASE_URL", "BETTER_AUTH_SECRET", "CLOUDFLARE_API_TOKEN", "postgresql://", "-----BEGIN PRIVATE KEY-----"];
const files = []; const walk = (dir) => { for (const item of readdirSync(dir, { withFileTypes: true })) { if (item.isDirectory()) walk(join(dir, item.name)); else if (item.name.endsWith(".js")) files.push(join(dir, item.name)); } }; walk(root);
for (const file of files) for (const pattern of forbidden) if (readFileSync(file, "utf8").includes(pattern)) throw new Error(`Client bundle secret-name scan failed: ${pattern}.`);
console.log("CLIENT SECRET VERIFIED: built browser JavaScript contains no database URL or secret identifier.");
