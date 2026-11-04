'use client';

import { useEffect } from 'react';

/** Admin khulle service worker register kore ar "Install app" prompt dhore rakhe */
export function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    }
    const h = (e: any) => {
      e.preventDefault();
      (window as any).__installPrompt = e;
      window.dispatchEvent(new Event('pwa-install-ready'));
    };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  return null;
}