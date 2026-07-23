import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  fullPostgresConfig,
  fullPostgresDatabases,
  queryServerIdentity,
  sanitize,
} from "./full-postgres-config.mjs";

const prismaCli = fileURLToPath(
  new URL("../node_modules/prisma/build/index.js", import.meta.url),
);
const vitestCli = fileURLToPath(
  new URL("../node_modules/vitest/vitest.mjs", import.meta.url),
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
  const version = await queryServerIdentity(config.integrationUrl);
  const env = {
    ...process.env,
    DATABASE_URL: config.integrationUrl,
    TEST_DATABASE_URL: config.integrationUrl,
  };
  delete env.SHADOW_DATABASE_URL;
  await run([prismaCli, "migrate", "deploy"], env);
  await run(
    [vitestCli, "run", "--config", "vitest.integration.config.ts"],
    env,
  );
  console.log(
    `FULLPG INTEGRATION PASSED: host=${config.host} port=${config.port} version=${version} database=${fullPostgresDatabases.integration}`,
  );
}

main().catch((error) => {
  console.error(
    `Full PostgreSQL integration failed: ${sanitize(error instanceof Error ? error.message : "unknown error")}`,
  );
  process.exitCode = 1;
});
