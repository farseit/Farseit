import { gql } from './api';

const toKey = (s: string) => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export async function currentSub() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function enablePush() {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notification permission দেওয়া হয়নি');

  const { pushPublicKey } = await gql<{ pushPublicKey: string }>(`query { pushPublicKey }`);
  if (!pushPublicKey) throw new Error('Server-e VAPID key set kora nei (backend .env check korun)');

  await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(pushPublicKey) as unknown as BufferSource }));

  const j = sub.toJSON();
  await gql(`mutation($e:String!,$p:String!,$a:String!){ savePushSubscription(endpoint:$e,p256dh:$p,auth:$a) }`, {
    e: sub.endpoint,
    p: j.keys?.p256dh,
    a: j.keys?.auth,
  });
}

/** SW register na thakle `serviceWorker.ready` jhule thake, tai getRegistration diye safe check */
export async function existingSub() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration('/');
  return reg ? reg.pushManager.getSubscription() : null;
}

/** Ei device theke push soriye dey (logout / off korar somoy), jeno onno user-er noti na ashe */
export async function releasePush(token?: string) {
  try {
    const sub = await existingSub();
    if (!sub) return;
    await gql(`mutation($e:String!){ removePushSubscription(endpoint:$e) }`, { e: sub.endpoint }, token === undefined ? {} : { token }).catch(() => {});
    await sub.unsubscribe();
  } catch {
    /* ignore */
  }
}

/** Browser-e agei subscribe thakle current user-er nam-e abar save kore (account bodlale-o thik thake) */
export async function claimPush() {
  try {
    const sub = await existingSub();
    if (!sub) return false;
    if (Notification.permission !== 'granted') return false;
    const j = sub.toJSON();
    await gql(`mutation($e:String!,$p:String!,$a:String!){ savePushSubscription(endpoint:$e,p256dh:$p,auth:$a) }`, {
      e: sub.endpoint,
      p: j.keys?.p256dh,
      a: j.keys?.auth,
    });
    return true;
  } catch {
    return false;
  }
}

export async function disablePush() {
  const sub = await currentSub();
  if (!sub) return;
  await gql(`mutation($e:String!){ removePushSubscription(endpoint:$e) }`, { e: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
}