import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  fullPostgresConfig,
  requireValidationConfirmation,
  sanitize,
} from "./full-postgres-config.mjs";

const tsxCli = fileURLToPath(
  new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url),
);

async function main() {
  const config = fullPostgresConfig();
  requireValidationConfirmation();
  if (
    process.env.CAPTURE_TRACKER_DATA_MODE !== "demo" ||
    process.env.DEMO_SEED_CONFIRMATION !== "CAPTURE_TRACKER_DEMO_ONLY"
  ) {
    throw new Error("Existing demo safety confirmation is required.");
  }

  const child = spawn(process.execPath, [tsxCli, "prisma/seed.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: config.validationUrl },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => (output += chunk));
  child.stderr.on("data", (chunk) => (output += chunk));
  const code = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (value) => resolve(value ?? 1));
  });
  if (code !== 0) throw new Error(sanitize(output).slice(-2_000));
  console.log("FULLPG VALIDATION DEMO SEEDED");
}

main().catch((error) => {
  console.error(
    `Full PostgreSQL validation seed failed: ${sanitize(error instanceof Error ? error.message : "unknown error")}`,
  );
  process.exitCode = 1;
});
