'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
type Point = { x: number; y: number };
const Ctx = createContext<{ theme: Theme; toggle: (pt?: Point) => void }>({ theme: 'light', toggle: () => {} });

/** Inline script (runs before paint) so there is no flash of the wrong theme. */
export const themeScript = `(function(){try{var t=localStorage.getItem('farse_theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}if(t==='dark')document.documentElement.classList.add('dark')}catch(e){}})()`;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  }, []);

  // pt dile (button-er jayga) oikhan theke golakar bhabe notun theme ephiye jay
  const toggle = useCallback((pt?: Point) => {
    const next: Theme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
    const apply = () => {
      document.documentElement.classList.toggle('dark', next === 'dark');
      try {
        localStorage.setItem('farse_theme', next);
      } catch {}
      setTheme(next);
    };

    const doc = document as any;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!pt || typeof pt.x !== 'number' || typeof pt.y !== 'number' || reduce || typeof doc.startViewTransition !== 'function') {
      return apply();
    }

    const radius = Math.hypot(Math.max(pt.x, window.innerWidth - pt.x), Math.max(pt.y, window.innerHeight - pt.y));
    const transition = doc.startViewTransition(() => apply());
    transition.ready
      .then(() => {
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${pt.x}px ${pt.y}px)`, `circle(${radius}px at ${pt.x}px ${pt.y}px)`] },
          { duration: 650, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' },
        );
      })
      .catch(() => {});
  }, []);

  return <Ctx.Provider value={{ theme, toggle }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);