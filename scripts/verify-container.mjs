import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
const forbidden = ["DATABASE_URL", "DIRECT_DATABASE_URL", "BETTER_AUTH_SECRET", "R2_SECRET_ACCESS_KEY", "R2_ACCESS_KEY_ID", "postgresql://", "-----BEGIN PRIVATE KEY-----"];
const root = join(process.cwd(), ".next", "static");
if (!existsSync(root)) throw new Error("Production build output is missing.");
const files = []; const walk = (dir) => { for (const item of readdirSync(dir, { withFileTypes: true })) { if (item.isDirectory()) walk(join(dir, item.name)); else if (item.name.endsWith(".js")) files.push(join(dir, item.name)); } }; walk(root);
for (const file of files) { const text = readFileSync(file, "utf8"); for (const pattern of forbidden) if (text.includes(pattern)) throw new Error(`Client bundle secret-name scan failed: ${pattern} in ${file.replace(process.cwd(), ".")}`); }
const ignore = readFileSync(".dockerignore", "utf8"); for (const entry of [".env*", ".git", "node_modules"]) if (!ignore.includes(entry)) throw new Error("Docker ignore protection is incomplete.");
console.log("CONTAINER VERIFIED: Docker ignore policy and client bundle secret-name scan passed.");
