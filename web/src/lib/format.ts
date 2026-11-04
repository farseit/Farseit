import type { Lang } from './types';

const locale = (lang: Lang) => (lang === 'bn' ? 'bn-BD' : 'en-US');

export const num = (n: number, lang: Lang) => Number(n || 0).toLocaleString(locale(lang));
export const money = (n: number, lang: Lang) => `৳${num(n, lang)}`;

export const dateFmt = (iso: string, lang: Lang, withTime = false) =>
  new Date(iso).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });

/** pick(product, 'name', lang) -> nameBn or nameEn (falls back to English). */
export const pick = (o: any, base: string, lang: Lang): string =>
  (lang === 'bn' ? o?.[base + 'Bn'] || o?.[base + 'En'] : o?.[base + 'En']) || '';

export const optionsText = (options?: Record<string, string> | null) => Object.values(options || {}).join(' / ');

export const discountPct =(price: number, compare?: number | null) =>
  compare && compare > price ? Math.round(((compare - price) / compare) * 100) : 0;

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
