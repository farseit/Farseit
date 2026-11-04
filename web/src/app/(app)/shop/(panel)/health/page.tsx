'use client';

import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, Copy, Loader2, RefreshCw, Wrench, X, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ErrorBox } from '@/components/admin/ui';
import { useShop } from '@/components/shop/ShopShell';
import { useLang } from '@/context/lang';
import { gql } from '@/lib/api';

type Status = 'ok' | 'warn' | 'error';
type Check = { id: string; status: Status; vars?: Record<string, string | number>; fix?: { href?: string; repair?: string } };
type Issue = {
  id: string;
  code: string;
  subject: string;
  severity: 'ERROR' | 'WARN';
  message: string;
  detail: string | null;
  count: number;
  firstAt: string;
  lastAt: string;
  resolvedAt: string | null;
};
type Health = { live: boolean; checkedAt: string; checks: Check[]; issues: Issue[]; summary: { errors: number; warnings: number } };
type Pair = [string, string]; // [title, detail]

/* ---------- texts (bn / en). {name} {names} {n} {detail} server theke boshe ---------- */
const CHECKS: Record<string, { bn: Pair; en: Pair }> = {
  page_none: { bn: ['ফেসবুক পেজ', 'কোনো পেজ কানেক্ট করা নেই, তাই বট মেসেজ পাবে না।'], en: ['Facebook Page', 'No Page is connected, so the bot cannot receive messages.'] },
  page_expired: { bn: ['ফেসবুক পেজ', '{names}-এর Facebook অনুমতির মেয়াদ শেষ। আবার কানেক্ট করুন।'], en: ['Facebook Page', '{names} must be reconnected because Facebook access expired.'] },
  page_secret: { bn: ['ফেসবুক পেজ', '{names}-এর সংরক্ষিত অনুমতি পড়া যাচ্ছে না (সম্ভবত সার্ভারের TOKEN_ENC_KEY বদলে গেছে)। পেজটি আবার কানেক্ট করুন।'], en: ['Facebook Page', 'The saved access for {names} cannot be read (the server’s TOKEN_ENC_KEY probably changed). Reconnect the Page.'] },
  ai_secret: { bn: ['AI key', 'সংরক্ষিত Gemini key পড়া যাচ্ছে না। “AI key” পেজে key আবার দিন।'], en: ['AI key', 'The saved Gemini key cannot be read. Add the key again in “AI key”.'] },
  page_ok: { bn: ['ফেসবুক পেজ', '{n}টি পেজ কানেক্ট আছে।'], en: ['Facebook Page', '{n} connected.'] },
  bot_off: { bn: ['অটোমেটিক বট', 'বট বন্ধ আছে, তাই কাস্টমার অটো রিপ্লাই পাচ্ছে না।'], en: ['Automatic bot', 'The bot is off, so customers get no automatic replies.'] },
  bot_on: { bn: ['অটোমেটিক বট', 'বট চালু আছে।'], en: ['Automatic bot', 'The bot is on.'] },
  ai_missing: { bn: ['AI key', 'কোনো Gemini key যোগ করা নেই, তাই বট রিপ্লাই দিতে পারছে না।'], en: ['AI key', 'No Gemini key is added, so the bot cannot reply.'] },
  ai_invalid: { bn: ['AI key', 'Google আপনার Gemini key গ্রহণ করেনি। নতুন key দিন।'], en: ['AI key', 'Google rejected your Gemini key. Add a new key.'] },
  ai_quota: { bn: ['AI key', 'Gemini key-র লিমিট শেষ। লিমিট রিসেট হলে বট আবার চলবে।'], en: ['AI key', 'Your Gemini key reached its limit. The bot resumes after it resets.'] },
  ai_own: { bn: ['AI key', 'আপনার নিজের Gemini key কাজ করছে।'], en: ['AI key', 'Your own Gemini key is working.'] },
  ai_platform: { bn: ['AI key', 'বট Farse AI-এর AI ব্যবহার করছে।'], en: ['AI key', 'The bot is using the shared Farse AI.'] },
  plan_ok: { bn: ['প্ল্যান', 'আপনার প্ল্যান চালু আছে।'], en: ['Plan', 'Your plan is active.'] },
  plan_suspended: { bn: ['প্ল্যান', 'এই শপ সাময়িকভাবে বন্ধ আছে। সাপোর্টের সাথে যোগাযোগ করুন।'], en: ['Plan', 'This shop is suspended. Please contact support.'] },
  plan_expired: { bn: ['প্ল্যান', 'প্ল্যানের মেয়াদ শেষ, তাই বট বন্ধ।'], en: ['Plan', 'Your plan has expired, so the bot is off.'] },
  plan_limit: { bn: ['প্ল্যান', 'এই মাসের AI রিপ্লাই শেষ, তাই বট থেমে আছে।'], en: ['Plan', 'You used all AI replies this month, so the bot stopped.'] },
  products_none: { bn: ['প্রোডাক্ট', 'কোনো প্রোডাক্ট নেই, তাই বট দাম বলতে পারবে না।'], en: ['Products', 'No products added, so the bot cannot quote prices.'] },
  products_ok: { bn: ['প্রোডাক্ট', '{n}টি প্রোডাক্ট যোগ করা আছে।'], en: ['Products', '{n} products added.'] },
  errors_recent: { bn: ['সাম্প্রতিক এরর', 'সাম্প্রতিক {n}টি সমস্যা রেকর্ড হয়েছে। নিচের তালিকা দেখুন।'], en: ['Recent errors', '{n} recent problem(s) were recorded. See the list below.'] },
  errors_none: { bn: ['সাম্প্রতিক এরর', 'সাম্প্রতিক কোনো সমস্যা নেই।'], en: ['Recent errors', 'No recent errors.'] },
  token_ok: { bn: ['ফেসবুক সংযোগ: {name}', 'Facebook সংরক্ষিত অনুমতি গ্রহণ করছে।'], en: ['Facebook connection: {name}', 'Facebook accepts the saved access.'] },
  token_bad: { bn: ['ফেসবুক সংযোগ: {name}', 'Facebook সংরক্ষিত অনুমতি গ্রহণ করছে না। পেজ আবার কানেক্ট করুন।'], en: ['Facebook connection: {name}', 'Facebook rejected the saved access. Reconnect the Page.'] },
  token_error: { bn: ['ফেসবুক সংযোগ: {name}', 'সংযোগ যাচাই করা যায়নি: {detail}'], en: ['Facebook connection: {name}', 'Could not verify the connection: {detail}'] },
  fb_unreachable: { bn: ['ফেসবুক সংযোগ: {name}', 'এখন Facebook-এ পৌঁছানো যাচ্ছে না। একটু পরে আবার চেষ্টা করুন।'], en: ['Facebook connection: {name}', 'Could not reach Facebook right now. Try again in a moment.'] },
  hook_ok: { bn: ['মেসেজ ডেলিভারি: {name}', 'Facebook এই পেজের মেসেজ বটের কাছে পাঠাচ্ছে।'], en: ['Message delivery: {name}', 'Facebook is sending this Page’s messages to the bot.'] },
  hook_missing: { bn: ['মেসেজ ডেলিভারি: {name}', 'Facebook এই পেজের মেসেজ এখনো বটের কাছে পাঠাচ্ছে না।'], en: ['Message delivery: {name}', 'Facebook is not sending this Page’s messages to the bot yet.'] },
  hook_error: { bn: ['মেসেজ ডেলিভারি: {name}', 'মেসেজ ডেলিভারি যাচাই করা যায়নি: {detail}'], en: ['Message delivery: {name}', 'Could not check message delivery: {detail}'] },
};

