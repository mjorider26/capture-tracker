import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { assertSanitizedReport, inspectWorkerArtifact, verifyReachabilityReport } from "./cloud-worker-inventory.mjs";

function assert(condition, message) { if (!condition) throw new Error(message); }
function write(path, contents = "") { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, contents); }
function packageJson(root, name, version = "1.0.0") { write(join(root, "node_modules", name, "package.json"), JSON.stringify({ name, version })); }
function result(report, name) { return report.packages.find((item) => item.package === name); }

const root = mkdtempSync(join(tmpdir(), "capture-tracker-inventory-"));
try {
  const artifact = join(root, ".open-next");
  write(join(artifact, "worker.js"), 'import "./server-functions/default/handler.mjs";');
  write(join(artifact, "server-functions/default/handler.mjs"), 'import "sharp";');
  write(join(artifact, "server-functions/default/handler.mjs.meta.json"), JSON.stringify({ outputs: { "handler.mjs": { inputs: { "/safe/node_modules/postcss/lib/index.js": {} } } } }));
  write(join(artifact, "server-functions/default/trace.nft.json"), JSON.stringify({ files: ["node_modules/valibot/dist/index.js"] }));
  write(join(artifact, "server-functions/default/handler.mjs.map"), JSON.stringify({ sources: ["/safe/node_modules/@img/sharp-linux-x64/index.js"] }));
  packageJson(artifact + "/server-functions/default", "sharp");
  packageJson(artifact + "/server-functions/default", "pg-cloudflare");
  write(join(artifact, "server-functions/default/node_modules/pg-cloudflare/dist/index.js"), "export {}; ");
  packageJson(root, "postcss");
  packageJson(root, "find-my-way");
  packageJson(root, "valibot");
  packageJson(root, "prisma");

  const report = inspectWorkerArtifact({ artifactRoot: artifact, workspaceRoot: root });
  assert(result(report, "postcss").classification === "bundled in Worker executable code", "PostCSS bundled fixture must be executable.");
  assert(result(report, "postcss").requestTimeReachability === "reachable", "Bundled PostCSS fixture must be request reachable.");
  assert(result(report, "sharp").classification === "copied runtime package" && result(report, "sharp").requestTimeReachability === "reachable", "Sharp copied fixture must be request reachable.");
  assert(result(report, "@img/*").classification === "absent" && result(report, "@img/*").evidence.sourceMapOnlyReferences.length === 1, "Source-map-only @img fixture must not be executable.");
  assert(result(report, "find-my-way").classification === "build-time only", "find-my-way fixture must be tooling only.");
  assert(result(report, "valibot").classification === "referenced only by a build manifest", "Valibot manifest fixture must not be executable.");
  assert(result(report, "prisma").classification === "build-time only", "Prisma CLI fixture must be excluded from the artifact.");
  assert(result(report, "aws-cdk-lib").classification === "absent", "AWS CDK fixture must be absent.");
  assert(result(report, "vitest").classification === "absent", "Test tooling fixture must be absent.");
  assert(result(report, "pg-cloudflare").classification === "copied runtime package" && result(report, "pg-cloudflare").requestTimeReachability === "reachable", "Copied pg-cloudflare must be treated as reachable Worker runtime evidence.");
  assert(!JSON.stringify(report).includes(root), "Inventory report must not include an absolute fixture path.");
  let rejected = false;
  try { verifyReachabilityReport(report); } catch { rejected = true; }
  assert(rejected, "Reachability gate must reject runtime highs and unresolved copied packages.");

  const buildOnlyArtifact = join(root, ".open-next-build-only");
  write(join(buildOnlyArtifact, "worker.js"), 'import "./server-functions/default/handler.mjs";');
  write(join(buildOnlyArtifact, "server-functions/default/handler.mjs"), "export default {}; ");
  const buildOnly = inspectWorkerArtifact({ artifactRoot: buildOnlyArtifact, workspaceRoot: root });
  assert(result(buildOnly, "postcss").classification === "build-time only", "PostCSS build-only fixture must not be runtime present.");
  assert(result(buildOnly, "sharp").classification === "absent", "Sharp absent fixture must not be inferred from another artifact.");
  assert(result(buildOnly, "prisma").classification === "build-time only", "Prisma CLI fixture must remain outside the Worker artifact.");
  assert(result(buildOnly, "aws-cdk-lib").classification === "absent", "AWS CDK exclusion fixture must remain absent.");
  verifyReachabilityReport(buildOnly);

  write(join(buildOnlyArtifact, "server-functions/default/unresolved.mjs"), 'require("eslint");');
  const unresolved = inspectWorkerArtifact({ artifactRoot: buildOnlyArtifact, workspaceRoot: root });
  assert(result(unresolved, "eslint").classification === "unresolved", "Bare unresolved package import must fail classification.");

  let secretRejected = false;
  try { assertSanitizedReport({ artifactRoot: "C:\\Users\\unsafe", credential: "postgresql://redacted" }); } catch { secretRejected = true; }
  assert(secretRejected, "Inventory report sanitizer must reject prohibited secret and absolute-path patterns.");
  console.log("CLOUD WORKER INVENTORY SYNTHETIC TESTS PASSED: bundled, copied, manifest-only, source-map-only, build-only, absent, unresolved, and secret sanitization cases verified.");
} finally {
  rmSync(root, { recursive: true, force: true });
}
