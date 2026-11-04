'use client';

import clsx from 'clsx';
import { AlertTriangle, ExternalLink, Eye, EyeOff, KeyRound, Loader2, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useShop } from '@/components/shop/ShopShell';
import { useLang } from '@/context/lang';
import { gql } from '@/lib/api';

type KeyState = {
  configured: boolean;
  status: 'NONE' | 'OK' | 'INVALID' | 'QUOTA';
  last4: string | null;
  lastError: string | null;
  checkedAt: string | null;
};

const AI_STUDIO = 'https://aistudio.google.com/apikey';

export default function AiKeyPage() {
  const { lang } = useLang();
  const L = (bn: string, en: string) => (lang === 'bn' ? bn : en);
  const loc = lang === 'bn' ? 'bn-BD' : 'en-US';
  const { shop } = useShop();
  const owner = shop.myRole === 'OWNER';

  const [st, setSt] = useState<KeyState | null>(null);
  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<'save' | 'test' | 'remove' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    gql<{ shopAiKey: KeyState }>(`query { shopAiKey }`)
      .then((d) => setSt(d.shopAiKey))
      .catch((e) => setError(e.message));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    setBusy('save');
    setError(null);
    try {
      const d = await gql<{ shopSaveAiKey: KeyState }>(`mutation($k:String!){ shopSaveAiKey(key:$k) }`, { k: value.trim() });
      setSt(d.shopSaveAiKey);
      setValue('');
      setShow(false);
      toast.success(L('কী সেভ ও যাচাই হয়েছে', 'Key saved and verified'));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy('test');
    setError(null);
    try {
      const d = await gql<{ shopTestAiKey: KeyState }>(`mutation { shopTestAiKey }`);
      setSt(d.shopTestAiKey);
      if (d.shopTestAiKey.status === 'OK') toast.success(L('কী ঠিক আছে', 'Key is working'));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy('remove');
    setError(null);
    try {
      await gql(`mutation { shopRemoveAiKey }`);
      setSt({ configured: false, status: 'NONE', last4: null, lastError: null, checkedAt: null });
      setConfirmRemove(false);
      toast.success(L('কী মুছে ফেলা হয়েছে', 'Key removed'));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const configured = !!st?.configured;
  const meta = {
    NONE: {
      badge: 'bg-surface-2 text-muted',
      label: L('যোগ করা হয়নি', 'Not added'),
      text: L('একটি Gemini key যোগ করুন, তাহলে বট কাস্টমারকে রিপ্লাই দিতে পারবে।', 'Add a Gemini key so the bot can reply to your customers.'),
    },
    OK: {
      badge: 'bg-success/15 text-success',
      label: L('কাজ করছে', 'Working'),
      text: L('AI রিপ্লাইয়ের খরচ আপনার Google অ্যাকাউন্ট থেকে যাচ্ছে।', 'AI replies are billed to your Google account.'),
    },
    INVALID: {
      badge: 'bg-danger/10 text-danger',
      label: L('কাজ করছে না', 'Invalid'),
      text: L('Google এই key গ্রহণ করেনি, তাই বট থেমে আছে। নতুন key বানিয়ে নিচে দিন।', 'Google rejected this key, so the bot is paused. Create a new key and add it below.'),
    },
    QUOTA: {
      badge: 'bg-warning/15 text-warning',
      label: L('লিমিট শেষ', 'Limit reached'),
      text: L('Google জানিয়েছে key-র লিমিট শেষ। লিমিট রিসেট হলে বট আবার চলবে, অথবা Google-এ বিলিং চালু করুন।', 'Google reported this key hit its limit. The bot resumes after it resets, or you can enable billing in Google.'),
    },
  }[st?.status ?? 'NONE'];

  const steps = [
    {
      title: L('Google AI Studio খুলুন', 'Open Google AI Studio'),
      desc: (
        <>
          {L('যে কোনো Google (Gmail) অ্যাকাউন্ট দিয়ে লগইন করুন: ', 'Sign in with any Google (Gmail) account: ')}
          <a href={AI_STUDIO} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
            aistudio.google.com/apikey <ExternalLink className="h-3 w-3" />
          </a>
        </>
      ),
    },
    { title: L('“Create API key” চাপুন', 'Click “Create API key”'), desc: L('একটি প্রজেক্ট বেছে নিন, না থাকলে নতুন প্রজেক্টে key বানান।', 'Pick a project, or create the key in a new project.') },
    { title: L('key-টি কপি করুন', 'Copy the key'), desc: L('সাধারণত AIza দিয়ে শুরু হয়। পুরোটা কপি করুন।', 'It usually starts with AIza. Copy the whole key.') },
    { title: L('এখানে পেস্ট করে সেভ করুন', 'Paste it here and save'), desc: L('আমরা Google-এ যাচাই করে নিরাপদে এনক্রিপ্ট করে রাখব।', 'We verify it with Google and store it encrypted.') },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{L('আপনার Gemini AI key', 'Your Gemini AI key')}</h1>
        <p className="mt-1 text-sm text-muted">
          {L('বট আপনার নিজের Google Gemini key দিয়ে কাস্টমারকে রিপ্লাই দেয়, তাই AI-এর খরচ আপনার Google অ্যাকাউন্টে যায়।', 'Your bot replies using your own Google Gemini key, so the AI cost goes to your Google account.')}
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* status */}
          <section className="card p-5 sm:p-6">
            {!st && !error ? (
              <div className="h-24 animate-pulse rounded-xl bg-surface-2" />
            ) : (
              <>
                <div className="flex items-start gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                    <KeyRound className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{L('key-র অবস্থা', 'Key status')}</h2>
                      <span className={clsx('badge', meta.badge)}>{meta.label}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted">{meta.text}</p>
                    {configured && (
                      <p className="mt-3 text-sm">
                        <span className="font-mono tracking-wider text-muted">••••••••••••</span>
                        <span className="font-mono font-semibold">{st!.last4}</span>
                        {st!.checkedAt && (
                          <span className="ml-3 text-xs text-muted">
                            {L('শেষ যাচাই: ', 'Last checked: ')}
                            {new Date(st!.checkedAt).toLocaleString(loc, { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>

                {configured && owner && (
                  <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                    <button onClick={test} disabled={busy !== null} className="btn btn-outline btn-sm">
                      {busy === 'test' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      {L('আবার যাচাই করুন', 'Test again')}
                    </button>
                    {confirmRemove ? (
                      <span className="flex items-center gap-2 text-sm">
                        <span className="text-muted">{L('মুছে ফেললে বট থেমে যাবে।', 'The bot will stop replying.')}</span>
                        <button onClick={() => setConfirmRemove(false)} disabled={busy !== null} className="btn btn-ghost btn-sm">
                          {L('বাতিল', 'Cancel')}
                        </button>
                        <button onClick={remove} disabled={busy !== null} className="btn btn-danger btn-sm">
                          {busy === 'remove' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                          {L('মুছুন', 'Remove')}
                        </button>
                      </span>
                    ) : (
                      <button onClick={() => setConfirmRemove(true)} disabled={busy !== null} className="btn btn-ghost btn-sm text-danger hover:bg-danger/10">
                        <Trash2 className="h-3.5 w-3.5" /> {L('key মুছুন', 'Remove key')}
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </section>

          {/* add / replace */}
          {owner ? (
            <form onSubmit={save} className="card p-5 sm:p-6">
              <h2 className="font-semibold">{configured ? L('key বদলান', 'Replace key') : L('key যোগ করুন', 'Add your key')}</h2>
              <label htmlFor="aikey" className="mb-1.5 mt-4 block text-sm font-medium">
                {L('Gemini API key', 'Gemini API key')}
              </label>
              <div className="relative">
                <input
                  id="aikey"
                  type={show ? 'text' : 'password'}
                  className="input pr-11 font-mono"
                  placeholder="AIza..."
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-surface-2"
                  aria-label={show ? L('লুকান', 'Hide key') : L('দেখান', 'Show key')}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {error && (
                <div className="mt-3 flex items-start gap-3 rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-2 text-xs text-muted">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  {L('সেভ করার পর key আর দেখানো হবে না, শেষ ৪ অক্ষর ছাড়া।', 'After saving, the key is never shown again except its last 4 characters.')}
                </p>
                <button type="submit" disabled={busy !== null || !value.trim()} className="btn btn-primary">
                  {busy === 'save' && <Loader2 className="h-4 w-4 animate-spin" />}
                  {busy === 'save' ? L('যাচাই হচ্ছে...', 'Verifying...') : L('সেভ ও যাচাই করুন', 'Save and verify')}
                </button>
              </div>
            </form>
          ) : (
            <p className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-muted">
              {L('শুধু শপের মালিক key যোগ বা বদলাতে পারবেন।', 'Only the shop owner can add or change the key.')}
            </p>
          )}
        </div>

        {/* right column: nতুন হলে guide আগে দেখায় */}
        <div className={clsx('space-y-6', !configured && 'max-lg:order-first')}>
          <section className="card p-5">
            <h2 className="font-semibold">{L('key কীভাবে পাবেন', 'How to get your key')}</h2>
            <ol className="mt-4 space-y-4">
              {steps.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary">{(i + 1).toLocaleString(loc)}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-tight">{s.title}</p>
                    <p className="mt-0.5 text-xs text-muted">{s.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs text-muted">{L('Google-এর পেজের বাটনের নাম একটু আলাদা হতে পারে।', 'Button names on Google’s page may look slightly different.')}</p>
          </section>

          <section className="card p-5">
            <h2 className="font-semibold">{L('জেনে রাখুন', 'Good to know')}</h2>
            <ul className="mt-3 space-y-3 text-sm text-muted">
              <li>{L('খরচ আপনার Google অ্যাকাউন্টে যায়, Farse AI-তে নয়।', 'Costs are billed to your Google account, not to Farse AI.')}</li>
              <li>{L('ফ্রি key-তে Google প্রতিদিনের লিমিট রাখে, যা বদলাতে পারে। লিমিট শেষ হলে বট থামবে ও আপনি নোটিফিকেশন পাবেন।', 'Google’s free keys have usage limits that can change. If you hit one, the bot pauses and you get a notification.')}</li>
              <li>{L('ফ্রি টিয়ারে Google প্রম্পটের লেখা নিজেদের প্রোডাক্ট উন্নত করতে ব্যবহার করতে পারে, যেখানে কাস্টমারের নাম, ফোন ও ঠিকানা থাকতে পারে। Google-এর বর্তমান শর্ত দেখে নিন।', 'On Google’s free tier, Google may use prompts to improve its products, and these can include customer names, phones and addresses. Check Google’s current terms.')}</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}