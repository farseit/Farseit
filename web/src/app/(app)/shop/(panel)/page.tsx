'use client';

import clsx from 'clsx';
import { ArrowRight, Check, ChevronRight, Inbox, Package, ShoppingBag, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useShop } from '@/components/shop/ShopShell';
import { useAuth } from '@/context/auth';
import { useLang } from '@/context/lang';
import { gql } from '@/lib/api';
import { trialDaysLeft } from '@/lib/shop';

type Chat = { id: string; name: string | null; lastText: string | null; unread: number; lastMessageAt: string };
type Ord = { id: string; number: number; customerName: string; total: number; status: string; createdAt: string };
type Data = { products: number; pending: number; unread: number; chats: Chat[]; orders: Ord[]; botConfigured: boolean; aiKey: boolean };

const taka = (n: number) => `৳${Number(n).toLocaleString('en-US')}`;
const ok = <T,>(r: PromiseSettledResult<T>) => (r.status === 'fulfilled' ? r.value : null);

/* ---------- small building blocks ---------- */

function Skeleton({ className }: { className?: string }) {
  return <span className={clsx('inline-block animate-pulse rounded-md bg-surface-2', className)} />;
}

function Stat({
  href,
  icon: Icon,
  label,
  value,
  hint,
  alert,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint: string;
  alert?: boolean;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        'card group relative flex flex-col gap-4 p-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_45px_-25px_rgb(11_14_20_/_0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:p-5',
        alert && 'border-signal/40',
      )}
    >
      <div className="flex items-center justify-between">
        <span className={clsx('grid h-10 w-10 place-items-center rounded-lg', alert ? 'bg-signal/15 text-signal' : 'bg-primary-soft text-primary')}>
          <Icon className="h-5 w-5" />
        </span>
        <ArrowRight className="h-4 w-4 -translate-x-1 text-muted opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
      </div>
      <div>
        <p className="text-sm text-muted">{label}</p>
        <div className="mt-1 font-display text-3xl font-semibold leading-none tabular-nums">{value}</div>
      </div>
      <p className={clsx('text-xs', alert ? 'font-medium text-signal' : 'text-muted')}>{hint}</p>
    </Link>
  );
}

