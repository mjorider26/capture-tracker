import { readCloudEnvironment } from "../src/lib/cloud/environment";
import { pathToFileURL } from "node:url";

export function validateFictionalStagingUrl(value: string | undefined, input: Record<string, string | undefined> = process.env): URL {
  const config = readCloudEnvironment(input);
  if (config.deploymentProfile !== "free-preview-cloudflare-neon" || config.environment !== "staging" || config.realDataApproved) throw new Error("Smoke tests are limited to fictional staging.");
  if (!value) throw new Error("An explicit HTTPS fictional staging URL is required.");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || /(^|\.)localhost$|127\.0\.0\.1|::1/i.test(url.hostname) || /prod|production/i.test(url.hostname)) throw new Error("Smoke-test target is not a safe staging HTTPS URL.");
  return url;
}

async function expect(response: Response, condition: boolean, message: string, protectedResponse = false) {
  if (!condition) throw new Error(`${message} (HTTP ${response.status}).`);
  const headers = response.headers;
  if (!headers.get("x-content-type-options")) throw new Error("Response is missing security headers.");
  if (protectedResponse && (!/noindex/i.test(headers.get("x-robots-tag") ?? "") || !/no-store/i.test(headers.get("cache-control") ?? ""))) throw new Error("Protected response is missing noindex or no-store protection.");
}

export async function smokeFictionalStaging(base: URL) {
  const fetchPath = (path: string) => fetch(new URL(path, base), { redirect: "manual" });
  await expect(await fetchPath("/api/health/live"), true, "Liveness failed", true);
  await expect(await fetchPath("/api/health/ready"), true, "Readiness failed", true);
  await expect(await fetchPath("/sign-in"), true, "Login page is unreachable");
  const financial = await fetchPath("/app/money");
  await expect(financial, [302, 303, 307, 308, 401].includes(financial.status), "Unauthenticated financial route is not protected", true);
  await expect(await fetchPath("/app/money/not-a-real-id"), true, "Malformed ID route failed");
  await expect(await fetchPath("/not-found-fictional-staging"), true, "Not-found route failed");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void import("./load-local-staging-environment")
    .then(() => smokeFictionalStaging(validateFictionalStagingUrl(process.argv[2])))
    .then(() => console.log("Fictional staging smoke checks passed."))
    .catch((error: unknown) => { console.error("Fictional staging smoke checks failed."); console.error(error instanceof Error ? error.message : "Unexpected failure."); process.exitCode = 1; });
}
