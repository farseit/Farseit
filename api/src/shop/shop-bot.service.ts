import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { decryptSecret } from '../common/crypto';
import { PrismaService } from '../prisma/prisma.module';
import { ShopAiService } from './shop-ai.service';
import { reportIssue, resolveIssue } from './shop-health';
import { ShopNotifyService } from './shop-notify.service';
import { consumeReply, shopAccess } from './shop-plans';

import { pageCache, TenantPage, tenantRouter } from './shop-router';

const GRAPH = 'https://graph.facebook.com/v21.0';
const HANDOFF_HOURS = 6; // page-er admin nijer hate reply dile / human handoff-e bot eto ghonta chup
const REPLY_DELAY_MS = 3500; // customer ek-shathe onek message dile shob-gulor porer ekbar-e uttor
const MAX_BOT_REPLIES_PER_HOUR = 40; // ek chat-e AI spam/cost thekate
const FALLBACK_TEXT = 'দুঃখিত, একটু সমস্যা হচ্ছে। আমাদের টিম শীঘ্রই আপনাকে জানাবে।';

@Injectable()
export class ShopBotService implements OnModuleInit {
  private log = new Logger('ShopBot');
  private chain = new Map<string, Promise<void>>(); // ek customer-er kaj line dhore
  private timers = new Map<string, NodeJS.Timeout>(); // chatId -> AI reply timer

  constructor(
    private prisma: PrismaService,
    private ai: ShopAiService,
    private notify: ShopNotifyService,
  ) {}

  async onModuleInit() {
    tenantRouter.handler = (pageId, ev) => this.route(pageId, ev);
    // Server restart hole timer harai jay: shesh 3 minute-er onuttorito chat-gulo abar schedule kori
    try {
      const rows = await this.prisma.shopChat.findMany({
        where: { lastFrom: 'CUSTOMER', lastMessageAt: { gte: new Date(Date.now() - 3 * 60 * 1000) } },
        take: 50,
      });
      for (const c of rows) {
        const page = await this.lookup(c.pageId);
        if (page) this.schedule(page, c.id, c.psid);
      }
    } catch (e: any) {
      this.log.warn(`restart recovery skipped: ${e?.message || e}`);
    }
  }

  // ------------------------------------------------------------ routing
  private async lookup(pageId: string): Promise<TenantPage | null> {
    const hit = pageCache.get(pageId);
    if (hit) return hit.v;
    const p = await this.prisma.shopPage.findUnique({ where: { pageId }, include: { shop: true } });
    const v: TenantPage | null = p
      ? {
          shopId: p.shopId,
          pageId,
          tokenEnc: p.tokenEnc,
          shopName: p.shop.name,
          plan: p.shop.plan,
          // meyad shesh / suspend hole bot bondho. Mas-er limit shesh hole aiReply-te live check hoy
          botEnabled: p.status === 'ACTIVE' && p.shop.botEnabled && ['LIMIT', null].includes(shopAccess(p.shop).reason),
        }
      : null;
    pageCache.set(pageId, v);
    return v;
  }

  private run(key: string, fn: () => Promise<void>) {
    const prev = this.chain.get(key) || Promise.resolve();
    const next = prev.then(fn).catch((e) => this.log.error(e?.stack || String(e)));
    this.chain.set(key, next);
    void next.then(() => {
      if (this.chain.get(key) === next) this.chain.delete(key);
    });
  }

  /** true = eta Shop-er Page, ami sambhalechhi. false = platform-er, ager flow-te jabe */
  async route(pageId: string, ev: any): Promise<boolean> {
    let page: TenantPage | null;
    try {
      page = await this.lookup(pageId);
    } catch (e: any) {
      this.log.error(`page lookup failed: ${e?.message || e}`);
      const row = await this.prisma.shopPage.findFirst({ where: { pageId }, select: { shopId: true } }).catch(() => null);
      if (row) void reportIssue(this.prisma, row.shopId, 'FB_SECRET_UNREADABLE', { severity: 'ERROR', subject: pageId, message: 'The saved Facebook access for this Page cannot be read, so the bot cannot answer. Reconnect the Page.', detail: String(e?.message || e) });
      return true; // lookup fail hole-o event drop kori
    }
    if (!page) return false;
    const who = ev.message?.is_echo ? ev.recipient?.id : ev.sender?.id;
    if (!who) return true;
    this.run(`${page.pageId}:${who}`, () => this.process(page!, ev));
    return true;
  }