const ISSUES: Record<string, { bn: Pair; en: Pair }> = {
  FB_TOKEN_EXPIRED: { bn: ['পেজের অনুমতির মেয়াদ শেষ', 'Facebook-এর অনুমতি শেষ হওয়ায় বট রিপ্লাই দিতে পারছে না। “ফেসবুক পেজ” থেকে পেজটি আবার কানেক্ট করুন।'], en: ['Page access expired', 'Facebook access expired, so the bot cannot reply. Reconnect the Page from “Facebook Page”.'] },
  FB_PERMISSION: { bn: ['Facebook মেসেজ পাঠাতে দেয়নি', 'নিশ্চিত করুন আপনি পেজের অ্যাডমিন, তারপর পেজটি আবার কানেক্ট করুন।'], en: ['Facebook blocked sending', 'Make sure you are an admin of the Page, then reconnect it.'] },
  FB_SEND_FAILED: { bn: ['মেসেজ পাঠানো যায়নি', 'Facebook একটি বটের মেসেজ ডেলিভার করতে পারেনি। বিস্তারিত নিচে দেখুন।'], en: ['A message could not be sent', 'Facebook could not deliver a bot message. See the details below.'] },
  FB_SECRET_UNREADABLE: { bn: ['পেজের অনুমতি পড়া যাচ্ছে না', 'সংরক্ষিত Facebook অনুমতি পড়া যাচ্ছে না, তাই বট মেসেজ ধরতে পারছে না। পেজটি আবার কানেক্ট করুন।'], en: ['Page access cannot be read', 'The saved Facebook access cannot be read, so the bot cannot receive messages. Reconnect the Page.'] },
  CONNECT_FAILED: { bn: ['পেজ কানেক্ট করা যায়নি', 'পেজ কানেক্ট করার সময় সমস্যা হয়েছে। কারণ নিচে দেখুন।'], en: ['Connecting a Page failed', 'Something went wrong while connecting a Page. See the reason below.'] },
  AI_ERROR: { bn: ['AI উত্তর দিতে পারেনি', 'কাস্টমারকে “আমরা জানাব” ধরনের ছোট মেসেজ গেছে। বিস্তারিত নিচে দেখুন।'], en: ['The AI could not answer', 'The customer got a short “we will get back to you” message. See the details below.'] },
  AI_KEY_INVALID: { bn: ['Gemini key কাজ করছে না', 'Google key গ্রহণ করেনি, তাই বট থেমে আছে। “AI key” পেজে নতুন key দিন।'], en: ['Gemini key is not working', 'Google rejected the key, so the bot is paused. Add a new key in “AI key”.'] },
  AI_KEY_QUOTA: { bn: ['Gemini key-র লিমিট শেষ', 'লিমিট রিসেট হলে বট আবার চলবে, অথবা Google-এ বিলিং চালু করুন।'], en: ['Gemini key limit reached', 'The bot resumes after the limit resets, or enable billing in Google.'] },
  NO_AI_KEY: { bn: ['AI key নেই', 'একজন কাস্টমার মেসেজ করেছেন কিন্তু বট রিপ্লাই দিতে পারেনি। “AI key” পেজে key যোগ করুন।'], en: ['No AI key', 'A customer wrote but the bot could not reply. Add a key in “AI key”.'] },
  PLAN_LIMIT: { bn: ['মাসের AI রিপ্লাই শেষ', 'প্ল্যান আপগ্রেড করুন, অথবা নিজের Gemini key যোগ করুন।'], en: ['Monthly AI replies used up', 'Upgrade your plan, or add your own Gemini key.'] },
};

