import "server-only";

export class DocumentStorageUnavailableError extends Error {
  constructor() { super("Secure document storage is not approved in Phase 10A."); }
}
export const documentStorage = {
  async putObject(): Promise<never> { throw new DocumentStorageUnavailableError(); },
  async signedReadReference(): Promise<never> { throw new DocumentStorageUnavailableError(); },
  async quarantineObject(): Promise<never> { throw new DocumentStorageUnavailableError(); },
  async deleteAfterRetention(): Promise<never> { throw new DocumentStorageUnavailableError(); },
};
