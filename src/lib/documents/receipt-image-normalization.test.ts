import { describe, expect, it } from "vitest";

import {
  normalizedReceiptDimensions,
  normalizedReceiptFilename,
  RECEIPT_IMAGE_JPEG_QUALITY,
  RECEIPT_IMAGE_LONGEST_EDGE,
  shouldNormalizeReceiptImage,
} from "./receipt-image-normalization";

describe("receipt image normalization policy", () => {
  it("caps a large camera-style image without changing its aspect ratio", () => {
    const dimensions = normalizedReceiptDimensions({ width: 4032, height: 3024 });
    expect(dimensions.width).toBe(RECEIPT_IMAGE_LONGEST_EDGE);
    expect(dimensions.height).toBe(1440);
    expect(dimensions.width / dimensions.height).toBeCloseTo(4032 / 3024, 4);
    expect(RECEIPT_IMAGE_JPEG_QUALITY).toBe(0.82);
  });

  it("does not enlarge a reasonably sized image", () => {
    expect(normalizedReceiptDimensions({ width: 1200, height: 900 })).toEqual({ width: 1200, height: 900 });
    expect(shouldNormalizeReceiptImage({ mimeType: "image/jpeg", sizeBytes: 480_000, dimensions: { width: 1200, height: 900 }, hasTransparency: false })).toBe(false);
  });

  it("leaves PDFs and transparency-dependent PNGs outside the JPEG path", () => {
    expect(shouldNormalizeReceiptImage({ mimeType: "application/pdf", sizeBytes: 4_000_000, dimensions: { width: 4000, height: 3000 }, hasTransparency: false })).toBe(false);
    expect(shouldNormalizeReceiptImage({ mimeType: "image/png", sizeBytes: 4_000_000, dimensions: { width: 4000, height: 3000 }, hasTransparency: true })).toBe(false);
    expect(normalizedReceiptFilename("receipt.PNG")).toBe("receipt.jpg");
  });
});
