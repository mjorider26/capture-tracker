import { describe, expect, it } from "vitest";

import { decryptBackupArchive, encryptBackupArchive } from "./production-logical-backup-core";

describe("production logical backup encryption", () => {
  it("round-trips a custom archive payload and rejects an incorrect passphrase", () => {
    const source = Buffer.from("fictional-custom-postgresql-archive");
    const encrypted = encryptBackupArchive(source, "fictional-only-test-passphrase-that-is-long-enough");
    expect(encrypted).not.toEqual(source);
    expect(decryptBackupArchive(encrypted, "fictional-only-test-passphrase-that-is-long-enough")).toEqual(source);
    expect(() => decryptBackupArchive(encrypted, "another-fictional-test-passphrase-long-enough")).toThrow();
  });
});
