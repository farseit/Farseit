import { BadRequestException, ForbiddenException, Injectable, Module, NotFoundException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuthModule } from '../auth/auth.module';
import { AuthService } from '../auth/auth.service';
import { CurrentUser, JwtAuthGuard } from '../auth/guards';
import { decryptSecret, encryptSecret } from '../common/crypto';
import { clientIp, rateLimit } from '../common/rate-limit';
import { PrismaService } from '../prisma/prisma.module';
import { ShopAiService } from './shop-ai.service';
import { ShopBotService } from './shop-bot.service';
import { ShopDataResolver, ShopDataService } from './shop-data';
import { ShopHealthResolver, ShopHealthService, reportIssue, resolveIssue } from './shop-health';
import { ShopInboxResolver, ShopInboxService } from './shop-inbox';
import { ShopNotifyService } from './shop-notify.service';
import { ShopAdminResolver, ShopAdminService, ShopBillingResolver, ShopBillingService } from './shop-billing';
import { shopAccess } from './shop-plans';
import { ShopAiKeyResolver, ShopAiKeyService } from './shop-aikey';
import { pageCache } from './shop-router';
import { ShopLandingResolver, ShopLandingService } from './shop-landing';
import { ShopWebhookController } from './shop-webhook';
const GRAPH = 'https://graph.facebook.com/v21.0';
const TRIAL_DAYS = 7;
const PAGE_SELECT = { id: true, pageId: true, name: true, status: true, createdAt: true } as const; // tokenEnc kokhono bahire jay na

@Injectable()
export class ShopService {
  constructor(
    private prisma: PrismaService,
    private auth: AuthService,
    private config: ConfigService,
  ) {}

