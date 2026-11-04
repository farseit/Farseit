import { ShopApprovedGuard } from './shop-guard';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser, JwtAuthGuard } from '../auth/guards';
import { decryptSecret } from '../common/crypto';
import { rateLimit } from '../common/rate-limit';
import { PrismaService } from '../prisma/prisma.module';
import { shopAccess } from './shop-plans';
import { pageCache } from './shop-router';

const GRAPH = 'https://graph.facebook.com/v21.0';

// ---------------------------------------------------------------- recorder (bot/service theke ei duto call hoy)
/** Shop-er dashboard-e dekhanor moto ekta somossha record kore. Kokhono throw kore na, tai bot-er kaj atkabe na */
export async function reportIssue(
  prisma: PrismaService,
  shopId: string,
  code: string,
  o: { message: string; severity?: 'ERROR' | 'WARN'; subject?: string; detail?: string },
) {
  try {
    const subject = o.subject || '';
    const data = { severity: o.severity || 'WARN', message: o.message.slice(0, 500), detail: o.detail ? o.detail.slice(0, 600) : null };
    await prisma.shopIssue.upsert({
      where: { shopId_code_subject: { shopId, code, subject } },
      create: { shopId, code, subject, ...data },
      update: { ...data, count: { increment: 1 }, lastAt: new Date(), resolvedAt: null },
    });
  } catch {
    /* record korte na parle-o main kaj cholbe */
  }
}