  // ------------------------------------------------------------ incoming
  private async duplicate(mid?: string): Promise<boolean> {
    if (!mid) return false;
    try {
      await this.prisma.webhookEvent.create({ data: { id: mid } });
      return false;
    } catch (e: any) {
      return e?.code === 'P2002';
    }
  }

  private async process(page: TenantPage, ev: any) {
    if (ev.message?.is_echo) return this.onEcho(page, ev);
    const psid: string | undefined = ev.sender?.id;
    if (!psid) return;
    if (await this.duplicate(ev.message?.mid)) return;

    const payload: string = ev.postback?.payload || ev.message?.quick_reply?.payload || '';
    const text: string = (ev.message?.text || '').trim();
    const attach = !!ev.message?.attachments?.length;
    const label = text || (payload === 'GET_STARTED' ? 'হ্যালো' : payload ? `[${payload}]` : attach ? '[ছবি/অ্যাটাচমেন্ট পাঠিয়েছেন]' : '');
    if (!label) return;

    const existing = await this.prisma.shopChat.findUnique({ where: { pageId_psid: { pageId: page.pageId, psid } } });
    const chat = existing
      ? await this.prisma.shopChat.update({
          where: { id: existing.id },
          data: { lastMessageAt: new Date(), lastText: label.slice(0, 200), lastFrom: 'CUSTOMER', unread: { increment: 1 } },
        })
      : await this.prisma.shopChat.create({
          data: { shopId: page.shopId, pageId: page.pageId, psid, lastText: label.slice(0, 200), lastFrom: 'CUSTOMER', unread: 1 },
        });
    await this.prisma.shopMessage.create({ data: { chatId: chat.id, role: 'USER', text: label } });
    if (!chat.name) void this.fetchName(page, chat.id, psid);

    // Bot uttor dibe na (bot off / human-er somoy / chat-e AI off) hole owner-ke janai
    if (!page.botEnabled || !chat.aiEnabled || (chat.handoffUntil && chat.handoffUntil > new Date())) {
      this.notify.needsHuman(page.shopId, chat.id, chat.name, label);
    }
    if (!page.botEnabled) return;
    if (chat.handoffUntil && chat.handoffUntil > new Date()) return;

    const canAi = chat.aiEnabled && (await this.ai.canReply(page.shopId));
    if (chat.aiEnabled && !canAi) {
      void reportIssue(this.prisma, page.shopId, 'NO_AI_KEY', { severity: 'ERROR', message: 'A customer wrote to your Page but the bot could not reply because no working Gemini AI key is added.' });
    }
    if (canAi) {
      this.schedule(page, chat.id, psid);
      return;
    }
    // AI key / AI off hole shudhu prothom message-e greeting
    if (!existing) {
      await this.reply(page, chat.id, psid, `${page.shopName}-এ স্বাগতম! আপনার মেসেজ পেয়েছি। একটু অপেক্ষা করুন, আমরা শীঘ্রই উত্তর দিচ্ছি।`);
    }
  }

  /** Page-er admin nijer hate reply dile: dashboard-e dekhao + bot kichukkhon chup */
  private async onEcho(page: TenantPage, ev: any) {
    const psid: string | undefined = ev.recipient?.id;
    const text = (ev.message?.text || '').trim();
    if (!psid || !text || ev.message?.metadata) return; // metadata thakle eta bot-er nijer pathano
    if (await this.duplicate(ev.message?.mid)) return;
    const handoffUntil = new Date(Date.now() + HANDOFF_HOURS * 3600 * 1000);
    const chat = await this.prisma.shopChat.upsert({
      where: { pageId_psid: { pageId: page.pageId, psid } },
      update: { handoffUntil, lastText: text.slice(0, 200), lastFrom: 'ADMIN', lastMessageAt: new Date() },
      create: { shopId: page.shopId, pageId: page.pageId, psid, handoffUntil, lastText: text.slice(0, 200), lastFrom: 'ADMIN' },
    });
    await this.prisma.shopMessage.create({ data: { chatId: chat.id, role: 'ADMIN', text } });
    const t = this.timers.get(chat.id);
    if (t) {
      clearTimeout(t);
      this.timers.delete(chat.id);
    }
  }

