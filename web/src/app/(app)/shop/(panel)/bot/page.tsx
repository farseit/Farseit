'use client';

import clsx from 'clsx';
import { BadgePercent, Bot, HelpCircle, Info, MessageSquareText, ScrollText, Truck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ErrorBox } from '@/components/admin/ui';
import { useShop } from '@/components/shop/ShopShell';
import { useLang } from '@/context/lang';
import { gql } from '@/lib/api';

type Tone = 'FRIENDLY' | 'FORMAL';
type Settings = {
  botName: string;
  tone: Tone;
  insideArea: string;
  deliveryInside: number;
  deliveryOutside: number;
  bargainEnabled: boolean;
  rules: string | null;
};
// form-e taka-r ghor gulo string, jate fnaka rakha jay (0 jar kore na boshe)
type Form = {
  botName: string;
  tone: Tone;
  insideArea: string;
  deliveryInside: string;
  deliveryOutside: string;
  bargainEnabled: boolean;
  rules: string;
};

const toForm = (x: Settings): Form => ({
  botName: x.botName,
  tone: x.tone,
  insideArea: x.insideArea,
  deliveryInside: String(x.deliveryInside),
  deliveryOutside: String(x.deliveryOutside),
  bargainEnabled: x.bargainEnabled,
  rules: x.rules || '',
});

const digits = (v: string) => v.replace(/\D/g, '').slice(0, 4);
const num = (v: string) => Math.min(5000, Number(v.replace(/\D/g, '')) || 0);
const taka = (n: number) => `৳${n.toLocaleString('en-US')}`;

/* ---------- building blocks ---------- */

