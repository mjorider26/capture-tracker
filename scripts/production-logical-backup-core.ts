import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const magic = Buffer.from("CTPB1");
const saltBytes = 16;
const ivBytes = 12;
const tagBytes = 16;

function key(passphrase: string, salt: Buffer) {
  if (passphrase.length < 24) throw new Error("BACKUP_PASSPHRASE_REFUSED");
  return scryptSync(passphrase, salt, 32);
}

export function encryptBackupArchive(plain: Buffer, passphrase: string) {
  const salt = randomBytes(saltBytes);
  const iv = randomBytes(ivBytes);
  const cipher = createCipheriv("aes-256-gcm", key(passphrase, salt), iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([magic, salt, iv, cipher.getAuthTag(), encrypted]);
}

export function decryptBackupArchive(encrypted: Buffer, passphrase: string) {
  const header = magic.length + saltBytes + ivBytes + tagBytes;
  if (encrypted.length <= header || !encrypted.subarray(0, magic.length).equals(magic)) throw new Error("BACKUP_ARCHIVE_FORMAT_REFUSED");
  const salt = encrypted.subarray(magic.length, magic.length + saltBytes);
  const iv = encrypted.subarray(magic.length + saltBytes, magic.length + saltBytes + ivBytes);
  const tag = encrypted.subarray(magic.length + saltBytes + ivBytes, header);
  const decipher = createDecipheriv("aes-256-gcm", key(passphrase, salt), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted.subarray(header)), decipher.final()]);
}

export function assertPrivateLinuxBackupDestination(value: string | undefined) {
  if (process.platform !== "linux") throw new Error("NATIVE_LINUX_REQUIRED");
  if (!value || !value.startsWith("/") || value === "/" || value.startsWith("/mnt/")) throw new Error("BACKUP_DESTINATION_REFUSED");
  return value;
}
