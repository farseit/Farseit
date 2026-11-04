import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.module';

type Payload = Record<string, string>;

/**
 * Shop owner/agent-der (ar super admin-er) device-e push. platform-er PushService-e hat deini
 * (oita shudhu ADMIN/AGENT role-er jonno). Subscription ager-i savePushSubscription mutation diye save hoy.
 */
@Injectable()
export class ShopNotifyService {
  private log = new Logger('ShopNotify');
  private lastChatPush = new Map<string, number>();

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private get vapid() {
    const clean = (v?: string) => (v || '').trim().replace(/^["']|["']$/g, '');
    const publicKey = clean(this.config.get<string>('VAPID_PUBLIC_KEY'));
    const privateKey = clean(this.config.get<string>('VAPID_PRIVATE_KEY'));
    if (!publicKey || !privateKey) return null;
    return { subject: clean(this.config.get<string>('VAPID_SUBJECT')) || 'mailto:admin@example.com', publicKey, privateKey };
  }

  newOrder(shopId: string, o: { id: string; number: number; customerName: string; total: number }) {
    void this.toShop(shopId, {
      title: `নতুন অর্ডার #${o.number}`,
      body: `${o.customerName} · ৳${o.total}`,
      url: '/shop/orders',
      tag: `shop-order-${o.id}`,
    });
  }

  /** Bot uttor dibe na (human-er kaj) tai owner-ke janai. Ek chat-e minute-e ekbar-er beshi na */
  needsHuman(shopId: string, chatId: string, name: string | null | undefined, text: string) {
    const now = Date.now();
    if (now - (this.lastChatPush.get(chatId) || 0) < 60_000) return;
    if (this.lastChatPush.size > 5000) this.lastChatPush.clear();
    this.lastChatPush.set(chatId, now);
    void this.toShop(shopId, {
      title: `${name || 'একজন কাস্টমার'} মেসেজ দিয়েছেন`,
      body: String(text || '').slice(0, 100),
      url: `/shop/inbox?chat=${chatId}`,
      tag: `shop-chat-${chatId}`,
    });
  }

  planActivated(shopId: string, planName: string) {
    void this.toShop(shopId, { title: 'প্ল্যান চালু হয়েছে', body: `${planName} প্ল্যান চালু হয়েছে। বট আবার রিপ্লাই দিবে।`, url: '/shop/billing', tag: 'shop-plan' });
  }

  paymentRejected(shopId: string, note: string) {
    void this.toShop(shopId, { title: 'পেমেন্ট গৃহীত হয়নি', body: note || 'TrxID যাচাই করা যায়নি, আবার চেষ্টা করুন।', url: '/shop/billing', tag: 'shop-plan' });
  }

  /** Super admin-ke (platform-er ADMIN role) notun payment-er khobor */
  newPaymentForAdmin(shopName: string, amount: number, plan: string) {
    void (async () => {
      const admins = await this.prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
      await this.toUsers(admins.map((a) => a.id), { title: 'নতুন প্ল্যান পেমেন্ট', body: `${shopName} · ${plan} · ৳${amount}`, url: '/admin/saas?tab=payments', tag: 'saas-payment' });
    })().catch((e) => this.log.warn(`admin push failed: ${e?.message || e}`));
  }

  private async toShop(shopId: string, payload: Payload) {
    try {
      const members = await this.prisma.shopMember.findMany({ where: { shopId }, select: { userId: true } });
      await this.toUsers(members.map((m) => m.userId), payload);
    } catch (e: any) {
      this.log.warn(`Shop push error: ${e?.message || e}`);
    }
  }

  private async toUsers(userIds: string[], payload: Payload) {
    const v = this.vapid;
    if (!v || !userIds.length) return;
    const subs = await this.prisma.pushSubscription.findMany({ where: { userId: { in: userIds } } });
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), {
            TTL: 3600,
            urgency: 'high',
            vapidDetails: v,
          });
        } catch (e: any) {
          if (e?.statusCode === 404 || e?.statusCode === 410) {
            await this.prisma.pushSubscription.deleteMany({ where: { endpoint: s.endpoint } });
          } else {
            this.log.warn(`Push failed (${e?.statusCode || ''}): ${String(e?.body || e?.message || e).slice(0, 200)}`);
          }
        }
      }),
    );
  }
}