  // ------------------------------------------------------------ AI reply
  private schedule(page: TenantPage, chatId: string, psid: string) {
    const old = this.timers.get(chatId);
    if (old) clearTimeout(old);
    void this.action(page, psid, 'typing_on');
    const t = setTimeout(() => {
      this.timers.delete(chatId);
      this.run(`${page.pageId}:${psid}`, () => this.aiReply(page.pageId, chatId, psid));
    }, REPLY_DELAY_MS);
    this.timers.set(chatId, t);
  }

  private async aiReply(pageId: string, chatId: string, psid: string) {
    const page = await this.lookup(pageId); // fresh: token/bot on-off bodlale
    if (!page || !page.botEnabled) return;
    const chat = await this.prisma.shopChat.findUnique({ where: { id: chatId } });
    if (!chat || !chat.aiEnabled) return;
    if (chat.handoffUntil && chat.handoffUntil > new Date()) return;

    const recent = await this.prisma.shopMessage.count({ where: { chatId, role: 'BOT', createdAt: { gte: new Date(Date.now() - 3600 * 1000) } } });
    if (recent >= MAX_BOT_REPLIES_PER_HOUR) return;



    // plan-er mas-er AI reply limit (live check)
    const shop = await this.prisma.shop.findUnique({ where: { id: page.shopId } });
    const ownKey = await this.ai.hasOwnKey(page.shopId); // nijer key hole platform-er reply limit lage na
    if (!shop || (!ownKey && shopAccess(shop).reason === 'LIMIT')) {
      if (shop) void reportIssue(this.prisma, page.shopId, 'PLAN_LIMIT', { severity: 'WARN', message: 'All AI replies in your plan for this month are used, so the bot stopped replying.' });
      this.notify.needsHuman(page.shopId, chatId, chat.name, 'প্ল্যানের AI রিপ্লাই লিমিট শেষ, আপনি নিজে রিপ্লাই দিন');
      return;
    }

    const startedAt = new Date();
    const rows = await this.prisma.shopMessage.findMany({ where: { chatId }, orderBy: { createdAt: 'desc' }, take: 16 });
    rows.reverse();

    let text: string | null = null;
    try {
      text = await this.ai.reply({ shopId: page.shopId, shopName: page.shopName, chatId }, rows, {
        photos: (urls) => this.sendImages(page, psid, urls),
        handoff: async () => {
          await this.prisma.shopChat.update({ where: { id: chatId }, data: { handoffUntil: new Date(Date.now() + HANDOFF_HOURS * 3600 * 1000) } });
          this.notify.needsHuman(page.shopId, chatId, chat.name, 'AI এই চ্যাটটি আপনার কাছে হস্তান্তর করেছে');
        },
      });
    } catch (e: any) {
      this.log.error(`AI failed (shop ${page.shopId}): ${e?.message || e}`);
      void reportIssue(this.prisma, page.shopId, 'AI_ERROR', { severity: 'WARN', message: 'The AI could not answer a customer, so a short "we will get back to you" message was sent.', detail: String(e?.message || e) });
      text = FALLBACK_TEXT;
    }

    // Ei somoyer moddhe customer notun message dile, oi message-er timer-i uttor dibe
    const newer = await this.prisma.shopMessage.count({ where: { chatId, role: 'USER', createdAt: { gt: startedAt } } });
    if (newer) return;
    if (text) {
      await this.reply(page, chatId, psid, text);
      if (text !== FALLBACK_TEXT) {
        await consumeReply(this.prisma, page.shopId).catch(() => undefined);
        void resolveIssue(this.prisma, page.shopId, 'AI_ERROR');
      }
    }
  }

