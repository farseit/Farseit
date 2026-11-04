'use client';

import clsx from 'clsx';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ErrorBox, PageHeader } from '@/components/admin/ui';
import { useShop } from '@/components/shop/ShopShell';
import { useLang } from '@/context/lang';
import { gql } from '@/lib/api';
import { dateFmt, money, num } from '@/lib/format';
import type { ShopAccess } from '@/lib/shop';

type Plan = { id: string; name: string; price: number; replies: number; pages: number };
type Payment = { id: string; plan: string; months: number; amount: number; method: string; trxId: string; status: 'PENDING' | 'APPROVED' | 'REJECTED'; note: string | null; createdAt: string };
type Billing = {
  access: ShopAccess;
  plans: Plan[];
  months: number[];
  payTo: { bkash: string; nagad: string; note: string };
  payments: Payment[];
};

export default function ShopBilling() {
  const { lang } = useLang();
  const L = (bn: string, en: string) => (lang === 'bn' ? bn : en);
  const { shop, refresh } = useShop();
  const owner = shop.myRole === 'OWNER';
  const [b, setB] = useState<Billing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ plan: 'PRO', months: 1, method: 'BKASH', senderNumber: '', trxId: '' });

  const load = useCallback(() => {
    gql<{ shopBilling: Billing }>(`query { shopBilling }`)
      .then((d) => setB(d.shopBilling))
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const plan = b?.plans.find((p) => p.id === f.plan);
  const amount = plan ? plan.price * f.months : 0;
  const payNo = b ? (f.method === 'NAGAD' ? b.payTo.nagad : b.payTo.bkash) : '';
  const pending = b?.payments.some((p) => p.status === 'PENDING');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await gql(`mutation($i: JSON!){ shopSubmitPayment(input: $i) }`, { i: f });
      toast.success(L('পেমেন্ট জমা হয়েছে। যাচাই শেষে প্ল্যান চালু হবে।', 'Payment submitted. Your plan starts once it is verified.'));
      setF({ ...f, trxId: '' });
      load();
      refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const a = b?.access;
  const pct = a ? Math.min(100, Math.round((a.used / a.limit) * 100)) : 0;
  const statusLabel = { PENDING: L('যাচাই চলছে', 'Checking'), APPROVED: L('অনুমোদিত', 'Approved'), REJECTED: L('বাতিল', 'Rejected') };

  return (
    <div>
      <PageHeader title={L('প্ল্যান ও বিল', 'Plan & billing')} />
      <ErrorBox message={error} />
      {!b || !a ? (
        <p className="text-sm text-muted">{L('লোড হচ্ছে...', 'Loading...')}</p>
      ) : (
        <>
          <div className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xl font-display font-semibold">{a.planName}</p>
              {a.daysLeft !== null && (
                <span className={clsx('badge', a.daysLeft > 3 ? 'bg-success/15 text-success' : 'bg-danger/10 text-danger')}>
                  {a.daysLeft >= 0 ? L(`আর ${a.daysLeft} দিন`, `${a.daysLeft} days left`) : L('মেয়াদ শেষ', 'Expired')}
                </span>
              )}
            </div>
            {a.expiresAt && <p className="mt-0.5 text-xs text-muted">{L('মেয়াদ', 'Valid until')}: {dateFmt(a.expiresAt, lang)}</p>}

            <p className="mt-4 text-sm font-semibold">
              {L('এই মাসের AI রিপ্লাই', 'AI replies this month')}: {num(a.used, lang)} / {num(a.limit, lang)}
            </p>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-surface-2">
              <div className={clsx('h-full rounded-full', pct >= 90 ? 'bg-danger' : 'bg-primary')} style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted">{L(`পেজ লিমিট: ${a.pagesLimit}টি। লিমিট শেষ হলে বট বন্ধ হয়ে যায়, ইনবক্স ও অর্ডার আগের মতোই দেখা যায়।`, `Page limit: ${a.pagesLimit}. When the limit is reached the bot pauses; inbox and orders stay available.`)}</p>
          </div>

          {owner && (
            <form onSubmit={submit} className="card mt-5 space-y-4 p-5">
              <p className="font-bold">{L('প্ল্যান কিনুন / রিনিউ করুন', 'Buy or renew a plan')}</p>

              <div className="grid gap-2 sm:grid-cols-3">
                {b.plans.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => setF({ ...f, plan: p.id })}
                    className={clsx('rounded-xl border p-3 text-left transition-colors', f.plan === p.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-surface-2')}
                  >
                    <p className="font-display font-semibold">{p.name}</p>
                    <p className="text-lg font-display font-semibold text-primary">{money(p.price, lang)}<span className="text-xs font-semibold text-muted">/{L('মাস', 'mo')}</span></p>
                    <p className="mt-1 text-xs text-muted">{L(`${num(p.replies, lang)}টি AI রিপ্লাই, ${p.pages}টি পেজ`, `${num(p.replies, lang)} AI replies, ${p.pages} Page(s)`)}</p>
                  </button>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">{L('কত মাসের জন্য', 'Duration')}</label>
                  <select className="input" value={f.months} onChange={(e) => setF({ ...f, months: Number(e.target.value) })}>
                    {b.months.map((m) => (
                      <option key={m} value={m}>
                        {m} {L('মাস', m === 1 ? 'month' : 'months')}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">{L('পেমেন্ট মাধ্যম', 'Pay with')}</label>
                  <select className="input" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
                    <option value="BKASH">bKash</option>
                    <option value="NAGAD">Nagad</option>
                  </select>
                </div>
              </div>

              <div className="rounded-xl bg-accent/10 p-3.5 text-sm">
                <p className="font-bold">
                  {L('মোট', 'Total')}: {money(amount, lang)}
                </p>
                {payNo ? (
                  <p className="mt-1">
                    {L('এই নম্বরে', 'Send money to')} <span className="font-display font-semibold">{payNo}</span> ({f.method === 'NAGAD' ? 'Nagad' : 'bKash'} {L('সেন্ড মানি করুন', 'Send Money')}), {L('তারপর নিচে নিজের নম্বর ও TrxID দিন।', 'then enter your number and TrxID below.')}
                  </p>
                ) : (
                  <p className="mt-1 text-danger">{L('পেমেন্ট নম্বর এখনো সেট করা হয়নি। সাপোর্টে যোগাযোগ করুন।', 'Payment number is not set yet. Please contact support.')}</p>
                )}
                {b.payTo.note && <p className="mt-1 text-muted">{b.payTo.note}</p>}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">{L('যে নম্বর থেকে পাঠিয়েছেন', 'Number you paid from')}</label>
                  <input className="input" required inputMode="tel" placeholder="01XXXXXXXXX" value={f.senderNumber} onChange={(e) => setF({ ...f, senderNumber: e.target.value })} />
                </div>
                <div>
                  <label className="label">TrxID</label>
                  <input className="input uppercase" required minLength={6} maxLength={20} value={f.trxId} onChange={(e) => setF({ ...f, trxId: e.target.value })} />
                </div>
              </div>

              <button className="btn btn-primary" disabled={busy || !!pending || !payNo}>
                {pending ? L('আগের পেমেন্ট যাচাই চলছে...', 'Previous payment is being checked...') : busy ? L('জমা হচ্ছে...', 'Submitting...') : L('পেমেন্ট জমা দিন', 'Submit payment')}
              </button>
            </form>
          )}

          {b.payments.length > 0 && (
            <div className="card mt-5 p-4">
              <p className="mb-2 font-bold">{L('পেমেন্টের ইতিহাস', 'Payment history')}</p>
              <ul className="divide-y divide-border text-sm">
                {b.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div>
                      <p className="font-semibold">
                        {p.plan} × {p.months} {L('মাস', 'mo')} · {money(p.amount, lang)}
                      </p>
                      <p className="text-xs text-muted">
                        {p.method} · {p.trxId} · {dateFmt(p.createdAt, lang, true)}
                      </p>
                      {p.note && <p className="text-xs text-danger">{p.note}</p>}
                    </div>
                    <span className={clsx('badge', p.status === 'APPROVED' ? 'bg-success/15 text-success' : p.status === 'REJECTED' ? 'bg-danger/10 text-danger' : 'bg-accent/15')}>{statusLabel[p.status]}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}