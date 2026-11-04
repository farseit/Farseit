'use client';

import { AnimatePresence, MotionConfig, motion, useReducedMotion, type Variants } from 'framer-motion';
import { ArrowLeft, Bell, Check, Eye, EyeOff, Loader2, Lock, Mail, MessageCircle, Phone, Send, Store, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { LangToggle, ThemeToggle } from '@/components/Toggles';
import { useAuth } from '@/context/auth';
import { useLang } from '@/context/lang';
import { gql, TOKEN_KEY } from '@/lib/api';
import { fetchMyShop } from '@/lib/shop';

type Icon = React.ComponentType<{ className?: string }>;
const ease: [number, number, number, number] = [0.2, 0.8, 0.2, 1];
const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } } };
const rise: Variants = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease } } };

function Field({ label, icon: I, children }: { label: string; icon: Icon; children: React.ReactNode }) {
  return (
    <label className="group block">
      <span className="label">{label}</span>
      <span className="relative block">
        <I className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted transition-colors group-focus-within:text-primary" />
        {children}
      </span>
    </label>
  );
}

/** Collapses smoothly when a mode does not need the field */
function Collapse({ show, children, inner = 'space-y-4 pb-4' }: { show: boolean; children: React.ReactNode; inner?: string }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.35, ease }}
          className="-mx-1 overflow-hidden px-1"
        >
          <div className={inner}>{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Msg({ me, children }: { me?: boolean; children: React.ReactNode }) {
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 14, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
      transition={{ type: 'spring', stiffness: 360, damping: 28 }}
      style={{ originX: me ? 0 : 1 }}
      className={`flex ${me ? 'justify-start' : 'justify-end'}`}
    >
      <div className={`max-w-[86%] rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed ${me ? 'rounded-bl-md bg-white/10 text-white' : 'rounded-br-md bg-white text-[#1b2a57]'}`}>{children}</div>
    </motion.div>
  );
}

