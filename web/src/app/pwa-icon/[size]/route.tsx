import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(_req: Request, { params }: { params: { size: string } }) {
  const size = params.size === '512' ? 512 : 192;
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #273c75, #0f121c)',
          color: 'white',
          fontSize: size * 0.55,
          fontWeight: 800,
        }}
      >
        F
      </div>
    ),
    { width: size, height: size },
  );
}