export async function resolveIssue(prisma: PrismaService, shopId: string, code: string, subject?: string) {
  try {
    await prisma.shopIssue.updateMany({
      where: { shopId, code, ...(subject !== undefined ? { subject } : {}), resolvedAt: null },
      data: { resolvedAt: new Date() },
    });
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------- health
type Status = 'ok' | 'warn' | 'error';
type Check = { id: string; status: Status; vars?: Record<string, string | number>; fix?: { href?: string; repair?: string } };

@Injectable()
export class ShopHealthService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private async member(userId: string, ownerOnly = false) {
    const m = await this.prisma.shopMember.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } });
    if (!m) throw new NotFoundException('You do not have a shop yet');
    if (ownerOnly && m.role !== 'OWNER') throw new ForbiddenException('Only the shop owner can do this');
    return m;
  }

  private async graph(url: string, token: string, init: any = {}) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) },
        signal: AbortSignal.timeout(12000),
      });
      const body: any = await res.json().catch(() => ({}));
      if (res.ok) return { ok: true, net: false, code: 0, message: '', body };
      return { ok: false, net: false, code: Number(body?.error?.code) || 0, message: String(body?.error?.message || res.status).slice(0, 200), body };
    } catch (e: any) {
      return { ok: false, net: true, code: 0, message: String(e?.message || e).slice(0, 200), body: null as any };
    }
  }

  private async markExpired(shopId: string, pageId: string, detail: string) {
    await this.prisma.shopPage.updateMany({ where: { pageId }, data: { status: 'TOKEN_EXPIRED' } });
    pageCache.clear(pageId);
    await reportIssue(this.prisma, shopId, 'FB_TOKEN_EXPIRED', {
      severity: 'ERROR',
      subject: pageId,
      message: 'Facebook access for this Page expired. Reconnect the Page so the bot can reply.',
      detail,
    });
  }

  async health(userId: string, live: boolean) {
    const m = await this.member(userId);
    const shopId = m.shopId;
    if (live) await rateLimit(`health:${shopId}`, 6, 60 * 1000, 'Please wait a minute before checking again.');

    const [shop, pages, key, products] = await Promise.all([
      this.prisma.shop.findUnique({ where: { id: shopId } }),
      this.prisma.shopPage.findMany({ where: { shopId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.shopAiKey.findUnique({ where: { shopId } }),
      this.prisma.shopProduct.count({ where: { shopId } }),
    ]);
    if (!shop) throw new NotFoundException('Shop not found');

    // ------------------------------------------------ live: Facebook-e sorasori jiggesh kora
    const liveChecks: Check[] = [];
    if (live) {
      const appId = this.config.get<string>('FB_APP_ID');
      for (const p of pages) {
        const name = p.name || p.pageId;
        let token: string | null = null;
        try {
          token = decryptSecret(p.tokenEnc);
        } catch {
          /* niche handle */
        }
        if (!token) {
          liveChecks.push({ id: 'token_bad', status: 'error', vars: { name }, fix: { href: '/shop/connect' } });
          continue;
        }
        const me = await this.graph(`${GRAPH}/me?fields=id,name`, token);
        if (me.net) {
          liveChecks.push({ id: 'fb_unreachable', status: 'warn', vars: { name } });
          continue;
        }
        if (me.code === 190) {
          await this.markExpired(shopId, p.pageId, me.message);
          p.status = 'TOKEN_EXPIRED';
          liveChecks.push({ id: 'token_bad', status: 'error', vars: { name }, fix: { href: '/shop/connect' } });
          continue;
        }
        if (!me.ok) {
          liveChecks.push({ id: 'token_error', status: 'warn', vars: { name, detail: me.message } });
          continue;
        }
        // token thik: age TOKEN_EXPIRED chhilo hole ACTIVE kore dei
        if (p.status !== 'ACTIVE') {
          await this.prisma.shopPage.updateMany({ where: { pageId: p.pageId }, data: { status: 'ACTIVE' } });
          pageCache.clear(p.pageId);
          p.status = 'ACTIVE';
        }
        liveChecks.push({ id: 'token_ok', status: 'ok', vars: { name } });

        // webhook subscribe kora ache kina
        const sub = await this.graph(`${GRAPH}/${p.pageId}/subscribed_apps`, token);
        if (!sub.ok) {
          liveChecks.push({ id: 'hook_error', status: 'warn', vars: { name, detail: sub.message } });
          continue;
        }
        const apps: any[] = Array.isArray(sub.body?.data) ? sub.body.data : [];
        const mine = apps.find((a) => (appId ? String(a.id) === String(appId) : true));
        const fields: string[] = mine?.subscribed_fields || [];
        if (mine && fields.includes('messages')) liveChecks.push({ id: 'hook_ok', status: 'ok', vars: { name } });
        else liveChecks.push({ id: 'hook_missing', status: 'error', vars: { name }, fix: { repair: p.pageId } });
      }
    }

    // ------------------------------------------------ DB theke state
    const access = shopAccess(shop as any);
    const requireOwn = this.config.get<string>('SHOP_REQUIRE_OWN_KEY') === 'true';
    const hasOwn = !!key && key.status !== 'INVALID';

    // secret gulo ashole pora jay kina (TOKEN_ENC_KEY bodlale ager token/key ar khole na)
    const canRead = (v: string) => {
      try {
        decryptSecret(v);
        return true;
      } catch {
        return false;
      }
    };
    const unreadablePages = pages.filter((p) => !canRead(p.tokenEnc));
    const keyUnreadable = !!key && !canRead(key.keyEnc);

    // purono issue: state ekhon thik hole nijei bondho
    const rows = await this.prisma.shopIssue.findMany({
      where: { shopId, OR: [{ resolvedAt: null }, { resolvedAt: { gt: new Date(Date.now() - 7 * 86400000) } }] },
      orderBy: { lastAt: 'desc' },
      take: 50,
    });
    const resolvable = (i: { code: string; subject: string }) => {
      if (i.code === 'AI_KEY_INVALID' || i.code === 'AI_KEY_QUOTA') return key?.status === 'OK';
      if (i.code === 'NO_AI_KEY') return key ? key.status !== 'INVALID' : !requireOwn;
      if (i.code === 'FB_TOKEN_EXPIRED') {
        const p = pages.find((x) => x.pageId === i.subject);
        return !p || p.status === 'ACTIVE';
      }
      if (i.code === 'PLAN_LIMIT') return access.reason !== 'LIMIT' || hasOwn;
      if (i.code === 'FB_SECRET_UNREADABLE') {
        const p = pages.find((x) => x.pageId === i.subject);
        return !p || canRead(p.tokenEnc);
      }
      return false;
    };
    for (const i of rows) {
      if (!i.resolvedAt && resolvable(i)) {
        i.resolvedAt = new Date();
        await resolveIssue(this.prisma, shopId, i.code, i.subject);
      }
    }

    const checks: Check[] = [];

    // 1. Facebook Page
    const expired = pages.filter((p) => p.status !== 'ACTIVE');
    if (unreadablePages.length) checks.push({ id: 'page_secret', status: 'error', vars: { names: unreadablePages.map((p) => p.name || p.pageId).join(', ') }, fix: { href: '/shop/connect' } });
    else if (!pages.length) checks.push({ id: 'page_none', status: 'error', fix: { href: '/shop/connect' } });
    else if (expired.length) checks.push({ id: 'page_expired', status: 'error', vars: { names: expired.map((p) => p.name || p.pageId).join(', ') }, fix: { href: '/shop/connect' } });
    else checks.push({ id: 'page_ok', status: 'ok', vars: { n: pages.length } });

    // 2. Bot on/off
    if (!shop.botEnabled) checks.push({ id: 'bot_off', status: 'warn', fix: { href: '/shop' } });
    else checks.push({ id: 'bot_on', status: 'ok' });

    // 3. AI key
    if (keyUnreadable) checks.push({ id: 'ai_secret', status: 'error', fix: { href: '/shop/ai' } });
    else if (key?.status === 'INVALID') checks.push({ id: 'ai_invalid', status: 'error', fix: { href: '/shop/ai' } });
    else if (key?.status === 'QUOTA') checks.push({ id: 'ai_quota', status: 'warn', fix: { href: '/shop/ai' } });
    else if (key) checks.push({ id: 'ai_own', status: 'ok' });
    else if (requireOwn) checks.push({ id: 'ai_missing', status: 'error', fix: { href: '/shop/ai' } });
    else checks.push({ id: 'ai_platform', status: 'ok' });

    // 4. Plan
    if (access.reason === 'SUSPENDED') checks.push({ id: 'plan_suspended', status: 'error' });
    else if (access.reason === 'EXPIRED') checks.push({ id: 'plan_expired', status: 'error', fix: { href: '/shop/billing' } });
    else if (access.reason === 'LIMIT' && !hasOwn) checks.push({ id: 'plan_limit', status: 'error', fix: { href: '/shop/billing' } });
    else checks.push({ id: 'plan_ok', status: 'ok' });

    // 5. Products
    if (!products) checks.push({ id: 'products_none', status: 'warn', fix: { href: '/shop/products' } });
    else checks.push({ id: 'products_ok', status: 'ok', vars: { n: products } });

    // 6. Onno recent error (jegulo upore-r check-e nai)
    const covered = ['FB_TOKEN_EXPIRED', 'AI_KEY_INVALID', 'AI_KEY_QUOTA', 'NO_AI_KEY', 'PLAN_LIMIT'];
    const recent = rows.filter((i) => !i.resolvedAt && !covered.includes(i.code) && Date.now() - i.lastAt.getTime() < 48 * 3600 * 1000).length;
    if (recent) checks.push({ id: 'errors_recent', status: 'warn', vars: { n: recent }, fix: { href: '#issues' } });
    else checks.push({ id: 'errors_none', status: 'ok' });

    const all = [...checks, ...liveChecks];
    return {
      live,
      checkedAt: new Date().toISOString(),
      checks: all,
      summary: { errors: all.filter((c) => c.status === 'error').length, warnings: all.filter((c) => c.status === 'warn').length },
      issues: rows.map((i) => ({
        id: i.id,
        code: i.code,
        subject: i.subject,
        severity: i.severity,
        message: i.message,
        detail: i.detail,
        count: i.count,
        firstAt: i.firstAt.toISOString(),
        lastAt: i.lastAt.toISOString(),
        resolvedAt: i.resolvedAt ? i.resolvedAt.toISOString() : null,
      })),
    };
  }

  /** Webhook subscribe abar kore dei (owner-er "Fix automatically" button) */
  async repair(userId: string, pageId: string) {
    const m = await this.member(userId, true);
    await rateLimit(`repair:${m.shopId}`, 10, 3600 * 1000, 'Too many attempts. Please try again later.');
    const p = await this.prisma.shopPage.findFirst({ where: { pageId, shopId: m.shopId } });
    if (!p) throw new NotFoundException('Page not found');
    let token: string;
    try {
      token = decryptSecret(p.tokenEnc);
    } catch {
      throw new BadRequestException('Page access problem, please reconnect the Page');
    }
    const r = await this.graph(`${GRAPH}/${pageId}/subscribed_apps`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscribed_fields: ['messages', 'messaging_postbacks', 'message_echoes'] }),
    });
    if (!r.ok) {
      if (r.code === 190) {
        await this.markExpired(m.shopId, pageId, r.message);
        throw new BadRequestException('Facebook access expired. Please reconnect the Page.');
      }
      throw new BadRequestException(`Facebook said: ${r.message}`);
    }
    return true;
  }

  async dismiss(userId: string, id: string) {
    const m = await this.member(userId);
    await this.prisma.shopIssue.updateMany({ where: { id, shopId: m.shopId, resolvedAt: null }, data: { resolvedAt: new Date() } });
    return true;
  }
}

@Resolver()
export class ShopHealthResolver {
  constructor(private svc: ShopHealthService) {}

  @Query('shopHealth')
  @UseGuards(ShopApprovedGuard)
  health(@CurrentUser() me: any, @Args('live', { nullable: true }) live?: boolean) {
    return this.svc.health(me.id, !!live);
  }

  @Mutation('shopRepairPage')
  @UseGuards(ShopApprovedGuard)
  repair(@CurrentUser() me: any, @Args('pageId') pageId: string) {
    return this.svc.repair(me.id, pageId);
  }

  @Mutation('shopDismissIssue')
  @UseGuards(ShopApprovedGuard)
  dismiss(@CurrentUser() me: any, @Args('id') id: string) {
    return this.svc.dismiss(me.id, id);
  }
}