  // ------------------------------------------------------------ register
  /** Notun manush: account + shop ekshathe toiri. Role CUSTOMER thake, tai super admin panel-e dhukte pare na */
  async registerShop(input: any) {
    const shopName = String(input?.shopName || '').trim();
    if (shopName.length < 2) throw new BadRequestException('Shop name is too short');
    await rateLimit(`shopreg:${String(input?.phone || '')}`, 5, 3600 * 1000);

    const res = await this.auth.register(input); // { accessToken, user }
    try {
      const shop = await this.prisma.shop.create({
        data: {
          name: shopName,
          trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 24 * 3600 * 1000),
          members: { create: { userId: res.user.id, role: 'OWNER' } },
        },
      });
      return { ...res, shop };
    } catch (e) {
      await this.prisma.user.delete({ where: { id: res.user.id } }).catch(() => undefined);
      throw e;
    }
  }

  private async mine(userId: string, ownerOnly = false) {
    const m = await this.prisma.shopMember.findFirst({
      where: { userId },
      include: { shop: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!m) throw new NotFoundException('You do not have a shop yet');
    if (ownerOnly && m.role !== 'OWNER') throw new ForbiddenException('Only the shop owner can do this');
    return m;
  }

  async myShop(userId: string) {
    const m = await this.prisma.shopMember.findFirst({
      where: { userId },
      include: { shop: { include: { pages: { select: PAGE_SELECT, orderBy: { createdAt: 'asc' } } } } },
      orderBy: { createdAt: 'asc' },
    });
    if (!m) return null;

    return { ...m.shop, myRole: m.role, access: shopAccess(m.shop) };
  }

  // ------------------------------------------------------------ facebook
  /** Short-lived user token -> long-lived (tahole Page token expire hoy na) */
  private async longLived(userToken: string): Promise<string> {
    const appId = this.config.get<string>('FB_APP_ID');
    const secret = this.config.get<string>('FB_APP_SECRET');
    if (!appId || !secret) throw new BadRequestException('Facebook app is not configured on the server');
    const u = new URL(`${GRAPH}/oauth/access_token`);
    u.searchParams.set('grant_type', 'fb_exchange_token');
    u.searchParams.set('client_id', appId);
    u.searchParams.set('client_secret', secret);
    u.searchParams.set('fb_exchange_token', userToken);
    const r = await fetch(u);
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) throw new BadRequestException('Facebook login expired, please connect again');
    return j.access_token;
  }

  private async userPages(userToken: string): Promise<{ id: string; name: string; access_token: string }[]> {
    const long = await this.longLived(userToken);
    const r = await fetch(`${GRAPH}/me/accounts?fields=id,name,access_token&limit=100`, {
      headers: { Authorization: `Bearer ${long}` },
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) throw new BadRequestException('Could not load your Facebook Pages');
    return j.data || [];
  }

  /** Dashboard-e "kon Page connect korbe" list. Token ferot dey na */
  async fbPages(userId: string, userToken: string) {
    await this.mine(userId, true);
    const pages = await this.userPages(userToken);
    const connected = await this.prisma.shopPage.findMany({
      where: { pageId: { in: pages.map((p) => p.id) } },
      select: { pageId: true, shopId: true },
    });
    const taken = new Map(connected.map((c) => [c.pageId, c.shopId]));
    return pages.map((p) => ({ id: p.id, name: p.name, connected: taken.has(p.id) }));
  }

  async connectPage(userId: string, pageId: string, userToken: string) {
    const mem = () => this.prisma.shopMember.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } }).catch(() => null);
    try {
      const out = await this.connectPageInner(userId, pageId, userToken);
      const m = await mem();
      if (m) {
        await resolveIssue(this.prisma, m.shopId, 'CONNECT_FAILED', pageId);
        await resolveIssue(this.prisma, m.shopId, 'FB_TOKEN_EXPIRED', pageId);
        await resolveIssue(this.prisma, m.shopId, 'FB_SEND_FAILED', pageId);
        await resolveIssue(this.prisma, m.shopId, 'FB_PERMISSION', pageId);
      }
      return out;
    } catch (e: any) {
      const m = await mem();
      if (m && typeof e?.getStatus === 'function' && e.getStatus() < 500) {
        await reportIssue(this.prisma, m.shopId, 'CONNECT_FAILED', { severity: 'WARN', subject: pageId, message: 'Connecting a Facebook Page failed.', detail: String(e.message || e) });
      }
      throw e;
    }
  }

  private async connectPageInner(userId: string, pageId: string, userToken: string) {
    const m = await this.mine(userId, true);
    const page = (await this.userPages(userToken)).find((p) => p.id === pageId);
    if (!page) throw new BadRequestException('You do not manage this Page');
    const pagesLimit = shopAccess(m.shop).pagesLimit;
    const have = await this.prisma.shopPage.count({ where: { shopId: m.shopId, NOT: { pageId } } });
    if (have >= pagesLimit) throw new BadRequestException(`Your plan allows ${pagesLimit} Page(s). Upgrade to connect more.`);

    const taken = await this.prisma.shopPage.findUnique({ where: { pageId } });
    if (taken && taken.shopId !== m.shopId) throw new BadRequestException('This Page is already connected to another shop');

    // Page-ke amader app-er webhook-e subscribe kora
    const sub = await fetch(`${GRAPH}/${pageId}/subscribed_apps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${page.access_token}` },
      body: JSON.stringify({ subscribed_fields: ['messages', 'messaging_postbacks', 'message_echoes'] }),
    });
    if (!sub.ok) {
      const body = (await sub.text()).slice(0, 200);
      throw new BadRequestException(`Could not connect the Page to the bot: ${body}`);
    }

    const tokenEnc = encryptSecret(page.access_token);
    await this.prisma.shopPage.upsert({
      where: { pageId },
      update: { shopId: m.shopId, name: page.name, tokenEnc, status: 'ACTIVE' },
      create: { shopId: m.shopId, pageId, name: page.name, tokenEnc },
    });
    pageCache.clear(pageId);
    return { pageId, name: page.name };
  }

  async disconnectPage(userId: string, pageId: string) {
    const m = await this.mine(userId, true);
    const p = await this.prisma.shopPage.findFirst({ where: { pageId, shopId: m.shopId } });
    if (!p) throw new NotFoundException('Page not found');
    // best-effort: Facebook-e unsubscribe, fail korleo DB theke muche dei
    try {
      await fetch(`${GRAPH}/${pageId}/subscribed_apps`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${decryptSecret(p.tokenEnc)}` },
      });
    } catch {
      /* ignore */
    }
    await this.prisma.shopPage.delete({ where: { id: p.id } });
    pageCache.clear(pageId);
    return true;
  }
}

@Resolver()
export class ShopResolver {
  constructor(private svc: ShopService) {}

  @Mutation('shopRegister')
  async register(@Args('input') input: any, @Context() ctx: any) {
    await rateLimit(`shopreg-ip:${clientIp(ctx)}`, 5, 24 * 3600 * 1000, 'Too many sign-ups from this network. Try again tomorrow.');
    return this.svc.registerShop(input);
  }

  @Query('myShop')
  @UseGuards(JwtAuthGuard)
  myShop(@CurrentUser() me: any) {
    return this.svc.myShop(me.id);
  }

  @Query('shopFbPages')
  @UseGuards(JwtAuthGuard)
  fbPages(@CurrentUser() me: any, @Args('userToken') userToken: string) {
    return this.svc.fbPages(me.id, userToken);
  }

  @Mutation('shopConnectPage')
  @UseGuards(JwtAuthGuard)
  connect(@CurrentUser() me: any, @Args('pageId') pageId: string, @Args('userToken') userToken: string) {
    return this.svc.connectPage(me.id, pageId, userToken);
  }

  @Mutation('shopDisconnectPage')
  @UseGuards(JwtAuthGuard)
  disconnect(@CurrentUser() me: any, @Args('pageId') pageId: string) {
    return this.svc.disconnectPage(me.id, pageId);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [ShopWebhookController],
   providers: [
  ShopService, ShopResolver, ShopBotService, ShopAiService,
  ShopAiKeyService, ShopAiKeyResolver,
  ShopHealthService, ShopHealthResolver,
  ShopLandingService, ShopLandingResolver,
  ShopNotifyService, ShopDataService, ShopDataResolver,
  ShopInboxService, ShopInboxResolver,
  ShopBillingService, ShopBillingResolver,
  ShopAdminService, ShopAdminResolver,
],
  exports: [ShopService],
})
export class ShopModule {}