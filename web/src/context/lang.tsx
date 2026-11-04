'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { makeT, TFn } from '@/lib/i18n';
import type { Lang } from '@/lib/types';

const Ctx = createContext<{ lang: Lang; t: TFn; setLang: (l: Lang) => void }>({
  lang: 'en',
  t: makeT('en'),
  setLang: () => {},
});

export function LangProvider({ initial, children }: { initial: Lang; children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial);
  const router = useRouter();

  // Server shobsomoy 'en' dey (page static rakhar jonno). Browser e cookie dekhe thik bhasha e jai
  useEffect(() => {
    const m = document.cookie.match(/(?:^|; )farse_lang=(bn|en)/);
    if (m && m[1] !== initial) setLangState(m[1] as Lang);
  }, [initial]);

  const setLang = useCallback(
    (l: Lang) => {
      document.cookie = `farse_lang=${l}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = l;
      setLangState(l);
      router.refresh(); // re-render server components in the new language
    },
    [router],
  );

  const value = useMemo(() => ({ lang, t: makeT(lang), setLang }), [lang, setLang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);
