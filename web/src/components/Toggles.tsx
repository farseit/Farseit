'use client';

import { Languages, Moon, Sun } from 'lucide-react';
import { useLang } from '@/context/lang';
import { useTheme } from '@/context/theme';

export function ThemeToggle() {
  const { toggle } = useTheme();
  const { t } = useLang();
  return (
    <button
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            toggle({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
          }}
          className="btn btn-ghost h-10 w-10 !p-0" aria-label={t('nav.theme')} title={t('nav.theme')}>
      <Sun className="hidden h-5 w-5 dark:block" />
      <Moon className="h-5 w-5 dark:hidden" />
    </button>
  );
}

export function LangToggle() {
  const { lang, setLang, t } = useLang();
  return (
    <button
      onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}
      className="btn btn-ghost h-10 gap-1.5 !px-2.5"
      aria-label={t('nav.language')}
      title={t('nav.language')}
    >
      <Languages className="h-5 w-5" />
      <span className="text-xs font-bold">{lang === 'en' ? 'বাং' : 'EN'}</span>
    </button>
  );
}