function Typing() {
  return (
    <motion.div layout="position" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.15 } }} className="flex justify-end">
      <div className="flex items-center gap-1 rounded-2xl rounded-br-md bg-white px-3.5 py-3">
        {[0, 1, 2].map((i) => (
          <span key={i} className="typing-dot h-1.5 w-1.5 rounded-full bg-[#1b2a57]/50" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </motion.div>
  );
}

/** Looping demo: customer asks, AI "types", replies, order confirmed, seller gets notified */
function PhoneDemo({ L }: { L: (bn: string, en: string) => string }) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(reduce ? 4 : 0);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    if (reduce) {
      setStep(4);
      return;
    }
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(() => alive && fn(), ms));
    const run = () => {
      setStep(0);
      setTyping(false);
      at(900, () => setStep(1));
      at(1700, () => setTyping(true));
      at(2900, () => (setTyping(false), setStep(2)));
      at(4700, () => setStep(3));
      at(5500, () => setTyping(true));
      at(6700, () => (setTyping(false), setStep(4)));
      at(13500, run);
    };
    run();
    return () => {
      alive = false;
      timers.forEach(clearTimeout);
    };
  }, [reduce]);

  return (
    <div className="relative mx-auto w-full max-w-[310px]">
      <div className="absolute -z-10 h-64 w-64 -translate-x-8 translate-y-16 rounded-full bg-accent/25 blur-3xl" />
      <div className="rounded-[2.4rem] bg-[#0e1838] p-2 shadow-[0_40px_80px_-24px_rgba(0,0,0,0.7)] ring-1 ring-white/15">
        <div className="overflow-hidden rounded-[1.9rem] bg-[#18244f]">
          <div className="mx-auto mt-2 h-1 w-14 rounded-full bg-white/15" />
          <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground">P</span>
            <div className="leading-tight">
              <div className="text-[13px] font-semibold text-white">{L('আপনার পেজ', 'Your Page')}</div>
              <div className="flex items-center gap-1.5 text-[11px] text-white/60">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
                </span>
                {L('AI রিপ্লাই চালু', 'AI replies on')}
              </div>
            </div>
          </div>

          <div className="flex h-[318px] flex-col justify-end gap-2 overflow-hidden px-3 py-3">
            <AnimatePresence initial={false}>
              {step >= 1 && <Msg key="a" me>{L('ভাইয়া, এই পাঞ্জাবিটার দাম কত? M সাইজ আছে?', 'Hi, how much is this panjabi? Is size M in stock?')}</Msg>}
              {step >= 2 && <Msg key="b">{L('জি, ৳১,২৫০। M সাইজ স্টকে আছে। অর্ডার করতে নাম আর ঠিকানা দিন।', 'Yes, ৳1,250 and size M is in stock. Send your name and address to order.')}</Msg>}
              {step >= 3 && <Msg key="c" me>{L('রাফি, মিরপুর ১০, ঢাকা। 01XXXXXXXXX', 'Rafi, Mirpur 10, Dhaka. 01XXXXXXXXX')}</Msg>}
              {step >= 4 && (
                <Msg key="d">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-success">
                      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                        <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.25, duration: 0.45, ease }} />
                      </svg>
                    </span>
                    {L('অর্ডার কনফার্ম #1042', 'Order confirmed #1042')}
                  </div>
                  <div className="mt-0.5 text-[11.5px] opacity-70">{L('ডেলিভারি ৳৬০ · মোট ৳১,৩১০', 'Delivery ৳60 · Total ৳1,310')}</div>
                </Msg>
              )}
              {typing && <Typing key="t" />}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-2 px-3 pb-3">
            <div className="flex h-9 flex-1 items-center rounded-full bg-white/10 px-3.5 text-[12px] text-white/40">Aa</div>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Send className="h-4 w-4" />
            </span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {step >= 4 && (
          <motion.div
            initial={{ opacity: 0, y: -14, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            transition={{ type: 'spring', stiffness: 320, damping: 24, delay: 0.7 }}
            className="absolute -right-3 top-14 flex items-center gap-2.5 rounded-2xl bg-white px-3 py-2.5 text-[#1b2a57] shadow-2xl xl:-right-8"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Bell className="h-4 w-4" />
            </span>
            <div className="leading-tight">
              <div className="text-[12px] font-bold">{L('নতুন অর্ডার', 'New order')}</div>
              <div className="text-[11px] opacity-65">৳{L('১,৩১০', '1,310')}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StartForm() {
  const { lang } = useLang();
  const L = (bn: string, en: string) => (lang === 'bn' ? bn : en);
  const n = (s: string) => (lang === 'bn' ? s.replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[+d]) : s);
  const { user, loading, login, logout } = useAuth();
  const router = useRouter();
  const sp = useSearchParams();
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({ shopName: '', name: '', phone: '', email: '', password: '' });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const noShop = sp.get('noshop') === '1';
  const wantLogin = sp.get('mode') === 'login';
  useEffect(() => {
    if (wantLogin) setMode('login');
  }, [wantLogin]);
  const reg = mode === 'register';

  // Already login kora + shop ache hole shorasori dashboard-e
  useEffect(() => {
    if (loading || !user || noShop) return;
    if (user.role === 'ADMIN') {
      router.replace('/admin/saas');
      return;
    }
    fetchMyShop()
      .then((s) => s && router.replace('/shop'))
      .catch(() => {});
  }, [loading, user, noShop, router]);

  const switchTo = (m: 'register' | 'login') => {
    setMode(m);
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (reg) {
        const d = await gql<{ shopRegister: { accessToken: string } }>(
          `mutation($input: JSON!){ shopRegister(input: $input) }`,
          { input: { shopName: f.shopName, name: f.name, phone: f.phone, email: f.email || undefined, password: f.password } },
          { token: '' },
        );
        localStorage.setItem(TOKEN_KEY, d.shopRegister.accessToken);
        setDone(true);
        setTimeout(() => (window.location.href = '/shop/connect'), 650); // full reload: auth state notun token diye load hobe
        return;
      }
      const me = await login(f.phone, f.password);
      if (me.role === 'ADMIN') {
        router.replace('/admin/saas');
        return;
      }
      const s = await fetchMyShop();
      if (!s) {
        setError(L('এই অ্যাকাউন্টে কোনো শপ নেই। "রেজিস্টার" থেকে নতুন অ্যাকাউন্ট খুলুন।', 'This account has no shop. Use "Register" to create a new account.'));
        return;
      }
      toast.success(L('স্বাগতম!', 'Welcome back!'));
      router.replace('/shop');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const headline = L('Messenger-এ অটোমেটিক বিক্রি', 'Automatic sales on Messenger');
  const sub = L('আপনার ফেসবুক পেজের কমেন্ট ও মেসেজে AI রিপ্লাই দিবে এবং অর্ডার নিবে। ওয়েবসাইট না থাকলেও চলবে।', 'AI replies to your Facebook Page messages and takes orders. No website needed.');
  const facts = [
    { v: n('24/7'), l: L('অটোমেটিক রিপ্লাই', 'automatic replies') },
    { v: L('অর্ডার', 'Orders'), l: L('চ্যাটেই নেওয়া হয়', 'taken right in chat') },
    { v: L('ইনবক্স', 'Inbox'), l: L('নিজে রিপ্লাই দিতে', 'to reply yourself') },
  ];
  const cta = done ? L('অ্যাকাউন্ট তৈরি হয়েছে', 'Account created') : busy ? L('অপেক্ষা করুন...', 'Please wait...') : reg ? L('রেজিস্টার করুন', 'Register') : L('লগইন', 'Login');

  return (
    <MotionConfig reducedMotion="user">
      <style>{`@keyframes typing-dot{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-4px);opacity:1}}.typing-dot{animation:typing-dot 1s ease-in-out infinite}@media (prefers-reduced-motion:reduce){.typing-dot{animation:none}}`}</style>
      <div className="grid min-h-[100dvh] bg-surface lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        {/* ---------- Brand + live demo (desktop) ---------- */}
        <aside className="relative isolate hidden overflow-hidden bg-[#1b2a57] text-white lg:block">
          <div className="absolute inset-0 -z-10 opacity-70 [background-image:radial-gradient(rgba(255,255,255,0.09)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_at_60%_55%,black,transparent_72%)]" />
          <motion.div variants={stagger} initial="hidden" animate="show" className="flex h-full min-h-[100dvh] flex-col justify-between gap-10 p-12 xl:p-16">
            <motion.div variants={rise}>
              <Link
                href="/"
                aria-label={L('হোম পেজ', 'Home page')}
                className="inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <MessageCircle className="h-5 w-5" />
                </span>
                <span className="text-lg font-bold tracking-tight">Farse AI</span>
              </Link>
            </motion.div>

            <div className="grid items-center gap-10 xl:grid-cols-[1fr_auto]">
              <motion.div variants={rise}>
                <h1 className="max-w-md text-4xl font-extrabold leading-[1.2] tracking-tight xl:text-[2.6rem]">{headline}</h1>
                <p className="mt-4 max-w-sm text-base leading-relaxed text-white/70">{sub}</p>
              </motion.div>
              <motion.div variants={rise} className="px-2 xl:w-[310px]">
                <PhoneDemo L={L} />
              </motion.div>
            </div>

            <motion.dl variants={rise} className="grid max-w-md grid-cols-3 gap-4">
              {facts.map((x) => (
                <div key={x.l} className="border-l border-white/15 pl-4">
                  <dt className="text-2xl font-bold">{x.v}</dt>
                  <dd className="mt-0.5 text-xs leading-snug text-white/60">{x.l}</dd>
                </div>
              ))}
            </motion.dl>
          </motion.div>
        </aside>

        {/* ---------- Form ---------- */}
        <main className="flex flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-8">
          <div className="flex items-center justify-between">
            <Link href="/" aria-label={L('হোম পেজ', 'Home page')} className="flex items-center gap-2 lg:hidden">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <MessageCircle className="h-4 w-4" />
              </span>
              <span className="font-bold tracking-tight">Farse AI</span>
            </Link>
            <Link
              href="/"
              className="hidden items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 lg:inline-flex"
            >
              <ArrowLeft className="h-4 w-4" /> {L('হোমে ফিরুন', 'Back to home')}
            </Link>
            <div className="flex items-center">
              <ThemeToggle />
              <LangToggle />
            </div>
          </div>

          <motion.div variants={stagger} initial="hidden" animate="show" className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center py-4 lg:max-w-[540px]">
            <motion.div variants={rise} className="mb-6 lg:hidden">
              <h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">{headline}</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted">{sub}</p>
            </motion.div>

            <motion.div variants={rise} className="card p-5 shadow-xl shadow-primary/5 sm:p-7">
              {user && noShop && (
                <div className="mb-5 rounded-xl bg-accent/10 p-3 text-sm">
                  {L('আপনি লগইন করা আছেন, কিন্তু এই অ্যাকাউন্টে কোনো শপ নেই।', 'You are logged in, but this account has no shop.')}{' '}
                  <button className="font-semibold underline" onClick={logout}>
                    {L('লগআউট', 'Logout')}
                  </button>
                </div>
              )}

              <div role="tablist" className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1 text-sm font-semibold">
                {(['register', 'login'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={mode === m}
                    onClick={() => switchTo(m)}
                    className={`relative rounded-lg py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${mode === m ? '' : 'text-muted hover:text-foreground'}`}
                  >
                    {mode === m && <motion.span layoutId="tab-pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} className="absolute inset-0 rounded-lg bg-background shadow-sm" />}
                    <span className="relative">{m === 'register' ? L('রেজিস্টার', 'Register') : L('লগইন', 'Login')}</span>
                  </button>
                ))}
              </div>

              <div className="mt-5 min-h-[3.75rem]">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={mode} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
                    <h2 className="text-xl font-bold tracking-tight">{reg ? L('আপনার শপ রেজিস্টার করুন', 'Register your shop') : L('আবার স্বাগতম', 'Welcome back')}</h2>
                    <p className="mt-1 text-sm text-muted">{reg ? L('১ মিনিটে অ্যাকাউন্ট খুলে পেজ কানেক্ট করুন।', 'Create an account and connect your Page in a minute.') : L('আপনার শপে লগইন করুন।', 'Log in to your shop.')}</p>
                  </motion.div>
                </AnimatePresence>
              </div>

                            <form onSubmit={submit} className="mt-4">
                {error && (
                  <div role="alert" className="animate-shake mb-4 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
                    {error}
                  </div>
                )}

                <Collapse show={reg} inner="grid gap-4 pb-4 sm:grid-cols-2">
                  <Field label={L('শপের নাম', 'Shop name')} icon={Store}>
                    <input className="input !py-2.5 pl-10" required={reg} minLength={2} autoComplete="organization" value={f.shopName} onChange={set('shopName')} />
                  </Field>
                  <Field label={L('আপনার নাম', 'Your name')} icon={User}>
                    <input className="input !py-2.5 pl-10" required={reg} minLength={2} autoComplete="name" value={f.name} onChange={set('name')} />
                  </Field>
                </Collapse>

                <div className={`grid gap-4 pb-4 ${reg ? 'sm:grid-cols-2' : ''}`}>
                  <Field label={reg ? L('মোবাইল নম্বর', 'Mobile number') : L('মোবাইল নম্বর বা ইমেইল', 'Mobile or email')} icon={Phone}>
                    <input
                      className="input !py-2.5 pl-10"
                      required
                      inputMode={reg ? 'tel' : 'text'}
                      autoComplete={reg ? 'tel' : 'username'}
                      placeholder="01XXXXXXXXX"
                      value={f.phone}
                      onChange={set('phone')}
                    />
                  </Field>
                  {reg && (
                    <Field label={L('ইমেইল (ঐচ্ছিক)', 'Email (optional)')} icon={Mail}>
                      <input className="input !py-2.5 pl-10" type="email" autoComplete="email" value={f.email} onChange={set('email')} />
                    </Field>
                  )}
                </div>

                <Field label={L('পাসওয়ার্ড', 'Password')} icon={Lock}>
                  <input
                    className="input !py-2.5 pl-10 pr-11"
                    type={show ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete={reg ? 'new-password' : 'current-password'}
                    value={f.password}
                    onChange={set('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    aria-label={show ? L('পাসওয়ার্ড লুকান', 'Hide password') : L('পাসওয়ার্ড দেখান', 'Show password')}
                    className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </Field>

                <button className={`btn mt-5 w-full !py-2.5 text-[15px] ${done ? 'bg-success text-white' : 'btn-primary'}`} disabled={busy || done}>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span key={cta} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.16 }} className="flex items-center gap-2">
                      {busy && !done && <Loader2 className="h-4 w-4 animate-spin" />}
                      {done && <Check className="h-4 w-4" strokeWidth={3} />}
                      {cta}
                    </motion.span>
                  </AnimatePresence>
                </button>
              </form>

              {reg && <p className="mt-4 text-center text-xs leading-relaxed text-muted">{L('নতুন অ্যাকাউন্টে নিজে থেকেই ফ্রি ট্রায়াল চালু হয়, ড্যাশবোর্ডে দেখতে পাবেন।', 'New accounts get a free trial automatically. You can see it in your dashboard.')}</p>}
              <p className="mt-4 border-t border-border pt-3 text-center text-sm text-muted">
                {reg ? L('আগে থেকেই অ্যাকাউন্ট আছে?', 'Already have an account?') : L('নতুন এসেছেন?', 'New here?')}{' '}
                <button type="button" onClick={() => switchTo(reg ? 'login' : 'register')} className="font-semibold text-primary hover:underline">
                  {reg ? L('লগইন করুন', 'Log in') : L('রেজিস্টার করুন', 'Register')}
                </button>
              </p>
            </motion.div>
          </motion.div>
        </main>
      </div>
    </MotionConfig>
  );
}

export default function ShopStartPage() {
  return (
    <Suspense>
      <StartForm />
    </Suspense>
  );
}