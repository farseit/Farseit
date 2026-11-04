'use client';

import clsx from 'clsx';
import { AlertTriangle, Copy, ExternalLink, EyeOff, ImagePlus, LayoutGrid, Link2, List, Loader2, Package, Pencil, Plus, Search, Star, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ErrorBox } from '@/components/admin/ui';
import { useLang } from '@/context/lang';
import { gql, uploadImage } from '@/lib/api';
import { money, num } from '@/lib/format';

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  minPrice: number | null;
  stock: number;
  trackStock: boolean;
  images: string[];
  options: { name: string; values: string[] }[] | null;
  active: boolean;
  code?: string | null;
};

type Draft = {
  id?: string;
  name: string;
  description: string;
  price: string;
  minPrice: string;
  stock: string;
  trackStock: boolean;
  active: boolean;
  images: string[];
  options: { name: string; values: string }[];
};

type Filter = 'ALL' | 'ACTIVE' | 'HIDDEN' | 'LOW' | 'OUT';
type Sort = 'DEFAULT' | 'NAME' | 'PRICE_ASC' | 'PRICE_DESC' | 'STOCK_ASC';
type View = 'LIST' | 'GRID';

const LOW = 3; // ei ba er kom stock hole "Low stock"
const empty: Draft = { name: '', description: '', price: '', minPrice: '', stock: '10', trackStock: true, active: true, images: [], options: [] };

const toDraft = (p: Product): Draft => ({
  id: p.id,
  name: p.name,
  description: p.description || '',
  price: String(p.price),
  minPrice: p.minPrice == null ? '' : String(p.minPrice),
  stock: String(p.stock),
  trackStock: p.trackStock,
  active: p.active,
  images: p.images || [],
  options: (p.options || []).map((o) => ({ name: o.name, values: o.values.join(', ') })),
});

const toInput = (d: Draft) => ({
  id: d.id,
  name: d.name,
  description: d.description,
  price: Number(d.price),
  minPrice: d.minPrice.trim() === '' ? null : Number(d.minPrice),
  stock: Number(d.stock) || 0,
  trackStock: d.trackStock,
  active: d.active,
  images: d.images,
  options: d.options.map((o) => ({ name: o.name, values: o.values.split(',').map((v) => v.trim()).filter(Boolean) })),
});

const stockState = (p: Product) => (!p.trackStock ? 'NA' : p.stock <= 0 ? 'OUT' : p.stock <= LOW ? 'LOW' : 'OK');

