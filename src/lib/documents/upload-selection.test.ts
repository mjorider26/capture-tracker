import { describe, expect, it } from "vitest";

import { selectedDocumentUpload } from "./upload-selection";

describe("selectedDocumentUpload", () => {
  it("uses the captured receipt with the existing upload action field", () => {
    const formData = new FormData();
    formData.set("cameraDocument", new File(["receipt"], "receipt.jpg", { type: "image/jpeg" }));
    formData.set("document", new File([], ""));
    expect(selectedDocumentUpload(formData)?.name).toBe("receipt.jpg");
  });

  it("retains the PDF picker and does not manufacture a file", () => {
    const formData = new FormData();
    formData.set("document", new File(["pdf"], "receipt.pdf", { type: "application/pdf" }));
    expect(selectedDocumentUpload(formData)?.name).toBe("receipt.pdf");
    expect(selectedDocumentUpload(new FormData())).toBeNull();
  });
});
