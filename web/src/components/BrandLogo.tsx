import logo from '@/assets/logo.png';
import logoFull from '@/assets/logo-full.png';
import mark from '@/assets/logo-mark.png';

type Props = { className?: string; alt?: string; variant?: 'wordmark' | 'full' | 'mark' };

/**
 * FarseIT logo. Plain <img> (no next/image) so it works in Docker standalone without sharp.
 *  wordmark = F + "ARSE IT" (navbar, sidebar)   full = with tagline   mark = only the orange F
 */
export function BrandLogo({ className = 'h-10 w-auto', alt = 'FarseIT', variant = 'wordmark' }: Props) {
  const img = variant === 'full' ? logoFull : variant === 'mark' ? mark : logo;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={img.src} width={img.width} height={img.height} alt={alt} className={className} />;
}
