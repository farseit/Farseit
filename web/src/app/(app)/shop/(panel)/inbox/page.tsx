'use client';

import clsx from 'clsx';
import { AlertTriangle, ArrowLeft, Bot, BotOff, Loader2, MessageSquare, Search, Send, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useLang } from '@/context/lang';
import { gql } from '@/lib/api';
import { dateFmt, money, num } from '@/lib/format';

type Chat = {
  id: string;
  name: string | null;
  aiEnabled: boolean;
  handoffUntil: string | null;
  unread: number;
  lastText: string | null;
  lastFrom: string | null;
  lastMessageAt: string;
};
type Msg = { id: string; role: 'USER' | 'BOT' | 'ADMIN'; text: string; createdAt: string };
type ChatOrder = { id: string; number: number; total: number; status: string };
type Filter = 'ALL' | 'UNREAD' | 'NEEDS' | 'HUMAN';
type Mode = 'BOT' | 'HUMAN' | 'OFF';

const handoffActive = (c: Chat) => !!c.handoffUntil && new Date(c.handoffUntil) > new Date();
const modeOf = (c: Chat): Mode => (!c.aiEnabled ? 'OFF' : handoffActive(c) ? 'HUMAN' : 'BOT');

const AV = [
  'bg-rose-100 text-rose-700',
  'bg-sky-100 text-sky-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-violet-100 text-violet-700',
  'bg-teal-100 text-teal-700',
];
function Avatar({ name, size = 'h-11 w-11' }: { name: string; size?: string }) {
  const s = (name || '?').trim() || '?';
  let h = 0;
  for (let k = 0; k < s.length; k++) h += s.charCodeAt(k);
  return <div className={clsx('flex shrink-0 items-center justify-center rounded-full text-sm font-bold', size, AV[h % AV.length])}>{s.charAt(0).toUpperCase()}</div>;
}

const orderTone: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  CONFIRMED: 'bg-primary/10 text-primary',
  SHIPPED: 'bg-primary/10 text-primary',
  DELIVERED: 'bg-success/15 text-success',
  CANCELLED: 'bg-danger/10 text-danger',
};

