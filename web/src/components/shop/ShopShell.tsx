'use client';
import { BrandLogo } from '@/components/BrandLogo';

import clsx from 'clsx';
import { Bot, CreditCard, HeartPulse, Inbox, KeyRound, LayoutDashboard, LogOut, Menu, Package, Plug, ShoppingBag, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { LangToggle, ThemeToggle } from '@/components/Toggles';
import { PendingApproval } from '@/components/shop/PendingApproval';
import { useAuth } from '@/context/auth';
import { useLang } from '@/context/lang';
import { gql } from '@/lib/api';
import { fetchMyShop, Shop } from '@/lib/shop';

type ShopCtx = { shop: Shop; refresh: () => Promise<void>; unread: number };
const Ctx = createContext<ShopCtx | null>(null);
export const useShop = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useShop must be used inside ShopShell');
  return c;
};

type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean; badge?: number };

const initials = (s: string) =>
  s
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || '?';

export function ShopShell({ children }: { children: React.ReactNode }) {
  const { lang } = useLang();
  const L = (bn: string, en: string) => (lang === 'bn' ? bn : en);
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [shop, setShop] = useState<Shop | null>(null);
  const [unread, setUnread] = useState(0);
  const [healthErrors, setHealthErrors] = useState(0);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    const s = await fetchMyShop();
    if (!s) router.replace('/shop/start?noshop=1');
    else setShop(s);
  }, [router]);

  useEffect(() => {
    if (!loading && !user) router.replace('/shop/start');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    refresh().catch(() => router.replace('/shop/start'));
  }, [user, refresh, router]);

  // notun message-er sankha (20 sec por por)
  useEffect(() => {
    if (!shop || shop.approved === false) return;
    let stop = false;
    const tick = () =>
      gql<{ shopChats: { unreadTotal: number } }>(`query { shopChats(take: 1) }`)
        .then((d) => !stop && setUnread(d.shopChats.unreadTotal || 0))
        .catch(() => {});
    tick();
    const id = setInterval(tick, 20000);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [shop, pathname]);

  // sidebar badge + banner-er jonno: ekhon koyta error ache
  useEffect(() => {
    if (!shop || shop.approved === false) return;
    gql<{ shopHealth: { summary: { errors: number } } }>(`query { shopHealth }`)
      .then((d) => setHealthErrors(d.shopHealth.summary.errors || 0))
      .catch(() => {});
  }, [shop, pathname]);

  // page bodlale drawer bondho
  useEffect(() => setOpen(false), [pathname]);

  // drawer khola thakle: Esc diye bondho + background scroll lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (loading || !user || !shop) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <span className="h-9 w-9 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
      </div>
    );
  }

  if (shop.approved === false) {
    return (
      <PendingApproval
        shopName={shop.name}
        userName={user.name}
        L={L}
        onRefresh={refresh}
        onLogout={() => {
          logout();
          router.push('/shop/start');
        }}
      />
    );
  }

  const groups: { title: string; items: NavItem[] }[] = [
    {
      title: L('কাজ', 'Workspace'),
      items: [
        { href: '/shop', label: L('ওভারভিউ', 'Overview'), icon: LayoutDashboard, exact: true },
        { href: '/shop/inbox', label: L('ইনবক্স', 'Inbox'), icon: Inbox, badge: unread },
        { href: '/shop/orders', label: L('অর্ডার', 'Orders'), icon: ShoppingBag },
        { href: '/shop/products', label: L('প্রোডাক্ট', 'Products'), icon: Package },
      ],
    },
    {
      title: L('অটোমেশন', 'Automation'),
      items: [
        { href: '/shop/bot', label: L('বট সেটিংস', 'Bot settings'), icon: Bot },
        { href: '/shop/connect', label: L('ফেসবুক পেজ', 'Facebook Page'), icon: Plug },
        { href: '/shop/ai', label: L('AI কী', 'AI key'), icon: KeyRound },
      ],
    },
    {
      title: L('অ্যাকাউন্ট', 'Account'),
      items: [
        { href: '/shop/health', label: L('সমস্যা ও স্বাস্থ্য', 'Health & issues'), icon: HeartPulse, badge: healthErrors },
        { href: '/shop/billing', label: L('প্ল্যান ও বিল', 'Plan & billing'), icon: CreditCard },
      ],
    },
  ];
  const flat = groups.flatMap((g) => g.items);
  const isActive = (n: NavItem) => (n.exact ? pathname === n.href : pathname.startsWith(n.href));
  const title = flat.find(isActive)?.label ?? L('ড্যাশবোর্ড', 'Dashboard');

  // mobile-er niche-r 4ta shortcut (baki shob "Menu" te)
  const tabs = flat.slice(0, 4);

  const doLogout = () => {
    logout();
    router.push('/shop/start');
  };

  const acc = shop.access;
  const pct = acc && acc.limit > 0 ? Math.min(100, Math.round((acc.used / acc.limit) * 100)) : 0;
  const meterTone = pct >= 90 ? 'bg-danger' : pct >= 70 ? 'bg-warning' : 'bg-primary';
  const botLive = shop.botEnabled && acc?.ok !== false;

  const sidebar = (
    <div className="flex h-full flex-col">
      {/* brand (website Navbar-er moto) */}
      <Link href="/shop" className="flex h-16 shrink-0 items-center gap-2.5 border-b border-border px-5">
        <BrandLogo className="h-10 w-auto" />
        <span className="rounded-md bg-primary-soft px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">AI</span>
      </Link>

      {/* shop card (compact) */}
      <div className="shrink-0 px-3 pt-3">
        <div className="flex items-center gap-2.5 rounded-xl border border-border bg-surface p-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink font-display text-sm font-semibold text-white">
            {initials(shop.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold leading-tight">{shop.name}</span>
            <span className="mt-0.5 block font-mono text-[10px] font-medium uppercase tracking-wider text-primary">{acc?.planName ?? shop.plan}</span>
          </span>
        </div>
      </div>

      {/* nav */}
      <nav className="sidebar-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4" aria-label="Main">
        {groups.map((g) => (
          <div key={g.title}>
            <p className="mb-1 px-3 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted/70">{g.title}</p>
            <ul className="space-y-0.5">
              {g.items.map((n) => {
                const active = isActive(n);
                return (
                  <li key={n.href}>
                    <Link
                      href={n.href}
                      aria-current={active ? 'page' : undefined}
                      className={clsx(
                        'relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary/50',
                        active ? 'bg-primary-soft font-semibold text-primary' : 'font-medium text-muted hover:bg-surface-2 hover:text-foreground',
                      )}
                    >
                      {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-signal" />}
                      <n.icon className="h-[18px] w-[18px] shrink-0" />
                      <span className="flex-1 truncate">{n.label}</span>
                      {!!n.badge && (
                        <span className="min-w-[20px] rounded-full bg-signal px-1.5 text-center text-[11px] font-bold leading-5 text-white">
                          {n.badge > 99 ? '99+' : n.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* usage meter */}
      {acc && (
        <Link href="/shop/billing" className="mx-3 mb-2 block shrink-0 rounded-xl border border-border bg-surface p-2.5 transition-colors hover:bg-surface-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">{L('এই মাসের AI রিপ্লাই', 'AI replies this month')}</span>
            <span className="tabular-nums text-muted">
              {acc.used.toLocaleString()} / {acc.limit.toLocaleString()}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className={clsx('h-full rounded-full transition-[width] duration-500', meterTone)} style={{ width: `${Math.max(pct, acc.used > 0 ? 3 : 0)}%` }} />
          </div>
        </Link>
      )}

      {/* user */}
      <div className="flex shrink-0 items-center gap-3 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary">
          {initials(user.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold leading-tight">{user.name}</span>
          <span className="block text-xs text-muted">{shop.myRole === 'OWNER' ? L('মালিক', 'Owner') : L('এজেন্ট', 'Agent')}</span>
        </span>
        <button onClick={doLogout} className="btn btn-ghost h-9 w-9 shrink-0 !p-0" aria-label={L('লগআউট', 'Logout')} title={L('লগআউট', 'Logout')}>
          <LogOut className="h-[18px] w-[18px]" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-background lg:block">{sidebar}</aside>

      {/* mobile drawer */}
      <div className={clsx('fixed inset-0 z-40 lg:hidden', open ? 'visible' : 'pointer-events-none invisible')} aria-hidden={!open}>
        <button
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className={clsx('absolute inset-0 bg-ink/60 transition-opacity duration-200', open ? 'opacity-100' : 'opacity-0')}
        />
        <aside
          className={clsx(
            'absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-background shadow-xl transition-[transform,visibility] duration-200',
            open ? 'translate-x-0' : '-translate-x-full invisible',
          )}
        >
          <button onClick={() => setOpen(false)} className="btn btn-ghost absolute right-2 top-3 h-9 w-9 !p-0" aria-label="Close menu">
            <X className="h-5 w-5" />
          </button>
          {sidebar}
        </aside>
      </div>

      <div className="lg:pl-64">
        {/* header */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-6 lg:px-8">
          <button onClick={() => setOpen(true)} className="btn btn-ghost -ml-2 h-10 w-10 !p-0 lg:hidden" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <h2 className="min-w-0 truncate font-display text-lg font-semibold tracking-tight">{title}</h2>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <Link
              href="/shop"
              className={clsx(
                'mr-1 flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                botLive ? 'border-success/30 bg-success/10 text-success hover:bg-success/15' : 'border-border bg-background text-muted hover:bg-surface-2',
              )}
              title={botLive ? L('বট চালু আছে', 'Bot is on') : L('বট বন্ধ আছে', 'Bot is off')}
            >
              <span className={clsx('h-2 w-2 rounded-full', botLive ? 'bg-success' : 'bg-muted/60')} />
              <span className="hidden sm:inline">{botLive ? L('বট চালু', 'Bot on') : L('বট বন্ধ', 'Bot off')}</span>
            </Link>
            <LangToggle />
            <ThemeToggle />
            <span className="ml-1 hidden h-9 w-9 place-items-center rounded-full bg-ink text-xs font-bold text-white sm:grid" title={user.name}>
              {initials(user.name)}
            </span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-6 pb-28 sm:px-6 lg:px-8 lg:py-8 lg:pb-8">
          {shop.access && !shop.access.ok && (
            <Link href="/shop/billing" className="mb-6 block rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
              {shop.access.reason === 'SUSPENDED'
                ? L('এই শপ সাময়িকভাবে বন্ধ আছে। সাপোর্টের সাথে যোগাযোগ করুন।', 'This shop is suspended. Please contact support.')
                : shop.access.reason === 'EXPIRED'
                  ? L('প্ল্যানের মেয়াদ শেষ, বট বন্ধ আছে। রিনিউ করতে এখানে চাপুন।', 'Your plan has expired and the bot is off. Tap to renew.')
                  : L('এই মাসের AI রিপ্লাই লিমিট শেষ, বট বন্ধ আছে। আপগ্রেড করতে এখানে চাপুন।', 'You used all AI replies this month and the bot is off. Tap to upgrade.')}
            </Link>
          )}
          {healthErrors > 0 && pathname !== '/shop/health' && (
            <Link href="/shop/health" className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
              <span>{L(`${healthErrors.toLocaleString('bn-BD')}টি সমস্যা ঠিক করা দরকার`, `${healthErrors} problem${healthErrors > 1 ? 's' : ''} need your attention`)}</span>
              <span className="shrink-0 underline">{L('দেখুন', 'Review')}</span>
            </Link>
          )}
          <Ctx.Provider value={{ shop, refresh, unread }}>{children}</Ctx.Provider>
        </main>
      </div>

      {/* mobile bottom tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        aria-label="Quick"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {tabs.map((n) => {
            const active = isActive(n);
            return (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={active ? 'page' : undefined}
                  className={clsx('relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium', active ? 'text-primary' : 'text-muted')}
                >
                  <span className="relative">
                    <n.icon className="h-5 w-5" />
                    {!!n.badge && <span className="absolute -right-2 -top-1.5 min-w-[16px] rounded-full bg-signal px-1 text-center text-[10px] font-bold leading-4 text-white">{n.badge > 99 ? '99+' : n.badge}</span>}
                  </span>
                  <span className="max-w-full truncate px-1">{n.label}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button onClick={() => setOpen(true)} className="flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted">
              <Menu className="h-5 w-5" />
              <span>{L('মেনু', 'Menu')}</span>
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}