function Section({ icon: Icon, title, desc, action, children }: { icon: LucideIcon; title: string; desc: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-start gap-3.5 px-5 py-4 sm:px-6">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div>
          <h2 className="flex items-center gap-2 font-display font-semibold leading-tight">
            {title}
            {action}
          </h2>
          <p className="mt-0.5 text-sm text-muted">{desc}</p>
        </div>
      </div>
      <div className="space-y-5 border-t border-border px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}

/* ---------- rules guide ---------- */

/* ---------- rules guide ---------- */

function RulesGuide({ onAdd, canAdd, onClose }: { onAdd: (t: string) => void; canAdd: boolean; onClose: () => void }) {
  // guide shob shomoy age Bangla-e kholbe, upor-er toggle diye English kora jay
  const [bn, setBn] = useState(true);
  const T = (b: string, e: string) => (bn ? b : e);

  const examples = [
    {
      rule: T('ক্যাশ অন ডেলিভারি। অগ্রিম পেমেন্ট লাগবে না।', 'Cash on delivery. No advance payment needed.'),
      q: T('আগে টাকা দিতে হবে?', 'Do I have to pay first?'),
      a: T('না, ক্যাশ অন ডেলিভারি। পণ্য হাতে পেয়ে টাকা দিবেন।', 'No, it is cash on delivery. You pay when you receive the product.'),
    },
    {
      rule: T('ঢাকার ভিতরে ২ দিনে, ঢাকার বাইরে ৩-৫ দিনে ডেলিভারি।', 'Delivery in 2 days inside Dhaka, 3-5 days outside.'),
      q: T('কয়দিনে পাব?', 'How soon will I get it?'),
      a: T('ঢাকার ভিতরে ২ দিনে, বাইরে ৩-৫ দিনে পেয়ে যাবেন। আপনার ঠিকানা কোথায়?', 'Within 2 days inside Dhaka and 3-5 days outside. Where is your address?'),
    },
    {
      rule: T('রিটার্ন বা এক্সচেঞ্জ নেই। ডেলিভারির সময় পণ্যে সমস্যা থাকলে সাথে সাথে জানাতে হবে।', 'No returns or exchanges. Report any damage at the time of delivery.'),
      q: T('পছন্দ না হলে ফেরত দেওয়া যাবে?', 'Can I return it if I do not like it?'),
      a: T('দুঃখিত, রিটার্ন বা এক্সচেঞ্জ নেই। তবে ডেলিভারির সময় পণ্যে সমস্যা থাকলে সাথে সাথে জানাবেন।', 'Sorry, we do not accept returns or exchanges. But if there is a problem when it arrives, please tell us right away.'),
    },
    {
      rule: T('অর্ডারের আগে সাইজ জেনে নিন।', 'Confirm the size before ordering.'),
      q: T('M সাইজ হবে কি না বুঝতে পারছি না', 'I am not sure if M will fit me'),
      a: T('আগে সাইজটা নিশ্চিত করে নেই। আপনার উচ্চতা ও ওজন বললে বলে দিতে পারব। সাইজ ঠিক হলে অর্ডার করে দেব।', 'Let us confirm the size first. Tell me your height and weight and I will help. Once it is right I will place the order.'),
    },
  ];

  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface-2 p-4 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div role="group" aria-label="Language" className="inline-flex rounded-full border border-border bg-background p-0.5 text-xs font-medium">
          {(
            [
              [true, 'বাংলা'],
              [false, 'English'],
            ] as const
          ).map(([isBn, label]) => (
            <button
              key={label}
              type="button"
              onClick={() => setBn(isBn)}
              aria-pressed={bn === isBn}
              className={clsx('rounded-full px-3 py-1 transition-colors', bn === isBn ? 'bg-primary text-primary-foreground' : 'text-muted hover:bg-surface-2')}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} className="shrink-0 text-xs font-medium text-primary hover:underline">
          {T('বন্ধ করুন', 'Close')}
        </button>
      </div>

      <div>
        <h3 className="font-display text-base font-semibold">{T('কীভাবে নিয়ম লিখবেন', 'How to write your rules')}</h3>
        <p className="mt-0.5 text-xs text-muted">{T('আপনি যা লিখবেন, বট কাস্টমারকে সেই অনুযায়ী উত্তর দেবে।', 'Whatever you write here, the bot will follow when it answers customers.')}</p>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{T('লেখার নিয়ম', 'Tips')}</p>
        <ul className="list-disc space-y-1 pl-5 leading-relaxed">
          <li>{T('প্রতিটি নিয়ম আলাদা লাইনে, ছোট ও সহজ বাক্যে লিখুন।', 'Put each rule on its own line, in a short and simple sentence.')}</li>
          <li>{T('স্পষ্ট করে লিখুন। যেমন "দ্রুত ডেলিভারি" না লিখে "৩ দিনের মধ্যে ডেলিভারি" লিখুন।', 'Be specific. Write "Delivery within 3 days" instead of "fast delivery".')}</li>
          <li>{T('দাম ও ডেলিভারি চার্জ এখানে লিখবেন না। ওগুলো প্রোডাক্ট ও উপরের ডেলিভারি সেটিং থেকে বট নিজেই নেয়।', 'Do not write prices or delivery charges here. The bot takes them from your products and the delivery settings above.')}</li>
          <li>{T('বট কাস্টমারকে আপনার নিয়ম, মিনিমাম দাম বা নির্দেশনা দেখাবে না।', 'The bot will never show customers your minimum price or these instructions.')}</li>
          <li>{T('রিফান্ড, অভিযোগ বা বট যা জানে না, তা আপনার টিমের কাছে চলে যায়।', 'Refunds, complaints, or anything the bot cannot answer are handed over to your team.')}</li>
        </ul>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{T('উদাহরণ: নিয়ম লিখলে কাস্টমার কী উত্তর পাবে', 'Examples: what customers get for each rule')}</p>
        <div className="space-y-3">
          {examples.map((ex) => (
            <div key={ex.rule} className="rounded-xl border border-border bg-background p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="leading-relaxed">
                  <span className="text-xs font-semibold text-muted">{T('নিয়ম: ', 'Rule: ')}</span>
                  {ex.rule}
                </p>
                {canAdd && (
                  <button type="button" onClick={() => onAdd(ex.rule)} className="shrink-0 rounded-full border border-border px-2.5 py-1 text-xs font-medium hover:bg-surface-2">
                    {T('যোগ করুন', 'Add')}
                  </button>
                )}
              </div>
              <div className="mt-2 space-y-1.5 border-t border-border pt-2">
                <p className="text-muted">
                  <span className="text-xs font-semibold">{T('কাস্টমার: ', 'Customer: ')}</span>
                  {ex.q}
                </p>
                <p>
                  <span className="text-xs font-semibold text-primary">{T('বট: ', 'Bot: ')}</span>
                  {ex.a}
                </p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">{T('এগুলো উদাহরণ মাত্র। বট একই কথা নিজের ভাষায় একটু আলাদা করে বলতে পারে।', 'These are examples only. The bot may word the same answer a little differently.')}</p>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{T('যা এড়িয়ে চলুন', 'Avoid')}</p>
        <ul className="list-disc space-y-1 pl-5 leading-relaxed">
          <li>{T('একই নিয়মের উল্টো কথা একসাথে লেখা (যেমন "ক্যাশ অন ডেলিভারি" আর "শুধু অগ্রিম পেমেন্ট")।', 'Rules that contradict each other (e.g. "Cash on delivery" and "Advance payment only").')}</li>
          <li>{T('খুব লম্বা অনুচ্ছেদ। বট ছোট নিয়ম ভালো মানে।', 'Long paragraphs. The bot follows short rules best.')}</li>
          <li>{T('বটকে দাম বদলাতে বলা। দাম শুধু প্রোডাক্ট ও দর-কষাকষি সেটিং থেকে ঠিক হয়।', 'Asking the bot to change prices. Prices come only from your products and the bargaining setting.')}</li>
        </ul>
      </div>
    </div>
  );
}


function Field({ label, hint, aside, htmlFor, children }: { label: string; hint?: string; aside?: React.ReactNode; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </label>
        {aside && <span className="text-xs tabular-nums text-muted">{aside}</span>}
      </div>
      {children}
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-xl bg-surface-2', className)} />;
}

/* ---------- live preview ---------- */

function Preview({ f, L }: { f: Form; L: (bn: string, en: string) => string }) {
  const name = f.botName.trim() || 'Assistant';
  const inside = taka(num(f.deliveryInside));
  const outside = taka(num(f.deliveryOutside));
  const area = f.insideArea.trim() || L('ঢাকা সিটির ভিতরে', 'inside the city');
  const formal = f.tone === 'FORMAL';

  const q1 = L('এটার দাম কত? ডেলিভারি চার্জ কত লাগবে?', 'How much is this? What is the delivery charge?');
  const a1 = formal
    ? L(
        `আসসালামু আলাইকুম। পণ্যটির মূল্য ৳1,200। ডেলিভারি চার্জ ${area} হলে ${inside}, বাইরে হলে ${outside}। অর্ডার করতে অনুগ্রহ করে আপনার নাম, ফোন নম্বর ও ঠিকানা জানান।`,
        `Hello. This item is ৳1,200. Delivery is ${inside} if the address is ${area}, otherwise ${outside}. To place the order, kindly share your name, phone number and address.`,
      )
    : L(
        `জি, দাম ৳1,200। ডেলিভারি চার্জ ${area} হলে ${inside}, বাইরে হলে ${outside}। অর্ডার করতে নাম, ফোন নম্বর আর ঠিকানা দিন, আমি এখনই করে দিচ্ছি!`,
        `Sure! It's ৳1,200. Delivery is ${inside} if you're ${area}, otherwise ${outside}. Send your name, phone and address and I'll place the order right away!`,
      );
  const q2 = L('একটু কমানো যাবে?', 'Can you lower the price a bit?');
  const a2 = f.bargainEnabled
    ? formal
      ? L('দামে কিছুটা ছাড় দিতে পারি, তবে নির্ধারিত সর্বনিম্ন মূল্যের নিচে সম্ভব নয়।', 'I can offer a small discount, but not below the lowest price set for this product.')
      : L('একটু ছাড় দিতে পারি, তবে প্রোডাক্টের সর্বনিম্ন দামের নিচে যেতে পারব না।', 'I can do a little off, but I can’t go below the lowest price for this product.')
    : formal
      ? L('দুঃখিত, এই পণ্যের মূল্য নির্ধারিত, কমানো সম্ভব নয়।', 'Sorry, the price for this item is fixed and cannot be reduced.')
      : L('দুঃখিত, দামটা ফিক্সড, কমানো যাবে না।', 'Sorry, the price is fixed, so I can’t lower it.');

  const bubble = (mine: boolean, text: string) => (
    <div className={clsx('flex', mine ? 'justify-start' : 'justify-end')}>
      <p
        className={clsx(
          'max-w-[85%] rounded-xl px-3.5 py-2 text-sm leading-relaxed',
          mine ? 'rounded-bl-md bg-surface-2' : 'rounded-br-md bg-primary text-primary-foreground',
        )}
      >
        {text}
      </p>
    </div>
  );

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border px-5 py-3.5">
        <span className="relative grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground">
          <Bot className="h-[18px] w-[18px]" />
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-success ring-2 ring-background" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">{name}</p>
          <p className="text-xs text-muted">{L('প্রিভিউ', 'Preview')}</p>
        </div>
      </div>
      <div className="space-y-3 bg-surface/60 px-4 py-5">
        {bubble(true, q1)}
        {bubble(false, a1)}
        {bubble(true, q2)}
        {bubble(false, a2)}
      </div>
      <p className="border-t border-border px-5 py-3 text-xs text-muted">
        {L('এটি নমুনা। আসল রিপ্লাই AI প্রতিটি কথোপকথন অনুযায়ী নিজে লেখে।', 'This is a sample. Real replies are written by the AI for each conversation.')}
      </p>
    </div>
  );
}

/* ---------- page ---------- */

export default function BotSettings() {
  const { lang } = useLang();
  const L = (bn: string, en: string) => (lang === 'bn' ? bn : en);
  const { shop } = useShop();
  const owner = shop.myRole === 'OWNER';

  const [f, setF] = useState<Form | null>(null);
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const rulesHelpBtn = (
    <button
      type="button"
      onClick={() => setShowGuide((v) => !v)}
      aria-expanded={showGuide}
      aria-label={L('নিয়ম লেখার গাইড', 'Rules guide')}
      title={L('নিয়ম লেখার গাইড', 'Rules guide')}
      className={clsx(
        'grid h-6 w-6 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        showGuide && 'bg-primary-soft text-primary',
      )}
    >
      <HelpCircle className="h-4 w-4" />
    </button>
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    gql<{ shopBotSettings: Settings }>(`query { shopBotSettings }`)
      .then((d) => {
        const form = toForm(d.shopBotSettings);
        setF(form);
        setSaved(JSON.stringify(form));
      })
      .catch((e) => setLoadError(e.message));
  }, []);

  const patch = (p: Partial<Form>) => setF((x) => (x ? { ...x, ...p } : x));
  const dirty = useMemo(() => !!f && JSON.stringify(f) !== saved, [f, saved]);

  const discard = () => {
    setF(JSON.parse(saved));
    setSaveError(null);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f || !f.botName.trim()) return;
    setBusy(true);
    setSaveError(null);
    try {
      await gql(`mutation($i: JSON!){ shopSaveBotSettings(input: $i) }`, {
        i: {
          botName: f.botName.trim(),
          tone: f.tone,
          insideArea: f.insideArea.trim(),
          deliveryInside: num(f.deliveryInside),
          deliveryOutside: num(f.deliveryOutside),
          bargainEnabled: f.bargainEnabled,
          rules: f.rules.trim(),
        },
      });
      const clean = { ...f, botName: f.botName.trim(), insideArea: f.insideArea.trim(), rules: f.rules.trim(), deliveryInside: String(num(f.deliveryInside)), deliveryOutside: String(num(f.deliveryOutside)) };
      setF(clean);
      setSaved(JSON.stringify(clean));
      toast.success(L('সেভ হয়েছে', 'Saved'));
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const addRule = (text: string) => {
    if (!f || f.rules.includes(text)) return;
    patch({ rules: (f.rules.trim() ? f.rules.trim() + '\n' : '') + text });
  };

  const ruleChips = [
    L('ক্যাশ অন ডেলিভারি।', 'Cash on delivery.'),
    L('৩ দিনের মধ্যে ডেলিভারি।', 'Delivery within 3 days.'),
    L('রিটার্ন বা এক্সচেঞ্জ নেই।', 'No returns or exchanges.'),
    L('অর্ডারের আগে সাইজ জেনে নিন।', 'Confirm the size before ordering.'),
  ];

  const tones: { id: Tone; title: string; sample: string }[] = [
    { id: 'FRIENDLY', title: L('বন্ধুসুলভ', 'Friendly'), sample: L('“জি, অবশ্যই! আমি এখনই দেখে দিচ্ছি।”', '“Sure thing! Let me check that for you.”') },
    { id: 'FORMAL', title: L('ফরমাল', 'Formal'), sample: L('“অনুগ্রহ করে একটু অপেক্ষা করুন, আমি তথ্য জানাচ্ছি।”', '“Kindly wait a moment while I confirm the details.”') },
  ];

  return (
    <div className={clsx('space-y-6', owner && dirty && 'pb-20')}>
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-[30px]">{L('আপনার বট কেমন হবে', 'How your bot talks and sells')}</h1>
        <p className="mt-1 text-sm text-muted">{L('সেভ করা সেটিংস নতুন রিপ্লাইয়ে কাজ করবে।', 'Saved settings are used for new replies.')}</p>
      </div>

      <ErrorBox message={loadError} />

      {!owner && (
        <div className="flex items-start gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
          <span>{L('শুধু শপের মালিক এগুলো বদলাতে পারবেন।', 'Only the shop owner can change these settings.')}</span>
        </div>
      )}
      {owner && !shop.botEnabled && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warning/25 bg-warning/10 px-4 py-3 text-sm">
          <span className="font-medium">{L('বট এখন বন্ধ আছে। চালু না করলে কাস্টমার রিপ্লাই পাবে না।', 'The bot is off, so customers will not get automatic replies.')}</span>
          <Link href="/shop" className="font-semibold text-primary hover:underline">
            {L('ওভারভিউতে গিয়ে চালু করুন', 'Turn it on in Overview')}
          </Link>
        </div>
      )}

      {!f ? (
        !loadError && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-6">
              <Skeleton className="h-56" />
              <Skeleton className="h-64" />
            </div>
            <Skeleton className="h-80" />
          </div>
        )
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <form id="bot-form" onSubmit={save} className="space-y-6">
            <fieldset disabled={!owner} className="min-w-0 space-y-6">
              {/* identity */}
              <Section icon={Bot} title={L('বটের পরিচয়', 'Identity')} desc={L('কাস্টমার বটকে কী নামে চিনবে এবং বট কীভাবে কথা বলবে।', 'What customers call your bot and how it speaks.')}>
                <Field label={L('বটের নাম', 'Bot name')} htmlFor="botName" aside={`${f.botName.length}/40`}>
                  <input id="botName" className="input" required maxLength={40} value={f.botName} onChange={(e) => patch({ botName: e.target.value })} />
                </Field>

                <div>
                  <p className="mb-1.5 text-sm font-medium">{L('কথা বলার ধরন', 'Tone')}</p>
                  <div role="radiogroup" aria-label={L('কথা বলার ধরন', 'Tone')} className="grid gap-3 sm:grid-cols-2">
                    {tones.map((t) => {
                      const on = f.tone === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => patch({ tone: t.id })}
                          className={clsx(
                            'rounded-xl border p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60',
                            on ? 'border-primary bg-primary-soft' : 'border-border bg-background hover:bg-surface',
                          )}
                        >
                          <span className="flex items-center justify-between">
                            <span className="text-sm font-semibold">{t.title}</span>
                            <span className={clsx('grid h-4 w-4 place-items-center rounded-full border-2', on ? 'border-primary' : 'border-border')}>
                              {on && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                            </span>
                          </span>
                          <span className="mt-1.5 block text-xs leading-relaxed text-muted">{t.sample}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Section>

              {/* delivery */}
              <Section icon={Truck} title={L('ডেলিভারি', 'Delivery')} desc={L('ঠিকানা দেখে বট নিজেই ডেলিভারি চার্জ ঠিক করবে।', 'The bot picks the charge from the customer’s address.')}>
                <Field
                  label={L('কোন এলাকাকে “ভিতরে” ধরবেন?', 'Which area counts as “inside”?')}
                  htmlFor="insideArea"
                  hint={L('এর বাইরের সব ঠিকানায় “বাইরে”-র চার্জ লাগবে।', 'Every other address gets the “outside” charge.')}
                  aside={`${f.insideArea.length}/80`}
                >
                  <input id="insideArea" className="input" maxLength={80} value={f.insideArea} onChange={(e) => patch({ insideArea: e.target.value })} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  {(
                    [
                      ['deliveryInside', L('ভিতরে চার্জ', 'Inside charge')],
                      ['deliveryOutside', L('বাইরে চার্জ', 'Outside charge')],
                    ] as const
                  ).map(([key, label]) => (
                    <Field key={key} label={label} htmlFor={key}>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">৳</span>
                        <input
                          id={key}
                          className="input pl-8 tabular-nums"
                          inputMode="numeric"
                          placeholder="0"
                          value={f[key]}
                          onChange={(e) => patch({ [key]: digits(e.target.value) } as Partial<Form>)}
                        />
                      </div>
                    </Field>
                  ))}
                </div>
              </Section>

              {/* bargaining */}
              <Section icon={BadgePercent} title={L('দরদাম', 'Bargaining')} desc={L('কাস্টমার দাম কমাতে বললে বট কী করবে।', 'What the bot does when a customer asks for a lower price.')}>
                <div className="flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{L('দরদাম করতে দিন', 'Allow bargaining')}</p>
                    <p className="mt-0.5 text-sm text-muted">
                      {L('প্রোডাক্টে দেওয়া “সর্বনিম্ন দাম”-এর নিচে বট কখনো নামবে না।', 'The bot never goes below the “lowest price” set on each product.')}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={f.bargainEnabled}
                    aria-label={L('দরদাম করতে দিন', 'Allow bargaining')}
                    onClick={() => patch({ bargainEnabled: !f.bargainEnabled })}
                    className={clsx(
                      'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60',
                      f.bargainEnabled ? 'bg-success' : 'bg-surface-2 ring-1 ring-inset ring-border',
                    )}
                  >
                    <span className={clsx('inline-block h-5 w-5 rounded-full bg-white shadow transition-transform', f.bargainEnabled ? 'translate-x-6' : 'translate-x-1')} />
                  </button>
                </div>
                {f.bargainEnabled && (
                  <p className="rounded-lg bg-surface px-3.5 py-2.5 text-xs text-muted">
                    {L('প্রতিটি প্রোডাক্টে সর্বনিম্ন দাম না দিলে সেই প্রোডাক্টে দরদাম হবে না।', 'Products without a lowest price set are still sold at a fixed price.')}{' '}
                    <Link href="/shop/products" className="font-semibold text-primary hover:underline">
                      {L('প্রোডাক্ট দেখুন', 'Open products')}
                    </Link>
                  </p>
                )}
              </Section>

              {/* rules */}
              <Section icon={ScrollText} title={L('আপনার নিয়ম', 'Your rules')} desc={L('শপের নিজস্ব শর্ত লিখুন, বট সেগুলো মেনে চলবে।', 'Write your shop’s own terms and the bot will follow them.')} action={rulesHelpBtn}>
                {showGuide && <RulesGuide onAdd={addRule} canAdd={owner} onClose={() => setShowGuide(false)} />}
                <Field label={L('নিয়মগুলো', 'Rules')} htmlFor="rules" aside={`${f.rules.length}/3000`}>
                  <textarea
                    id="rules"
                    className="input min-h-[140px] resize-y leading-relaxed"
                    maxLength={3000}
                    placeholder={L('যেমন: ক্যাশ অন ডেলিভারি। ৩ দিনের মধ্যে ডেলিভারি। রিটার্ন নেই।', 'e.g. Cash on delivery. Delivery in 3 days. No returns.')}
                    value={f.rules}
                    onChange={(e) => patch({ rules: e.target.value })}
                  />
                </Field>
                {owner && (
                  <div>
                    <p className="mb-2 text-xs text-muted">{L('ক্লিক করে যোগ করুন', 'Click to add')}</p>
                    <div className="flex flex-wrap gap-2">
                      {ruleChips.map((c) => {
                        const used = f.rules.includes(c);
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => addRule(c)}
                            disabled={used}
                            className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-default disabled:opacity-40"
                          >
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Section>
            </fieldset>
          </form>

          {/* preview */}
          <aside className="lg:sticky lg:top-24">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <MessageSquareText className="h-4 w-4 text-muted" />
              {L('কাস্টমার কেমন উত্তর পাবে', 'What customers will see')}
            </div>
            <Preview f={f} L={L} />
          </aside>
        </div>
      )}

      {/* sticky save bar */}
      {owner && f && dirty && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75 lg:left-64">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 lg:px-8">
            <p className={clsx('min-w-0 truncate text-sm font-medium', saveError && 'text-danger')}>
              {saveError || L('সেভ না করা পরিবর্তন আছে', 'You have unsaved changes')}
            </p>
            <div className="flex shrink-0 gap-2">
              <button type="button" onClick={discard} disabled={busy} className="btn btn-outline btn-sm">
                {L('বাতিল', 'Discard')}
              </button>
              <button type="submit" form="bot-form" disabled={busy || !f.botName.trim()} className="btn btn-primary btn-sm">
                {busy ? L('সেভ হচ্ছে...', 'Saving...') : L('সেভ করুন', 'Save changes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}