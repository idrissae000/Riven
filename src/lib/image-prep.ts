/**
 * Browser-side image preparation for riven scans.
 *
 * Why: (1) phone photos are huge, EXIF-rotated, sometimes HEIC, and hosting caps request bodies (~4.5 MB);
 * (2) the vision API downsizes anything over ~1568px on its longest edge, so on a full-screen 1440p/4K
 * screenshot the riven card (a small part of the picture) ends up tiny. So for big images we send a small
 * overview first to LOCATE the card, then crop that region from the ORIGINAL pixels and send only the crop.
 */

export interface Box { x: number; y: number; w: number; h: number } // normalised 0..1

/** Scale (w,h) down so the longest edge is at most `max`, preserving aspect ratio. Never upscales. */
export function fitWithin(w: number, h: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/** Grow a box by `pad` (fraction of its own size) on every side, clamped to the image. */
export function padBox(b: Box, pad = 0.08): Box {
  const x = Math.max(0, b.x - b.w * pad);
  const y = Math.max(0, b.y - b.h * pad);
  return { x, y, w: Math.min(1 - x, b.w * (1 + 2 * pad)), h: Math.min(1 - y, b.h * (1 + 2 * pad)) };
}

const LIMIT_BYTES = 3_200_000; // comfortably under 4.5 MB request limits once multipart overhead is added
const toBlob = (c: HTMLCanvasElement, type: string, q: number) => new Promise<Blob | null>((r) => c.toBlob(r, type, q));

export class ScanImage {
  private constructor(readonly file: File, private source: CanvasImageSource, readonly width: number, readonly height: number, private release: () => void) {}

  static async open(file: File): Promise<ScanImage> {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); // honours EXIF rotation
      return new ScanImage(file, bmp, bmp.width, bmp.height, () => bmp.close());
    } catch {
      const url = URL.createObjectURL(file); // older browsers: <img> applies EXIF orientation itself
      try {
        const img = new Image();
        img.src = url;
        await img.decode();
        return new ScanImage(file, img, img.naturalWidth, img.naturalHeight, () => URL.revokeObjectURL(url));
      } catch {
        URL.revokeObjectURL(url);
        throw new Error("Couldn’t read that image. If it’s an iPhone HEIC photo, switch the camera to “Most Compatible” (Settings → Camera → Formats) or screenshot the photo and upload that.");
      }
    }
  }

  get longEdge() { return Math.max(this.width, this.height); }

  /** Encode the whole image, or a normalised crop of it, as a JPEG whose longest edge is <= maxEdge. */
  async jpeg(opts: { maxEdge: number; crop?: Box }): Promise<File> {
    const c = opts.crop ?? { x: 0, y: 0, w: 1, h: 1 };
    const sx = Math.round(c.x * this.width), sy = Math.round(c.y * this.height);
    const sw = Math.max(1, Math.round(c.w * this.width)), sh = Math.max(1, Math.round(c.h * this.height));
    const { width, height } = fitWithin(sw, sh, opts.maxEdge);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser can’t process images.");
    ctx.fillStyle = "#000"; // JPEG has no alpha
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(this.source, sx, sy, sw, sh, 0, 0, width, height);
    for (const q of [0.92, 0.85, 0.75, 0.65]) {
      const blob = await toBlob(canvas, "image/jpeg", q);
      if (blob && blob.size <= LIMIT_BYTES) return new File([blob], "riven.jpg", { type: "image/jpeg" });
    }
    throw new Error("That image is still too large after shrinking — crop it closer to the riven card.");
  }

  /** A small PNG that is already small enough can be sent as-is, keeping pixel-perfect text. */
  get isSmallPng() { return this.file.type === "image/png" && this.file.size <= LIMIT_BYTES && this.longEdge <= READ_EDGE; }

  close() { this.release(); }
}

/** Longest edge sent for reading. The API itself downsizes beyond ~1568px, so more would just waste bytes. */
export const READ_EDGE = 1568;
/** Images bigger than this get the locate-then-crop treatment. */
export const CROP_ABOVE = 1700;
export const OVERVIEW_EDGE = 1400;
