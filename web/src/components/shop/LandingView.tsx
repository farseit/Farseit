'use client';
import { BrandLogo } from '@/components/BrandLogo';

import clsx from 'clsx';
import { AnimatePresence, LayoutGroup, MotionConfig, animate, motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Loader2, MapPin, MessageCircle, Minus, Phone, PhoneCall, Plus, ShieldCheck, Truck, User } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { gql } from '@/lib/api';

export type LandingData = {
  code: string;
  name: string;
  description: string | null;
  price: number;
  images: string[];
  options: { name: string; values: string[] }[];
  inStock: boolean;
  maxQty: number;
  canBargain: boolean;
  accepting: boolean;
  shopName: string;
  messengerUrl: string | null;
  delivery: { inside: number; outside: number; insideArea: string };
};

const EASE = [0.22, 1, 0.36, 1] as const;

// Page load-e ekta-i sequence: gallery age, tarpor dan dik-er content ekta ekta kore
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } } };
const rise = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } } };

/** Songkha poriborton hole notun songkhay gorie jay (subtotal, delivery, total) */
function AnimatedNumber({ value, locale }: { value: number; locale: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fmt = (n: number) => `৳${Math.round(n).toLocaleString(locale)}`;
    if (reduce || prev.current === value) {
      el.textContent = fmt(value);
      prev.current = value;
      return;
    }
    const c = animate(prev.current, value, { duration: 0.5, ease: EASE, onUpdate: (v) => (el.textContent = fmt(v)) });
    prev.current = value;
    return () => c.stop();
  }, [value, locale, reduce]);
  return <span ref={ref}>{`৳${value.toLocaleString(locale)}`}</span>;
}

function Field({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-muted" />
      {children}
    </div>
  );
}

