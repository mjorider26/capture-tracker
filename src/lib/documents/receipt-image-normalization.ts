export const RECEIPT_IMAGE_LONGEST_EDGE = 1920;
export const RECEIPT_IMAGE_JPEG_QUALITY = 0.82;
export const RECEIPT_IMAGE_REASONABLE_BYTES = 1024 * 1024;

export type ReceiptImageDimensions = { width: number; height: number };

export function normalizedReceiptDimensions({ width, height }: ReceiptImageDimensions): ReceiptImageDimensions {
  const longestEdge = Math.max(width, height);
  if (longestEdge <= RECEIPT_IMAGE_LONGEST_EDGE) return { width, height };
  const scale = RECEIPT_IMAGE_LONGEST_EDGE / longestEdge;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export function shouldNormalizeReceiptImage({
  mimeType,
  sizeBytes,
  dimensions,
  hasTransparency,
}: {
  mimeType: string;
  sizeBytes: number;
  dimensions: ReceiptImageDimensions;
  hasTransparency: boolean;
}) {
  if (mimeType !== "image/jpeg" && mimeType !== "image/png") return false;
  if (mimeType === "image/png" && hasTransparency) return false;
  return sizeBytes > RECEIPT_IMAGE_REASONABLE_BYTES
    || Math.max(dimensions.width, dimensions.height) > RECEIPT_IMAGE_LONGEST_EDGE;
}

export function normalizedReceiptFilename(filename: string) {
  return /\.(?:jpe?g|png)$/i.test(filename)
    ? filename.replace(/\.(?:jpe?g|png)$/i, ".jpg")
    : `${filename}.jpg`;
}
