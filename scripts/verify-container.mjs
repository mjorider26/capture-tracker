import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
const forbidden = ["DATABASE_URL", "DIRECT_DATABASE_URL", "BETTER_AUTH_SECRET", "R2_SECRET_ACCESS_KEY", "R2_ACCESS_KEY_ID", "postgresql://", "-----BEGIN PRIVATE KEY-----"];
const root = join(process.cwd(), ".next", "static");
if (!existsSync(root)) throw new Error("Production build output is missing.");
const files = []; const walk = (dir) => { for (const item of readdirSync(dir, { withFileTypes: true })) { if (item.isDirectory()) walk(join(dir, item.name)); else if (item.name.endsWith(".js")) files.push(join(dir, item.name)); } }; walk(root);
const secretValues = existsSync(".env")
  ? readFileSync(".env", "utf8").split(/\r?\n/).flatMap((line) => {
      const match = line.match(/^\s*(BETTER_AUTH_SECRET|DATABASE_URL|DIRECT_DATABASE_URL|R2_SECRET_ACCESS_KEY|R2_ACCESS_KEY_ID)=(.*)$/);
      if (!match) return [];
      const value = match[2].trim().replace(/^(?:"|')|(?:"|')$/g, "");
      return value ? [[match[1], value]] : [];
    })
  : [];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const pattern of forbidden.filter((value) => value !== "BETTER_AUTH_SECRET")) if (text.includes(pattern)) throw new Error(`Client bundle secret-name scan failed: ${pattern} in ${file.replace(process.cwd(), ".")}`);
  // Better Auth's supported browser client contains an inert lazy getter named
  // BETTER_AUTH_SECRET. Scan each configured value instead of mistaking that
  // vendor identifier for credential disclosure.
  for (const [name, value] of secretValues) if (text.includes(value)) throw new Error(`Client bundle secret-value scan failed: ${name} in ${file.replace(process.cwd(), ".")}`);
}
const ignore = readFileSync(".dockerignore", "utf8"); for (const entry of [".env*", ".git", "node_modules"]) if (!ignore.includes(entry)) throw new Error("Docker ignore protection is incomplete.");
console.log("CONTAINER VERIFIED: Docker ignore policy and client bundle secret-name scan passed.");
