import "server-only";

/** One public origin for generated customer-facing URLs. A future branded
 * application domain is configured here, never copied through product code. */
type UrlEnvironment = { [key: string]: string | undefined };
export function canonicalAppBaseUrl(environment: UrlEnvironment = process.env): string {
  const raw = environment.APP_BASE_URL ?? environment.BETTER_AUTH_URL;
  if (!raw) throw new Error("Application base URL is not configured.");
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("Application base URL is invalid."); }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Application base URL is invalid.");
  url.pathname = ""; url.search = ""; url.hash = "";
  return url.toString().replace(/\/$/, "");
}

export function appUrl(path: string, environment: UrlEnvironment = process.env): string {
  if (!path.startsWith("/")) throw new Error("Application path must be absolute.");
  return `${canonicalAppBaseUrl(environment)}${path}`;
}
