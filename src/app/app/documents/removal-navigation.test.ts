import { beforeEach, describe, expect, it, vi } from "vitest";

const removePrivateDocument = vi.hoisted(() => vi.fn());
const traceDocumentRemoval = vi.hoisted(() => vi.fn());
const requireBusinessMutationContext = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect, RedirectType: { replace: "replace" } }));
vi.mock("@/lib/documents/removal", () => ({ removePrivateDocument, traceDocumentRemoval }));
vi.mock("@/lib/security/business-context", () => ({ requireBusinessMutationContext }));
vi.mock("@/lib/documents/secure-upload", () => ({ uploadPrivateDocument: vi.fn() }));
vi.mock("@/lib/documents/upload-selection", () => ({ selectedDocumentUpload: vi.fn() }));
vi.mock("@/lib/documents/extraction", () => ({ extractDocument: vi.fn(), reviewDocumentExtraction: vi.fn() }));
vi.mock("@/lib/documents/transaction-matching", () => ({ decideDocumentTransactionMatch: vi.fn(), dismissDocumentTransactionMatchRun: vi.fn(), generateDocumentTransactionMatches: vi.fn() }));

describe("authenticated document removal navigation", () => {
  beforeEach(() => {
    removePrivateDocument.mockReset();
    traceDocumentRemoval.mockReset();
    requireBusinessMutationContext.mockReset();
    revalidatePath.mockReset();
    redirect.mockReset();
    traceDocumentRemoval.mockResolvedValue(undefined);
    requireBusinessMutationContext.mockResolvedValue({ business: { id: "business" }, user: { id: "user" } });
  });

  it("replaces the deleted detail route without any auth-cookie mutation", async () => {
    const form = new FormData();
    form.set("documentId", "document");
    form.set("confirmed", "yes");
    removePrivateDocument.mockResolvedValue({ ok: true, mode: "DELETED", cleanupPending: false });
    redirect.mockImplementation(() => { throw new Error("NEXT_REDIRECT"); });

    const { removeAuthenticatedDocument } = await import("./actions");
    await expect(removeAuthenticatedDocument({ ok: false }, form)).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/app/documents", "replace");
    expect(revalidatePath).toHaveBeenCalledWith("/app/documents");
    expect(traceDocumentRemoval).toHaveBeenLastCalledWith("business", expect.any(String), "ACTION_RESPONSE", "PASS");
  });

  it("keeps the current route and valid session path on deletion failure", async () => {
    removePrivateDocument.mockResolvedValue({ ok: false, code: "CONFLICT" });
    const form = new FormData();
    form.set("documentId", "document");
    form.set("confirmed", "yes");
    const { removeAuthenticatedDocument } = await import("./actions");
    await expect(removeAuthenticatedDocument({ ok: false }, form)).resolves.toEqual({ ok: false, message: "This document changed before it could be removed." });
    expect(redirect).not.toHaveBeenCalled();
  });
});
