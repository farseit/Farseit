'use client';

import clsx from 'clsx';
import { Check, Copy, MapPin, MessageCircle, Package, Phone, RefreshCw, Search, ShoppingBag, XCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ErrorBox } from '@/components/admin/ui';
import { useLang } from '@/context/lang';
import { gql } from '@/lib/api';
import { dateFmt, money, num } from '@/lib/format';

const STATUSES = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;
type Status = (typeof STATUSES)[number];
const FLOW: Status[] = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED'];
const NEXT: Partial<Record<Status, Status>> = { PENDING: 'CONFIRMED', CONFIRMED: 'SHIPPED', SHIPPED: 'DELIVERED' };

type Order = {
  id: string;
  number: number;
  customerName: string;
  phone: string;
  address: string;
  zone: string;
  note: string | null;
  subtotal: number;
  deliveryCharge: number;
  total: number;
  status: Status;
  createdAt: string;
  items: { id: string; name: string; option: string | null; price: number; qty: number }[];
};

const PAGE = 20;

const tone: Record<Status, string> = {
  PENDING: 'bg-signal/15 text-signal',
  CONFIRMED: 'bg-primary/10 text-primary',
  SHIPPED: 'bg-primary/10 text-primary',
  DELIVERED: 'bg-success/15 text-success',
  CANCELLED: 'bg-danger/10 text-danger',
};
const bar: Record<Status, string> = {
  PENDING: 'bg-signal',
  CONFIRMED: 'bg-primary',
  SHIPPED: 'bg-primary',
  DELIVERED: 'bg-success',
  CANCELLED: 'bg-danger',
};

function ago(iso: string, lang: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  const bn = lang === 'bn';
  if (m < 1) return bn ? 'এইমাত্র' : 'just now';
  if (m < 60) return bn ? `${m} মিনিট আগে` : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return bn ? `${h} ঘণ্টা আগে` : `${h}h ago`;
  const d = Math.floor(h / 24);
  return bn ? `${d} দিন আগে` : `${d}d ago`;
}

