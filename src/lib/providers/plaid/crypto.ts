import "server-only";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function fromBase64(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function configuredKey() {
  const encoded = process.env.PLAID_TOKEN_ENCRYPTION_KEY?.trim();
  if (!encoded) throw new Error("PLAID_TOKEN_ENCRYPTION_KEY is not configured.");
  const key = fromBase64(encoded);
  if (key.byteLength !== 32) throw new Error("PLAID_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  return key;
}

export function plaidTokenKeyVersion() {
  const version = Number(process.env.PLAID_TOKEN_KEY_VERSION ?? "1");
  if (!Number.isSafeInteger(version) || version < 1) throw new Error("PLAID_TOKEN_KEY_VERSION must be a positive integer.");
  return version;
}

export async function encryptPlaidAccessToken(accessToken: string) {
  if (!/^access-(?:sandbox|production)-[A-Za-z0-9-]+$/u.test(accessToken)) throw new Error("Plaid returned an invalid access token.");
  const version = plaidTokenKeyVersion();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey("raw", configuredKey(), "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(`capture-tracker:plaid:v${version}`) }, key, encoder.encode(accessToken)));
  return { ciphertext: `v${version}.${base64Url(iv)}.${base64Url(ciphertext)}`, keyVersion: version };
}

export async function decryptPlaidAccessToken(envelope: string, expectedVersion: number | null) {
  const match = /^v([1-9]\d*)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/u.exec(envelope);
  if (!match) throw new Error("The stored Plaid credential envelope is invalid.");
  const version = Number(match[1]);
  if (version !== expectedVersion || version !== plaidTokenKeyVersion()) throw new Error("The Plaid credential key version is unavailable.");
  const key = await crypto.subtle.importKey("raw", configuredKey(), "AES-GCM", false, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(match[2]), additionalData: encoder.encode(`capture-tracker:plaid:v${version}`) }, key, fromBase64(match[3]));
  const accessToken = decoder.decode(plaintext);
  if (!/^access-(?:sandbox|production)-[A-Za-z0-9-]+$/u.test(accessToken)) throw new Error("The stored Plaid credential is invalid.");
  return accessToken;
}

export async function stablePlaidClientUserId(businessId: string, userId: string) {
  const key = await crypto.subtle.importKey("raw", configuredKey(), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(`${businessId}:${userId}`)));
  return `ct_${base64Url(signature).slice(0, 32)}`;
}

export const plaidCryptoInternals = { base64Url, fromBase64 };
