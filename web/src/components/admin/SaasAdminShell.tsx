'use client';
import { BrandLogo } from '@/components/BrandLogo';

import { LogOut } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LangToggle, ThemeToggle } from '@/components/Toggles';
import { useAuth } from '@/context/auth';
import { useLang } from '@/context/lang';

/** Platform super admin (role ADMIN) panel-er frame. Onno keu dhukte pare na */
export function SaasAdminShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const { lang } = useLang();
  const router = useRouter();
  const L = (bn: string, en: string) => (lang === 'bn' ? bn : en);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/shop/start?mode=login');
    else if (user.role !== 'ADMIN') router.replace('/shop');
  }, [loading, user, router]);

  if (loading || !user || user.role !== 'ADMIN') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <span className="h-9 w-9 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/admin/saas" className="flex items-center gap-2 font-bold tracking-tight">
            <BrandLogo className="h-9 w-auto" /> <span className="rounded-md bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">{L('সুপার অ্যাডমিন', 'Super admin')}</span>
          </Link>
          <div className="flex items-center gap-1">
            <Link href="/" className="btn btn-ghost btn-sm hidden sm:inline-flex">
              {L('ওয়েবসাইট', 'Website')}
            </Link>
            <LangToggle />
            <ThemeToggle />
            <button
              onClick={() => {
                logout();
                router.push('/shop/start?mode=login');
              }}
              className="btn btn-ghost btn-sm"
            >
              <LogOut className="h-4 w-4" /> {L('লগআউট', 'Logout')}
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