  // ------------------------------------------------------------ sending
  /** Dashboard theke owner/agent-er reply. Bot ei chat-e HANDOFF_HOURS chup thakbe */
  /** Order status bodlale customer-ke Messenger-e jananor jonno. Bot-er handoff/timer-e haat dey na.
   *  Meta POST_PURCHASE_UPDATE tag tule diyeche, tai customer-er last message-er 24 ghonta por pathano jay na. */
  async notifyCustomer(shopId: string, chatId: string | null | undefined, text: string): Promise<'SENT' | 'NO_CHAT' | 'WINDOW_CLOSED' | 'FAILED'> {
    if (!chatId) return 'NO_CHAT';
    const chat = await this.prisma.shopChat.findFirst({ where: { id: chatId, shopId } });
    if (!chat) return 'NO_CHAT';
    const page = await this.lookup(chat.pageId);
    if (!page || page.shopId !== shopId) return 'FAILED';
    const token = this.token(page);
    if (!token) return 'FAILED';
    try {
      const res = await fetch(`${GRAPH}/me/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ recipient: { id: chat.psid }, messaging_type: 'UPDATE', message: { text: text.slice(0, 1900), metadata: 'bot' } }),
      });
      if (!res.ok) {
        const body: any = await res.json().catch(() => ({}));
        const err = body?.error || {};
        this.log.warn(`order status notify failed (shop ${shopId}): ${JSON.stringify(err).slice(0, 300)}`);
        if (err.code === 190) {
          await this.prisma.shopPage.updateMany({ where: { pageId: page.pageId }, data: { status: 'TOKEN_EXPIRED' } });
          pageCache.clear(page.pageId);
          return 'FAILED';
        }
        if (err.code === 10 || err.code === 551 || err.error_subcode === 2018278) return 'WINDOW_CLOSED';
        return 'FAILED';
      }
    } catch (e: any) {
      this.log.warn(`order status notify error (shop ${shopId}): ${e?.message || e}`);
      return 'FAILED';
    }
    await this.prisma.shopMessage.create({ data: { chatId, role: 'BOT', text } });
    await this.prisma.shopChat.update({ where: { id: chatId }, data: { lastText: text.slice(0, 200), lastFrom: 'BOT' } });
    return 'SENT';
  }

  async adminSend(shopId: string, chatId: string, text: string) {
    const chat = await this.prisma.shopChat.findFirst({ where: { id: chatId, shopId } });
    if (!chat) throw new NotFoundException('Chat not found');
    const page = await this.lookup(chat.pageId);
    if (!page || page.shopId !== shopId) throw new BadRequestException('This Page is not connected');
    const token = this.token(page);
    if (!token) throw new BadRequestException('Page token problem, please reconnect the Page');

    const res = await fetch(`${GRAPH}/me/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ recipient: { id: chat.psid }, messaging_type: 'RESPONSE', message: { text, metadata: 'admin' } }),
    });
    if (!res.ok) {
      const body: any = await res.json().catch(() => ({}));
      const err = body?.error || {};
      this.log.warn(`admin send failed (shop ${shopId}): ${JSON.stringify(err).slice(0, 300)}`);
      if (err.code === 190) {
        await this.prisma.shopPage.updateMany({ where: { pageId: page.pageId }, data: { status: 'TOKEN_EXPIRED' } });
        pageCache.clear(page.pageId);
        throw new BadRequestException('Facebook connection expired, please reconnect the Page');
      }
      if (err.code === 10 || err.error_subcode === 2018278) {
        throw new BadRequestException('Customer-er last message-er 24 ghonta periye gechhe, ekhon Messenger-e reply deya jabe na');
      }
      throw new BadRequestException(`Facebook could not send the message: ${String(err.message || res.status).slice(0, 150)}`);
    }

    const msg = await this.prisma.shopMessage.create({ data: { chatId, role: 'ADMIN', text } });
    await this.prisma.shopChat.update({
      where: { id: chatId },
      data: { lastText: text.slice(0, 200), lastFrom: 'ADMIN', lastMessageAt: new Date(), handoffUntil: new Date(Date.now() + HANDOFF_HOURS * 3600 * 1000) },
    });
    const t = this.timers.get(chatId);
    if (t) {
      clearTimeout(t);
      this.timers.delete(chatId);
    } 
    return msg;
  }

  private token(page: TenantPage): string | null {
    try {
      return decryptSecret(page.tokenEnc);
    } catch (e: any) {
      this.log.error(`token decrypt failed for page ${page.pageId}: ${e?.message || e}`);
      return null;
    }
  }

  private async post(page: TenantPage, body: any): Promise<boolean> {
    const token = this.token(page);
    if (!token) return false;
    const res = await fetch(`${GRAPH}/me/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text();
      this.log.error(`Send API ${res.status} (page ${page.pageId}): ${t.slice(0, 300)}`);
      let err: any = {};
      try {
        err = JSON.parse(t)?.error || {};
      } catch {
        /* json na */
      }
      if (err.code === 190 || t.includes('"code":190')) {
        // token expire/invalid: owner-ke abar connect korte hobe
        await this.prisma.shopPage.updateMany({ where: { pageId: page.pageId }, data: { status: 'TOKEN_EXPIRED' } });
        pageCache.clear(page.pageId);
        await reportIssue(this.prisma, page.shopId, 'FB_TOKEN_EXPIRED', { severity: 'ERROR', subject: page.pageId, message: 'Facebook access for this Page expired. Reconnect the Page so the bot can reply.', detail: String(err.message || t) });
      } else if (err.code === 10 || err.error_subcode === 2018278) {
        // 24 ghonta-r niyom: customer-er last message-er por 24h gele reply jay na. Eta shadharon, somossha na
      } else if (err.code === 200 || err.code === 230 || err.code === 299) {
        await reportIssue(this.prisma, page.shopId, 'FB_PERMISSION', { severity: 'ERROR', subject: page.pageId, message: 'Facebook did not allow this Page to send messages. Make sure you are an admin of the Page, then reconnect it.', detail: String(err.message || t) });
      } else {
        await reportIssue(this.prisma, page.shopId, 'FB_SEND_FAILED', { severity: 'WARN', subject: page.pageId, message: 'Facebook could not deliver a bot message.', detail: String(err.message || t) });
      }
      return false;
    }
    return true;
  }

  private action(page: TenantPage, psid: string, sender_action: 'typing_on') {
    return this.post(page, { recipient: { id: psid }, sender_action }).catch(() => false);
  }

  private async sendImages(page: TenantPage, psid: string, urls: string[]) {
    for (const url of urls.slice(0, 3)) {
      await this.post(page, {
        recipient: { id: psid },
        messaging_type: 'RESPONSE',
        message: { attachment: { type: 'image', payload: { url, is_reusable: true } }, metadata: 'bot' },
      });
    }
  }

  private async reply(page: TenantPage, chatId: string, psid: string, text: string) {
    const ok = await this.post(page, {
      recipient: { id: psid },
      messaging_type: 'RESPONSE',
      message: { text: text.slice(0, 1900), metadata: 'bot' },
    });
    if (!ok) return;
    void resolveIssue(this.prisma, page.shopId, 'FB_SEND_FAILED', page.pageId);
    void resolveIssue(this.prisma, page.shopId, 'FB_PERMISSION', page.pageId);
    await this.prisma.shopMessage.create({ data: { chatId, role: 'BOT', text } });
    await this.prisma.shopChat.update({ where: { id: chatId }, data: { lastText: text.slice(0, 200), lastFrom: 'BOT' } });
  }

  private async fetchName(page: TenantPage, chatId: string, psid: string) {
    try {
      const token = this.token(page);
      if (!token) return;
      const r = await fetch(`${GRAPH}/${psid}?fields=first_name,last_name`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return;
      const j: any = await r.json();
      const name = [j.first_name, j.last_name].filter(Boolean).join(' ').trim();
      if (name) await this.prisma.shopChat.update({ where: { id: chatId }, data: { name } });
    } catch {
      /* name na pele-o somossa nai */
    }
  }
}