'use client';

import clsx from 'clsx';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ErrorBox, PageHeader } from '@/components/admin/ui';
import { useLang } from '@/context/lang';
import { gql } from '@/lib/api';
import { dateFmt, money, num } from '@/lib/format';

type Overview = {
  total: number;
  paid: number;
  trial: number;
  expired: number;
  suspended: number;
  mrr: number;
  pendingPayments: number;
  botOn: number;
  noPage: number;
  expiringSoon: number;
  signups: { today: number; week: number; month: number };
  daily: { date: string; count: number }[];
  revenue: number;
  revenueMonth: number;
  repliesMonth: number;
  tokens: { in: number; out: number };
};
type Owner = { name: string; phone: string } | null;
type ShopRow = {
  id: string;
  name: string;
  status: 'TRIAL' | 'ACTIVE' | 'SUSPENDED';
  approved: boolean;
  plan: string;
  botEnabled: boolean;
  createdAt: string;
  owner: { name: string; phone: string; email: string | null } | null;
  pages: { pageId: string; name: string | null; status: string }[];
  counts: { pages: number; orders: number; products: number; chats: number };
  access: { reason: string | null; used: number; limit: number; daysLeft: number | null; planName: string };
  tokens: { in: number; out: number };
  lastChatAt: string | null;
  totalPaid: number;
};
type PaymentRow = {
  id: string;
  plan: string;
  months: number;
  amount: number;
  method: string;
  senderNumber: string;
  trxId: string;
  status: string;
  note: string | null;
  createdAt: string;
  shop: { name: string; members: { user: Owner }[] };
};
type Detail = {
  shop: { id: string; name: string; status: string; plan: string; botEnabled: boolean; createdAt: string; trialEndsAt: string | null; planEndsAt: string | null };
  members: { role: string; user: { name: string; phone: string; email: string | null; createdAt: string } }[];
  pages: { pageId: string; name: string | null; status: string; createdAt: string }[];
  bot: { botName: string; tone: string; bargainEnabled: boolean; deliveryInside: number; deliveryOutside: number } | null;
  stats: { orders: number; sales: number; products: number; chats: number; messages: number };
  tokens: { in: number; out: number };
  orders: { id: string; number: number; customerName: string; total: number; status: string; createdAt: string }[];
  chats: { id: string; name: string | null; lastText: string | null; lastFrom: string | null; lastMessageAt: string; unread: number }[];
  payments: { id: string; plan: string; months: number; amount: number; status: string; method: string; trxId: string; createdAt: string }[];
};

const PLAN_IDS = ['TRIAL', 'STARTER', 'PRO', 'BUSINESS'];

function ago(iso: string | null | undefined, lang: string) {
  if (!iso) return '–';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  const bn = lang === 'bn';
  if (m < 1) return bn ? 'এইমাত্র' : 'just now';
  if (m < 60) return bn ? `${m} মিনিট আগে` : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return bn ? `${h} ঘণ্টা আগে` : `${h}h ago`;
  const d = Math.floor(h / 24);
  return bn ? `${d} দিন আগে` : `${d}d ago`;
}

