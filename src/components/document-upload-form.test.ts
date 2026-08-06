import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("mobile receipt camera upload form", () => {
  it("offers an explicit environment-camera action alongside the existing picker", async () => {
    const source = await readFile(new URL("./document-upload-form.tsx", import.meta.url), "utf8");
    expect(source).toContain('id="receipt-camera"');
    expect(source).toContain('accept="image/jpeg,image/png,image/*"');
    expect(source).toContain('capture="environment"');
    expect(source).toContain("Take photo of receipt");
    expect(source).toContain("Choose existing file");
    expect(source).toContain('accept="application/pdf,image/jpeg,image/png"');
  });

  it("keeps camera selection, preview, retake, removal, and the existing server action accessible", async () => {
    const source = await readFile(new URL("./document-upload-form.tsx", import.meta.url), "utf8");
    expect(source).toContain("useActionState(uploadDocument, initialState)");
    expect(source).toContain("Preview of");
    expect(source).toContain("Retake photo");
    expect(source).toContain("Remove file");
    expect(source).toContain('source === "camera" && fileInput.current');
    expect(source).toContain('source === "file" && cameraInput.current');
    expect(source).toContain("aria-label=\"Take photo of receipt\"");
    expect(source).toContain("min-h-12");
    expect(source).toContain("overflow-hidden");
  });
});
