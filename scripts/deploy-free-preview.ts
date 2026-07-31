import { spawnSync } from "node:child_process";
import { readCloudEnvironment } from "../src/lib/cloud/environment";

const config = readCloudEnvironment();
if (config.deploymentProfile !== "free-preview-cloudflare-neon") throw new Error("Only the free preview profile can use this deployment command.");
if (process.env.CAPTURE_TRACKER_PREVIEW_DEPLOY_CONFIRMATION !== "DEPLOY_FICTIONAL_STAGING") {
  throw new Error("Fictional staging deployment confirmation is missing.");
}

const npx = process.platform === "win32" ? "npx.cmd" : "npx";

for (const args of [["opennextjs-cloudflare", "build"], ["opennextjs-cloudflare", "deploy"]]) {
  const result = spawnSync(npx, args, {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
