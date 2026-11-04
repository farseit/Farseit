'use client';

import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './auth';
import { LangProvider } from './lang';
import { ThemeProvider } from './theme';
import type { Lang } from '@/lib/types';

/** Farse AI app (login, dashboard, admin) provider-er set */
export function Providers({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <LangProvider initial={lang}>
        <AuthProvider>
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: 'rgb(var(--background))',
                color: 'rgb(var(--foreground))',
                border: '1px solid rgb(var(--border))',
                fontSize: '14px',
              },
            }}
          />
        </AuthProvider>
      </LangProvider>
    </ThemeProvider>
  );
}
