import "server-only";

const headerName = "x-capture-tracker-scanner-token";

function configuredScannerToken() {
  const context = (globalThis as typeof globalThis & {
    [key: symbol]: { env?: CloudflareEnv & { CAPTURE_TRACKER_DOCUMENT_SCANNER_INTERNAL_TOKEN?: unknown } } | undefined;
  })[Symbol.for("__cloudflare-context__")];
  const workerToken = context?.env?.CAPTURE_TRACKER_DOCUMENT_SCANNER_INTERNAL_TOKEN;
  return typeof workerToken === "string" ? workerToken : process.env.CAPTURE_TRACKER_DOCUMENT_SCANNER_INTERNAL_TOKEN;
}

function constantTimeEquals(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export function scannerRequestIsAuthorized(request: Request) {
  return scannerRequestAuthorizationState(request).authorized;
}

export function scannerRequestAuthorizationState(request: Request) {
  const configured = configuredScannerToken();
  const supplied = request.headers.get(headerName);
  return {
    authorized: !!configured && !!supplied && constantTimeEquals(configured, supplied),
    reason: !configured ? "SCANNER_TOKEN_UNCONFIGURED" : !supplied ? "SCANNER_TOKEN_MISSING" : "SCANNER_TOKEN_INVALID",
  };
}

export const scannerTokenHeader = headerName;
