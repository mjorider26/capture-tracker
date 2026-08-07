import "server-only";

const headerName = "x-capture-tracker-scanner-token";

function constantTimeEquals(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export function scannerRequestIsAuthorized(request: Request) {
  const configured = process.env.CAPTURE_TRACKER_DOCUMENT_SCANNER_INTERNAL_TOKEN;
  const supplied = request.headers.get(headerName);
  return !!configured && !!supplied && constantTimeEquals(configured, supplied);
}

export const scannerTokenHeader = headerName;