function Meter({ pct, tone = 'bg-primary' }: { pct: number; tone?: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div className={clsx('h-full rounded-full transition-[width] duration-500', tone)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function CardHead({ title, href, linkText }: { title: string; href?: string; linkText?: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-4">
      <h2 className="font-display text-base font-semibold">{title}</h2>
      {href && (
        <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
          {linkText}
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="border-t border-border px-5 py-10 text-center">
      <p className="font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-sm text-muted">{text}</p>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="divide-y divide-border border-t border-border">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3.5">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- page ---------- */

export default function ShopOverview() {
  const { lang } = useLang();
  const L = (bn: string, en: string) => (lang === 'bn' ? bn : en);
  const loc = lang === 'bn' ? 'bn-BD' : 'en-US';
  const { user } = useAuth();
  const { shop, refresh } = useShop();
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);

  const days = trialDaysLeft(shop);
  const acc = shop.access;
  const isOwner = shop.myRole === 'OWNER';
  const connected = shop.pages.some((p) => p.status === 'ACTIVE');
  const firstName = user?.name?.trim().split(/\s+/)[0] || '';

  useEffect(() => {
    Promise.allSettled([
      gql<{ shopProducts: any[] }>(`query { shopProducts }`),
      gql<{ shopOrders: { total: number } }>(`query { shopOrders(status: "PENDING", take: 1) }`),
      gql<{ shopOrders: { items: Ord[] } }>(`query { shopOrders(take: 5) }`),
      gql<{ shopChats: { items: Chat[]; unreadTotal: number } }>(`query { shopChats(take: 5) }`),
      gql<{ shopBotSettings: { botName: string; greeting: string | null; rules: string | null } }>(`query { shopBotSettings }`),
      gql<{ shopAiKey: { configured: boolean; status: string } }>(`query { shopAiKey }`),
    ]).then(([p, pend, rec, ch, bs, ak]) => {
      const k = ok(ak)?.shopAiKey;
      const b = ok(bs)?.shopBotSettings;
      setData({
        products: ok(p)?.shopProducts.length ?? 0,
        pending: ok(pend)?.shopOrders.total ?? 0,
        unread: ok(ch)?.shopChats.unreadTotal ?? 0,
        chats: ok(ch)?.shopChats.items ?? [],
        orders: ok(rec)?.shopOrders.items ?? [],
        // bot-er nam/greeting/rules kichu bodlale setup hoyechhe dhora hoy
        botConfigured: !!b && (b.botName !== 'Assistant' || !!b.greeting || !!b.rules),
        aiKey: !!k?.configured && k.status !== 'INVALID',
      });
    });
  }, []);

  const toggleBot = async () => {
    setBusy(true);
    try {
      await gql(`mutation($e:Boolean!){ shopSetBotEnabled(enabled:$e) }`, { e: !shop.botEnabled });
      await refresh();
      toast.success(shop.botEnabled ? L('বট বন্ধ হয়েছে', 'Bot is off') : L('বট চালু হয়েছে', 'Bot is on'));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const ago = (iso: string) => {
    const m = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
    if (m < 1) return L('এইমাত্র', 'now');
    if (m < 60) return `${m.toLocaleString(loc)}${L(' মি', 'm')}`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h.toLocaleString(loc)}${L(' ঘ', 'h')}`;
    return `${Math.floor(h / 24).toLocaleString(loc)}${L(' দিন', 'd')}`;
  };

  const status = (s: string) => {
    const map: Record<string, { bn: string; en: string; cls: string }> = {
      PENDING: { bn: 'পেন্ডিং', en: 'Pending', cls: 'bg-signal/15 text-signal' },
      CONFIRMED: { bn: 'কনফার্ম', en: 'Confirmed', cls: 'bg-primary-soft text-primary' },
      SHIPPED: { bn: 'শিপড', en: 'Shipped', cls: 'bg-primary-soft text-primary' },
      DELIVERED: { bn: 'ডেলিভার্ড', en: 'Delivered', cls: 'bg-success/15 text-success' },
      CANCELLED: { bn: 'বাতিল', en: 'Cancelled', cls: 'bg-danger/10 text-danger' },
    };
    const m = map[s] || { bn: s, en: s, cls: 'bg-surface-2 text-muted' };
    return <span className={clsx('badge', m.cls)}>{L(m.bn, m.en)}</span>;
  };

  /* setup checklist */
  const steps = [
    {
      done: connected,
      label: L('ফেসবুক পেজ কানেক্ট করুন', 'Connect your Facebook Page'),
      desc: L('বট আপনার পেজের মেসেজ পড়তে ও রিপ্লাই দিতে পারবে', 'So the bot can read and answer your Page messages'),
      cta: L('কানেক্ট', 'Connect'),
      href: '/shop/connect',
    },
    {
      done: (data?.products ?? 0) > 0,
      label: L('প্রোডাক্ট যোগ করুন', 'Add your products'),
      desc: L('বট এই তালিকা থেকে দাম বলবে ও অর্ডার নেবে', 'The bot quotes prices and takes orders from this list'),
      cta: L('যোগ করুন', 'Add'),
      href: '/shop/products',
    },
    {
      done: !!data?.botConfigured,
      label: L('বটের নাম, ডেলিভারি চার্জ ও নিয়ম ঠিক করুন', 'Set bot name, delivery charges and rules'),
      desc: L('কীভাবে সালাম দেবে, ডেলিভারি চার্জ কত, কী বলবে না', 'How it greets, what delivery costs and what it should avoid'),
      cta: L('সেটিংস', 'Configure'),
      href: '/shop/bot',
    },
    {
      done: !!data?.aiKey,
      label: L('Gemini AI key যোগ করুন', 'Add your Gemini AI key'),
      desc: L('বট আপনার নিজের Google key দিয়ে রিপ্লাই দেবে, খরচ আপনার Google অ্যাকাউন্টে', 'The bot replies using your own Google key, billed to your Google account'),
      cta: L('key যোগ', 'Add key'),
      href: '/shop/ai',
    },
    {
      done: shop.botEnabled,
      label: L('বট চালু করুন', 'Turn the bot on'),
      desc: L('কাস্টমার দিনরাত সাথে সাথে উত্তর পাবে', 'Customers get instant replies, day and night'),
      cta: L('চালু করুন', 'Turn on'),
      action: toggleBot,
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const currentIdx = steps.findIndex((s) => !s.done);
  const next = currentIdx >= 0 ? steps[currentIdx] : null;
  const allDone = doneCount === steps.length;

  /* plan numbers */
  const pct = acc && acc.limit > 0 ? Math.min(100, Math.round((acc.used / acc.limit) * 100)) : 0;
  const tone = pct >= 90 ? 'bg-danger' : pct >= 70 ? 'bg-warning' : 'bg-primary';
  const daysLeft = days ?? acc?.daysLeft ?? null;
  const loading = data === null;

  return (
    <div className="space-y-6">
      {/* page heading */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-primary">{L('ড্যাশবোর্ড', 'Dashboard')}</span>
          <h1 className="mt-1.5 font-display text-2xl font-semibold tracking-tight sm:text-[30px]">
            {firstName ? L(`স্বাগতম, ${firstName}`, `Welcome back, ${firstName}`) : L('স্বাগতম', 'Welcome back')}
          </h1>
          <p className="mt-1 text-sm text-muted">{L(`${shop.name}-এর আজকের অবস্থা`, `Here is how ${shop.name} is doing today.`)}</p>
        </div>
        {days !== null && (
          <Link
            href="/shop/billing"
            className="inline-flex items-center gap-2 rounded-full border border-signal/30 bg-signal/10 px-3.5 py-1.5 text-sm font-semibold text-signal transition-colors hover:bg-signal/20"
          >
            {L(`ট্রায়াল: আর ${days.toLocaleString(loc)} দিন`, `Trial: ${days} days left`)}
            <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      {/* next step: ekta-i kaj, spasto */}
      {next && (
        <section className="relative overflow-hidden rounded-xl border border-white/10 bg-ink p-5 text-white sm:p-6">
          <div className="absolute inset-0 bg-grid-pattern bg-[size:36px_36px] [mask-image:radial-gradient(ellipse_70%_90%_at_100%_0%,black,transparent)] invert" />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0 max-w-xl">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-signal">
                {L(`পরের ধাপ · ${(doneCount + 1).toLocaleString(loc)}/${steps.length.toLocaleString(loc)}`, `Next step · ${doneCount + 1} of ${steps.length}`)}
              </span>
              <h2 className="mt-2 font-display text-xl font-semibold leading-snug sm:text-2xl">{next.label}</h2>
              <p className="mt-1.5 text-sm text-white/70">{next.desc}</p>
            </div>
            {'href' in next && next.href ? (
              <Link href={next.href} className="btn btn-accent shrink-0">
                {next.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              isOwner && (
                <button onClick={next.action} disabled={busy} className="btn btn-accent shrink-0">
                  {next.cta}
                  <ArrowRight className="h-4 w-4" />
                </button>
              )
            )}
          </div>
          <div className="relative mt-5 flex gap-1.5" aria-hidden="true">
            {steps.map((s, i) => (
              <span key={i} className={clsx('h-1 flex-1 rounded-full', s.done ? 'bg-signal' : 'bg-white/15')} />
            ))}
          </div>
        </section>
      )}

      {/* stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat
          href="/shop/inbox"
          icon={Inbox}
          alert={(data?.unread ?? 0) > 0}
          label={L('নতুন মেসেজ', 'Unread messages')}
          value={loading ? <Skeleton className="h-8 w-12" /> : data!.unread.toLocaleString(loc)}
          hint={loading ? '\u00A0' : data!.unread > 0 ? L('উত্তরের অপেক্ষায়', 'Waiting for a reply') : L('সব দেখা হয়েছে', 'All caught up')}
        />
        <Stat
          href="/shop/orders"
          icon={ShoppingBag}
          alert={(data?.pending ?? 0) > 0}
          label={L('পেন্ডিং অর্ডার', 'Pending orders')}
          value={loading ? <Skeleton className="h-8 w-12" /> : data!.pending.toLocaleString(loc)}
          hint={loading ? '\u00A0' : data!.pending > 0 ? L('কনফার্মের অপেক্ষায়', 'Waiting to be confirmed') : L('কোনো অর্ডার বাকি নেই', 'No orders waiting')}
        />
        <Stat
          href="/shop/products"
          icon={Package}
          label={L('প্রোডাক্ট', 'Products')}
          value={loading ? <Skeleton className="h-8 w-12" /> : data!.products.toLocaleString(loc)}
          hint={loading ? '\u00A0' : data!.products === 0 ? L('প্রথম প্রোডাক্ট যোগ করুন', 'Add your first product') : L('বটের কাছে আছে', 'Available to the bot')}
        />
        <Stat
          href="/shop/billing"
          icon={Sparkles}
          alert={pct >= 90}
          label={L('AI রিপ্লাই', 'AI replies')}
          value={
            <>
              {(acc?.used ?? 0).toLocaleString(loc)}
              <span className="ml-1 font-sans text-base font-medium text-muted">/ {(acc?.limit ?? 0).toLocaleString(loc)}</span>
            </>
          }
          hint={L('এই মাসে ব্যবহার হয়েছে', 'Used this month')}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* left column */}
        <div className="space-y-6 lg:col-span-2">
          {/* bot switch */}
          <section className="card flex items-center gap-4 p-5">
            <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
              <span className={clsx('absolute -right-1 -top-1 h-3 w-3 rounded-full ring-2 ring-background', shop.botEnabled ? 'bg-success' : 'bg-muted/60')}>
                {shop.botEnabled && <span className="absolute inset-0 rounded-full bg-success motion-safe:animate-ping" />}
              </span>
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-base font-semibold">{L('অটোমেটিক বট', 'Automatic bot')}</h2>
              <p className="text-sm text-muted">
                {shop.botEnabled
                  ? L('চালু আছে, কাস্টমারের মেসেজে নিজে রিপ্লাই দিচ্ছে।', 'On. Replying to customers automatically.')
                  : L('বন্ধ আছে। মেসেজ ইনবক্সে জমা হবে, আপনাকে রিপ্লাই দিতে হবে।', 'Off. Messages collect in the inbox and you reply yourself.')}
              </p>
            </div>
            {isOwner ? (
              <button
                role="switch"
                aria-checked={shop.botEnabled}
                aria-label={L('অটোমেটিক বট', 'Automatic bot')}
                onClick={toggleBot}
                disabled={busy}
                className={clsx(
                  'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60',
                  shop.botEnabled ? 'bg-success' : 'bg-surface-2 ring-1 ring-inset ring-border',
                )}
              >
                <span className={clsx('inline-block h-5 w-5 rounded-full bg-white shadow transition-transform', shop.botEnabled ? 'translate-x-6' : 'translate-x-1')} />
              </button>
            ) : (
              <span className={clsx('badge', shop.botEnabled ? 'bg-success/15 text-success' : 'bg-surface-2 text-muted')}>
                {shop.botEnabled ? L('চালু', 'On') : L('বন্ধ', 'Off')}
              </span>
            )}
          </section>

          {/* setup */}
          {allDone ? (
            <section className="card flex items-center gap-4 p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-success/15 text-success">
                <Check className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-display text-base font-semibold">{L('সেটআপ সম্পূর্ণ', 'Your shop is set up')}</h2>
                <p className="text-sm text-muted">{L('বট কাজ করছে। নতুন অর্ডার ও মেসেজ এখানে দেখা যাবে।', 'The bot is live. New orders and messages show up here.')}</p>
              </div>
            </section>
          ) : (
            <section className="card overflow-hidden">
              <div className="px-5 pb-4 pt-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-base font-semibold">{L('শপ সেটআপ', 'Set up your shop')}</h2>
                  <span className="text-sm tabular-nums text-muted">
                    {L(`${doneCount.toLocaleString(loc)}/${steps.length.toLocaleString(loc)} সম্পন্ন`, `${doneCount} of ${steps.length} done`)}
                  </span>
                </div>
                <div className="mt-3">
                  <Meter pct={(doneCount / steps.length) * 100} tone="bg-success" />
                </div>
              </div>
              <ul className="divide-y divide-border border-t border-border">
                {steps.map((s, i) => {
                  const current = i === currentIdx;
                  const rowCls = clsx('flex items-center gap-4 px-5 py-4', current && 'bg-primary-soft/50');
                  const icon = s.done ? (
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-success text-white">
                      <Check className="h-4 w-4" strokeWidth={3} />
                    </span>
                  ) : (
                    <span
                      className={clsx(
                        'grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 font-mono text-xs font-semibold',
                        current ? 'border-primary text-primary' : 'border-border text-muted',
                      )}
                    >
                      {(i + 1).toLocaleString(loc)}
                    </span>
                  );
                  const text = (
                    <span className="min-w-0 flex-1">
                      <span className={clsx('block text-sm', s.done ? 'text-muted line-through' : 'font-semibold')}>{s.label}</span>
                      {!s.done && <span className="mt-0.5 block text-xs text-muted">{s.desc}</span>}
                    </span>
                  );

                  if ('href' in s && s.href) {
                    return (
                      <li key={s.label}>
                        <Link href={s.href} className={clsx(rowCls, 'transition-colors hover:bg-surface')}>
                          {icon}
                          {text}
                          {!s.done && <span className={clsx('btn btn-sm shrink-0', current ? 'btn-primary' : 'btn-outline')}>{s.cta}</span>}
                        </Link>
                      </li>
                    );
                  }
                  return (
                    <li key={s.label} className={rowCls}>
                      {icon}
                      {text}
                      {!s.done && isOwner && (
                        <button onClick={s.action} disabled={busy} className={clsx('btn btn-sm shrink-0', current ? 'btn-primary' : 'btn-outline')}>
                          {s.cta}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* recent orders */}
          <section className="card overflow-hidden">
            <CardHead title={L('সাম্প্রতিক অর্ডার', 'Recent orders')} href="/shop/orders" linkText={L('সব দেখুন', 'View all')} />
            {loading ? (
              <ListSkeleton />
            ) : data!.orders.length === 0 ? (
              <Empty
                title={L('এখনও কোনো অর্ডার নেই', 'No orders yet')}
                text={L('বট অর্ডার নিলে এখানে দেখা যাবে।', 'When the bot takes an order, it will appear here.')}
              />
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {data!.orders.map((o) => (
                  <li key={o.id}>
                    <Link href="/shop/orders" className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">
                        <ShoppingBag className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          #{o.number.toLocaleString(loc)} · {o.customerName}
                        </span>
                        <span className="block text-xs text-muted">{ago(o.createdAt)}</span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-sm font-semibold tabular-nums">{taka(o.total)}</span>
                        {status(o.status)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* right column */}
        <div className="space-y-6">
          {/* plan */}
          <section className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold">{L('আপনার প্ল্যান', 'Your plan')}</h2>
              <span className="rounded-full bg-primary-soft px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wider text-primary">
                {acc?.planName ?? shop.plan}
              </span>
            </div>
            {daysLeft !== null && (
              <p className="mt-2 text-sm text-muted">
                {days !== null
                  ? L(`ট্রায়াল শেষ হতে ${daysLeft.toLocaleString(loc)} দিন বাকি`, `Trial ends in ${daysLeft} days`)
                  : L(`প্ল্যানের মেয়াদ ${daysLeft.toLocaleString(loc)} দিন বাকি`, `Plan ends in ${daysLeft} days`)}
              </p>
            )}
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-muted">{L('এই মাসের AI রিপ্লাই', 'AI replies this month')}</span>
                <span className="font-semibold tabular-nums">
                  {(acc?.used ?? 0).toLocaleString(loc)} / {(acc?.limit ?? 0).toLocaleString(loc)}
                </span>
              </div>
              <Meter pct={Math.max(pct, (acc?.used ?? 0) > 0 ? 3 : 0)} tone={tone} />
            </div>
            <Link href="/shop/billing" className={clsx('btn mt-5 w-full', days !== null || pct >= 80 ? 'btn-accent' : 'btn-outline')}>
              {days !== null || pct >= 80 ? L('প্ল্যান আপগ্রেড করুন', 'Upgrade plan') : L('প্ল্যান ম্যানেজ করুন', 'Manage plan')}
            </Link>
          </section>

          {/* recent messages */}
          <section className="card overflow-hidden">
            <CardHead title={L('সাম্প্রতিক মেসেজ', 'Recent messages')} href="/shop/inbox" linkText={L('ইনবক্স', 'Inbox')} />
            {loading ? (
              <ListSkeleton />
            ) : data!.chats.length === 0 ? (
              <Empty
                title={L('এখনও কোনো মেসেজ নেই', 'No conversations yet')}
                text={L('আপনার পেজে মেসেজ এলে এখানে দেখা যাবে।', 'Messages sent to your Facebook Page will show up here.')}
              />
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {data!.chats.map((c) => (
                  <li key={c.id}>
                    <Link href="/shop/inbox" className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary">
                        {(c.name || '?').trim()[0]?.toUpperCase() || '?'}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={clsx('block truncate text-sm', c.unread ? 'font-bold' : 'font-semibold')}>{c.name || L('কাস্টমার', 'Customer')}</span>
                        <span className="block truncate text-xs text-muted">{c.lastText || '—'}</span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-xs text-muted">{ago(c.lastMessageAt)}</span>
                        {c.unread > 0 && (
                          <span className="min-w-[18px] rounded-full bg-signal px-1.5 text-center text-[11px] font-bold leading-[18px] text-white">{c.unread}</span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}