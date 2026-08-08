"use client";

import {
  normalizedReceiptDimensions,
  normalizedReceiptFilename,
  RECEIPT_IMAGE_JPEG_QUALITY,
  shouldNormalizeReceiptImage,
  type ReceiptImageDimensions,
} from "./receipt-image-normalization";

type DecodedImage = {
  width: number;
  height: number;
  draw: (context: CanvasRenderingContext2D, width: number, height: number) => void;
  close: () => void;
};

export type NormalizedReceiptImage = {
  file: File;
  normalized: boolean;
  dimensions: ReceiptImageDimensions | null;
};

/**
 * The normalized File is the only image sent to the existing server action.
 * Canvas re-encoding intentionally omits EXIF/GPS metadata from normalized
 * images; no pixels leave the browser during this preparation step.
 */
export async function normalizeReceiptImage(file: File): Promise<NormalizedReceiptImage> {
  if (file.type !== "image/jpeg" && file.type !== "image/png") {
    return { file, normalized: false, dimensions: null };
  }

  const decoded = await decodeImage(file);
  try {
    const original = { width: decoded.width, height: decoded.height };
    const target = normalizedReceiptDimensions(original);
    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return { file, normalized: false, dimensions: original };
    decoded.draw(context, target.width, target.height);

    const hasTransparency = file.type === "image/png" && canvasHasTransparency(context, target);
    if (!shouldNormalizeReceiptImage({ mimeType: file.type, sizeBytes: file.size, dimensions: original, hasTransparency })) {
      return { file, normalized: false, dimensions: original };
    }

    const blob = await jpegBlob(canvas);
    return {
      file: new File([blob], normalizedReceiptFilename(file.name), { type: "image/jpeg" }),
      normalized: true,
      dimensions: target,
    };
  } finally {
    decoded.close();
  }
}

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (context, width, height) => context.drawImage(bitmap, 0, 0, width, height),
      close: () => bitmap.close(),
    };
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  image.src = objectUrl;
  await image.decode();
  return {
    width: image.naturalWidth,
    height: image.naturalHeight,
    draw: (context, width, height) => context.drawImage(image, 0, 0, width, height),
    close: () => URL.revokeObjectURL(objectUrl),
  };
}

function canvasHasTransparency(context: CanvasRenderingContext2D, { width, height }: ReceiptImageDimensions) {
  const pixels = context.getImageData(0, 0, width, height).data;
  for (let index = 3; index < pixels.length; index += 4) if (pixels[index] !== 255) return true;
  return false;
}

function jpegBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Receipt image normalization could not encode JPEG.")), "image/jpeg", RECEIPT_IMAGE_JPEG_QUALITY);
  });
}
