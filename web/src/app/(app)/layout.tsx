import type { Metadata, Viewport } from 'next';
import { Hind_Siliguri, Inter } from 'next/font/google';
import '../globals.css';
import { Providers } from '@/context/providers';
import { themeScript } from '@/context/theme';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });
const hind = Hind_Siliguri({ subsets: ['bengali', 'latin'], weight: ['400', '700'], preload: false, display: 'swap', variable: '--font-hind' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: { default: 'Farse AI — Messenger sales chatbot', template: '%s | Farse AI' },
  description: 'Farse AI answers your Facebook Page messages and takes orders automatically.',
  openGraph: { siteName: 'Farse AI', type: 'website' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#273c75' },
    { media: '(prefers-color-scheme: dark)', color: '#0f121c' },
  ],
};

// Cookie server-e pori na (tahole shob page dynamic hoye jay). <html lang> browser-e thik hoy
const langScript = `(function(){try{var m=document.cookie.match(/(?:^|; )farse_lang=(bn|en)/);if(m)document.documentElement.lang=m[1]}catch(e){}})()`;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${hind.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript + langScript }} />
      </head>
      <body className="min-h-screen">
        <Providers lang="en">{children}</Providers>
      </body>
    </html>
  );
}
