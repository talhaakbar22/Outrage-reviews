const MAX_IMAGE_EDGE = 1920;
const IMAGE_QUALITY = 0.82;

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not compress image"));
          return;
        }
        resolve(blob);
      },
      type,
      quality,
    );
  });
}

/**
 * Compresses review photos in the browser before S3 upload.
 * GIFs are left untouched. Videos should be passed through unchanged.
 */
export async function compressImageForUpload(file: File): Promise<{
  blob: Blob;
  contentType: string;
}> {
  if (file.type === "image/gif" || !file.type.startsWith("image/")) {
    return { blob: file, contentType: file.type || "application/octet-stream" };
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { blob: file, contentType: file.type };
  }

  try {
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) {
      return { blob: file, contentType: file.type };
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    const contentType = "image/jpeg";
    const blob = await canvasToBlob(canvas, contentType, IMAGE_QUALITY);

    if (scale === 1 && blob.size >= file.size * 0.95) {
      return { blob: file, contentType: file.type };
    }

    return { blob, contentType };
  } finally {
    bitmap.close();
  }
}