export function LandingView({ data }: { data: LandingData }) {
  // customer-der jonno Bangla age, alada toggle
  const [lang, setLang] = useState<'bn' | 'en'>('bn');
  const L = (bn: string, en: string) => (lang === 'bn' ? bn : en);
  const loc = lang === 'bn' ? 'bn-BD' : 'en-US';
  const taka = (n: number) => `৳${n.toLocaleString(loc)}`;

  const [qty, setQty] = useState(1);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [zone, setZone] = useState<'INSIDE' | 'OUTSIDE'>('INSIDE');
  const [f, setF] = useState({ name: '', phone: '', address: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errKey, setErrKey] = useState(0);
  const [done, setDone] = useState<{ number: number; total: number } | null>(null);

  // gallery
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState(1);
  const [origin, setOrigin] = useState('50% 50%');
  const imgs = data.images;
  const go = (n: number) => {
    if (!imgs.length) return;
    setDir(n >= idx ? 1 : -1);
    setIdx((n + imgs.length) % imgs.length);
  };

  // description
  const [open, setOpen] = useState(false);
  const longDesc = (data.description || '').length > 220;

  // mobile sticky bar: order form dekha gele lukiye jay
  const orderRef = useRef<HTMLElement>(null);
  const [orderSeen, setOrderSeen] = useState(false);
  useEffect(() => {
    const el = orderRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setOrderSeen(e.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, [done]);

  const canOrder = data.inStock && data.accepting;
  const max = Math.max(1, data.maxQty);
  const delivery = zone === 'INSIDE' ? data.delivery.inside : data.delivery.outside;
  const subtotal = data.price * qty;
  const total = subtotal + delivery;

  const fail = (msg: string) => {
    setError(msg);
    setErrKey((k) => k + 1);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const missing = data.options.find((o) => !chosen[o.name]);
    if (missing) {
      fail(L(`${missing.name} বেছে নিন`, `Please choose ${missing.name}`));
      document.getElementById('options')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setBusy(true);
    try {
      const d = await gql<{ shopLandingOrder: { number: number; total: number } }>(`mutation($c:String!,$i:JSON!){ shopLandingOrder(code:$c, input:$i) }`, {
        c: data.code,
        i: { name: f.name, phone: f.phone, address: f.address, zone, qty, options: chosen },
      });
      setDone(d.shopLandingOrder);
      document.getElementById('order')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err: any) {
      fail(err.message);
    } finally {
      setBusy(false);
    }
  };

  const messenger = (small = false) =>
    data.messengerUrl && (
      <a href={data.messengerUrl} target="_blank" rel="noopener noreferrer" className={clsx('btn btn-outline', small && 'btn-sm')}>
        <MessageCircle className="h-4 w-4" /> {L('মেসেজে কথা বলুন', 'Chat on Messenger')}
      </a>
    );

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-surface pb-28 lg:pb-14">
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">{(data.shopName || '?').trim().charAt(0).toUpperCase()}</span>
              <p className="truncate text-[15px] font-bold">{data.shopName}</p>
            </div>
            <button onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')} className="btn btn-outline btn-sm shrink-0 !rounded-full">
              {lang === 'bn' ? 'English' : 'বাংলা'}
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
            {/* ======================= gallery ======================= */}
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }} className="min-w-0 lg:sticky lg:top-24 lg:self-start">
              <div
                role="group"
                aria-roledescription="carousel"
                aria-label={data.name}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight') go(idx + 1);
                  if (e.key === 'ArrowLeft') go(idx - 1);
                }}
                onMouseMove={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
                }}
                className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-background outline-none focus-visible:ring-2 focus-visible:ring-primary/40 lg:aspect-[4/5]"
              >
                {imgs.length ? (
                  <AnimatePresence initial={false}>
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: dir * 40 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: dir * -40 }}
                      transition={{ duration: 0.4, ease: EASE }}
                      drag={imgs.length > 1 ? 'x' : false}
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={0.25}
                      onDragEnd={(_, i) => {
                        if (i.offset.x < -60) go(idx + 1);
                        else if (i.offset.x > 60) go(idx - 1);
                      }}
                      className="absolute inset-0 cursor-grab active:cursor-grabbing"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imgs[idx]}
                        alt={idx === 0 ? data.name : ''}
                        draggable={false}
                        style={{ transformOrigin: origin }}
                        className="h-full w-full select-none object-cover transition-transform duration-500 ease-out [@media(hover:hover)]:group-hover:scale-[1.4]"
                        loading={idx === 0 ? 'eager' : 'lazy'}
                      />
                    </motion.div>
                  </AnimatePresence>
                ) : (
                  <div className="grid h-full place-items-center text-sm text-muted">{L('ছবি নেই', 'No image')}</div>
                )}

                {imgs.length > 1 && (
                  <>
                    <button type="button" aria-label={L('আগের ছবি', 'Previous photo')} onClick={() => go(idx - 1)} className="absolute left-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-border bg-background/95 opacity-0 shadow-card transition focus-visible:opacity-100 group-hover:opacity-100 sm:grid">
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button type="button" aria-label={L('পরের ছবি', 'Next photo')} onClick={() => go(idx + 1)} className="absolute right-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-border bg-background/95 opacity-0 shadow-card transition focus-visible:opacity-100 group-hover:opacity-100 sm:grid">
                      <ChevronRight className="h-5 w-5" />
                    </button>
                    <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
                      {imgs.map((_, i) => (
                        <motion.span key={i} animate={{ width: i === idx ? 20 : 6, opacity: i === idx ? 1 : 0.6 }} transition={{ duration: 0.3 }} className="h-1.5 rounded-full bg-white shadow-sm ring-1 ring-black/10" />
                      ))}
                    </div>
                  </>
                )}
              </div>

              {imgs.length > 1 && (
                <LayoutGroup id="thumbs">
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {imgs.map((src, i) => (
                      <button key={src + i} type="button" aria-label={`${L('ছবি', 'Photo')} ${i + 1}`} onClick={() => go(i)} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border bg-background">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="" className={clsx('h-full w-full object-cover transition-opacity', i === idx ? 'opacity-100' : 'opacity-55 hover:opacity-100')} />
                        {i === idx && <motion.span layoutId="thumb-ring" className="absolute inset-0 rounded-lg ring-2 ring-inset ring-primary" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                      </button>
                    ))}
                  </div>
                </LayoutGroup>
              )}
            </motion.div>

            {/* ======================= details ======================= */}
            <motion.div variants={stagger} initial="hidden" animate="show" className="min-w-0 space-y-6">
              <motion.div variants={rise} className="space-y-3">
                <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-[32px]">{data.name}</h1>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="text-3xl font-bold tabular-nums text-primary">{taka(data.price)}</span>
                  {data.inStock ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                      <span className="h-1.5 w-1.5 rounded-full bg-success" />
                      {L('স্টকে আছে', 'In stock')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-danger/10 px-2.5 py-1 text-xs font-semibold text-danger">
                      <span className="h-1.5 w-1.5 rounded-full bg-danger" />
                      {L('স্টক শেষ', 'Out of stock')}
                    </span>
                  )}
                </div>
              </motion.div>

              {/* ekta line-e shob info, alada alada card na */}
              <motion.ul variants={rise} className="space-y-2 border-y border-border py-4 text-sm text-muted">
                <li className="flex items-center gap-2.5">
                  <Truck className="h-4 w-4 shrink-0 text-primary" />
                  <span>
                    {data.delivery.insideArea || L('শহরের ভিতরে', 'Inside the city')} <b className="font-semibold text-foreground">{taka(data.delivery.inside)}</b>
                    <span className="mx-2 text-border">|</span>
                    {L('বাইরে', 'Outside')} <b className="font-semibold text-foreground">{taka(data.delivery.outside)}</b>
                  </span>
                </li>
                <li className="flex items-center gap-2.5">
                  <PhoneCall className="h-4 w-4 shrink-0 text-primary" />
                  <span>{L('অর্ডারের পর দোকান যোগাযোগ করে কনফার্ম করবে', 'The shop will contact you to confirm your order')}</span>
                </li>
              </motion.ul>

              {!data.accepting && (
                <motion.p variants={rise} className="rounded-xl border border-warning/25 bg-warning/10 px-4 py-3 text-sm font-medium">
                  {L('এই দোকান এখন অর্ডার নিচ্ছে না।', 'This shop is not taking orders right now.')}
                </motion.p>
              )}

              {data.options.length > 0 && (
                <motion.div variants={rise} id="options" className="scroll-mt-24 space-y-5">
                  {data.options.map((o) => (
                    <div key={o.name}>
                      <p className="mb-2.5 flex items-baseline gap-2 text-sm font-semibold">
                        {o.name}
                        <AnimatePresence mode="wait">
                          {chosen[o.name] && (
                            <motion.span key={chosen[o.name]} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="font-normal text-muted">
                              {chosen[o.name]}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </p>
                      <LayoutGroup id={`opt-${o.name}`}>
                        <div className="flex flex-wrap gap-2">
                          {o.values.map((v) => {
                            const on = chosen[o.name] === v;
                            return (
                              <motion.button
                                key={v}
                                type="button"
                                aria-pressed={on}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setChosen((c) => ({ ...c, [o.name]: v }))}
                                className={clsx(
                                  'relative min-w-[3rem] rounded-lg border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                                  on ? 'border-primary' : 'border-border bg-background hover:border-primary/50',
                                )}
                              >
                                {on && <motion.span layoutId="opt-pill" className="absolute inset-0 rounded-[inherit] bg-primary" transition={{ type: 'spring', stiffness: 520, damping: 36 }} />}
                                <span className={clsx('relative', on && 'text-primary-foreground')}>{v}</span>
                              </motion.button>
                            );
                          })}
                        </div>
                      </LayoutGroup>
                    </div>
                  ))}
                </motion.div>
              )}

              {data.description && (
                <motion.div variants={rise}>
                  <h2 className="mb-2 text-sm font-semibold">{L('বিবরণ', 'Details')}</h2>
                  <motion.div animate={{ height: longDesc && !open ? 96 : 'auto' }} initial={false} transition={{ duration: 0.35, ease: EASE }} className="relative overflow-hidden">
                    <p className="whitespace-pre-line text-[15px] leading-relaxed text-muted">{data.description}</p>
                    {longDesc && !open && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-surface to-transparent" />}
                  </motion.div>
                  {longDesc && (
                    <button type="button" onClick={() => setOpen((v) => !v)} className="mt-1.5 text-sm font-semibold text-primary hover:underline">
                      {open ? L('কম দেখুন', 'Show less') : L('আরও পড়ুন', 'Read more')}
                    </button>
                  )}
                </motion.div>
              )}

              {data.canBargain && data.messengerUrl && (
                <motion.div variants={rise} className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted">{L('দাম নিয়ে কথা বলতে চান?', 'Want to talk about the price?')}</p>
                  {messenger(true)}
                </motion.div>
              )}

              {/* ======================= order ======================= */}
              <motion.section variants={rise} id="order" ref={orderRef} className="card scroll-mt-20 overflow-hidden p-5 sm:p-6">
                <AnimatePresence mode="wait" initial={false}>
                  {done ? (
                    <motion.div key="done" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35, ease: EASE }} className="py-4 text-center">
                      <div className="relative mx-auto grid h-20 w-20 place-items-center">
                        <motion.span initial={{ scale: 0.7, opacity: 0.5 }} animate={{ scale: 1.5, opacity: 0 }} transition={{ duration: 1, ease: 'easeOut', delay: 0.5 }} className="absolute inset-2 rounded-full bg-success/30" />
                        <svg viewBox="0 0 52 52" className="relative h-16 w-16" fill="none">
                          <motion.circle cx="26" cy="26" r="24" className="stroke-success" strokeWidth="3" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, ease: EASE }} />
                          <motion.path d="M15 27l8 8 14-16" className="stroke-success" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, delay: 0.45, ease: EASE }} />
                        </svg>
                      </div>
                      <h2 className="mt-3 text-xl font-bold">{L('অর্ডার হয়েছে!', 'Order placed!')}</h2>
                      <p className="mt-1 text-sm text-muted">
                        {L('অর্ডার নম্বর', 'Order number')} <span className="font-semibold text-foreground">#{done.number.toLocaleString(loc)}</span> · {L('মোট', 'Total')}{' '}
                        <span className="font-semibold text-foreground">{taka(done.total)}</span>
                      </p>
                      <p className="mx-auto mt-3 max-w-sm text-sm text-muted">{L('দোকান শীঘ্রই আপনার সাথে যোগাযোগ করে অর্ডার কনফার্ম করবে।', 'The shop will contact you shortly to confirm your order.')}</p>
                      {data.messengerUrl && <div className="mt-5 flex justify-center">{messenger()}</div>}
                    </motion.div>
                  ) : (
                    <motion.form key="form" exit={{ opacity: 0, y: -8 }} onSubmit={submit} className="space-y-4">
                      <h2 className="text-lg font-bold">{L('অর্ডার করুন', 'Place your order')}</h2>

                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{L('পরিমাণ', 'Quantity')}</span>
                        <div className="flex items-center rounded-xl border border-border">
                          <button type="button" aria-label="-" disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid h-10 w-10 place-items-center rounded-l-xl hover:bg-surface-2 disabled:opacity-40">
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="relative grid h-10 w-9 place-items-center overflow-hidden text-sm font-bold tabular-nums">
                            <AnimatePresence mode="popLayout" initial={false}>
                              <motion.span key={qty} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} transition={{ duration: 0.18 }}>
                                {qty.toLocaleString(loc)}
                              </motion.span>
                            </AnimatePresence>
                          </span>
                          <button type="button" aria-label="+" disabled={qty >= max} onClick={() => setQty((q) => Math.min(max, q + 1))} className="grid h-10 w-10 place-items-center rounded-r-xl hover:bg-surface-2 disabled:opacity-40">
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div>
                        <label htmlFor="ln" className="label">{L('আপনার নাম', 'Your name')}</label>
                        <Field icon={User}>
                          <input id="ln" className="input !py-3 !pl-10" required minLength={2} maxLength={80} autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
                        </Field>
                      </div>
                      <div>
                        <label htmlFor="lp" className="label">{L('মোবাইল নম্বর', 'Mobile number')}</label>
                        <Field icon={Phone}>
                          <input id="lp" className="input !py-3 !pl-10" required inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
                        </Field>
                      </div>
                      <div>
                        <label htmlFor="la" className="label">{L('পূর্ণ ঠিকানা', 'Full address')}</label>
                        <Field icon={MapPin}>
                          <textarea id="la" className="input min-h-[88px] resize-y !py-3 !pl-10" required minLength={10} maxLength={300} autoComplete="street-address" placeholder={L('এলাকা, রোড, বাসা নম্বর, জেলা', 'Area, road, house, district')} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
                        </Field>
                      </div>

                      <fieldset>
                        <legend className="label">{L('ডেলিভারি এলাকা', 'Delivery area')}</legend>
                        <LayoutGroup id="zones">
                          <div className="grid gap-2 sm:grid-cols-2">
                            {(
                              [
                                ['INSIDE', data.delivery.insideArea || L('শহরের ভিতরে', 'Inside the city'), data.delivery.inside],
                                ['OUTSIDE', L('এর বাইরে', 'Outside this area'), data.delivery.outside],
                              ] as const
                            ).map(([z, label, fee]) => (
                              <label key={z} className="relative flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm">
                                {zone === z && <motion.span layoutId="zone-ring" className="absolute inset-0 rounded-[inherit] border-2 border-primary bg-primary-soft" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                                <span className="relative flex items-center gap-2.5">
                                  <input type="radio" name="zone" className="accent-[var(--primary,#273c75)]" checked={zone === z} onChange={() => setZone(z)} />
                                  <span className="font-medium">{label}</span>
                                </span>
                                <span className="relative font-semibold tabular-nums">{taka(fee)}</span>
                              </label>
                            ))}
                          </div>
                        </LayoutGroup>
                      </fieldset>

                      <dl className="space-y-2 border-t border-border pt-4 text-sm">
                        <div className="flex justify-between">
                          <dt className="text-muted">{L('পণ্যের দাম', 'Subtotal')}</dt>
                          <dd className="font-medium tabular-nums"><AnimatedNumber value={subtotal} locale={loc} /></dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted">{L('ডেলিভারি চার্জ', 'Delivery charge')}</dt>
                          <dd className="font-medium tabular-nums"><AnimatedNumber value={delivery} locale={loc} /></dd>
                        </div>
                        <div className="flex items-baseline justify-between pt-1">
                          <dt className="font-bold">{L('মোট', 'Total')}</dt>
                          <dd className="text-xl font-bold tabular-nums text-primary"><AnimatedNumber value={total} locale={loc} /></dd>
                        </div>
                      </dl>

                      <AnimatePresence>
                        {error && (
                          <motion.p key={errKey} role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="animate-shake overflow-hidden rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
                            {error}
                          </motion.p>
                        )}
                      </AnimatePresence>

                      <motion.button whileTap={{ scale: 0.985 }} className="btn btn-primary w-full !rounded-xl !py-3.5 text-[15px]" disabled={busy || !canOrder}>
                        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                        {!data.inStock ? L('স্টক শেষ', 'Out of stock') : !data.accepting ? L('এখন অর্ডার নেওয়া হচ্ছে না', 'Not taking orders') : L('অর্ডার কনফার্ম করুন', 'Confirm order')}
                      </motion.button>

                      <p className="flex items-start gap-2 text-xs text-muted">
                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                        {L(`আপনার তথ্য শুধু ${data.shopName}-এর কাছে যাবে।`, `Your details are shared only with ${data.shopName}.`)}
                      </p>
                    </motion.form>
                  )}
                </AnimatePresence>
              </motion.section>

              {!data.canBargain && data.messengerUrl && !done && (
                <motion.div variants={rise} className="flex justify-center">
                  {messenger()}
                </motion.div>
              )}
            </motion.div>
          </div>

          <p className="mt-12 text-center text-xs text-muted">
            {L('চালিত', 'Powered by')}{' '}
            <Link href="/shop/start" className="inline-flex items-center gap-1 align-middle font-semibold hover:underline"><BrandLogo className="h-6 w-auto" /><span className="font-display">AI</span></Link>
          </p>
        </main>

        {/* ---------- mobile sticky bar: order form-er kache gele nime jay ---------- */}
        <AnimatePresence>
          {canOrder && !done && !orderSeen && (
            <motion.div
              initial={{ y: '110%' }}
              animate={{ y: 0 }}
              exit={{ y: '110%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
              className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden"
            >
              <div className="mx-auto flex max-w-xl items-center gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted">{L('মূল্য', 'Price')}</p>
                  <p className="text-lg font-bold leading-tight tabular-nums">{taka(data.price)}</p>
                </div>
                <a href="#order" className="btn btn-primary ml-auto !rounded-xl !px-7 !py-3 text-[15px]">
                  {L('অর্ডার করুন', 'Order now')}
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}