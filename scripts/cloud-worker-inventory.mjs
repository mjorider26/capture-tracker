import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";

const artifactDefault = ".open-next";
const reportDefault = ".artifacts/cloud-worker-inventory.json";
const targets = [
  { name: "postcss", high: true },
  { name: "sharp", high: true },
  { name: "@img/*", prefix: "@img/" },
  { name: "find-my-way", high: true },
  { name: "valibot" },
  { name: "prisma" },
  { name: "@prisma/cli" },
  { name: "@prisma/dev" },
  { name: "aws-cdk-lib" },
  { name: "constructs" },
  { name: "vitest" },
  { name: "typescript" },
  { name: "eslint" },
  { name: "@electric-sql/pglite" },
  { name: "@electric-sql/pglite-tools" },
  { name: "@electric-sql/pglite-socket" },
  { name: "pg" },
  { name: "pg-cloudflare" },
];
const prohibited = /(?:postgres(?:ql)?:\/\/|(?:api|access)[_-]?key\s*[=:]|password\s*[=:]|token\s*[=:]|secret\s*[=:]|[A-Z]:\\|\/(?:home|Users|tmp)\/)/i;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function readText(path) {
  return readFileSync(path, "utf8");
}
function readJson(path) {
  return JSON.parse(readText(path));
}
function portable(path) {
  return path.split(sep).join("/");
}
function filesUnder(directory) {
  const files = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) files.push(path);
    }
  };
  if (existsSync(directory)) walk(directory);
  return files;
}
function packageFromPath(path) {
  const segments = portable(path).split("/");
  const nodeModules = segments.lastIndexOf("node_modules");
  if (nodeModules < 0 || !segments[nodeModules + 1]) return null;
  return segments[nodeModules + 1].startsWith("@")
    ? `${segments[nodeModules + 1]}/${segments[nodeModules + 2] ?? ""}`
    : segments[nodeModules + 1];
}
function matchesTarget(target, value) {
  return target.prefix ? value.includes(target.prefix) : value.includes(target.name);
}
function packageMatches(target, packageName) {
  return target.prefix ? packageName?.startsWith(target.prefix) : packageName === target.name;
}
function safeCode(path) {
  return /\.(?:[cm]?js|tsx?)$/i.test(path) && !/\.map$/i.test(path);
}
function safeJson(path) {
  return path.endsWith(".json") && !path.endsWith("package.json");
}
function packageVersion(root, target) {
  if (target.prefix) {
    const scope = join(root, "node_modules", target.prefix.slice(0, -1));
    if (!existsSync(scope)) return null;
    const versions = readdirSync(scope, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(join(scope, entry.name, "package.json")))
      .map((entry) => readJson(join(scope, entry.name, "package.json")).version)
      .filter(Boolean);
    return versions.length ? versions.sort().join(",") : null;
  }
  const path = join(root, "node_modules", target.name, "package.json");
  return existsSync(path) ? readJson(path).version ?? null : null;
}
function directReferences(text, target) {
  const name = target.prefix ? "@img/[\\w.-]+" : target.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:from\\s*["']${name}["']|import\\s*["']${name}["']|(?:require|import)\\s*\\(\\s*["']${name}["']\\s*\\))`, "g").test(text);
}
function metaInputs(files, target, artifactRoot) {
  const matched = [];
  for (const path of files.filter((file) => file.endsWith(".meta.json"))) {
    try {
      const meta = readJson(path);
      for (const output of Object.values(meta.outputs ?? {})) {
        for (const input of Object.keys(output.inputs ?? {})) {
          const packageName = packageFromPath(input);
          if (packageMatches(target, packageName)) matched.push(portable(relative(artifactRoot, path)));
        }
      }
    } catch {
      throw new Error(`Artifact metafile is invalid: ${portable(relative(process.cwd(), path))}`);
    }
  }
  return [...new Set(matched)].sort();
}
function sanitizedReport(report) {
  const text = JSON.stringify(report);
  assert(!prohibited.test(text), "Sanitized artifact report contains a secret, URL, or absolute path pattern.");
  return report;
}

export function inspectWorkerArtifact({ artifactRoot = artifactDefault, workspaceRoot = process.cwd() } = {}) {
  assert(existsSync(artifactRoot), "OpenNext artifact is missing.");
  const workerPath = join(artifactRoot, "worker.js");
  assert(existsSync(workerPath), "OpenNext Worker entry is missing.");
  const files = filesUnder(artifactRoot);
  const relativeFiles = files.map((path) => portable(relative(artifactRoot, path)));
  const code = files.filter(safeCode).map((path) => ({ path, relative: portable(relative(artifactRoot, path)), text: readText(path) }));
  const manifests = files.filter(safeJson).map((path) => ({ path, relative: portable(relative(artifactRoot, path)), text: readText(path) }));
  const sourceMaps = files.filter((path) => path.endsWith(".map")).map((path) => ({ path, relative: portable(relative(artifactRoot, path)), text: readText(path) }));
  const packageManifests = files.filter((path) => path.endsWith("package.json")).map((path) => ({ path, relative: portable(relative(artifactRoot, path)), packageName: packageFromPath(path) }));
  for (const item of code) assert(!prohibited.test(item.text), `Worker executable code contains a prohibited secret or absolute path pattern: ${item.relative}`);

  const packages = targets.map((target) => {
    const bundledEvidence = metaInputs(files, target, artifactRoot);
    const copiedEvidence = packageManifests.filter((item) => packageMatches(target, item.packageName)).map((item) => item.relative).sort();
    const codeEvidence = code.filter((item) => directReferences(item.text, target)).map((item) => item.relative).sort();
    const manifestEvidence = manifests.filter((item) => matchesTarget(target, item.text)).map((item) => item.relative).sort();
    const sourceMapEvidence = sourceMaps.filter((item) => matchesTarget(target, item.text)).map((item) => item.relative).sort();
    const installedVersion = packageVersion(workspaceRoot, target);
    const unresolved = codeEvidence.length > 0 && bundledEvidence.length === 0 && copiedEvidence.length === 0;
    let classification = "absent";
    if (unresolved) classification = "unresolved";
    else if (bundledEvidence.length > 0) classification = "bundled in Worker executable code";
    else if (copiedEvidence.length > 0) classification = "copied runtime package";
    else if (manifestEvidence.length > 0) classification = "referenced only by a build manifest";
    else if (installedVersion) classification = "build-time only";

    let requestTimeReachability = "not-reachable";
    if (classification === "unresolved") requestTimeReachability = "unresolved";
    else if (classification === "bundled in Worker executable code" || codeEvidence.length > 0) requestTimeReachability = "reachable";
    else if (classification === "copied runtime package") requestTimeReachability = "unresolved";

    return {
      package: target.name,
      installedVersion,
      classification,
      requestTimeReachability,
      advisoryRelevance: target.high && requestTimeReachability === "reachable" ? "runtime-high" : target.high ? "not-runtime-reachable" : "tooling-or-unaffected",
      evidence: {
        bundledMetafiles: bundledEvidence,
        copiedPackageManifests: copiedEvidence,
        executableReferences: codeEvidence,
        manifestOnlyReferences: manifestEvidence,
        sourceMapOnlyReferences: sourceMapEvidence,
      },
      evidenceRule: bundledEvidence.length ? "METAFILE_EXECUTABLE_INPUT" : copiedEvidence.length ? "COPIED_RUNTIME_PACKAGE" : manifestEvidence.length ? "MANIFEST_NON_EXECUTABLE" : sourceMapEvidence.length ? "SOURCE_MAP_NON_EXECUTABLE" : installedVersion ? "INSTALLED_NOT_ARTIFACT" : "NO_ARTIFACT_EVIDENCE",
    };
  });

  const report = {
    schemaVersion: 1,
    artifactRoot: ".open-next",
    workerEntry: "worker.js",
    workerBytes: statSync(workerPath).size,
    requestEntrypoints: code.filter((item) => /(?:^|\/)(?:worker|handler|index)\.(?:mjs|js|cjs)$/.test(item.relative)).map((item) => item.relative).sort(),
    packages,
    reportSanitized: true,
  };
  assert(relativeFiles.every((path) => !prohibited.test(path)), "Artifact contains a prohibited path pattern.");
  return sanitizedReport(report);
}

export function verifyReachabilityReport(report) {
  assert(report?.schemaVersion === 1 && report.reportSanitized === true, "Sanitized cloud Worker inventory report is missing or invalid.");
  for (const item of report.packages ?? []) {
    assert(item.classification !== "unresolved" && item.requestTimeReachability !== "unresolved", `Artifact classification is unresolved for ${item.package}.`);
    assert(!(targets.find((target) => target.name === item.package)?.high && item.requestTimeReachability === "reachable"), `High-severity target is request-time reachable: ${item.package}.`);
  }
  return report;
}

function writeReport(path, report) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(sanitizedReport(report), null, 2)}\n`, "utf8");
}

const args = new Set(process.argv.slice(2));
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (args.has("--verify-report")) {
    const report = readJson(reportDefault);
    verifyReachabilityReport(report);
    console.log("CLOUD WORKER REACHABILITY VERIFIED: sanitized artifact report has no unresolved target or request-time-reachable high target.");
  } else {
    const report = inspectWorkerArtifact();
    writeReport(reportDefault, report);
    const summary = report.packages.map((item) => `${item.package}=${item.classification}/${item.requestTimeReachability}`).join(", ");
    console.log(`CLOUD WORKER INVENTORY VERIFIED: ${report.workerBytes} bytes; ${summary}`);
  }
}
