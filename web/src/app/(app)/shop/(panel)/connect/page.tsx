'use client';

import clsx from 'clsx';
import { AlertTriangle, Bell, Check, Facebook, Loader2, RefreshCw, Search, ShieldCheck, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { PushButton } from '@/components/admin/PushButton';
import { useShop } from '@/components/shop/ShopShell';
import { useLang } from '@/context/lang';
import { gql } from '@/lib/api';
import { facebookLogin, loadFacebookSdk } from '@/lib/shop';

type FbPage = { id: string; name: string; connected: boolean };

function FbTile({ className }: { className?: string }) {
  return (
    <span className={clsx('grid shrink-0 place-items-center rounded-xl bg-[#1877F2]/10 text-[#1877F2]', className)}>
      <Facebook className="h-5 w-5" />
    </span>
  );
}

/* ---------- confirm dialog ---------- */

function ConfirmDialog({
  title,
  text,
  confirmText,
  cancelText,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  text: string;
  confirmText: string;
  cancelText: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onCancel();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [busy, onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
      <button aria-label="Close" className="absolute inset-0 bg-black/50" onClick={() => !busy && onCancel()} />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-xl">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-danger/10 text-danger">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <h3 id="dlg-title" className="mt-4 text-lg font-semibold">
          {title}
        </h3>
        <p className="mt-1.5 text-sm text-muted">{text}</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button autoFocus onClick={onCancel} disabled={busy} className="btn btn-outline">
            {cancelText}
          </button>
          <button onClick={onConfirm} disabled={busy} className="btn btn-danger">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- page ---------- */

export default function ConnectPage() {
  const { lang } = useLang();
  const L = (bn: string, en: string) => (lang === 'bn' ? bn : en);
  const { shop, refresh } = useShop();
  const owner = shop.myRole === 'OWNER';
  const limit = shop.access?.pagesLimit;

  const [token, setToken] = useState<string | null>(null);
  const [pages, setPages] = useState<FbPage[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [confirmFor, setConfirmFor] = useState<{ pageId: string; name: string } | null>(null);

  useEffect(() => {
    loadFacebookSdk().catch(() => {}); // popup block na hoy tai age-i load
  }, []);

  const needsReconnect = shop.pages.filter((p) => p.status !== 'ACTIVE');
  const atLimit = typeof limit === 'number' && shop.pages.length >= limit;

  const start = async () => {
    setBusy('login');
    setLoginError(null);
    setQuery('');
    try {
      const t = await facebookLogin();
      setToken(t);
      const d = await gql<{ shopFbPages: FbPage[] }>(`query($t:String!){ shopFbPages(userToken:$t) }`, { t });
      setPages(d.shopFbPages);
    } catch (e: any) {
      setPages(null);
      setLoginError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const connect = async (p: FbPage) => {
    if (!token) return;
    setBusy(p.id);
    try {
      await gql(`mutation($p:String!,$t:String!){ shopConnectPage(pageId:$p, userToken:$t) }`, { p: p.id, t: token });
      toast.success(L(`${p.name} কানেক্ট হয়েছে`, `${p.name} connected`));
      setPages((list) => list && list.map((x) => (x.id === p.id ? { ...x, connected: true } : x)));
      await refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    if (!confirmFor) return;
    const { pageId } = confirmFor;
    setBusy(pageId);
    try {
      await gql(`mutation($p:String!){ shopDisconnectPage(pageId:$p) }`, { p: pageId });
      await refresh();
      setPages((list) => list && list.map((x) => (x.id === pageId ? { ...x, connected: false } : x)));
      toast.success(L('পেজ ডিসকানেক্ট হয়েছে', 'Page disconnected'));
      setConfirmFor(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const shown = (pages || []).filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()));

  const steps = [
    { title: L('ফেসবুকে লগইন করুন', 'Log in with Facebook'), desc: L('যে অ্যাকাউন্টে আপনি পেজের অ্যাডমিন।', 'Use the account that manages your Page.') },
    { title: L('পেজ বেছে নিন', 'Choose a Page'), desc: L('একটি পেজ একসাথে একটাই শপে থাকতে পারে।', 'A Page can belong to one shop at a time.') },
    { title: L('বট রিপ্লাই শুরু করবে', 'The bot starts replying'), desc: L('বট চালু থাকলে নতুন মেসেজে নিজে উত্তর দেবে।', 'With the bot on, it answers new messages by itself.') },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{L('আপনার ফেসবুক পেজ কানেক্ট করুন', 'Connect your Facebook Page')}</h1>
        <p className="mt-1 text-sm text-muted">{L('এখানে কানেক্ট করা পেজগুলোর মেসেজে বট রিপ্লাই দেবে।', 'The bot replies to messages sent to the Pages you connect here.')}</p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* connected pages */}
          <section className="card overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
              <h2 className="font-semibold">{L('কানেক্ট করা পেজ', 'Connected Pages')}</h2>
              {typeof limit === 'number' && (
                <span className="badge bg-surface-2 text-muted">
                  {shop.pages.length} / {limit} {L('পেজ', 'Pages')}
                </span>
              )}
            </div>

            {needsReconnect.length > 0 && (
              <div className="mx-5 mb-4 flex items-start gap-3 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger sm:mx-6">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="font-medium">
                  {L('কিছু পেজের অনুমতির মেয়াদ শেষ। আবার কানেক্ট না করলে বট সেখানে রিপ্লাই দিতে পারবে না।', 'Access for some Pages has expired. The bot cannot reply there until you reconnect.')}
                </span>
              </div>
            )}

            {shop.pages.length === 0 ? (
              <div className="border-t border-border px-6 py-12 text-center">
                <FbTile className="mx-auto h-12 w-12" />
                <p className="mt-4 font-semibold">{L('এখনো কোনো পেজ কানেক্ট করা হয়নি', 'No Page connected yet')}</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                  {L('পেজ কানেক্ট করলে কাস্টমারের মেসেজ এখানে আসবে এবং বট উত্তর দিতে পারবে।', 'Connect a Page so customer messages arrive here and the bot can answer them.')}
                </p>
                {owner && (
                  <button onClick={start} disabled={busy === 'login'} className="btn btn-primary mt-5">
                    {busy === 'login' && <Loader2 className="h-4 w-4 animate-spin" />}
                    {L('পেজ কানেক্ট করুন', 'Connect a Page')}
                  </button>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {shop.pages.map((p) => {
                  const active = p.status === 'ACTIVE';
                  return (
                    <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-4 sm:px-6">
                      <FbTile className="h-10 w-10" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold leading-tight">{p.name || p.pageId}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs">
                          <span className={clsx('h-2 w-2 rounded-full', active ? 'bg-success' : 'bg-danger')} />
                          <span className={active ? 'text-muted' : 'font-medium text-danger'}>
                            {active ? L('চালু আছে', 'Active') : L('আবার কানেক্ট করুন, টোকেনের মেয়াদ শেষ', 'Reconnect needed, token expired')}
                          </span>
                          <span className="text-muted">· ID {p.pageId}</span>
                        </p>
                      </div>
                      {owner && (
                        <div className="flex shrink-0 items-center gap-1">
                          {!active && (
                            <button onClick={start} disabled={busy === 'login'} className="btn btn-primary btn-sm">
                              <RefreshCw className="h-3.5 w-3.5" /> {L('রিকানেক্ট', 'Reconnect')}
                            </button>
                          )}
                          <button
                            className="btn btn-ghost h-9 w-9 !p-0 text-danger hover:bg-danger/10"
                            aria-label={L('ডিসকানেক্ট', 'Disconnect')}
                            title={L('ডিসকানেক্ট', 'Disconnect')}
                            disabled={busy === p.pageId}
                            onClick={() => setConfirmFor({ pageId: p.pageId, name: p.name || p.pageId })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* connect */}
          {owner ? (
            <section className="card p-5 sm:p-6">
              <h2 className="font-semibold">{L('নতুন পেজ কানেক্ট করুন', 'Connect a Page')}</h2>
              <p className="mt-1 text-sm text-muted">
                {L('ফেসবুকে লগইন করে যে পেজের অ্যাডমিন আপনি সেটি বেছে নিন।', 'Log in with Facebook and pick a Page you manage.')}
              </p>

              {atLimit && (
                <p className="mt-4 rounded-lg bg-surface px-3.5 py-2.5 text-xs text-muted">
                  {L(`আপনার প্ল্যানে সর্বোচ্চ ${limit}টি পেজ চলে।`, `Your plan allows up to ${limit} Page${limit === 1 ? '' : 's'}.`)}{' '}
                  <Link href="/shop/billing" className="font-semibold text-primary hover:underline">
                    {L('প্ল্যান আপগ্রেড করুন', 'Upgrade plan')}
                  </Link>
                </p>
              )}

              <button
                onClick={start}
                disabled={busy === 'login'}
                className="btn mt-5 bg-[#1877F2] text-white shadow-sm hover:bg-[#166FE5]"
              >
                {busy === 'login' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Facebook className="h-4 w-4" />}
                {busy === 'login' ? L('অপেক্ষা করুন...', 'Please wait...') : pages ? L('অন্য অ্যাকাউন্ট দিয়ে চেষ্টা করুন', 'Use a different account') : L('ফেসবুক দিয়ে চালিয়ে যান', 'Continue with Facebook')}
              </button>

              {loginError && (
                <div className="mt-4 flex items-start gap-3 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              {pages && (
                <div className="mt-6">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">{L('আপনার পেজগুলো', 'Your Pages')}</p>
                    <span className="text-xs text-muted">{pages.length}</span>
                  </div>

                  {pages.length > 5 && (
                    <div className="relative mb-3">
                      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                      <input className="input pl-10" placeholder={L('পেজ খুঁজুন', 'Search Pages')} value={query} onChange={(e) => setQuery(e.target.value)} />
                    </div>
                  )}

                  {pages.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
                      <p className="text-sm font-medium">{L('এই অ্যাকাউন্টে কোনো পেজ পাওয়া যায়নি', 'No Pages found on this account')}</p>
                      <p className="mx-auto mt-1 max-w-sm text-xs text-muted">
                        {L('নিশ্চিত করুন আপনি পেজের অ্যাডমিন, তারপর অন্য অ্যাকাউন্ট দিয়ে আবার চেষ্টা করুন।', 'Make sure you are an admin of the Page, then try again with another account.')}
                      </p>
                    </div>
                  ) : shown.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted">{L('কিছু পাওয়া যায়নি', 'No Pages match your search')}</p>
                  ) : (
                    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                      {shown.map((p) => (
                        <li key={p.id} className="flex items-center gap-3 p-3.5">
                          <FbTile className="h-9 w-9" />
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.name}</span>
                          {p.connected ? (
                            <span className="badge gap-1 bg-success/15 text-success">
                              <Check className="h-3 w-3" strokeWidth={3} /> {L('কানেক্টেড', 'Connected')}
                            </span>
                          ) : (
                            <button className="btn btn-primary btn-sm" disabled={busy === p.id} onClick={() => connect(p)}>
                              {busy === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : L('কানেক্ট', 'Connect')}
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <p className="mt-5 flex items-start gap-2 text-xs text-muted">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                {L(
                  'ফেসবুক আপনার পেজ দেখা এবং মেসেজ পড়া ও পাঠানোর অনুমতি চাইবে। পেজের অ্যাক্সেস টোকেন এনক্রিপ্ট করে রাখা হয়।',
                  'Facebook will ask to see your Pages and to read and send messages on them. The Page access token is stored encrypted.',
                )}
              </p>
            </section>
          ) : (
            <p className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-muted">
              {L('শুধু শপের মালিক পেজ কানেক্ট বা ডিসকানেক্ট করতে পারবেন।', 'Only the shop owner can connect or disconnect Pages.')}
            </p>
          )}
        </div>

        {/* right column */}
        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="font-semibold">{L('কীভাবে কাজ করে', 'How it works')}</h2>
            <ol className="mt-4 space-y-4">
              {steps.map((s, i) => (
                <li key={s.title} className="flex gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary">{(i + 1).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US')}</span>
                  <div>
                    <p className="text-sm font-semibold leading-tight">{s.title}</p>
                    <p className="mt-0.5 text-xs text-muted">{s.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="card p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-soft text-primary">
                <Bell className="h-[18px] w-[18px]" />
              </span>
              <h2 className="font-semibold">{L('নোটিফিকেশন', 'Notifications')}</h2>
            </div>
            <p className="mb-4 mt-3 text-sm text-muted">
              {L('নতুন অর্ডার ও কাস্টমারের মেসেজ এলে এই ডিভাইসে নোটিফিকেশন পাবেন।', 'Get a notification on this device for new orders and customer messages.')}
            </p>
            <PushButton />
          </section>
        </div>
      </div>

      {confirmFor && (
        <ConfirmDialog
          title={L(`“${confirmFor.name}” ডিসকানেক্ট করবেন?`, `Disconnect “${confirmFor.name}”?`)}
          text={L('বট এই পেজে আর রিপ্লাই দেবে না। পরে আবার কানেক্ট করতে পারবেন।', 'The bot will stop replying on this Page. You can connect it again later.')}
          confirmText={L('ডিসকানেক্ট করুন', 'Disconnect')}
          cancelText={L('বাতিল', 'Cancel')}
          busy={busy === confirmFor.pageId}
          onConfirm={disconnect}
          onCancel={() => setConfirmFor(null)}
        />
      )}
    </div>
  );
}