function Switch({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={clsx('relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50', on ? 'bg-primary' : 'bg-border')}
    >
      <span className={clsx('inline-block h-5 w-5 rounded-full bg-white shadow transition-transform', on ? 'translate-x-[22px]' : 'translate-x-0.5')} />
    </button>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-sm font-bold">{title}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

export default function ShopProducts() {
  const { lang } = useLang();
  const L = (bn: string, en: string) => (lang === 'bn' ? bn : en);

  const [items, setItems] = useState<Product[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [sort, setSort] = useState<Sort>('DEFAULT');
  const [view, setView] = useState<View>('LIST');

  // list / grid pochondo mone rakhe
  useEffect(() => {
    try {
      const v = localStorage.getItem('farse_products_view');
      if (v === 'LIST' || v === 'GRID') setView(v);
    } catch {}
  }, []);
  const changeView = (v: View) => {
    setView(v);
    try {
      localStorage.setItem('farse_products_view', v);
    } catch {}
  };

  const load = useCallback(() => {
    gql<{ shopProducts: Product[] }>(`query { shopProducts }`)
      .then((d) => setItems(d.shopProducts))
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const patch = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d));

  const onFiles = async (files: FileList | null) => {
    if (!files || !draft) return;
    const room = 5 - draft.images.length;
    if (room <= 0) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files).slice(0, room)) urls.push(await uploadImage(f, false, '/upload/shop'));
      setDraft((d) => (d ? { ...d, images: [...d.images, ...urls].slice(0, 5) } : d));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      await gql(`mutation($i: JSON!){ shopSaveProduct(input: $i) }`, { i: toInput(draft) });
      toast.success(L('সেভ হয়েছে', 'Saved'));
      setDraft(null);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p: Product) => {
    if (!confirm(L(`"${p.name}" ডিলিট করবেন?`, `Delete "${p.name}"?`))) return;
    try {
      await gql(`mutation($id:String!){ shopDeleteProduct(id:$id) }`, { id: p.id });
      toast.success(L('ডিলিট হয়েছে', 'Deleted'));
      setDraft(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const toggleActive = async (p: Product) => {
    setBusyId(p.id);
    try {
      await gql(`mutation($i: JSON!){ shopSaveProduct(input: $i) }`, { i: { ...toInput(toDraft(p)), active: !p.active } });
      setItems((list) => list && list.map((x) => (x.id === p.id ? { ...x, active: !p.active } : x)));
      toast.success(!p.active ? L('বট এখন এই প্রোডাক্ট দেখাবে', 'The bot will now show this product') : L('প্রোডাক্ট লুকানো হয়েছে', 'Product hidden from the bot'));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const duplicate = (p: Product) => {
    setError(null);
    setDraft({ ...toDraft(p), id: undefined, name: `${p.name} (${L('কপি', 'copy')})` });
  };

  // ---------- derived ----------
  const stats = useMemo(() => {
    const list = items || [];
    return {
      total: list.length,
      active: list.filter((p) => p.active).length,
      hidden: list.filter((p) => !p.active).length,
      low: list.filter((p) => stockState(p) === 'LOW').length,
      out: list.filter((p) => stockState(p) === 'OUT').length,
    };
  }, [items]);

  const shown = useMemo(() => {
    if (!items) return null;
    const t = q.trim().toLowerCase();
    const list = items.filter((p) => {
      if (filter === 'ACTIVE' && !p.active) return false;
      if (filter === 'HIDDEN' && p.active) return false;
      if (filter === 'LOW' && stockState(p) !== 'LOW') return false;
      if (filter === 'OUT' && stockState(p) !== 'OUT') return false;
      if (!t) return true;
      return `${p.name} ${p.description || ''}`.toLowerCase().includes(t);
    });
    const s = [...list];
    if (sort === 'NAME') s.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'PRICE_ASC') s.sort((a, b) => a.price - b.price);
    if (sort === 'PRICE_DESC') s.sort((a, b) => b.price - a.price);
    if (sort === 'STOCK_ASC') s.sort((a, b) => (a.trackStock ? a.stock : Infinity) - (b.trackStock ? b.stock : Infinity));
    return s;
  }, [items, q, filter, sort]);

  const filters: { id: Filter; label: string; n: number }[] = [
    { id: 'ALL', label: L('সব', 'All'), n: stats.total },
    { id: 'ACTIVE', label: L('চালু', 'Active'), n: stats.active },
    { id: 'HIDDEN', label: L('লুকানো', 'Hidden'), n: stats.hidden },
    { id: 'LOW', label: L('স্টক কম', 'Low stock'), n: stats.low },
    { id: 'OUT', label: L('স্টক শেষ', 'Out of stock'), n: stats.out },
  ];

  const sorts: { id: Sort; label: string }[] = [
    { id: 'DEFAULT', label: L('ডিফল্ট', 'Default order') },
    { id: 'NAME', label: L('নাম (A-Z)', 'Name (A-Z)') },
    { id: 'PRICE_ASC', label: L('দাম: কম থেকে বেশি', 'Price: low to high') },
    { id: 'PRICE_DESC', label: L('দাম: বেশি থেকে কম', 'Price: high to low') },
    { id: 'STOCK_ASC', label: L('স্টক: কম আগে', 'Stock: lowest first') },
  ];

  const stat = (label: string, value: number, tone?: string) => (
    <div className="bg-background px-5 py-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className={clsx('mt-1 font-display text-2xl font-semibold tabular-nums', tone)}>{num(value, lang)}</p>
    </div>
  );

  const openEdit = (p: Product) => {
    setError(null);
    setDraft(toDraft(p));
  };

  const copyLink = (p: Product) => {
    const url = `${window.location.origin}/p/${p.code}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success(L('লিংক কপি হয়েছে', 'Link copied')),
      () => toast.error(url),
    );
  };

  const iconBtn = 'btn btn-ghost h-8 w-8 shrink-0 !p-0';

  const actions = (p: Product) => (
    <div className="flex items-center">
      {p.code && (
        <>
          <button className={iconBtn} aria-label="Copy landing page link" title={L('ল্যান্ডিং পেজের লিংক কপি করুন', 'Copy landing page link')} onClick={() => copyLink(p)}>
            <Link2 className="h-4 w-4" />
          </button>
          <a className={iconBtn} href={`/p/${p.code}`} target="_blank" rel="noopener noreferrer" aria-label="Open landing page" title={L('ল্যান্ডিং পেজ দেখুন', 'Open landing page')}>
            <ExternalLink className="h-4 w-4" />
          </a>
        </>
      )}
      <button className={iconBtn} onClick={() => duplicate(p)} aria-label="Duplicate" title={L('কপি করুন', 'Duplicate')}>
        <Copy className="h-4 w-4" />
      </button>
      <button className={iconBtn} onClick={() => openEdit(p)} aria-label="Edit" title={L('এডিট', 'Edit')}>
        <Pencil className="h-4 w-4" />
      </button>
      <button className={clsx(iconBtn, 'text-danger')} onClick={() => remove(p)} aria-label="Delete" title={L('ডিলিট', 'Delete')}>
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );

  const stockCell = (p: Product) => {
    const st = stockState(p);
    if (st === 'NA') return <span className="text-sm text-muted">{L('হিসাব বন্ধ', 'Not tracked')}</span>;
    return (
      <span className="flex items-center gap-2">
        <span className="text-sm font-semibold tabular-nums">{num(p.stock, lang)}</span>
        {st === 'OUT' && <span className="badge bg-danger/10 text-danger">{L('শেষ', 'Out')}</span>}
        {st === 'LOW' && <span className="badge bg-signal/15 text-signal">{L('কম', 'Low')}</span>}
      </span>
    );
  };

  const priceCell = (p: Product) => {
    const hasMin = p.minPrice != null && p.minPrice < p.price;
    return (
      <span className="block">
        <span className="block font-display text-base font-semibold tabular-nums">{money(p.price, lang)}</span>
        {hasMin && (
          <span className="block text-[11px] text-muted">
            {L('সর্বনিম্ন', 'Lowest')} {money(p.minPrice as number, lang)}
          </span>
        )}
      </span>
    );
  };

  const statusCell = (p: Product) => (
    <label className="flex items-center gap-2 text-xs font-semibold text-muted">
      <Switch on={p.active} onChange={() => toggleActive(p)} disabled={busyId === p.id} />
      <span className="hidden sm:inline">{p.active ? L('বট দেখাচ্ছে', 'Visible') : L('লুকানো', 'Hidden')}</span>
    </label>
  );

  const COLS = 'md:grid-cols-[minmax(0,1fr)_120px_120px_150px_auto]';

  const minP = draft && draft.minPrice.trim() !== '' ? Number(draft.minPrice) : null;
  const priceN = draft ? Number(draft.price) : 0;

  return (
    <div className="mx-auto max-w-6xl">
      {/* header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-primary">{L('ওয়ার্কস্পেস', 'Workspace')}</span>
          <h1 className="mt-1.5 font-display text-2xl font-semibold tracking-tight sm:text-[30px]">{L('প্রোডাক্ট', 'Products')}</h1>
          <p className="mt-1 text-sm text-muted">{L('বট শুধু এখানে যোগ করা প্রোডাক্টই বিক্রি করবে।', 'The bot only sells the products you add here.')}</p>
        </div>
        <button
          className="btn btn-primary gap-1.5"
          onClick={() => {
            setError(null);
            setDraft({ ...empty });
          }}
        >
          <Plus className="h-4 w-4" /> {L('নতুন প্রোডাক্ট', 'Add product')}
        </button>
      </div>

      <ErrorBox message={draft ? null : error} />

      {/* stats strip */}
      <div className="card mb-5 grid grid-cols-2 gap-px overflow-hidden bg-border md:grid-cols-4">
        {stat(L('মোট প্রোডাক্ট', 'Total products'), stats.total)}
        {stat(L('বট দেখাচ্ছে', 'Visible to bot'), stats.active, 'text-success')}
        {stat(L('লুকানো', 'Hidden'), stats.hidden)}
        {stat(L('স্টক নিয়ে সতর্কতা', 'Stock alerts'), stats.low + stats.out, stats.low + stats.out > 0 ? 'text-signal' : undefined)}
      </div>

      {/* toolbar */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:pb-0">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={clsx(
                'flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors',
                filter === f.id ? 'border-primary bg-primary text-white shadow-sm' : 'border-border bg-background text-muted hover:border-primary/40 hover:text-primary',
              )}
            >
              {f.label}
              <span className={clsx('min-w-5 rounded-md px-1.5 text-center text-[11px] font-bold leading-5', filter === f.id ? 'bg-white/25 text-white' : 'bg-surface-2')}>{num(f.n, lang)}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1 lg:w-60 lg:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input className="input !py-2 !pl-9" placeholder={L('প্রোডাক্ট খুঁজুন', 'Search products')} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="input !w-auto !py-2" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label={L('সাজান', 'Sort')}>
            {sorts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <div className="flex shrink-0 rounded-lg border border-border bg-background p-0.5" role="group" aria-label="View">
            {([
              ['LIST', List, L('তালিকা', 'List')],
              ['GRID', LayoutGrid, L('গ্রিড', 'Grid')],
            ] as const).map(([id, Icon, label]) => (
              <button
                key={id}
                onClick={() => changeView(id)}
                aria-pressed={view === id}
                title={label}
                aria-label={label}
                className={clsx('grid h-8 w-8 place-items-center rounded-md transition-colors', view === id ? 'bg-primary-soft text-primary' : 'text-muted hover:text-foreground')}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* products */}
      {shown === null && !error ? (
        <div className="card divide-y divide-border overflow-hidden">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="h-14 w-14 animate-pulse rounded-lg bg-surface-2" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-1/3 animate-pulse rounded bg-surface-2" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-surface-2" />
              </div>
            </div>
          ))}
        </div>
      ) : shown && shown.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Package className="h-8 w-8" />
          </div>
          <p className="font-display text-base font-semibold">{items && items.length ? L('কোনো প্রোডাক্ট মেলেনি', 'No products match') : L('এখনো কোনো প্রোডাক্ট নেই', 'No products yet')}</p>
          <p className="max-w-sm text-sm text-muted">
            {items && items.length ? L('ফিল্টার বা সার্চ বদলে দেখুন।', 'Try another filter or search.') : L('আপনার প্রথম প্রোডাক্ট যোগ করুন, তারপর বট চালু করলে সে নিজে কাস্টমারকে দেখাবে ও অর্ডার নেবে।', 'Add your first product, then turn the bot on and it will show it to customers and take orders.')}
          </p>
          {!(items && items.length) && (
            <button className="btn btn-primary mt-1 gap-1.5" onClick={() => setDraft({ ...empty })}>
              <Plus className="h-4 w-4" /> {L('প্রোডাক্ট যোগ করুন', 'Add product')}
            </button>
          )}
        </div>
      ) : view === 'LIST' ? (
        /* ---------- list (table) view ---------- */
        <div className="card overflow-hidden">
          <div className={clsx('hidden items-center gap-4 border-b border-border bg-surface px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted md:grid', COLS)}>
            <span>{L('প্রোডাক্ট', 'Product')}</span>
            <span>{L('দাম', 'Price')}</span>
            <span>{L('স্টক', 'Stock')}</span>
            <span>{L('বট', 'Bot')}</span>
            <span className="w-[160px]" />
          </div>
          <ul className="divide-y divide-border">
            {shown?.map((p) => (
              <li key={p.id} className={clsx('grid items-center gap-x-4 gap-y-3 px-4 py-3 transition-colors hover:bg-surface', COLS)}>
                <button type="button" onClick={() => openEdit(p)} className={clsx('flex min-w-0 items-center gap-3 text-left', !p.active && 'opacity-60')} aria-label="Edit">
                  <span className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-surface-2 text-muted">
                    {p.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.images[0]} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Package className="h-6 w-6" />
                    )}
                    {p.images.length > 1 && <span className="absolute bottom-0 right-0 rounded-tl-md bg-ink/75 px-1 text-[10px] font-semibold text-white">{p.images.length}</span>}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold" title={p.name}>
                      {p.name}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {p.options && p.options.length ? p.options.map((o) => `${o.name} (${o.values.length})`).join(' · ') : p.description || '—'}
                    </span>
                  </span>
                </button>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 md:contents">
                  <div>{priceCell(p)}</div>
                  <div>{stockCell(p)}</div>
                  <div>{statusCell(p)}</div>
                  <div className="ml-auto md:ml-0 md:justify-self-end">{actions(p)}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        /* ---------- compact grid view ---------- */
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {shown?.map((p) => {
            const st = stockState(p);
            return (
              <div key={p.id} className={clsx('card group flex flex-col overflow-hidden transition-shadow hover:shadow-md', !p.active && 'opacity-80')}>
                <button type="button" className="relative block aspect-square w-full overflow-hidden bg-surface-2" onClick={() => openEdit(p)} aria-label="Edit">
                  {p.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.images[0]} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted">
                      <Package className="h-8 w-8" />
                    </div>
                  )}
                  {!p.active && (
                    <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-ink/70 px-2 py-0.5 text-[11px] font-semibold text-white">
                      <EyeOff className="h-3 w-3" /> {L('লুকানো', 'Hidden')}
                    </span>
                  )}
                  {st === 'OUT' && <span className="absolute bottom-2 left-2 rounded-md bg-danger px-2 py-0.5 text-[11px] font-semibold text-white">{L('স্টক শেষ', 'Out of stock')}</span>}
                  {st === 'LOW' && <span className="absolute bottom-2 left-2 rounded-md bg-signal px-2 py-0.5 text-[11px] font-semibold text-white">{L(`মাত্র ${p.stock}টি বাকি`, `Only ${p.stock} left`)}</span>}
                </button>
                <div className="flex flex-1 flex-col p-3">
                  <p className="truncate text-sm font-semibold" title={p.name}>
                    {p.name}
                  </p>
                  <div className="mt-1">{priceCell(p)}</div>
                  <p className="mt-1 text-xs text-muted">{p.trackStock ? `${L('স্টক', 'Stock')}: ${num(p.stock, lang)}` : L('স্টক হিসাব বন্ধ', 'Stock not tracked')}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-1 border-t border-border pt-3">
                    {statusCell(p)}
                    <div className="flex items-center">
                      <button className={iconBtn} onClick={() => openEdit(p)} aria-label="Edit" title={L('এডিট', 'Edit')}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button className={clsx(iconBtn, 'text-danger')} onClick={() => remove(p)} aria-label="Delete" title={L('ডিলিট', 'Delete')}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {shown && shown.length > 0 && items && (
        <p className="mt-3 text-xs text-muted">
          {L(`${num(shown.length, lang)}টি দেখানো হচ্ছে, মোট ${num(items.length, lang)}টি`, `Showing ${shown.length} of ${items.length}`)}
        </p>
      )}

      {/* ====================== editor drawer ====================== */}
      {draft && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onMouseDown={(e) => e.target === e.currentTarget && setDraft(null)}>
          <form onSubmit={save} className="card flex h-full w-full max-w-xl flex-col !rounded-none sm:!rounded-l-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-lg font-display font-semibold">{draft.id ? L('প্রোডাক্ট এডিট', 'Edit product') : L('নতুন প্রোডাক্ট', 'New product')}</h2>
                <p className="text-xs text-muted">{L('ভালো ছবি ও বিবরণ দিলে বট আরও ভালো উত্তর দেয়।', 'A good photo and description help the bot answer better.')}</p>
              </div>
              <button type="button" className="btn btn-ghost h-9 w-9 !p-0" onClick={() => setDraft(null)} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <ErrorBox message={error} />

              <Section title={L('ছবি', 'Photos')} hint={L('সর্বোচ্চ ৫টি। প্রথম ছবিটি কভার হিসেবে দেখাবে এবং বট এটাই আগে পাঠাবে।', 'Up to 5. The first photo is the cover and the one the bot sends first.')}>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {draft.images.map((u, i) => (
                    <div key={u} className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-surface-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt="" className="h-full w-full object-cover" />
                      {i === 0 ? (
                        <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">
                          <Star className="h-3 w-3" /> {L('কভার', 'Cover')}
                        </span>
                      ) : (
                        <button type="button" className="absolute bottom-1.5 left-1.5 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100" onClick={() => patch({ images: [u, ...draft.images.filter((x) => x !== u)] })}>
                          {L('কভার করুন', 'Make cover')}
                        </button>
                      )}
                      <button type="button" className="absolute right-1.5 top-1.5 rounded-full bg-danger p-1 text-white shadow" onClick={() => patch({ images: draft.images.filter((_, j) => j !== i) })} aria-label="Remove">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {uploading && (
                    <div className="flex aspect-square items-center justify-center rounded-xl border border-border bg-surface-2">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  )}
                  {draft.images.length < 5 && !uploading && (
                    <label
                      className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-muted transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        onFiles(e.dataTransfer.files);
                      }}
                    >
                      <ImagePlus className="h-6 w-6" />
                      <span className="text-[11px] font-semibold">{L('ছবি দিন', 'Add photo')}</span>
                      <input type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
                    </label>
                  )}
                </div>
              </Section>

              <Section title={L('প্রোডাক্টের তথ্য', 'Product details')}>
                <div>
                  <label className="label">{L('নাম', 'Name')}</label>
                  <input className="input" required minLength={2} placeholder={L('যেমন: কটন পোলো শার্ট', 'e.g. Cotton polo shirt')} value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
                </div>
                <div>
                  <label className="label">{L('বিবরণ', 'Description')}</label>
                  <textarea
                    className="input min-h-[96px]"
                    placeholder={L('কাপড়, মাপ, ওয়ারেন্টি, ব্যবহার... যা জানলে কাস্টমার কিনতে চাইবে। বট এটা দেখে উত্তর দেবে।', 'Material, size, warranty, usage... anything a customer would ask. The bot answers from this.')}
                    value={draft.description}
                    onChange={(e) => patch({ description: e.target.value })}
                  />
                </div>
              </Section>

              <Section title={L('দাম', 'Pricing')}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">{L('দাম (৳)', 'Price (৳)')}</label>
                    <input className="input" type="number" min={1} required value={draft.price} onChange={(e) => patch({ price: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">{L('সর্বনিম্ন দাম (৳)', 'Lowest price (৳)')}</label>
                    <input className="input" type="number" min={0} placeholder={L('ঐচ্ছিক', 'optional')} value={draft.minPrice} onChange={(e) => patch({ minPrice: e.target.value })} />
                  </div>
                </div>
                <p className="text-xs text-muted">{L('বট এর নিচে কখনো দাম কমাবে না, কাস্টমার এটা দেখবে না। এটা কাজ করার জন্য “বট সেটিংস”-এ “দরদাম করতে দিন” চালু থাকতে হবে।', 'The bot never goes below this, and customers never see it. “Allow bargaining” must be on in Bot settings for this to work.')}</p>
                {minP !== null && priceN > 0 && minP >= priceN && (
                  <p className="flex items-start gap-1.5 rounded-lg bg-signal/10 px-3 py-2 text-xs text-signal">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {L('সর্বনিম্ন দাম আসল দামের কম হতে হবে, নইলে এই প্রোডাক্টে ডিসকাউন্ট দেওয়া হবে না।', 'The lowest price must be below the price, otherwise no discount will be given on this product.')}
                  </p>
                )}
              </Section>

              <Section title={L('স্টক', 'Inventory')}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{L('স্টক হিসাব রাখুন', 'Track stock')}</p>
                    <p className="text-xs text-muted">{L('অর্ডার হলে স্টক নিজে কমবে, শেষ হলে বট আর বিক্রি করবে না।', 'Stock drops with each order and the bot stops selling at zero.')}</p>
                  </div>
                  <Switch on={draft.trackStock} onChange={(v) => patch({ trackStock: v })} />
                </div>
                {draft.trackStock && (
                  <div>
                    <label className="label">{L('বর্তমান স্টক', 'Current stock')}</label>
                    <input className="input" type="number" min={0} value={draft.stock} onChange={(e) => patch({ stock: e.target.value })} />
                  </div>
                )}
              </Section>

              <Section title={L('অপশন', 'Options')} hint={L('সাইজ, কালার ইত্যাদি। কাস্টমারকে এর মধ্য থেকেই বেছে নিতে হবে।', 'Size, color, etc. Customers must pick from these.')}>
                {draft.options.map((o, i) => (
                  <div key={i} className="rounded-xl bg-surface-2 p-3">
                    <div className="flex gap-2">
                      <input className="input !w-32" placeholder={L('নাম: Size', 'Name: Size')} value={o.name} onChange={(e) => patch({ options: draft.options.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                      <input className="input" placeholder="M, L, XL" value={o.values} onChange={(e) => patch({ options: draft.options.map((x, j) => (j === i ? { ...x, values: e.target.value } : x)) })} />
                      <button type="button" className="btn btn-ghost h-10 w-10 shrink-0 !p-0" onClick={() => patch({ options: draft.options.filter((_, j) => j !== i) })} aria-label="Remove option">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    {o.values.split(',').some((v) => v.trim()) && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {o.values
                          .split(',')
                          .map((v) => v.trim())
                          .filter(Boolean)
                          .map((v, k) => (
                            <span key={`${v}-${k}`} className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium">
                              {v}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                ))}
                {draft.options.length < 5 && (
                  <button type="button" className="btn btn-outline btn-sm gap-1.5" onClick={() => patch({ options: [...draft.options, { name: '', values: '' }] })}>
                    <Plus className="h-4 w-4" /> {L('অপশন যোগ', 'Add option')}
                  </button>
                )}
              </Section>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-4">
                <div>
                  <p className="text-sm font-bold">{L('বট এই প্রোডাক্ট দেখাবে', 'Visible to the bot')}</p>
                  <p className="text-xs text-muted">{L('বন্ধ করলে বট এটা কাস্টমারকে দেখাবে না ও বিক্রি করবে না।', 'When off, the bot will not show or sell this product.')}</p>
                </div>
                <Switch on={draft.active} onChange={(v) => patch({ active: v })} />
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-border px-5 py-4">
              {draft.id && (
                <button
                  type="button"
                  className="btn btn-ghost gap-1.5 text-danger"
                  onClick={() => {
                    const p = items?.find((x) => x.id === draft.id);
                    if (p) remove(p);
                  }}
                >
                  <Trash2 className="h-4 w-4" /> {L('ডিলিট', 'Delete')}
                </button>
              )}
              <div className="ml-auto flex gap-3">
                <button type="button" className="btn btn-outline" onClick={() => setDraft(null)}>
                  {L('বাতিল', 'Cancel')}
                </button>
                <button className="btn btn-primary min-w-28 gap-1.5" disabled={busy || uploading}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {busy ? L('সেভ হচ্ছে...', 'Saving...') : L('সেভ করুন', 'Save')}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}