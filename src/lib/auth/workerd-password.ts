import { scryptAsync } from "@noble/hashes/scrypt.js";

const scryptOptions = {
  N: 16_384,
  r: 16,
  p: 1,
  dkLen: 64,
  maxmem: 128 * 16_384 * 16 * 2,
};

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(value: string) {
  if (!/^[a-f0-9]+$/i.test(value) || value.length % 2 !== 0) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

async function derive(password: string, salt: string) {
  return scryptAsync(password.normalize("NFKC"), salt, scryptOptions);
}

export async function hashWorkerdPassword(password: string) {
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  return `${salt}:${toHex(await derive(password, salt))}`;
}

export async function verifyWorkerdPassword(hash: string, password: string) {
  const [salt, encodedKey] = hash.split(":");
  const expected = salt && encodedKey ? fromHex(encodedKey) : null;
  if (!salt || !expected) return false;
  const derived = await derive(password, salt);
  if (derived.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < derived.length; index += 1) {
    difference |= derived[index] ^ expected[index];
  }
  return difference === 0;
}
