/**
 * Facebook webhook theke ashha event ke Page onujayi shop-er bot-e pathanor jonno chhoto hub.
 * ShopBotService start hole nijeke `tenantRouter.handler` hishebe boshiye dey (shop-bot.service.ts).
 */
import { Logger } from '@nestjs/common';

const routerLog = new Logger('ShopRouter');

export type TenantPage = {
  shopId: string;
  pageId: string;
  tokenEnc: string;
  shopName: string;
  plan: string;
  botEnabled: boolean;
};

export const tenantRouter: { handler: null | ((pageId: string, ev: any) => Promise<boolean>) } = { handler: null };

const cache = new Map<string, { v: TenantPage | null; exp: number }>();

/** Page -> shop lookup cache (60 sec). Plan/status/bot toggle bodlale clear kora hoy */
export const pageCache = {
  get(pageId: string) {
    const h = cache.get(pageId);
    return h && h.exp > Date.now() ? h : undefined;
  },
  set(pageId: string, v: TenantPage | null, ttlMs = 60_000) {
    if (cache.size > 5000) cache.clear();
    cache.set(pageId, { v, exp: Date.now() + ttlMs });
  },
  clear(pageId?: string) {
    if (pageId) cache.delete(pageId);
    else cache.clear();
  },
};

/** Webhook event ekta shop-er bot-e pathay. Kono shop-er Page na hole drop kore */
export async function routeEvent(pageId: string | undefined, ev: any) {
  if (!pageId || !tenantRouter.handler) return;
  const handled = await tenantRouter.handler(pageId, ev);
  if (!handled) routerLog.warn(`dropped event from Page ${pageId}: not connected to any shop`);
}