const fill = (s: string, v: Record<string, string | number> = {}) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''));

const ICON = { ok: CheckCircle2, warn: AlertTriangle, error: XCircle };
const TONE = { ok: 'text-success', warn: 'text-warning', error: 'text-danger' };
const TINT = { ok: 'bg-success/10', warn: 'bg-warning/10', error: 'bg-danger/10' };

export default function HealthPage() {
  const { lang } = useLang();
  const L = (bn: string, en: string) => (lang === 'bn' ? bn : en);
  const loc = lang === 'bn' ? 'bn-BD' : 'en-US';
  const { shop } = useShop();
  const owner = shop.myRole === 'OWNER';

  const [data, setData] = useState<Health | null>(null);
  const [busy, setBusy] = useState<null | 'init' | 'live'>('init');
  const [error, setError] = useState<string | null>(null);
  const [repairing, setRepairing] = useState<string | null>(null);

  const load = async (live: boolean) => {
    setBusy(live ? 'live' : 'init');
    setError(null);
    try {
      const d = await gql<{ shopHealth: Health }>(`query($l:Boolean){ shopHealth(live:$l) }`, { l: live });
      setData(d.shopHealth);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const repair = async (pageId: string) => {
    setRepairing(pageId);
    try {
      await gql(`mutation($p:String!){ shopRepairPage(pageId:$p) }`, { p: pageId });
      toast.success(L('ঠিক করা হয়েছে', 'Fixed'));
      await load(true);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRepairing(null);
    }
  };

  const dismiss = async (id: string) => {
    try {
      await gql(`mutation($i:String!){ shopDismissIssue(id:$i) }`, { i: id });
      setData((d) => (d ? { ...d, issues: d.issues.map((x) => (x.id === id ? { ...x, resolvedAt: new Date().toISOString() } : x)) } : d));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const ago = (iso: string) => {
    const m = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
    if (m < 1) return L('এইমাত্র', 'just now');
    if (m < 60) return `${m.toLocaleString(loc)}${L(' মিনিট আগে', ' min ago')}`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h.toLocaleString(loc)}${L(' ঘণ্টা আগে', ' h ago')}`;
    return `${Math.floor(h / 24).toLocaleString(loc)}${L(' দিন আগে', ' d ago')}`;
  };

  const copyReport = async () => {
    if (!data) return;
    const en = (c: Check) => {
      const t = CHECKS[c.id]?.en;
      return t ? `${fill(t[0], c.vars)}: ${fill(t[1], c.vars)}` : c.id;
    };
    const lines = [
      'Farse AI shop report',
      `Shop: ${shop.name} (${shop.id})`,
      `Time: ${new Date().toISOString()}`,
      '',
      'Checks:',
      ...data.checks.map((c) => `- [${c.status.toUpperCase()}] ${en(c)}`),
      '',
      'Issues:',
      ...(data.issues.length
        ? data.issues.map((i) => `- [${i.severity}] ${i.code}${i.subject ? ` (${i.subject})` : ''} x${i.count}, last ${i.lastAt}${i.resolvedAt ? ' (resolved)' : ''}: ${i.message}${i.detail ? ` | ${i.detail}` : ''}`)
        : ['- none']),
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast.success(L('রিপোর্ট কপি হয়েছে', 'Report copied'));
    } catch {
      toast.error(L('কপি করা যায়নি', 'Could not copy'));
    }
  };

  const open = data?.issues.filter((i) => !i.resolvedAt) ?? [];
  const closed = data?.issues.filter((i) => i.resolvedAt) ?? [];
  const errors = data?.summary.errors ?? 0;
  const warnings = data?.summary.warnings ?? 0;
  const top: Status = errors ? 'error' : warnings ? 'warn' : 'ok';
  const TopIcon = ICON[top];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-[30px]">{L('সমস্যা ও স্বাস্থ্য', 'Health and issues')}</h1>
          <p className="mt-1 text-sm text-muted">{L('আপনার বট ঠিকমতো চলছে কিনা এবং কোনো সমস্যা হলে কী করবেন, সব এখানে।', 'See whether your bot is running properly, and what to do if something goes wrong.')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={copyReport} disabled={!data} className="btn btn-outline btn-sm">
            <Copy className="h-3.5 w-3.5" /> {L('রিপোর্ট কপি', 'Copy report')}
          </button>
          <button onClick={() => load(true)} disabled={busy !== null} className="btn btn-primary btn-sm">
            {busy === 'live' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {L('সম্পূর্ণ চেক চালান', 'Run full check')}
          </button>
        </div>
      </div>

      <ErrorBox message={error} />

      {/* summary */}
      {!data ? (
        busy && <div className="h-24 animate-pulse rounded-xl bg-surface-2" />
      ) : (
        <section className={clsx('card flex items-center gap-4 p-5', TINT[top])}>
          <span className={clsx('grid h-11 w-11 shrink-0 place-items-center rounded-full bg-background', TONE[top])}>
            <TopIcon className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold">
              {errors
                ? L(`${errors.toLocaleString(loc)}টি সমস্যা ঠিক করা দরকার`, `${errors} problem${errors > 1 ? 's' : ''} need attention`)
                : warnings
                  ? L(`চলছে, তবে ${warnings.toLocaleString(loc)}টি বিষয় দেখে নিন`, `Running, but ${warnings} thing${warnings > 1 ? 's' : ''} to review`)
                  : L('সব ঠিক আছে', 'Everything looks good')}
            </p>
            <p className="text-sm text-muted">
              {data.live
                ? L('Facebook-এ লাইভ চেক সম্পন্ন হয়েছে।', 'Live Facebook check completed.')
                : L('Facebook-এর সংযোগ যাচাই করতে “সম্পূর্ণ চেক চালান” চাপুন।', 'Press “Run full check” to test the Facebook connection.')}
            </p>
          </div>
        </section>
      )}

      {/* checks */}
      {data && (
        <section className="card overflow-hidden">
          <div className="px-5 py-4 sm:px-6">
            <h2 className="font-display text-base font-semibold">{L('অবস্থা যাচাই', 'Status checks')}</h2>
          </div>
          <ul className="divide-y divide-border border-t border-border">
            {data.checks.map((c, idx) => {
              const t = CHECKS[c.id]?.[lang === 'bn' ? 'bn' : 'en'];
              const Icon = ICON[c.status];
              return (
                <li key={`${c.id}-${idx}`} className="flex flex-wrap items-center gap-3 px-5 py-4 sm:px-6">
                  <Icon className={clsx('h-5 w-5 shrink-0', TONE[c.status])} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-tight">{t ? fill(t[0], c.vars) : c.id}</p>
                    <p className="mt-0.5 text-sm text-muted">{t ? fill(t[1], c.vars) : ''}</p>
                  </div>
                  {c.fix?.repair && owner && (
                    <button onClick={() => repair(c.fix!.repair!)} disabled={repairing !== null} className="btn btn-primary btn-sm shrink-0">
                      {repairing === c.fix.repair ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}
                      {L('অটো ঠিক করুন', 'Fix automatically')}
                    </button>
                  )}
                  {c.fix?.href &&
                    c.status !== 'ok' &&
                    (c.fix.href.startsWith('#') ? (
                      <a href={c.fix.href} className="btn btn-outline btn-sm shrink-0">
                        {L('দেখুন', 'View')}
                      </a>
                    ) : (
                      <Link href={c.fix.href} className="btn btn-outline btn-sm shrink-0">
                        {L('ঠিক করুন', 'Fix this')}
                      </Link>
                    ))}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* issues */}
      {data && (
        <section id="issues" className="card scroll-mt-24 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 sm:px-6">
            <h2 className="font-display text-base font-semibold">{L('সাম্প্রতিক সমস্যার তালিকা', 'Recent problems')}</h2>
            <span className="text-sm text-muted">{L('শেষ ৭ দিন', 'Last 7 days')}</span>
          </div>
          {!open.length && !closed.length ? (
            <div className="border-t border-border px-6 py-10 text-center">
              <p className="font-medium">{L('কোনো সমস্যা রেকর্ড হয়নি', 'No problems recorded')}</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{L('বট বা Facebook-এ কিছু ভুল হলে এখানে দেখা যাবে।', 'If something goes wrong with the bot or Facebook, it will show up here.')}</p>
            </div>
          ) : (
            <ul className="divide-y divide-border border-t border-border">
              {[...open, ...closed].map((i) => {
                const t = ISSUES[i.code]?.[lang === 'bn' ? 'bn' : 'en'];
                const done = !!i.resolvedAt;
                const sev: Status = done ? 'ok' : i.severity === 'ERROR' ? 'error' : 'warn';
                const Icon = ICON[sev];
                return (
                  <li key={i.id} className={clsx('px-5 py-4 sm:px-6', done && 'opacity-60')}>
                    <div className="flex items-start gap-3">
                      <Icon className={clsx('mt-0.5 h-5 w-5 shrink-0', TONE[sev])} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-tight">{t ? t[0] : i.message}</p>
                        {t && <p className="mt-1 text-sm text-muted">{i.code === 'CONNECT_FAILED' || i.code === 'AI_ERROR' || i.code === 'FB_SEND_FAILED' ? t[1] : t[1]}</p>}
                        <p className="mt-1.5 text-xs text-muted">
                          {i.count > 1 && `${i.count.toLocaleString(loc)}${L(' বার', ' times')} · `}
                          {L('শেষবার ', 'Last ')}
                          {ago(i.lastAt)}
                          {done && ` · ${L('সমাধান হয়েছে', 'Resolved')}`}
                        </p>
                        {i.detail && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs font-medium text-primary">{L('টেকনিক্যাল বিবরণ', 'Technical details')}</summary>
                            <p className="mt-1.5 break-words rounded-lg bg-surface px-3 py-2 font-mono text-xs text-muted">{i.detail}</p>
                          </details>
                        )}
                      </div>
                      {!done && (
                        <button onClick={() => dismiss(i.id)} className="btn btn-ghost h-8 w-8 shrink-0 !p-0" aria-label={L('বন্ধ করুন', 'Dismiss')} title={L('বন্ধ করুন', 'Dismiss')}>
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* help */}
      <section className="card p-5 sm:p-6">
        <h2 className="font-display text-base font-semibold">{L('সমস্যা না মিটলে', 'Still stuck?')}</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted">
          <li>{L('“সম্পূর্ণ চেক চালান” চাপুন। এতে Facebook-এর সংযোগ ও মেসেজ ডেলিভারি লাইভ যাচাই হবে।', 'Press “Run full check” to test the Facebook connection and message delivery live.')}</li>
          <li>{L('কাস্টমারের শেষ মেসেজের ২৪ ঘণ্টা পর Messenger-এ রিপ্লাই যায় না। এটি Facebook-এর নিয়ম, সমস্যা নয়।', 'Messenger does not allow replies 24 hours after the customer’s last message. This is a Facebook rule, not a fault.')}</li>
          <li>{L('তবুও না মিটলে “রিপোর্ট কপি” চেপে রিপোর্টটি সাপোর্টকে পাঠান।', 'If it is still not fixed, press “Copy report” and send it to support.')}</li>
        </ul>
      </section>
    </div>
  );
}