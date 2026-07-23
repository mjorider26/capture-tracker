import { exec, spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { Client } from "pg";

const execAsync = promisify(exec);
const integrationName = "capture-tracker-integration";
const preferredPorts = { http: 52213, postgres: 52214, shadow: 52215 };
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const prismaCli = fileURLToPath(
  new URL("../node_modules/prisma/build/index.js", import.meta.url),
);
const vitestCli = fileURLToPath(
  new URL("../node_modules/vitest/vitest.mjs", import.meta.url),
);

function integrationUrl(port = preferredPorts.postgres) {
  return `postgres://postgres:postgres@127.0.0.1:${port}/template1?sslmode=disable`;
}

function assertSafeIntegrationTarget(connectionString) {
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error("Integration target must use PostgreSQL.");
  }
  if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
    throw new Error("Integration target must be local.");
  }
  if (Number(url.port) !== preferredPorts.postgres) {
    throw new Error(
      "Integration target must use the dedicated integration PostgreSQL port.",
    );
  }
  if (url.pathname.toLowerCase().includes("default")) {
    throw new Error(
      "Integration target must not select the normal development database.",
    );
  }
}

function sanitize(text) {
  return text
    .replace(/api_key=[^&\s]+/gi, "api_key=[redacted]")
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[database-url-redacted]")
    .replace(/\x1b\][^\x07]*\x07/g, "");
}

async function prismaDevList() {
  const { stdout } = await execAsync(`${npx} prisma dev ls`, {
    cwd: process.cwd(),
    windowsHide: true,
  });
  return stdout;
}

function namedServerStatus(listOutput) {
  const line = listOutput
    .split(/\r?\n/)
    .find((value) => value.includes(integrationName));
  if (!line) return null;
  const match = line.match(new RegExp(`${integrationName}\\s+(\\S+)`));
  return match?.[1] ?? "unknown";
}

async function run(command, args, env) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env,
    windowsHide: true,
    stdio: "inherit",
  });
  const code = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (exitCode) => resolve(exitCode ?? 1));
  });
  if (code !== 0) throw new Error(`${args.slice(0, 3).join(" ")} failed.`);
}

async function waitForPostgres(connectionString) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const client = new Client({ connectionString });
    try {
      await client.connect();
      await client.query("SELECT 1");
      await client.end();
      return;
    } catch {
      await client.end().catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
  throw new Error(
    "The local integration PostgreSQL service did not become ready within 60 seconds.",
  );
}

async function main() {
  const normalDevelopmentUrl = process.env.DATABASE_URL?.trim();
  const targetUrl = integrationUrl();
  assertSafeIntegrationTarget(targetUrl);
  if (normalDevelopmentUrl === targetUrl)
    throw new Error(
      "Integration target matches the normal development database.",
    );
  console.log(
    "Integration target verified as local; normal development database protected.",
  );

  const listBefore = await prismaDevList();
  const existingStatus = namedServerStatus(listBefore);
  if (existingStatus && existingStatus !== "running") {
    // This exact named server is disposable and was positively identified as unusable by `prisma dev ls`.
    await run(
      process.execPath,
      [prismaCli, "dev", "rm", "--force", integrationName],
      process.env,
    ).catch(() => undefined);
  }
  if (existingStatus === "running") {
    throw new Error(
      "A running integration server requires its reported port mapping; stop it before this fresh lifecycle can safely manage it.",
    );
  }

  const devChild = spawn(
    process.execPath,
    [
      prismaCli,
      "dev",
      "--name",
      integrationName,
      "--port",
      String(preferredPorts.http),
      "--db-port",
      String(preferredPorts.postgres),
      "--shadow-db-port",
      String(preferredPorts.shadow),
    ],
    {
      cwd: process.cwd(),
      env: process.env,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let startupOutput = "";
  devChild.stdout.on("data", (chunk) => {
    startupOutput += chunk.toString();
  });
  devChild.stderr.on("data", (chunk) => {
    startupOutput += chunk.toString();
  });

  try {
    await waitForPostgres(targetUrl);
    console.log("Integration service started: capture-tracker-integration.");
    const childEnv = {
      ...process.env,
      TEST_DATABASE_URL: targetUrl,
      DATABASE_URL: targetUrl,
      SHADOW_DATABASE_URL: integrationUrl(preferredPorts.shadow),
    };
    await run(process.execPath, [prismaCli, "migrate", "deploy"], childEnv);
    console.log("Integration migrations applied/current.");
    await run(
      process.execPath,
      [vitestCli, "run", "--config", "vitest.integration.config.ts"],
      childEnv,
    );
    console.log("Integration tests passed.");
  } catch (error) {
    const diagnostic = sanitize(startupOutput).trim();
    if (diagnostic)
      console.error(
        `Integration startup diagnostic: ${diagnostic.slice(-1_000)}`,
      );
    throw error;
  } finally {
    if (devChild.pid)
      spawnSync("taskkill", ["/PID", String(devChild.pid), "/T", "/F"], {
        windowsHide: true,
        stdio: "ignore",
      });
    console.log("Integration service stopped.");
  }
}

main().catch((error) => {
  console.error(
    `Integration lifecycle failed: ${error instanceof Error ? error.message : "unknown error"}`,
  );
  process.exitCode = 1;
});
