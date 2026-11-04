'use client';

import { motion } from 'framer-motion';
import { Clock, Copy, LogOut, MessageCircle, PhoneCall, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { SUPPORT_PHONE } from '@/lib/shop';

type Props = {
  shopName: string;
  userName: string;
  L: (bn: string, en: string) => string;
  onRefresh: () => Promise<void>;
  onLogout: () => void;
};

export function PendingApproval({ shopName, userName, L, onRefresh, onLogout }: Props) {
  const [checking, setChecking] = useState(false);

  // admin approve korle ekhane nijei unlock hoye jabe (15 sec por por check)
  useEffect(() => {
    const id = setInterval(() => onRefresh().catch(() => {}), 15000);
    return () => clearInterval(id);
  }, [onRefresh]);

  const check = async () => {
    setChecking(true);
    try {
      await onRefresh();
    } finally {
      setChecking(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_PHONE);
      toast.success(L('নম্বর কপি হয়েছে', 'Number copied'));
    } catch {}
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="card w-full max-w-md p-6 text-center sm:p-8">
        <div className="relative mx-auto grid h-16 w-16 place-items-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/15 [animation-duration:2.4s] motion-reduce:hidden" />
          <span className="relative grid h-16 w-16 place-items-center rounded-full bg-primary-soft text-primary">
            <Clock className="h-7 w-7" />
          </span>
        </div>

        <h1 className="mt-5 text-xl font-bold">{L('আপনার অ্যাকাউন্ট অনুমোদনের অপেক্ষায়', 'Your account is awaiting approval')}</h1>
        <p className="mt-2 text-sm text-muted">
          {L(`${userName}, "${shopName}" তৈরি হয়েছে। ফিচার ব্যবহারের আগে আমাদের সাথে যোগাযোগ করুন। আমরা কনফার্ম করলেই চালু হবে।`, `${userName}, "${shopName}" has been created. Please contact us before using the features. It will be unlocked as soon as we confirm.`)}
        </p>

        <ol className="mt-5 space-y-2 text-left text-sm">
          <li className="flex gap-3 rounded-xl bg-surface px-4 py-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
            {L('নিচের নম্বরে কল বা মেসেজ করুন', 'Call or message the number below')}
          </li>
          <li className="flex gap-3 rounded-xl bg-surface px-4 py-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
            {L('আমরা কনফার্ম করলে এই পেজ নিজেই খুলে যাবে', 'Once we confirm, this page opens automatically')}
          </li>
        </ol>

        <div className="mt-5 rounded-2xl border border-border p-4">
          <p className="text-xs text-muted">{L('যোগাযোগ নম্বর', 'Contact number')}</p>
          <button onClick={copy} className="mt-1 inline-flex items-center gap-2 text-2xl font-bold tabular-nums tracking-wide hover:text-primary" title={L('কপি করুন', 'Copy')}>
            {SUPPORT_PHONE}
            <Copy className="h-4 w-4 text-muted" />
          </button>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a href={`tel:${SUPPORT_PHONE}`} className="btn btn-primary">
              <PhoneCall className="h-4 w-4" /> {L('কল করুন', 'Call')}
            </a>
            <a href={`https://wa.me/88${SUPPORT_PHONE}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 text-sm">
          <button onClick={check} disabled={checking} className="btn btn-ghost btn-sm">
            <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} /> {L('স্ট্যাটাস দেখুন', 'Check status')}
          </button>
          <button onClick={onLogout} className="btn btn-ghost btn-sm">
            <LogOut className="h-4 w-4" /> {L('লগআউট', 'Logout')}
          </button>
        </div>
      </motion.div>
    </div>
  );
}