import { BRAND_ICONS } from '@/lib/brand-icons';

export const runtime = 'edge';

// /pwa-icon/192 , /pwa-icon/512 , /pwa-icon/maskable  (FarseIT logo, base64 e embedded)
export async function GET(_req: Request, { params }: { params: { size: string } }) {
  const key = params.size === '512' ? '512' : params.size === 'maskable' ? 'maskable' : '192';
  const bin = atob(BRAND_ICONS[key]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Response(bytes, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
}
