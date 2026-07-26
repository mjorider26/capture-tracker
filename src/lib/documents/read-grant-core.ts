export type DocumentReadGrantInput = { actorUserId: string; businessId: string; documentId: string };
type GrantPayload = DocumentReadGrantInput & { expiresAt: number };

function base64Url(value: Uint8Array | string) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

export async function issueDocumentReadGrantWithSecret(input: DocumentReadGrantInput, secret: string, now = Date.now()) {
  const payload: GrantPayload = { ...input, expiresAt: now + 5 * 60 * 1000 };
  const encodedPayload = base64Url(JSON.stringify(payload));
  return `${encodedPayload}.${base64Url(await sign(encodedPayload, secret))}`;
}

export async function verifyDocumentReadGrantWithSecret(grant: string | null, expected: DocumentReadGrantInput, secret: string, now = Date.now()) {
  if (!grant || grant.length > 2048) return false;
  const [encodedPayload, signature, ...extra] = grant.split(".");
  if (!encodedPayload || !signature || extra.length) return false;
  try {
    const expectedSignature = base64Url(await sign(encodedPayload, secret));
    if (!timingSafeEqual(signature, expectedSignature)) return false;
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as GrantPayload;
    return payload.expiresAt > now
      && payload.actorUserId === expected.actorUserId
      && payload.businessId === expected.businessId
      && payload.documentId === expected.documentId;
  } catch {
    return false;
  }
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}
