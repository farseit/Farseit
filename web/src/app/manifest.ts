import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Farse AI',
    short_name: 'Farse AI',
    description: 'Messenger sales chatbot dashboard',
    start_url: '/shop',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      { src: '/pwa-icon/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon/maskable', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
