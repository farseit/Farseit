'use client';

import clsx from 'clsx';
import { AlertTriangle, Copy, ExternalLink, EyeOff, ImagePlus, Link2, Loader2, Package, Pencil, Plus, Search, Star, Trash2, X } from 'lucide-react';
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
    return items.filter((p) => {
      if (filter === 'ACTIVE' && !p.active) return false;
      if (filter === 'HIDDEN' && p.active) return false;
      if (filter === 'LOW' && stockState(p) !== 'LOW') return false;
      if (filter === 'OUT' && stockState(p) !== 'OUT') return false;
      if (!t) return true;
      return `${p.name} ${p.description || ''}`.toLowerCase().includes(t);
    });
  }, [items, q, filter]);

  const filters: { id: Filter; label: string; n: number }[] = [
    { id: 'ALL', label: L('সব', 'All'), n: stats.total },
    { id: 'ACTIVE', label: L('চালু', 'Active'), n: stats.active },
    { id: 'HIDDEN', label: L('লুকানো', 'Hidden'), n: stats.hidden },
    { id: 'LOW', label: L('স্টক কম', 'Low stock'), n: stats.low },
    { id: 'OUT', label: L('স্টক শেষ', 'Out of stock'), n: stats.out },
  ];

  const statCard = (label: string, value: number, tone?: string) => (
    <div className="card p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={clsx('mt-1 text-2xl font-extrabold', tone)}>{num(value, lang)}</p>
    </div>
  );

  const minP = draft && draft.minPrice.trim() !== '' ? Number(draft.minPrice) : null;
  const priceN = draft ? Number(draft.price) : 0;

  return (
    <div className="mx-auto max-w-6xl">
      {/* header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{L('প্রোডাক্ট', 'Products')}</h1>
          <p className="mt-0.5 text-sm text-muted">{L('বট শুধু এখানে যোগ করা প্রোডাক্টই বিক্রি করবে।', 'The bot only sells the products you add here.')}</p>
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

      {/* stats */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCard(L('মোট প্রোডাক্ট', 'Total products'), stats.total)}
        {statCard(L('বট দেখাচ্ছে', 'Visible to bot'), stats.active, 'text-success')}
        {statCard(L('লুকানো', 'Hidden'), stats.hidden)}
        {statCard(L('স্টক নিয়ে সতর্কতা', 'Stock alerts'), stats.low + stats.out, stats.low + stats.out > 0 ? 'text-danger' : undefined)}
      </div>

      {/* toolbar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={clsx(
                'flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors',
                filter === f.id ? 'border-primary bg-primary text-white shadow-sm' : 'border-border bg-surface-2 text-muted hover:border-primary/40 hover:text-primary',
              )}
            >
              {f.label}
              <span className={clsx('min-w-5 rounded-full px-1.5 text-center text-[11px] font-bold leading-5', filter === f.id ? 'bg-white/25 text-white' : 'bg-border/60')}>{num(f.n, lang)}</span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input !pl-9" placeholder={L('প্রোডাক্ট খুঁজুন', 'Search products')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {/* grid */}
      {shown === null && !error ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-80 animate-pulse rounded-2xl bg-surface-2" />
          ))}
        </div>
      ) : shown && shown.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Package className="h-8 w-8" />
          </div>
          <p className="text-base font-bold">{items && items.length ? L('কোনো প্রোডাক্ট মেলেনি', 'No products match') : L('এখনো কোনো প্রোডাক্ট নেই', 'No products yet')}</p>
          <p className="max-w-sm text-sm text-muted">
            {items && items.length ? L('ফিল্টার বা সার্চ বদলে দেখুন।', 'Try another filter or search.') : L('আপনার প্রথম প্রোডাক্ট যোগ করুন, তারপর বট চালু করলে সে নিজে কাস্টমারকে দেখাবে ও অর্ডার নেবে।', 'Add your first product, then turn the bot on and it will show it to customers and take orders.')}
          </p>
          {!(items && items.length) && (
            <button className="btn btn-primary mt-1 gap-1.5" onClick={() => setDraft({ ...empty })}>
              <Plus className="h-4 w-4" /> {L('প্রোডাক্ট যোগ করুন', 'Add product')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown?.map((p) => {
            const st = stockState(p);
            const hasMin = p.minPrice != null && p.minPrice < p.price;
            return (
              <div key={p.id} className={clsx('card group flex flex-col overflow-hidden transition-shadow hover:shadow-md', !p.active && 'opacity-80')}>
                <button
                  type="button"
                  className="relative block aspect-[4/3] w-full overflow-hidden bg-surface-2"
                  onClick={() => {
                    setError(null);
                    setDraft(toDraft(p));
                  }}
                  aria-label="Edit"
                >
                  {p.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.images[0]} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted">
                      <Package className="h-10 w-10" />
                    </div>
                  )}
                  {!p.active && (
                    <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-bold text-white">
                      <EyeOff className="h-3 w-3" /> {L('লুকানো', 'Hidden')}
                    </span>
                  )}
                  {p.images.length > 1 && <span className="absolute right-3 top-3 rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-bold text-white">{p.images.length} {L('ছবি', 'photos')}</span>}
                  {st === 'OUT' && <span className="absolute bottom-3 left-3 rounded-full bg-danger px-2.5 py-1 text-[11px] font-bold text-white">{L('স্টক শেষ', 'Out of stock')}</span>}
                  {st === 'LOW' && <span className="absolute bottom-3 left-3 rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-white">{L(`মাত্র ${p.stock}টি বাকি`, `Only ${p.stock} left`)}</span>}
                </button>

                <div className="flex flex-1 flex-col p-4">
                  <p className="truncate text-base font-bold" title={p.name}>
                    {p.name}
                  </p>
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
                    <span className="text-xl font-extrabold tracking-tight">{money(p.price, lang)}</span>
                    {hasMin && (
                      <span className="text-xs text-muted">
                        {L('সর্বনিম্ন', 'Lowest')} {money(p.minPrice as number, lang)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted">{p.trackStock ? `${L('স্টক', 'Stock')}: ${num(p.stock, lang)}` : L('স্টক হিসাব বন্ধ', 'Stock not tracked')}</p>

                  {p.options && p.options.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {p.options.slice(0, 3).map((o) => (
                        <span key={o.name} className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-medium text-muted">
                          {o.name}: {o.values.slice(0, 4).join(', ')}
                          {o.values.length > 4 ? '…' : ''}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3.5" style={{ marginTop: 14 }}>
                    <label className="flex items-center gap-2 text-xs font-semibold text-muted">
                      <Switch on={p.active} onChange={() => toggleActive(p)} disabled={busyId === p.id} />
                      {p.active ? L('বট দেখাচ্ছে', 'Visible') : L('লুকানো', 'Hidden')}
                    </label>
                    <div className="flex items-center">
                      {p.code && (
                        <>
                          <button
                            className="btn btn-ghost h-8 w-8 !p-0"
                            aria-label="Copy landing page link"
                            title={L('ল্যান্ডিং পেজের লিংক কপি করুন', 'Copy landing page link')}
                            onClick={() => {
                              const url = `${window.location.origin}/p/${p.code}`;
                              navigator.clipboard.writeText(url).then(
                                () => toast.success(L('লিংক কপি হয়েছে', 'Link copied')),
                                () => toast.error(url),
                              );
                            }}
                          >
                            <Link2 className="h-4 w-4" />
                          </button>
                          <a className="btn btn-ghost h-8 w-8 !p-0" href={`/p/${p.code}`} target="_blank" rel="noopener noreferrer" aria-label="Open landing page" title={L('ল্যান্ডিং পেজ দেখুন', 'Open landing page')}>
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </>
                      )}
                      <button className="btn btn-ghost h-8 w-8 !p-0" onClick={() => duplicate(p)} aria-label="Duplicate" title={L('কপি করুন', 'Duplicate')}>
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        className="btn btn-ghost h-8 w-8 !p-0"
                        onClick={() => {
                          setError(null);
                          setDraft(toDraft(p));
                        }}
                        aria-label="Edit"
                        title={L('এডিট', 'Edit')}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button className="btn btn-ghost h-8 w-8 !p-0 text-danger" onClick={() => remove(p)} aria-label="Delete" title={L('ডিলিট', 'Delete')}>
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

      {/* ====================== editor drawer ====================== */}
      {draft && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onMouseDown={(e) => e.target === e.currentTarget && setDraft(null)}>
          <form onSubmit={save} className="card flex h-full w-full max-w-xl flex-col !rounded-none sm:!rounded-l-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-lg font-extrabold">{draft.id ? L('প্রোডাক্ট এডিট', 'Edit product') : L('নতুন প্রোডাক্ট', 'New product')}</h2>
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
                  <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
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