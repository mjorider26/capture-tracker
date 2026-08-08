import { beforeEach, describe, expect, it, vi } from "vitest";

const uploadPrivateDocument = vi.hoisted(() => vi.fn());
const selectedDocumentUpload = vi.hoisted(() => vi.fn());
const requireBusinessContext = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/documents/secure-upload", () => ({ uploadPrivateDocument }));
vi.mock("@/lib/documents/upload-selection", () => ({ selectedDocumentUpload }));
vi.mock("@/lib/security/business-context", () => ({ requireBusinessContext }));
vi.mock("@/lib/documents/extraction", () => ({ extractDocument: vi.fn(), reviewDocumentExtraction: vi.fn() }));
vi.mock("@/lib/documents/transaction-matching", () => ({ decideDocumentTransactionMatch: vi.fn(), dismissDocumentTransactionMatchRun: vi.fn(), generateDocumentTransactionMatches: vi.fn() }));
vi.mock("@/lib/documents/removal", () => ({ removePrivateDocument: vi.fn() }));

const cameraReceipt = new File(["receipt"], "camera-receipt.jpg", { type: "image/jpeg" });

describe("uploadDocument camera selection", () => {
  beforeEach(() => {
    uploadPrivateDocument.mockReset();
    selectedDocumentUpload.mockReset();
    requireBusinessContext.mockReset();
    revalidatePath.mockReset();
    selectedDocumentUpload.mockReturnValue(cameraReceipt);
    requireBusinessContext.mockResolvedValue({ business: { id: "business" }, user: { id: "user" } });
  });

  it("sends a selected camera receipt through the existing private upload handler", async () => {
    uploadPrivateDocument.mockResolvedValue({ ok: true, documentId: "document", duplicate: false, outcome: "QUARANTINED" });
    const { uploadDocument } = await import("./actions");

    await expect(uploadDocument({ ok: false }, new FormData())).resolves.toMatchObject({ ok: true, documentId: "document", outcome: "QUARANTINED" });
    expect(uploadPrivateDocument).toHaveBeenCalledWith({ businessId: "business", actorUserId: "user" }, cameraReceipt);
    expect(revalidatePath).toHaveBeenCalledWith("/app/documents");
  });

  it("retains validation errors, duplicate handling, and safe storage failures", async () => {
    const { uploadDocument } = await import("./actions");
    uploadPrivateDocument.mockResolvedValueOnce({ ok: false, code: "INVALID", message: "Rejected file." });
    await expect(uploadDocument({ ok: false }, new FormData())).resolves.toEqual({ ok: false, code: "INVALID", message: "Rejected file." });

    uploadPrivateDocument.mockResolvedValueOnce({ ok: true, documentId: "existing", duplicate: true, outcome: "EXISTING" });
    await expect(uploadDocument({ ok: false }, new FormData())).resolves.toMatchObject({ ok: true, outcome: "EXISTING", message: "This file already has a canonical document record." });

    uploadPrivateDocument.mockRejectedValueOnce(new Error("storage unavailable"));
    await expect(uploadDocument({ ok: false }, new FormData())).resolves.toMatchObject({ ok: false, code: "UNAVAILABLE" });
  });
});
