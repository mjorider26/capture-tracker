import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  fullPostgresConfig,
  fullPostgresDatabases,
  queryServerIdentity,
  requireValidationConfirmation,
  sanitize,
} from "./full-postgres-config.mjs";

const tsxCli = fileURLToPath(
  new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url),
);

function run(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        process.stdout.write(sanitize(output));
        resolve();
      } else {
        reject(new Error(sanitize(output).slice(-2_000)));
      }
    });
  });
}

async function main() {
  const config = fullPostgresConfig();
  requireValidationConfirmation();
  const version = await queryServerIdentity(config.validationUrl);
  const env = { ...process.env, DATABASE_URL: config.validationUrl };
  await run([tsxCli, "scripts/verify-demo-seed.ts"], env);
  await run(["scripts/verify-database-integrity.mjs"], env);
  console.log(
    `FULLPG VERIFIED: host=${config.host} port=${config.port} version=${version} database=${fullPostgresDatabases.validation}`,
  );
}

main().catch((error) => {
  console.error(
    `Full PostgreSQL verification failed: ${sanitize(error instanceof Error ? error.message : "unknown error")}`,
  );
  process.exitCode = 1;
});
