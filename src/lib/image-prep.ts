/**
 * Browser-side image preparation for riven scans. Phone photos are huge (5–12 MB), often rotated via EXIF,
 * and sometimes HEIC; hosting platforms also cap request bodies (~4.5 MB on Vercel). So before uploading we
 * decode, honour EXIF orientation, downscale so the longest edge is <= maxEdge, and re-encode.
 */

/** Scale (w,h) down so the longest edge is at most `max`, preserving aspect ratio. Never upscales. */
export function fitWithin(w: number, h: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

const LIMIT_BYTES = 3_200_000; // comfortably under 4.5 MB request limits once multipart overhead is added

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
  } catch {
    // Older browsers: fall back to an <img> element (they apply EXIF orientation themselves).
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
    } catch {
      URL.revokeObjectURL(url);
      throw new Error("Couldn’t read that image. If it’s an iPhone HEIC photo, switch the camera to “Most Compatible” (Settings → Camera → Formats) or screenshot the photo and upload that.");
    }
  }
}

const toBlob = (c: HTMLCanvasElement, type: string, q: number) => new Promise<Blob | null>((r) => c.toBlob(r, type, q));

/** Returns a JPEG/PNG File that is safe to upload: oriented correctly, <= maxEdge px, under ~3.2 MB. */
export async function prepareImage(file: File, maxEdge = 1800): Promise<File> {
  const img = await decode(file);
  try {
    const { width, height } = fitWithin(img.width, img.height, maxEdge);
    const untouchedPng = file.type === "image/png" && width === img.width && height === img.height && file.size <= LIMIT_BYTES;
    if (untouchedPng) return file; // small screenshots keep their pixel-perfect text

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser can’t process images.");
    ctx.fillStyle = "#000"; // JPEG has no alpha
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img.source, 0, 0, width, height);

    for (const q of [0.92, 0.85, 0.75, 0.65]) {
      const blob = await toBlob(canvas, "image/jpeg", q);
      if (blob && blob.size <= LIMIT_BYTES) return new File([blob], "riven.jpg", { type: "image/jpeg" });
    }
    throw new Error("That image is still too large after shrinking — crop it closer to the riven card.");
  } finally {
    img.close();
  }
}
