// sharp is optional: if it cannot load on some server, uploads still work (just without server-side compression)
// eslint-disable-next-line @typescript-eslint/no-var-requires
let sharpLib: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  sharpLib = require('sharp');
} catch {
  console.warn('sharp not available – images will be stored without server-side compression');
}

const MAX_SIDE = 1600; // longest edge in pixels
const QUALITY = 80;

/** Resizes (max 1600px) + converts to WebP. Animated GIFs and already-small results are left alone. */
export async function compressImage(input: Buffer, ext: string): Promise<{ buffer: Buffer; ext: string }> {
  if (!sharpLib || ext === '.gif') return { buffer: input, ext };
  try {
    const out: Buffer = await sharpLib(input, { failOn: 'none', limitInputPixels: 120_000_000 })
      .rotate() // respect phone-camera orientation, then drop the EXIF data
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toBuffer();
    // keep the original if it was already smaller (tiny, well-optimised files)
    return out.length < input.length ? { buffer: out, ext: '.webp' } : { buffer: input, ext };
  } catch {
    return { buffer: input, ext };
  }
}