function InboxInner() {
  const { lang } = useLang();
  const L = (bn: string, en: string) => (lang === 'bn' ? bn : en);
  const router = useRouter();
  const sp = useSearchParams();
  const sel = sp.get('chat');

  const [chats, setChats] = useState<Chat[] | null>(null);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [open, setOpen] = useState<{ chat: Chat; messages: Msg[]; orders: ChatOrder[] } | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');

  const bottom = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const stick = useRef(true);

  const orderLabel: Record<string, string> = {
    PENDING: L('পেন্ডিং', 'Pending'),
    CONFIRMED: L('কনফার্মড', 'Confirmed'),
    SHIPPED: L('শিপড', 'Shipped'),
    DELIVERED: L('ডেলিভার্ড', 'Delivered'),
    CANCELLED: L('বাতিল', 'Cancelled'),
  };

  const quick = [
    L('ধন্যবাদ! 😊', 'Thank you! 😊'),
    L('একটু অপেক্ষা করুন, আমি দেখছি।', 'Please wait a moment, I am checking.'),
    L('আপনার নাম, ফোন নম্বর ও পুরো ঠিকানা দিন।', 'Please share your name, phone number and full address.'),
    L('আপনার অর্ডার কনফার্ম হয়েছে।', 'Your order has been confirmed.'),
  ];

  // ---------- time helpers ----------
  const hm = (iso: string) =>
    new Date(iso).toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const listTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    if (sameDay(d, now)) return hm(iso);
    if (sameDay(d, new Date(now.getTime() - 86400000))) return L('গতকাল', 'Yesterday');
    return dateFmt(iso, lang, false);
  };
  const dayLabel = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    if (sameDay(d, now)) return L('আজ', 'Today');
    if (sameDay(d, new Date(now.getTime() - 86400000))) return L('গতকাল', 'Yesterday');
    return dateFmt(iso, lang, false);
  };

  // ---------- data ----------
  const loadList = useCallback(() => {
    gql<{ shopChats: { items: Chat[]; unreadTotal: number } }>(`query { shopChats(take: 100) }`)
      .then((d) => {
        setChats(d.shopChats.items);
        setUnreadTotal(d.shopChats.unreadTotal || 0);
      })
      .catch(() => {});
  }, []);

  const loadChat = useCallback((id: string) => {
    gql<{ shopChat: { chat: Chat; messages: Msg[]; orders: ChatOrder[] } }>(`query($id:String!){ shopChat(id:$id) }`, { id })
      .then((d) => {
        setOpen(d.shopChat);
        setChats((cs) => cs && cs.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
      })
      .catch((e) => toast.error(e.message));
  }, []);

  useEffect(() => {
    loadList();
    const id = setInterval(loadList, 12000);
    return () => clearInterval(id);
  }, [loadList]);

  useEffect(() => {
    setOpen(null);
    stick.current = true;
    if (!sel) return;
    loadChat(sel);
    const id = setInterval(() => loadChat(sel), 6000);
    return () => clearInterval(id);
  }, [sel, loadChat]);

  useEffect(() => {
    if (stick.current) bottom.current?.scrollIntoView({ block: 'end' });
  }, [open?.messages.length, open?.chat.id]);

  useEffect(() => {
    const ta = area.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 128)}px`;
  }, [text]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const pick = (id: string | null) => router.replace(id ? `/shop/inbox?chat=${id}` : '/shop/inbox');

  const send = async (override?: string) => {
    const t = (override ?? text).trim();
    if (!t || !sel || sending) return;
    setSending(true);
    try {
      const d = await gql<{ shopReply: Msg }>(`mutation($c:String!,$t:String!){ shopReply(chatId:$c, text:$t) }`, { c: sel, t });
      setText('');
      stick.current = true;
      setOpen((o) => o && { ...o, messages: [...o.messages, d.shopReply], chat: { ...o.chat, handoffUntil: new Date(Date.now() + 6 * 3600 * 1000).toISOString() } });
      loadList();
    } catch (e: any) {
      toast.error(e.message, { duration: 6000 });
    } finally {
      setSending(false);
    }
  };

  const setBot = async (on: boolean) => {
    if (!open) return;
    try {
      await gql(`mutation($c:String!,$on:Boolean!){ shopSetChatBot(chatId:$c, on:$on) }`, { c: open.chat.id, on });
      toast.success(on ? L('এই চ্যাটে বট চালু', 'Bot is on for this chat') : L('এই চ্যাটে বট বন্ধ', 'Bot is off for this chat'));
      loadChat(open.chat.id);
      loadList();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const who = (c: Chat) => c.name || L('কাস্টমার', 'Customer');

  // ---------- derived ----------
  const counts = useMemo(() => {
    const cs = chats || [];
    return {
      ALL: cs.length,
      UNREAD: cs.filter((c) => c.unread > 0).length,
      NEEDS: cs.filter((c) => c.lastFrom === 'CUSTOMER').length,
      HUMAN: cs.filter((c) => modeOf(c) !== 'BOT').length,
    } as Record<Filter, number>;
  }, [chats]);

  const shown = useMemo(() => {
    if (!chats) return null;
    const t = q.trim().toLowerCase();
    return chats.filter((c) => {
      if (filter === 'UNREAD' && !(c.unread > 0)) return false;
      if (filter === 'NEEDS' && c.lastFrom !== 'CUSTOMER') return false;
      if (filter === 'HUMAN' && modeOf(c) === 'BOT') return false;
      if (!t) return true;
      return `${c.name || ''} ${c.lastText || ''}`.toLowerCase().includes(t);
    });
  }, [chats, q, filter]);

  const rows = useMemo(() => {
    if (!open) return [];
    const out: ({ kind: 'day'; key: string; label: string } | { kind: 'msg'; m: Msg; first: boolean })[] = [];
    let prevDay = '';
    let prevRole = '';
    for (const m of open.messages) {
      const d = new Date(m.createdAt);
      const dk = d.toDateString();
      if (dk !== prevDay) {
        out.push({ kind: 'day', key: `d-${dk}`, label: dayLabel(m.createdAt) });
        prevDay = dk;
        prevRole = '';
      }
      out.push({ kind: 'msg', m, first: m.role !== prevRole });
      prevRole = m.role;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open?.messages, lang]);

  const lastUserAt = open ? [...open.messages].reverse().find((m) => m.role === 'USER')?.createdAt : undefined;
  const windowClosed = !!lastUserAt && Date.now() - new Date(lastUserAt).getTime() > 24 * 3600 * 1000;
  const mode = open ? modeOf(open.chat) : 'BOT';

  const tabs: { id: Filter; label: string }[] = [
    { id: 'ALL', label: L('সব', 'All') },
    { id: 'UNREAD', label: L('অপঠিত', 'Unread') },
    { id: 'NEEDS', label: L('রিপ্লাই বাকি', 'Needs reply') },
    { id: 'HUMAN', label: L('আপনি হ্যান্ডেল করছেন', 'Handled by you') },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <div className="grid h-[calc(100vh-6.5rem)] min-h-[540px] gap-4 lg:grid-cols-[370px_1fr]">
        {/* ====================== chat list ====================== */}
        <div className={clsx('card flex min-h-0 flex-col overflow-hidden', sel && 'hidden lg:flex')}>
          <div className="space-y-3 border-b border-border p-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-extrabold tracking-tight">{L('ইনবক্স', 'Inbox')}</h1>
              {unreadTotal > 0 && (
                <span className="rounded-full bg-danger px-2.5 py-0.5 text-xs font-bold text-white">
                  {num(unreadTotal, lang)} {L('নতুন', 'new')}
                </span>
              )}
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input className="input !pl-9" placeholder={L('নাম বা মেসেজ খুঁজুন', 'Search name or message')} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setFilter(t.id)}
                  className={clsx(
                    'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                    filter === t.id ? 'bg-primary text-white shadow-sm' : 'bg-surface-2 text-muted hover:text-primary',
                  )}
                >
                  {t.label}
                  <span className={clsx('rounded-full px-1.5 text-[10px] font-bold leading-4', filter === t.id ? 'bg-white/25' : 'bg-border/60')}>{num(counts[t.id], lang)}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {shown === null ? (
              <div className="space-y-1 p-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex animate-pulse items-center gap-3 rounded-xl p-3">
                    <div className="h-11 w-11 rounded-full bg-surface-2" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-1/3 rounded bg-surface-2" />
                      <div className="h-3 w-3/4 rounded bg-surface-2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : shown.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <MessageSquare className="h-7 w-7" />
                </div>
                <p className="font-bold">{chats && chats.length ? L('কোনো চ্যাট মেলেনি', 'No chats match') : L('এখনো কোনো মেসেজ আসেনি', 'No messages yet')}</p>
                <p className="text-sm text-muted">
                  {chats && chats.length ? L('ফিল্টার বা সার্চ বদলে দেখুন।', 'Try another filter or search.') : L('কাস্টমার আপনার পেজে মেসেজ করলে এখানে দেখা যাবে।', 'Customer messages from your Page will show up here.')}
                </p>
              </div>
            ) : (
              <div className="p-2">
                {shown.map((c) => {
                  const m = modeOf(c);
                  const active = sel === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => pick(c.id)}
                      className={clsx('flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors', active ? 'bg-primary/10' : 'hover:bg-surface-2')}
                    >
                      <div className="relative">
                        <Avatar name={who(c)} />
                        <span
                          className={clsx('absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white text-white', m === 'BOT' ? 'bg-success' : m === 'HUMAN' ? 'bg-amber-400' : 'bg-muted')}
                          title={m === 'BOT' ? L('বট উত্তর দিচ্ছে', 'Bot replying') : m === 'HUMAN' ? L('আপনি হ্যান্ডেল করছেন', 'You are handling') : L('বট বন্ধ', 'Bot off')}
                        >
                          {m === 'OFF' ? <BotOff className="h-2.5 w-2.5" /> : <Bot className="h-2.5 w-2.5" />}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className={clsx('truncate text-sm', c.unread ? 'font-extrabold' : 'font-semibold')}>{who(c)}</p>
                          <span className={clsx('shrink-0 text-[11px]', c.unread ? 'font-bold text-primary' : 'text-muted')}>{listTime(c.lastMessageAt)}</span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2">
                          <p className={clsx('truncate text-xs', c.unread ? 'font-semibold' : 'text-muted')}>
                            {c.lastFrom === 'BOT' && <span className="text-primary">{L('বট', 'Bot')}: </span>}
                            {c.lastFrom === 'ADMIN' && <span className="text-muted">{L('আপনি', 'You')}: </span>}
                            {c.lastText}
                          </p>
                          {c.unread > 0 && <span className="min-w-5 shrink-0 rounded-full bg-danger px-1.5 text-center text-[11px] font-bold leading-5 text-white">{c.unread}</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ====================== conversation ====================== */}
        <div className={clsx('card flex min-h-0 flex-col overflow-hidden', !sel && 'hidden lg:flex')}>
          {!sel ? (
            <div className="m-auto flex flex-col items-center gap-3 px-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MessageSquare className="h-8 w-8" />
              </div>
              <p className="text-base font-bold">{L('একটি চ্যাট বেছে নিন', 'Select a conversation')}</p>
              <p className="max-w-xs text-sm text-muted">{L('বাঁ দিক থেকে কাস্টমার বেছে নিলে মেসেজ ও অর্ডার এখানে দেখা যাবে।', 'Pick a customer on the left to see their messages and orders.')}</p>
            </div>
          ) : !open ? (
            <div className="m-auto flex items-center gap-2 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> {L('লোড হচ্ছে...', 'Loading...')}
            </div>
          ) : (
            <>
              {/* header */}
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <button className="btn btn-ghost h-9 w-9 shrink-0 !p-0 lg:hidden" onClick={() => pick(null)} aria-label="Back">
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <Avatar name={who(open.chat)} size="h-10 w-10" />
                  <div className="min-w-0">
                    <p className="truncate font-extrabold leading-tight">{who(open.chat)}</p>
                    <p className="flex items-center gap-1.5 text-xs text-muted">
                      <span className={clsx('h-2 w-2 rounded-full', mode === 'BOT' ? 'bg-success' : mode === 'HUMAN' ? 'bg-amber-400' : 'bg-muted')} />
                      {mode === 'BOT' ? L('বট উত্তর দিচ্ছে', 'Bot is replying') : mode === 'HUMAN' ? L('আপনি হ্যান্ডেল করছেন', 'You are handling this chat') : L('এই চ্যাটে বট বন্ধ', 'Bot is off for this chat')}
                    </p>
                  </div>
                </div>
                <button className={clsx('btn btn-sm shrink-0 gap-1.5', mode === 'BOT' ? 'btn-outline' : 'btn-primary')} onClick={() => setBot(mode !== 'BOT')}>
                  {mode === 'BOT' ? <BotOff className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  <span className="hidden sm:inline">{mode === 'BOT' ? L('বট বন্ধ করুন', 'Pause bot') : L('বট চালু করুন', 'Resume bot')}</span>
                </button>
              </div>

              {/* orders strip */}
              {open.orders.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto border-b border-border bg-surface-2/60 px-4 py-2">
                  <ShoppingBag className="h-4 w-4 shrink-0 text-muted" />
                  {open.orders.map((o) => (
                    <Link key={o.id} href="/shop/orders" className="flex shrink-0 items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-semibold transition-colors hover:border-primary/40">
                      #{o.number} · {money(o.total, lang)}
                      <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-bold', orderTone[o.status] || 'bg-surface-2 text-muted')}>{orderLabel[o.status] || o.status}</span>
                    </Link>
                  ))}
                </div>
              )}

              {/* messages */}
              <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto bg-surface-2/40 px-4 py-4">
                {open.messages.length === 0 && <p className="mt-10 text-center text-sm text-muted">{L('এখনো কোনো মেসেজ নেই।', 'No messages yet.')}</p>}
                {rows.map((r) =>
                  r.kind === 'day' ? (
                    <div key={r.key} className="my-4 flex justify-center">
                      <span className="rounded-full bg-border/60 px-3 py-0.5 text-[11px] font-semibold text-muted">{r.label}</span>
                    </div>
                  ) : (
                    <div key={r.m.id} className={clsx('flex', r.m.role === 'USER' ? 'justify-start' : 'justify-end', r.first ? 'mt-3' : 'mt-1')}>
                      <div className={clsx('max-w-[82%] sm:max-w-[70%]', r.m.role !== 'USER' && 'flex flex-col items-end')}>
                        {r.first && r.m.role !== 'USER' && (
                          <span className="mb-0.5 flex items-center gap-1 px-1 text-[10px] font-bold uppercase tracking-wide text-muted">
                            {r.m.role === 'BOT' ? (
                              <>
                                <Bot className="h-3 w-3" /> {L('বট', 'Bot')}
                              </>
                            ) : (
                              L('আপনি', 'You')
                            )}
                          </span>
                        )}
                        <div
                          className={clsx(
                            'whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm',
                            r.m.role === 'USER' && 'rounded-tl-md bg-white text-foreground ring-1 ring-border dark:bg-surface-2',
                            r.m.role === 'BOT' && 'rounded-tr-md bg-primary/10',
                            r.m.role === 'ADMIN' && 'rounded-tr-md bg-primary text-primary-foreground',
                          )}
                        >
                          {r.m.text}
                        </div>
                        <span className="mt-0.5 px-1 text-[10px] text-muted">{hm(r.m.createdAt)}</span>
                      </div>
                    </div>
                  ),
                )}
                <div ref={bottom} />
              </div>

              {/* notices */}
              {windowClosed && (
                <div className="flex items-start gap-2 border-t border-border bg-amber-50 px-4 py-2 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{L('কাস্টমারের শেষ মেসেজের ২৪ ঘণ্টা পার হয়ে গেছে। Messenger এখন আপনার রিপ্লাই পৌঁছে দেবে না। ফোন করে যোগাযোগ করুন।', "It's been over 24 hours since the customer's last message. Messenger will not deliver your reply. Please contact them by phone.")}</span>
                </div>
              )}
              {mode !== 'BOT' && (
                <div className="flex items-center justify-between gap-3 border-t border-border bg-primary/5 px-4 py-2 text-xs">
                  <span className="text-muted">
                    {mode === 'HUMAN' && open.chat.handoffUntil
                      ? L(`আপনি রিপ্লাই দিয়েছেন, তাই বট ${hm(open.chat.handoffUntil)} পর্যন্ত বিরতিতে।`, `You replied, so the bot is paused until ${hm(open.chat.handoffUntil)}.`)
                      : L('এই চ্যাটে বট বন্ধ। কাস্টমারকে আপনাকেই উত্তর দিতে হবে।', 'The bot is off for this chat. You need to reply yourself.')}
                  </span>
                  <button className="shrink-0 font-bold text-primary hover:underline" onClick={() => setBot(true)}>
                    {L('বট চালু করুন', 'Resume bot')}
                  </button>
                </div>
              )}

              {/* composer */}
              <div className="border-t border-border p-3">
                <div className="mb-2 flex gap-1.5 overflow-x-auto pb-0.5">
                  {quick.map((qr) => (
                    <button key={qr} onClick={() => setText((t) => (t ? `${t} ${qr}` : qr))} className="shrink-0 rounded-full border border-border bg-surface-2 px-3 py-1 text-xs font-medium text-muted transition-colors hover:border-primary/40 hover:text-primary">
                      {qr}
                    </button>
                  ))}
                </div>
                <div className="flex items-end gap-2">
                  <textarea
                    ref={area}
                    className="input max-h-32 min-h-[44px] resize-none"
                    rows={1}
                    maxLength={1900}
                    placeholder={L('রিপ্লাই লিখুন... (Enter = পাঠান, Shift+Enter = নতুন লাইন)', 'Write a reply... (Enter to send, Shift+Enter for a new line)')}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                  />
                  <button className="btn btn-primary h-11 w-11 shrink-0 !p-0" onClick={() => send()} disabled={sending || !text.trim()} aria-label="Send">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
                {text.length > 1500 && <p className="mt-1 text-right text-[11px] text-muted">{text.length}/1900</p>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ShopInbox() {
  return (
    <Suspense>
      <InboxInner />
    </Suspense>
  );
}