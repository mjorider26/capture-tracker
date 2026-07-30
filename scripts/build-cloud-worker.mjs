import { spawnSync } from "node:child_process";
import { cpSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const command = (name) => process.platform === "win32" ? `${name}.cmd` : name;

function run(name, args) {
  const result = spawnSync(command(name), args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${name} failed with exit code ${result.status ?? "unknown"}.`);
}

const nodeClient = resolve("src/generated/prisma");
const workerdClient = resolve("src/generated/prisma-workerd");
let buildError;

try {
  // Prisma's documented Workerd target uses an async WASM compiler rather than
  // the base64 Node compiler. Generated output is ignored and this swap exists
  // only for the Cloudflare build process.
  run("prisma", ["generate", "--generator", "cloudflare"]);
  rmSync(nodeClient, { force: true, recursive: true });
  cpSync(workerdClient, nodeClient, { recursive: true });
  run("next", ["build", "--webpack"]);
} catch (error) {
  buildError = error;
} finally {
  try {
    // Always restore the Node target for development, migrations, and tests.
    run("prisma", ["generate", "--generator", "client"]);
  } catch (restoreError) {
    if (!buildError) buildError = restoreError;
  }
}

if (buildError) throw buildError;