function SaasInner() {
  const { lang } = useLang();
  const L = (bn: string, en: string) => (lang === 'bn' ? bn : en);
  const router = useRouter();
  const sp = useSearchParams();
  const tab = sp.get('tab') === 'payments' ? 'payments' : 'shops';

  const [ov, setOv] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadOv = useCallback(() => {
    gql<{ saasOverview: Overview }>(`query { saasOverview }`)
      .then((d) => {
        const o: any = d.saasOverview || {};
        setOv({
          ...o,
          signups: o.signups || { today: 0, week: 0, month: 0 },
          daily: o.daily || [],
          tokens: o.tokens || { in: 0, out: 0 },
          revenue: o.revenue || 0,
          revenueMonth: o.revenueMonth || 0,
          repliesMonth: o.repliesMonth || 0,
        });
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(loadOv, [loadOv]);

  const card = (label: string, v: string | number | undefined, hint?: string) => (
    <div className="card p-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-2xl font-display font-semibold">{v ?? '–'}</p>
      {hint && <p className="text-[11px] text-muted">{hint}</p>}
    </div>
  );

  const daily = ov?.daily || [];
  const maxDaily = Math.max(1, ...daily.map((d) => d.count));

  return (
    <div>
      <PageHeader title={L('SaaS শপ', 'SaaS shops')} />
      <ErrorBox message={error} />

      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {card(L('মোট শপ', 'Shops'), ov?.total)}
        {card(L('পেইড', 'Paid'), ov?.paid)}
        {card(L('ট্রায়াল', 'Trial'), ov?.trial)}
        {card(L('মেয়াদ শেষ', 'Expired'), ov?.expired)}
        {card(L('সাসপেন্ড', 'Suspended'), ov?.suspended)}
        {card('MRR', ov ? money(ov.mrr, lang) : undefined)}
        {card(L('পেন্ডিং পেমেন্ট', 'Pending pay'), ov?.pendingPayments)}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {card(L('আজ সাইনআপ', 'Signups today'), ov?.signups.today)}
        {card(L('৭ দিনে', 'Last 7 days'), ov?.signups.week)}
        {card(L('৩০ দিনে', 'Last 30 days'), ov?.signups.month)}
        {card(L('মোট আয়', 'Total revenue'), ov ? money(ov.revenue, lang) : undefined)}
        {card(L('এই মাসের আয়', 'Revenue this month'), ov ? money(ov.revenueMonth, lang) : undefined)}
        {card(L('এই মাসের AI রিপ্লাই', 'AI replies (month)'), ov ? num(ov.repliesMonth, lang) : undefined, ov ? `${num(ov.tokens.in, lang)} in / ${num(ov.tokens.out, lang)} out` : undefined)}
        {card(L('বট চালু', 'Bot on'), ov?.botOn)}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {card(L('শিগগির মেয়াদ শেষ', 'Expiring soon'), ov?.expiringSoon, L('ট্রায়াল ৩ দিন / পেইড ৭ দিনের মধ্যে', 'trial 3d / paid 7d'))}
        {card(L('পেজ কানেক্ট করেনি', 'No Page connected'), ov?.noPage, L('সাইনআপ করেছে কিন্তু আটকে আছে', 'signed up but stuck'))}
      </div>

      <div className="card mb-5 p-4">
        <p className="mb-3 text-sm font-bold">{L('গত ১৪ দিনের সাইনআপ', 'Signups, last 14 days')}</p>
        <div className="flex items-end gap-1.5">
          {daily.map((d) => (
            <div key={d.date} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${d.date}: ${d.count}`}>
              <span className="text-[10px] font-semibold text-muted">{d.count || ''}</span>
              <div className="w-full rounded-t bg-primary/80" style={{ height: `${Math.max(3, Math.round((d.count / maxDaily) * 64))}px` }} />
              <span className="text-[9px] text-muted">{d.date.slice(8)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        {(['shops', 'payments'] as const).map((t) => (
          <button key={t} onClick={() => router.replace(`/admin/saas?tab=${t}`)} className={clsx('btn btn-sm', tab === t ? 'btn-primary' : 'btn-outline')}>
            {t === 'payments' ? L('পেমেন্ট', 'Payments') : L('শপ / সাইনআপ', 'Shops / signups')}
            {t === 'payments' && !!ov?.pendingPayments && <span className="badge bg-danger text-white">{ov.pendingPayments}</span>}
          </button>
        ))}
      </div>

      {tab === 'payments' ? <Payments onChange={loadOv} /> : <Shops onChange={loadOv} />}
    </div>
  );
}

// ------------------------------------------------------------ payments
function Payments({ onChange }: { onChange: () => void }) {
  const { lang } = useLang();
  const L = (bn: string, en: string) => (lang === 'bn' ? bn : en);
  const [status, setStatus] = useState('PENDING');
  const [rows, setRows] = useState<PaymentRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setRows(null);
    gql<{ saasPayments: PaymentRow[] }>(`query($s:String){ saasPayments(status:$s) }`, { s: status || null })
      .then((d) => setRows(d.saasPayments))
      .catch((e) => toast.error(e.message));
  }, [status]);
  useEffect(load, [load]);

  const approve = async (p: PaymentRow) => {
    if (!confirm(L(`${p.shop.name}: ৳${p.amount} পেয়েছেন? প্ল্যান চালু করবেন?`, `${p.shop.name}: did you receive ৳${p.amount}? Activate the plan?`))) return;
    setBusy(p.id);
    try {
      await gql(`mutation($id:String!){ saasApprovePayment(id:$id) }`, { id: p.id });
      toast.success(L('প্ল্যান চালু হয়েছে', 'Plan activated'));
      load();
      onChange();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const reject = async (p: PaymentRow) => {
    const note = window.prompt(L('বাতিলের কারণ (শপ মালিক দেখবে):', 'Reason (the shop owner will see it):'), L('TrxID মেলেনি', 'TrxID did not match'));
    if (note === null) return;
    setBusy(p.id);
    try {
      await gql(`mutation($id:String!,$n:String){ saasRejectPayment(id:$id, note:$n) }`, { id: p.id, n: note });
      load();
      onChange();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <select className="input mb-3 !w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="PENDING">{L('পেন্ডিং', 'Pending')}</option>
        <option value="APPROVED">{L('অনুমোদিত', 'Approved')}</option>
        <option value="REJECTED">{L('বাতিল', 'Rejected')}</option>
        <option value="">{L('সব', 'All')}</option>
      </select>
      {rows === null ? (
        <p className="text-sm text-muted">{L('লোড হচ্ছে...', 'Loading...')}</p>
      ) : rows.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">{L('কোনো পেমেন্ট নেই।', 'No payments.')}</div>
      ) : (
        <div className="space-y-3">
          {rows.map((p) => {
            const o = p.shop.members[0]?.user;
            return (
              <div key={p.id} className="card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-display font-semibold">{p.shop.name}</p>
                  <span className="badge bg-surface-2">{p.status}</span>
                </div>
                {o && (
                  <p className="text-sm text-muted">
                    {o.name} · <a className="text-primary" href={`tel:${o.phone}`}>{o.phone}</a>
                  </p>
                )}
                <p className="mt-2 text-sm">
                  <b>{p.plan}</b> × {p.months} {L('মাস', 'mo')} = <b>{money(p.amount, lang)}</b>
                </p>
                <p className="text-sm">
                  {p.method} · {L('প্রেরক', 'From')}: <b>{p.senderNumber}</b> · TrxID: <b>{p.trxId}</b>
                </p>
                <p className="text-xs text-muted">{dateFmt(p.createdAt, lang, true)}</p>
                {p.note && <p className="text-xs text-danger">{p.note}</p>}
                {p.status === 'PENDING' && (
                  <div className="mt-3 flex gap-2">
                    <button className="btn btn-primary btn-sm" disabled={busy === p.id} onClick={() => approve(p)}>
                      {L('অনুমোদন', 'Approve')}
                    </button>
                    <button className="btn btn-outline btn-sm text-danger" disabled={busy === p.id} onClick={() => reject(p)}>
                      {L('বাতিল', 'Reject')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------ shop details
function ShopDetail({ id }: { id: string }) {
  const { lang } = useLang();
  const L = (bn: string, en: string) => (lang === 'bn' ? bn : en);
  const [d, setD] = useState<Detail | null>(null);

  useEffect(() => {
    gql<{ saasShop: Detail }>(`query($id:String!){ saasShop(id:$id) }`, { id })
      .then((r) => setD(r.saasShop))
      .catch((e) => toast.error(e.message));
  }, [id]);

  if (!d) return <p className="mt-3 text-sm text-muted">{L('লোড হচ্ছে...', 'Loading...')}</p>;

  const sec = 'mb-1 mt-3 text-xs font-bold uppercase tracking-wide text-muted';
  return (
    <div className="mt-3 rounded-xl bg-surface-2 p-3 text-sm">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-5">
        <span>{L('মোট অর্ডার', 'Orders')}: <b>{d.stats.orders}</b></span>
        <span>{L('মোট বিক্রি', 'Sales')}: <b>{money(d.stats.sales, lang)}</b></span>
        <span>{L('প্রোডাক্ট', 'Products')}: <b>{d.stats.products}</b></span>
        <span>{L('চ্যাট', 'Chats')}: <b>{d.stats.chats}</b></span>
        <span>{L('মেসেজ', 'Messages')}: <b>{num(d.stats.messages, lang)}</b></span>
      </div>
      <p className="mt-1 text-xs text-muted">
        {L('সব সময়ের টোকেন', 'All-time tokens')}: {num(d.tokens.in, lang)} in / {num(d.tokens.out, lang)} out
      </p>

      <p className={sec}>{L('মালিক / মেম্বার', 'Owner / members')}</p>
      {d.members.map((m, i) => (
        <p key={i}>
          <b>{m.user.name}</b> ({m.role}) · <a className="text-primary" href={`tel:${m.user.phone}`}>{m.user.phone}</a>
          {m.user.email ? ` · ${m.user.email}` : ''} · {L('জয়েন', 'joined')} {dateFmt(m.user.createdAt, lang)}
        </p>
      ))}

      <p className={sec}>{L('ফেসবুক পেজ', 'Facebook Pages')}</p>
      {d.pages.length === 0 ? (
        <p className="text-muted">{L('কোনো পেজ কানেক্ট করেনি', 'No Page connected')}</p>
      ) : (
        d.pages.map((p) => (
          <p key={p.pageId}>
            <a className="text-primary" href={`https://facebook.com/${p.pageId}`} target="_blank" rel="noreferrer">{p.name || p.pageId}</a>{' '}
            <span className={clsx('badge', p.status === 'ACTIVE' ? 'bg-primary/10 text-primary' : 'bg-danger/10 text-danger')}>{p.status}</span>{' '}
            <span className="text-xs text-muted">{dateFmt(p.createdAt, lang)}</span>
          </p>
        ))
      )}

      <p className={sec}>{L('বট সেটিংস', 'Bot settings')}</p>
      {d.bot ? (
        <p>
          {d.bot.botName} · {d.bot.tone} · {L('দর কষাকষি', 'Bargain')}: {d.bot.bargainEnabled ? L('চালু', 'on') : L('বন্ধ', 'off')} · {L('ডেলিভারি', 'Delivery')}: ৳{d.bot.deliveryInside} / ৳{d.bot.deliveryOutside}
        </p>
      ) : (
        <p className="text-muted">{L('এখনো সেট করেনি', 'Not set yet')}</p>
      )}

      <p className={sec}>{L('সাম্প্রতিক অর্ডার', 'Recent orders')}</p>
      {d.orders.length === 0 ? (
        <p className="text-muted">–</p>
      ) : (
        d.orders.map((o) => (
          <p key={o.id}>
            #{o.number} · {o.customerName} · <b>{money(o.total, lang)}</b> · <span className="badge bg-surface">{o.status}</span> · <span className="text-xs text-muted">{ago(o.createdAt, lang)}</span>
          </p>
        ))
      )}

      <p className={sec}>{L('সাম্প্রতিক চ্যাট', 'Recent chats')}</p>
      {d.chats.length === 0 ? (
        <p className="text-muted">–</p>
      ) : (
        d.chats.map((c) => (
          <p key={c.id} className="truncate">
            <b>{c.name || L('কাস্টমার', 'Customer')}</b>
            {c.unread > 0 && <span className="badge ml-1 bg-danger text-white">{c.unread}</span>}: {c.lastText || '–'} <span className="text-xs text-muted">· {ago(c.lastMessageAt, lang)}</span>
          </p>
        ))
      )}

      <p className={sec}>{L('পেমেন্ট ইতিহাস', 'Payment history')}</p>
      {d.payments.length === 0 ? (
        <p className="text-muted">–</p>
      ) : (
        d.payments.map((p) => (
          <p key={p.id}>
            {p.plan} × {p.months} {L('মাস', 'mo')} · <b>{money(p.amount, lang)}</b> · {p.method} · {p.trxId} · <span className="badge bg-surface">{p.status}</span> · <span className="text-xs text-muted">{dateFmt(p.createdAt, lang)}</span>
          </p>
        ))
      )}
    </div>
  );
}

// ------------------------------------------------------------ shops
const FILTERS: { id: string; bn: string; en: string }[] = [
  { id: '', bn: 'সব', en: 'All' },
  { id: 'PENDING', bn: 'অনুমোদন বাকি', en: 'Pending approval' },
  { id: 'TRIAL', bn: 'ট্রায়াল', en: 'Trial' },
  { id: 'PAID', bn: 'পেইড', en: 'Paid' },
  { id: 'EXPIRED', bn: 'মেয়াদ শেষ', en: 'Expired' },
  { id: 'SUSPENDED', bn: 'সাসপেন্ড', en: 'Suspended' },
  { id: 'NOPAGE', bn: 'পেজ নেই', en: 'No Page' },
  { id: 'BOT_ON', bn: 'বট চালু', en: 'Bot on' },
];

function Shops({ onChange }: { onChange: () => void }) {
  const { lang } = useLang();
  const L = (bn: string, en: string) => (lang === 'bn' ? bn : en);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('');
  const [rows, setRows] = useState<ShopRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [edit, setEdit] = useState<{ id: string; status: string; plan: string; extendDays: string; botEnabled: boolean } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    gql<{ saasShops: { items: ShopRow[]; total: number } }>(`query($q:String,$f:String){ saasShops(search:$q, filter:$f, take:50) }`, { q: q || null, f: filter || null })
      .then((d) => {
        setRows(
          d.saasShops.items.map((s: any) => ({
            ...s,
            pages: s.pages || [],
            tokens: s.tokens || { in: 0, out: 0 },
            totalPaid: s.totalPaid || 0,
            counts: s.counts || { pages: 0, orders: 0, products: 0, chats: 0 },
          })),
        );
        setTotal(d.saasShops.total);
      })
      .catch((e) => toast.error(e.message));
  }, [q, filter]);
  useEffect(() => {
    const id = setTimeout(load, 300); // search-e protibar ekbar
    return () => clearTimeout(id);
  }, [load]);

  const save = async () => {
    if (!edit) return;
    setBusy(true);
    try {
      const input: any = { status: edit.status, plan: edit.plan, botEnabled: edit.botEnabled };
      if (edit.extendDays.trim()) input.extendDays = Number(edit.extendDays);
      await gql(`mutation($id:String!,$i:JSON!){ saasSetShop(id:$id, input:$i) }`, { id: edit.id, i: input });
      toast.success(L('আপডেট হয়েছে', 'Updated'));
      setEdit(null);
      load();
      onChange();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const approve = async (id: string) => {
    setBusy(true);
    try {
      await gql(`mutation($id:String!,$i:JSON!){ saasSetShop(id:$id, input:$i) }`, { id, i: { approved: true } });
      toast.success(L('অনুমোদন হয়েছে', 'Approved'));
      load();
      onChange();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const reasonLabel = (r: string | null) => (r === 'EXPIRED' ? L('মেয়াদ শেষ', 'Expired') : r === 'LIMIT' ? L('লিমিট শেষ', 'Limit reached') : r === 'SUSPENDED' ? L('সাসপেন্ড', 'Suspended') : null);

  return (
    <div>
      <input className="input mb-3 max-w-sm" placeholder={L('শপ / নাম / ফোন / ইমেইল খুঁজুন', 'Search shop / name / phone / email')} value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mb-3 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)} className={clsx('btn btn-sm', filter === f.id ? 'btn-primary' : 'btn-outline')}>
            {L(f.bn, f.en)}
          </button>
        ))}
      </div>
      {rows === null ? (
        <p className="text-sm text-muted">{L('লোড হচ্ছে...', 'Loading...')}</p>
      ) : rows.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">{L('কোনো শপ নেই।', 'No shops.')}</div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted">{num(total, lang)} {L('টি শপ', 'shops')}</p>
          {rows.map((s) => {
            const r = reasonLabel(s.access.reason);
            const pct = s.access.limit ? Math.min(100, Math.round((s.access.used / s.access.limit) * 100)) : 0;
            return (
              <div key={s.id} className="card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-display font-semibold">{s.name}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="badge bg-primary/10 text-primary">{s.access.planName}</span>
                    {r && <span className="badge bg-danger/10 text-danger">{r}</span>}
                    {s.counts.pages === 0 && <span className="badge bg-signal/15 text-signal">{L('পেজ নেই', 'No Page')}</span>}
                    {!s.botEnabled && <span className="badge bg-surface-2">{L('বট অফ', 'Bot off')}</span>}
                    {!s.approved && <span className="badge bg-signal/15 text-signal">{L('অনুমোদন বাকি', 'Pending approval')}</span>}
                  </div>
                </div>

                {s.owner && (
                  <p className="text-sm text-muted">
                    {s.owner.name} · <a className="text-primary" href={`tel:${s.owner.phone}`}>{s.owner.phone}</a>
                    {s.owner.email ? ` · ${s.owner.email}` : ''}
                  </p>
                )}
                <p className="text-xs text-muted">
                  {L('সাইনআপ', 'Signed up')}: {dateFmt(s.createdAt, lang, true)} ({ago(s.createdAt, lang)})
                </p>

                {s.pages.length > 0 && (
                  <p className="mt-1 text-sm">
                    {s.pages.map((p) => (
                      <span key={p.pageId} className="mr-2 inline-block">
                        <a className="text-primary" href={`https://facebook.com/${p.pageId}`} target="_blank" rel="noreferrer">{p.name || p.pageId}</a>
                        {p.status !== 'ACTIVE' && <span className="badge ml-1 bg-danger/10 text-danger">{p.status}</span>}
                      </span>
                    ))}
                  </p>
                )}

                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                  <span>{L('রিপ্লাই', 'Replies')}: <b>{s.access.used}/{s.access.limit}</b></span>
                  <span>{L('বাকি', 'Days left')}: <b>{s.access.daysLeft ?? '∞'}</b></span>
                  <span>{L('অর্ডার', 'Orders')}: <b>{s.counts.orders}</b></span>
                  <span>{L('প্রোডাক্ট', 'Products')}: <b>{s.counts.products}</b></span>
                  <span>{L('পেজ', 'Pages')}: <b>{s.counts.pages}</b></span>
                  <span>{L('চ্যাট', 'Chats')}: <b>{s.counts.chats}</b></span>
                  <span>{L('শেষ চ্যাট', 'Last chat')}: <b>{ago(s.lastChatAt, lang)}</b></span>
                  <span>{L('এ পর্যন্ত দিয়েছে', 'Paid so far')}: <b>{money(s.totalPaid, lang)}</b></span>
                  <span className="col-span-2">{L('এই মাসের টোকেন', 'Tokens this month')}: <b>{num(s.tokens.in, lang)} in / {num(s.tokens.out, lang)} out</b></span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <div className={clsx('h-full rounded-full', pct >= 90 ? 'bg-danger' : 'bg-primary')} style={{ width: `${pct}%` }} />
                </div>

                {!s.approved && (
                  <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-signal/30 bg-signal/10 p-3 text-sm">
                    <span className="min-w-0 flex-1 text-signal">
                      {L('এই শপ এখনো অনুমোদিত না। ফোনে কথা বলে কনফার্ম করুন।', 'This shop is not approved yet. Confirm by phone first.')}
                    </span>
                    <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => approve(s.id)}>
                      {L('অনুমোদন দিন', 'Approve')}
                    </button>
                  </div>
                )}

                {open === s.id && <ShopDetail id={s.id} />}

                {edit?.id === s.id ? (
                  <div className="mt-3 grid gap-3 rounded-xl bg-surface-2 p-3 sm:grid-cols-4">
                    <div>
                      <label className="label">{L('স্ট্যাটাস', 'Status')}</label>
                      <select className="input" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
                        {['TRIAL', 'ACTIVE', 'SUSPENDED'].map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">{L('প্ল্যান', 'Plan')}</label>
                      <select className="input" value={edit.plan} onChange={(e) => setEdit({ ...edit, plan: e.target.value })}>
                        {PLAN_IDS.map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">{L('মেয়াদ বাড়ান (দিন)', 'Extend (days)')}</label>
                      <input className="input" type="number" min={1} max={366} value={edit.extendDays} onChange={(e) => setEdit({ ...edit, extendDays: e.target.value })} />
                    </div>
                    <label className="flex items-end gap-2 pb-2.5 text-sm">
                      <input type="checkbox" checked={edit.botEnabled} onChange={(e) => setEdit({ ...edit, botEnabled: e.target.checked })} /> {L('বট চালু', 'Bot on')}
                    </label>
                    <div className="flex gap-2 sm:col-span-4">
                      <button className="btn btn-primary btn-sm" disabled={busy} onClick={save}>
                        {L('সেভ', 'Save')}
                      </button>
                      <button className="btn btn-outline btn-sm" onClick={() => setEdit(null)}>
                        {L('বাতিল', 'Cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <button className="btn btn-outline btn-sm" onClick={() => setOpen(open === s.id ? null : s.id)}>
                      {open === s.id ? L('বন্ধ করুন', 'Hide details') : L('বিস্তারিত', 'Details')}
                    </button>
                    <button className="btn btn-outline btn-sm" onClick={() => setEdit({ id: s.id, status: s.status, plan: s.plan, extendDays: '', botEnabled: s.botEnabled })}>
                      {L('ম্যানেজ', 'Manage')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AdminSaas() {
  return (
    <Suspense>
      <SaasInner />
    </Suspense>
  );
}