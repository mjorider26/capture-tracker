import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function text(path) {
  return readFileSync(path, "utf8");
}
function filesUnder(directory) {
  const files = [];
  const walk = (current) => {
    for (const item of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, item.name);
      if (item.isDirectory()) {
        if (path.includes(`${join("src", "generated")}`)) continue;
        walk(path);
      } else if (/\.(?:[cm]?[jt]sx?)$/.test(item.name) && !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(item.name)) files.push(path);
    }
  };
  walk(directory);
  return files;
}

const manifest = JSON.parse(text("package.json"));
const runtime = manifest.dependencies ?? {};
const tooling = manifest.devDependencies ?? {};
const applicationTsconfig = JSON.parse(text("tsconfig.json"));
const infrastructureManifest = JSON.parse(text("infra/aws/package.json"));
const infrastructureTsconfig = JSON.parse(text("infra/aws/tsconfig.json"));

assert(!runtime["@opennextjs/cloudflare"] && tooling["@opennextjs/cloudflare"] === "1.20.2", "OpenNext must remain an exact build-only dependency.");
for (const dependency of ["prisma", "wrangler", "vitest", "typescript", "eslint"]) {
  assert(!runtime[dependency] && tooling[dependency], `${dependency} must remain build, validation, or local tooling only.`);
}
assert(!runtime["aws-cdk-lib"] && !runtime["constructs"], "AWS infrastructure dependencies must not enter application runtime dependencies.");
for (const directory of ["infra/aws", "infra/aws/.test-dist", "infra/aws/cdk.out"]) {
  assert(applicationTsconfig.exclude?.includes(directory), `The root Next.js TypeScript project must exclude ${directory}.`);
}
assert(infrastructureManifest.dependencies?.["aws-cdk-lib"] && infrastructureManifest.dependencies?.constructs, "AWS CDK dependencies must remain isolated in infra/aws.");
assert(infrastructureTsconfig.include?.includes("bin") && infrastructureTsconfig.include?.includes("lib") && infrastructureTsconfig.include?.includes("test"), "Infrastructure TypeScript must retain its dedicated CDK project coverage.");
const gitignore = text(".gitignore");
for (const directory of ["/infra/aws/.test-dist/", "/infra/aws/cdk.out/", "/infra/aws/node_modules/"]) {
  assert(gitignore.includes(directory), `Generated infrastructure output must remain ignored: ${directory}.`);
}
const workflow = text(".github/workflows/ci.yml");
assert(workflow.indexOf("npm run cloud:build") < workflow.indexOf("npm --prefix infra/aws ci"), "CI must build the application/Worker before installing isolated AWS infrastructure dependencies.");

const source = filesUnder("src");
const forbiddenImports = /from\s*["'](?:aws-cdk-lib|constructs|@aws-sdk\/|@opennextjs\/|vitest|prisma(?:\/|["']))/;
const unsafePackageLoading = /require\s*\(|createRequire\s*\(|import\s*\(\s*[^"']/;
for (const file of source) {
  const content = text(file);
  assert(!forbiddenImports.test(content) && !unsafePackageLoading.test(content), `Worker/server source has a forbidden tooling, infrastructure, or dynamic package load: ${file}.`);
  assert(!/node:(?:child_process|worker_threads)/.test(content), `Worker/server source must not spawn local tooling: ${file}.`);
  if (/^[\s;]*["']use client["'];/m.test(content)) {
    const runtimeImports = content.split(/\r?\n/).filter((line) => !/^\s*import\s+type\b/.test(line)).join("\n");
    assert(!/@\/lib\/(?:prisma|auth|database|services\/)|@prisma\//.test(runtimeImports), `Client component imports a server or database module: ${file}.`);
  }
}

const wrangler = text("wrangler.jsonc");
assert(!/r2_buckets|CAPTURE_TRACKER_DOCUMENTS_BUCKET|DATABASE_URL|DIRECT_DATABASE_URL|BETTER_AUTH_SECRET|account_id|api[_-]?token/i.test(wrangler), "Worker configuration must exclude R2, database/local-tooling settings, secrets, and account credentials.");
const dockerfile = text("Dockerfile");
assert(!/next dev|wrangler dev|vitest|prisma (?:studio|dev)|aws-cdk/i.test(dockerfile) && /CMD \["node", "server\.js"\]/.test(dockerfile), "Container runtime must not run development, test, database, or infrastructure tooling.");
assert(manifest.scripts.start === "next start" && manifest.scripts.dev === "next dev", "Production and development server entry points must remain distinct.");

console.log("RUNTIME DEPENDENCY SEPARATION VERIFIED: OpenNext/AWS/test/local-DB tooling is excluded from application runtime declarations and source; client, Worker configuration, dynamic-loading, secret, and development-server guards passed. This static check does not prove Linux Worker artifact contents.");
