import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const maxBytes = 3 * 1024 * 1024;
function verifyBundle(path) {
  if (!existsSync(path)) throw new Error("Worker bundle is missing.");
  const bytes = statSync(path).size;
  if (bytes > maxBytes) throw new Error(`Worker bundle exceeds ${maxBytes} bytes.`);
  const content = readFileSync(path, "utf8");
  if (/postgres(?:ql)?:\/\/|BETTER_AUTH_SECRET|CLOUDFLARE_API_TOKEN|CAPTURE_TRACKER_FICTIONAL_LOGIN_PASSWORD/i.test(content)) throw new Error("Worker bundle contains a secret or database URL pattern.");
  return bytes;
}
if (process.argv.includes("--synthetic")) {
  const directory = mkdtempSync(join(tmpdir(), "capture-tracker-worker-"));
  try { const file = join(directory, "worker.js"); writeFileSync(file, "export default { fetch() { return new Response('fictional'); } };\n"); console.log(`WORKER BUNDLE VERIFIED: ${verifyBundle(file)} bytes synthetic artifact.`); } finally { rmSync(directory, { recursive: true, force: true }); }
} else console.log(`WORKER BUNDLE VERIFIED: ${verifyBundle(".open-next/worker.js")} bytes.`);
