/**
 * Shrinks a photo in the browser BEFORE it is uploaded:
 *  - longest side max 1600px, converted to WebP (JPEG on old browsers)
 *  - lowers quality / size step by step until the file is under ~600 KB
 * A 12 MB phone photo ends up around 150–400 KB. On any problem the original file is returned unchanged.
 */
const MAX_SIDE = 1600;
const TARGET_BYTES = 600 * 1024;

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function compressImage(file: File): Promise<File> {
  try {
    if (typeof window === 'undefined' || !file.type.startsWith('image/')) return file;
    if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file; // would lose animation

    // imageOrientation: phone photos are drawn the right way up
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    let scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    let quality = 0.85;
    let best: Blob | null = null;
    let outType = 'image/webp';

    for (let attempt = 0; attempt < 6; attempt++) {
      const w = Math.max(1, Math.round(bitmap.width * scale));
      const h = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) break;
      ctx.drawImage(bitmap, 0, 0, w, h);

      let blob = await toBlob(canvas, outType, quality);
      if (blob && blob.type !== outType) {
        // browser cannot encode WebP (older Safari) -> JPEG on a white background
        outType = 'image/jpeg';
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        blob = await toBlob(canvas, outType, quality);
      }
      if (!blob) break;
      best = blob;
      if (blob.size <= TARGET_BYTES) break;

      // still too big: lower quality first, then the dimensions
      if (quality > 0.6) quality -= 0.1;
      else scale *= 0.8;
    }
    bitmap.close?.();

    if (!best || best.size >= file.size) return file; // already small – keep the original
    const ext = best.type === 'image/webp' ? 'webp' : 'jpg';
    const base = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([best], `${base}.${ext}`, { type: best.type });
  } catch {
    return file;
  }
}