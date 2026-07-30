import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function text(path) {
  return readFileSync(path, "utf8");
}
function json(path) {
  return JSON.parse(text(path));
}
function pathsUnder(directory) {
  const files = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) files.push(path);
    }
  };
  walk(directory);
  return files;
}

const mode = process.argv[2];
assert(mode === "--installed" || mode === "--artifact", "Usage: verify-pg-cloudflare-packaging.mjs --installed|--artifact");

const lock = json("package-lock.json");
const installedRoot = "node_modules/pg-cloudflare";
const installedPackagePath = join(installedRoot, "package.json");
const installedEntryPath = join(installedRoot, "dist/index.js");
assert(existsSync(installedPackagePath), "Locked pg-cloudflare package is missing after installation.");
assert(existsSync(installedEntryPath), "Installed pg-cloudflare Workerd require entry is missing: dist/index.js.");

const installed = json(installedPackagePath);
const locked = lock.packages?.[installedRoot];
assert(locked?.version === installed.version, "Installed pg-cloudflare version does not match package-lock.json.");
assert(installed.exports?.["."]?.workerd?.require === "./dist/index.js", "Installed pg-cloudflare must publish the Workerd require entry.");
assert(installed.exports?.["."]?.workerd?.import === "./esm/index.mjs", "Installed pg-cloudflare must publish the Workerd import entry.");
assert(text("next.config.ts").includes('"pg-cloudflare"'), "Next.js must explicitly activate OpenNext Workerd copying for pg-cloudflare.");

if (mode === "--installed") {
  console.log(`PG-CLOUDFLARE INSTALL VERIFIED: ${installed.name}@${installed.version} publishes dist/index.js and Workerd exports from the lockfile-installed package.`);
  process.exit(0);
}

const artifactRoot = ".open-next/server-functions/default";
const artifactPackageRoot = join(artifactRoot, "node_modules/pg-cloudflare");
const artifactPackagePath = join(artifactPackageRoot, "package.json");
const artifactEntryPath = join(artifactPackageRoot, "dist/index.js");
const workerPath = ".open-next/worker.js";
assert(existsSync(artifactPackagePath), "OpenNext artifact is missing the pg-cloudflare package manifest.");
assert(existsSync(artifactEntryPath), "OpenNext artifact is missing pg-cloudflare/dist/index.js.");
assert(existsSync(workerPath), "OpenNext Worker artifact is missing.");

const artifact = json(artifactPackagePath);
assert(artifact.version === installed.version, "OpenNext artifact pg-cloudflare version differs from the locked installed package.");
assert(artifact.exports?.["."]?.workerd?.require === "./dist/index.js", "OpenNext artifact must retain the pg-cloudflare Workerd require entry.");
assert(artifact.exports?.["."]?.workerd?.import === "./esm/index.mjs", "OpenNext artifact must retain the pg-cloudflare Workerd import entry.");

const artifactFiles = pathsUnder(artifactRoot).map((path) => relative(artifactRoot, path).split(sep).join("/"));
const forbiddenPackages = [
  "node_modules/aws-cdk-lib/",
  "node_modules/constructs/",
  "node_modules/vitest/",
  "node_modules/prisma/",
  "node_modules/@prisma/dev/",
  "node_modules/typescript/",
  "node_modules/eslint/",
  "node_modules/@electric-sql/pglite/",
  "node_modules/@electric-sql/pglite-tools/",
  "node_modules/@electric-sql/pglite-socket/",
];
for (const prefix of forbiddenPackages) {
  assert(!artifactFiles.some((path) => path.startsWith(prefix)), `OpenNext artifact contains excluded tooling package: ${prefix}`);
}

const worker = text(workerPath);
assert(!/require\(["']pg-cloudflare["']\)/.test(worker), "Worker contains an unresolved pg-cloudflare runtime external.");
assert(!/(?:aws-cdk-lib|\bvitest\b|\bprisma(?:\s+dev|\/cli)\b|full-postgres|pglite)/i.test(worker), "Worker bundle contains excluded infrastructure, test, Prisma CLI, or local PostgreSQL tooling.");
assert(!/(?:postgres(?:ql)?:\/\/|BETTER_AUTH_SECRET|CLOUDFLARE_API_TOKEN|CAPTURE_TRACKER_FICTIONAL_LOGIN_PASSWORD|[A-Z]:\\\\Users\\)/i.test(worker), "Worker bundle contains a database URL, secret marker, credential, or local workstation path.");
assert(statSync(workerPath).size > 0, "Worker bundle must not be empty.");

console.log(`PG-CLOUDFLARE ARTIFACT VERIFIED: ${installed.name}@${installed.version} Workerd entry is present, bundled without an unresolved external, and excluded tooling/secrets are absent.`);