export default function ShopOrders() {
  const { lang } = useLang();
  const L = (bn: string, en: string) => (lang === 'bn' ? bn : en);
  const label: Record<Status, string> = {
    PENDING: L('পেন্ডিং', 'Pending'),
    CONFIRMED: L('কনফার্মড', 'Confirmed'),
    SHIPPED: L('শিপড', 'Shipped'),
    DELIVERED: L('ডেলিভার্ড', 'Delivered'),
    CANCELLED: L('বাতিল', 'Cancelled'),
  };
  const nextLabel: Partial<Record<Status, string>> = {
    CONFIRMED: L('অর্ডার কনফার্ম করুন', 'Confirm order'),
    SHIPPED: L('শিপড হিসেবে মার্ক করুন', 'Mark as shipped'),
    DELIVERED: L('ডেলিভার্ড হিসেবে মার্ক করুন', 'Mark as delivered'),
  };

  const [status, setStatus] = useState<Status | ''>('');
  const [items, setItems] = useState<Order[] | null>(null);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [spin, setSpin] = useState(false);

  const fetchPage = useCallback(
    (skip: number) =>
      gql<{ shopOrders: { items: Order[]; total: number } }>(
        `query($s:String,$take:Int,$skip:Int){ shopOrders(status:$s, take:$take, skip:$skip) }`,
        { s: status || null, take: PAGE, skip },
      ),
    [status],
  );

  const loadCounts = useCallback(() => {
    Promise.all(
      (['', ...STATUSES] as const).map((s) =>
        gql<{ shopOrders: { total: number } }>(`query($s:String){ shopOrders(status:$s, take:1, skip:0) }`, { s: s || null }).then((d) => [s, d.shopOrders.total] as const),
      ),
    )
      .then((rows) => setCounts(Object.fromEntries(rows)))
      .catch(() => undefined);
  }, []);

  const load = useCallback(() => {
    setItems(null);
    setError(null);
    setSpin(true);
    fetchPage(0)
      .then((d) => {
        setItems(d.shopOrders.items);
        setTotal(d.shopOrders.total);
      })
      .catch((e) => setError(e.message))
      .finally(() => setSpin(false));
  }, [fetchPage]);

  useEffect(load, [load]);
  useEffect(loadCounts, [loadCounts]);

  const more = async () => {
    if (!items) return;
    setLoadingMore(true);
    try {
      const d = await fetchPage(items.length);
      setItems([...items, ...d.shopOrders.items]);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoadingMore(false);
    }
  };

  const change = async (o: Order, next: Status) => {
    if (next === o.status || busy) return;
    setBusy(o.id);
    try {
      const r = await gql<{ shopSetOrderStatus: { notified?: string } }>(`mutation($id:String!,$s:String!){ shopSetOrderStatus(id:$id, status:$s) }`, { id: o.id, s: next });
      setItems((list) => list && (status ? list.filter((x) => x.id !== o.id) : list.map((x) => (x.id === o.id ? { ...x, status: next } : x))));
      loadCounts();
      const n = r.shopSetOrderStatus?.notified;
      if (n === 'SENT') toast.success(L('স্ট্যাটাস আপডেট হয়েছে, কাস্টমারকে Messenger-এ জানানো হয়েছে', 'Status updated, customer notified on Messenger'));
      else if (n === 'WINDOW_CLOSED')
        toast(L('স্ট্যাটাস আপডেট হয়েছে। কাস্টমারের শেষ মেসেজের ২৪ ঘণ্টা পার, তাই Messenger-এ জানানো যায়নি। ফোন করে জানান।', 'Status updated. The 24-hour window has passed, so Messenger could not notify the customer. Please call them.'), { duration: 6000 });
      else if (n === 'FAILED') toast(L('স্ট্যাটাস আপডেট হয়েছে, কিন্তু কাস্টমারকে মেসেজ পাঠানো যায়নি', 'Status updated, but the customer message could not be sent'), { duration: 5000 });
      else toast.success(L('স্ট্যাটাস আপডেট হয়েছে', 'Status updated'));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const cancel = (o: Order) => {
    if (confirm(L(`অর্ডার #${o.number} বাতিল করবেন? স্টক ফেরত যাবে।`, `Cancel order #${o.number}? Stock will be restored.`))) change(o, 'CANCELLED');
  };

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(
      () => toast.success(L('কপি হয়েছে', 'Copied')),
      () => toast.error(L('কপি করা যায়নি', 'Could not copy')),
    );
  };

  const shown = useMemo(() => {
    if (!items) return null;
    const t = q.trim().toLowerCase().replace(/^#/, '');
    if (!t) return items;
    return items.filter((o) => `${o.number} ${o.customerName} ${o.phone} ${o.address}`.toLowerCase().includes(t));
  }, [items, q]);

  const tabs = ['', ...STATUSES] as const;

  return (
    <div className="mx-auto max-w-5xl">
      {/* header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-semibold tracking-tight">{L('অর্ডার', 'Orders')}</h1>
          <p className="mt-0.5 text-sm text-muted">
            {L('স্ট্যাটাস বদলালে কাস্টমারকে Messenger-এ জানানো হয় (শেষ মেসেজের ২৪ ঘণ্টার মধ্যে)।', 'Customers get a Messenger update when you change the status (within 24h of their last message).')}
          </p>
        </div>
        <button
          className="btn btn-outline btn-sm gap-1.5"
          onClick={() => {
            load();
            loadCounts();
          }}
          disabled={spin}
        >
          <RefreshCw className={clsx('h-4 w-4', spin && 'animate-spin')} />
          {L('রিফ্রেশ', 'Refresh')}
        </button>
      </div>

      <ErrorBox message={error} />

      {/* tabs + search */}
      <div className="mb-4 space-y-3">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {tabs.map((s) => {
            const active = status === s;
            const c = counts[s];
            return (
              <button
                key={s || 'all'}
                onClick={() => setStatus(s)}
                className={clsx(
                  'flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors',
                  active ? 'border-primary bg-primary text-white shadow-sm' : 'border-border bg-white text-muted hover:border-primary/40 hover:text-primary',
                )}
              >
                {s ? label[s] : L('সব', 'All')}
                {c !== undefined && (
                  <span className={clsx('min-w-5 rounded-full px-1.5 text-center text-[11px] font-bold leading-5', active ? 'bg-white/25 text-white' : 'bg-surface-2 text-muted')}>{num(c, lang)}</span>
                )}
              </button>
            );
          })}
        </div>
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input !pl-9" placeholder={L('নাম, ফোন বা অর্ডার নম্বর খুঁজুন', 'Search name, phone or order #')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {/* list */}
      {shown === null && !error ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-56 animate-pulse rounded-xl bg-surface-2" />
          ))}
        </div>
      ) : shown && shown.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShoppingBag className="h-7 w-7" />
          </div>
          <p className="text-base font-bold">{q ? L('কোনো মিল পাওয়া যায়নি', 'No matching orders') : L('এখনো কোনো অর্ডার নেই', 'No orders yet')}</p>
          <p className="max-w-sm text-sm text-muted">
            {q
              ? L('অন্য নাম, ফোন বা নম্বর দিয়ে খুঁজুন। আরও অর্ডার লোড করলে সেগুলোতেও খোঁজা হবে।', 'Try another name, phone or number. Loading more orders will search them too.')
              : L('কাস্টমার Messenger-এ অর্ডার করলে এখানে দেখা যাবে।', 'Orders placed by customers on Messenger will show up here.')}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {shown?.map((o) => {
            const next = NEXT[o.status];
            const idx = FLOW.indexOf(o.status);
            const closed = o.status === 'DELIVERED' || o.status === 'CANCELLED';
            const isBusy = busy === o.id;
            return (
              <div key={o.id} className="card overflow-hidden">
                <div className="flex">
                  <div className={clsx('w-1.5 shrink-0', bar[o.status])} />
                  <div className="min-w-0 flex-1 p-4 sm:p-5">
                    {/* top row */}
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-display font-semibold text-primary">#{o.number}</div>
                        <div className="min-w-0">
                          <p className="truncate text-base font-display font-semibold">{o.customerName}</p>
                          <p className="text-xs text-muted" title={dateFmt(o.createdAt, lang, true)}>
                            {ago(o.createdAt, lang)} · {dateFmt(o.createdAt, lang, true)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold', tone[o.status])}>
                          <span className={clsx('h-1.5 w-1.5 rounded-full', bar[o.status])} />
                          {label[o.status]}
                        </span>
                        <p className="text-xl font-display font-semibold tracking-tight">{money(o.total, lang)}</p>
                      </div>
                    </div>

                    {/* progress */}
                    {o.status === 'CANCELLED' ? (
                      <div className="mt-4 flex items-center gap-2 rounded-xl bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">
                        <XCircle className="h-4 w-4" /> {L('এই অর্ডার বাতিল করা হয়েছে', 'This order was cancelled')}
                      </div>
                    ) : (
                      <div className="mt-5 flex items-start px-1">
                        {FLOW.map((s, i) => (
                          <div key={s} className={clsx('flex items-start', i < FLOW.length - 1 && 'flex-1')}>
                            <div className="flex w-14 flex-col items-center gap-1">
                              <div
                                className={clsx(
                                  'flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-bold transition-colors',
                                  i <= idx ? 'border-primary bg-primary text-white' : 'border-border bg-surface-2 text-muted',
                                )}
                              >
                                {i < idx || o.status === 'DELIVERED' ? <Check className="h-3.5 w-3.5" /> : i + 1}
                              </div>
                              <span className={clsx('text-center text-[10px] font-semibold leading-tight', i <= idx ? '' : 'text-muted')}>{label[s]}</span>
                            </div>
                            {i < FLOW.length - 1 && <div className={clsx('mt-3.5 h-0.5 flex-1 rounded', i < idx ? 'bg-primary' : 'bg-border')} />}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* details */}
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      {/* customer */}
                      <div className="rounded-xl border border-border p-3.5">
                        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">{L('কাস্টমার', 'Customer')}</p>
                        <a href={`tel:${o.phone}`} className="inline-flex items-center gap-2 text-sm font-bold text-primary">
                          <Phone className="h-4 w-4" /> {o.phone}
                        </a>
                        <div className="mt-2 flex items-start gap-2 text-sm">
                          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                          <div className="min-w-0">
                            <p className="break-words">{o.address}</p>
                            <span className="mt-1 inline-block rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-muted">
                              {o.zone === 'OUTSIDE' ? L('ঢাকার বাইরে', 'Outside area') : L('ঢাকার ভিতরে', 'Inside area')}
                            </span>
                          </div>
                        </div>
                        {o.note && (
                          <p className="mt-2 rounded-lg bg-signal/10 px-2.5 py-1.5 text-xs text-signal">
                            <b>{L('নোট', 'Note')}:</b> {o.note}
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <a href={`tel:${o.phone}`} className="btn btn-outline btn-sm gap-1.5">
                            <Phone className="h-3.5 w-3.5" /> {L('কল', 'Call')}
                          </a>
                          <a href={`https://wa.me/${o.phone.replace(/^0/, '880')}`} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm gap-1.5">
                            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                          </a>
                          <button className="btn btn-outline btn-sm gap-1.5" onClick={() => copy(`${o.customerName}\n${o.phone}\n${o.address}`)}>
                            <Copy className="h-3.5 w-3.5" /> {L('কপি', 'Copy')}
                          </button>
                        </div>
                      </div>

                      {/* items */}
                      <div className="rounded-xl border border-border p-3.5">
                        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">{L('প্রোডাক্ট', 'Items')}</p>
                        <ul className="space-y-2">
                          {o.items.map((i) => (
                            <li key={i.id} className="flex items-start justify-between gap-3 text-sm">
                              <div className="flex min-w-0 items-start gap-2">
                                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted">
                                  <Package className="h-3.5 w-3.5" />
                                </div>
                                <div className="min-w-0">
                                  <p className="break-words font-semibold leading-snug">{i.name}</p>
                                  <p className="text-xs text-muted">
                                    {i.option ? `${i.option} · ` : ''}
                                    {money(i.price, lang)} × {i.qty}
                                  </p>
                                </div>
                              </div>
                              <span className="shrink-0 font-bold">{money(i.price * i.qty, lang)}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
                          <div className="flex justify-between text-muted">
                            <span>{L('সাবটোটাল', 'Subtotal')}</span>
                            <span>{money(o.subtotal, lang)}</span>
                          </div>
                          <div className="flex justify-between text-muted">
                            <span>{L('ডেলিভারি', 'Delivery')}</span>
                            <span>{money(o.deliveryCharge, lang)}</span>
                          </div>
                          <div className="flex justify-between pt-1 text-base font-display font-semibold">
                            <span>{L('মোট', 'Total')}</span>
                            <span>{money(o.total, lang)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* actions */}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {next && (
                          <button className="btn btn-primary btn-sm gap-1.5" disabled={isBusy} onClick={() => change(o, next)}>
                            {isBusy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            {nextLabel[next]}
                          </button>
                        )}
                        {!closed && (
                          <button className="btn btn-outline btn-sm text-danger" disabled={isBusy} onClick={() => cancel(o)}>
                            {L('বাতিল করুন', 'Cancel order')}
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-muted">{L('স্ট্যাটাস', 'Status')}</label>
                        <select className="input !w-auto !py-1.5 text-sm" value={o.status} disabled={isBusy} onChange={(e) => change(o, e.target.value as Status)}>
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {label[s]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {items && items.length < total && (
            <button className="btn btn-outline w-full" onClick={more} disabled={loadingMore}>
              {loadingMore ? L('লোড হচ্ছে...', 'Loading...') : `${L('আরও দেখুন', 'Load more')} (${num(total - items.length, lang)})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}