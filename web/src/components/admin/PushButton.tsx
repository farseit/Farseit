'use client';

import { BellOff, BellRing, Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useLang } from '@/context/lang';
import { currentSub, disablePush, enablePush, pushSupported } from '@/lib/push';

export function PushButton() {
  const { lang } = useLang();
  const L = (bn: string, en: string) => (lang === 'bn' ? bn : en);
  const [supported, setSupported] = useState(true);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    setSupported(pushSupported());
    currentSub()
      .then((s) => setOn(!!s))
      .catch(() => {});
    const check = () => setCanInstall(!!(window as any).__installPrompt);
    check();
    window.addEventListener('pwa-install-ready', check);
    return () => window.removeEventListener('pwa-install-ready', check);
  }, []);

  const toggle = async () => {
    setBusy(true);
    try {
      if (on) {
        await disablePush();
        setOn(false);
        toast.success(L('পুশ নোটিফিকেশন বন্ধ হয়েছে', 'Push notifications off'));
      } else {
        await enablePush();
        setOn(true);
        toast.success(L('পুশ নোটিফিকেশন চালু হয়েছে', 'Push notifications on'));
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const install = async () => {
    const p = (window as any).__installPrompt;
    if (!p) return;
    p.prompt();
    await p.userChoice?.catch?.(() => {});
    (window as any).__installPrompt = null;
    setCanInstall(false);
  };

  return (
    <div className="space-y-2">
      {supported ? (
        <button type="button" disabled={busy} onClick={toggle} className="btn btn-outline btn-sm w-full">
          {on ? <BellOff className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}
          {on ? L('পুশ নোটিফিকেশন বন্ধ করুন', 'Turn off push notifications') : L('পুশ নোটিফিকেশন চালু করুন (ব্রাউজার বন্ধ থাকলেও)', 'Turn on push (works when browser is closed)')}
        </button>
      ) : (
        <p className="text-xs text-muted">
          {L('iPhone-এ Share → Add to Home Screen করে অ্যাপ হিসেবে খুললে তারপর পুশ চালু করা যাবে।', 'On iPhone: Share → Add to Home Screen, then open the app to enable push.')}
        </p>
      )}
      {canInstall && (
        <button type="button" onClick={install} className="btn btn-outline btn-sm w-full">
          <Download className="h-4 w-4" /> {L('অ্যাডমিন অ্যাপ ইনস্টল করুন', 'Install admin app')}
        </button>
      )}
    </div>
  );
}