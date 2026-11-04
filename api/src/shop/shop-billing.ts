import { ShopApprovedGuard } from './shop-guard';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AdminGuard, CurrentUser, JwtAuthGuard } from '../auth/guards';
import { rateLimit } from '../common/rate-limit';
import { PrismaService } from '../prisma/prisma.module';
import { ShopNotifyService } from './shop-notify.service';
import { GRACE_DAYS, monthKey, PAID_PLANS, PlanId, PLANS, shopAccess } from './shop-plans';
import { pageCache } from './shop-router';

const MONTHS = [1, 3, 6, 12];
const DAY = 86400000;

// ======================================================================== shop owner
@Injectable()
export class ShopBillingService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private notify: ShopNotifyService,
  ) {}

  private async owner(userId: string) {
    const m = await this.prisma.shopMember.findFirst({ where: { userId }, include: { shop: true }, orderBy: { createdAt: 'asc' } });
    if (!m) throw new NotFoundException('You do not have a shop yet');
    return m;
  }

  async info(userId: string) {
    const m = await this.owner(userId);
    const payments = await this.prisma.shopPayment.findMany({
      where: { shopId: m.shopId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, plan: true, months: true, amount: true, method: true, trxId: true, status: true, note: true, createdAt: true },
    });
    return {
      shop: { id: m.shop.id, name: m.shop.name, status: m.shop.status },
      access: shopAccess(m.shop),
      plans: (Object.keys(PLANS) as PlanId[])
        .filter((id) => PAID_PLANS.includes(id))
        .map((id) => ({ id, ...PLANS[id] })),
      months: MONTHS,
      payTo: {
        bkash: this.config.get<string>('BILLING_BKASH') || '',
        nagad: this.config.get<string>('BILLING_NAGAD') || '',
        note: this.config.get<string>('BILLING_NOTE') || '',
      },
      payments,
    };
  }

  async submitPayment(userId: string, input: any) {
    const m = await this.owner(userId);
    if (m.role !== 'OWNER') throw new ForbiddenException('Only the shop owner can do this');
    await rateLimit(`shoppay:${userId}`, 5, 3600 * 1000);

    const plan = String(input?.plan || '') as PlanId;
    if (!PAID_PLANS.includes(plan)) throw new BadRequestException('Choose a plan');
    const months = Math.round(Number(input?.months));
    if (!MONTHS.includes(months)) throw new BadRequestException('Choose 1, 3, 6 or 12 months');
    const method = input?.method === 'NAGAD' ? 'NAGAD' : input?.method === 'BKASH' ? 'BKASH' : null;
    if (!method) throw new BadRequestException('Choose bKash or Nagad');
    const sender = String(input?.senderNumber || '').replace(/[^\d]/g, '').replace(/^88/, '');
    if (!/^01[3-9]\d{8}$/.test(sender)) throw new BadRequestException('Enter the mobile number you paid from (01XXXXXXXXX)');
    const trxId = String(input?.trxId || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{6,20}$/.test(trxId)) throw new BadRequestException('Enter a valid TrxID (letters and numbers only)');

    const pending = await this.prisma.shopPayment.count({ where: { shopId: m.shopId, status: 'PENDING' } });
    if (pending) throw new BadRequestException('Your previous payment is still being checked. Please wait.');

    const amount = PLANS[plan].price * months;
    try {
      await this.prisma.shopPayment.create({ data: { shopId: m.shopId, plan, months, amount, method, senderNumber: sender, trxId } });
    } catch (e: any) {
      if (e?.code === 'P2002') throw new BadRequestException('This TrxID has already been used');
      throw e;
    }
    this.notify.newPaymentForAdmin(m.shop.name, amount, PLANS[plan].name);
    return { ok: true, amount };
  }
}

@Resolver()
export class ShopBillingResolver {
  constructor(private svc: ShopBillingService) {}

  @Query('shopBilling')
  @UseGuards(ShopApprovedGuard)
  info(@CurrentUser() me: any) {
    return this.svc.info(me.id);
  }

  @Mutation('shopSubmitPayment')
  @UseGuards(ShopApprovedGuard)
  submit(@CurrentUser() me: any, @Args('input') input: any) {
    return this.svc.submitPayment(me.id, input);
  }
}

// ======================================================================== super admin (platform-er ADMIN)
@Injectable()
export class ShopAdminService {
  constructor(
    private prisma: PrismaService,
    private notify: ShopNotifyService,
  ) {}

  /** Dhaka (UTC+6) onujayi din, jemon "2026-11-01" */
  private dayKey(t: number) {
    return new Date(t + 6 * 3600 * 1000).toISOString().slice(0, 10);
  }

  async overview() {
    const now = Date.now();
    const month = monthKey();
    const since = new Date(`${month}-01T00:00:00+06:00`);
    const [shops, revAll, revMonth, tok] = await Promise.all([
      this.prisma.shop.findMany({
        select: {
          status: true,
          plan: true,
          trialEndsAt: true,
          planEndsAt: true,
          usagePeriod: true,
          usageReplies: true,
          botEnabled: true,
          createdAt: true,
          _count: { select: { pages: true } },
        },
      }),
      this.prisma.shopPayment.aggregate({ where: { status: 'APPROVED' }, _sum: { amount: true } }),
      this.prisma.shopPayment.aggregate({ where: { status: 'APPROVED', reviewedAt: { gte: since } }, _sum: { amount: true } }),
      this.prisma.shopAiUsage.aggregate({ where: { createdAt: { gte: since } }, _sum: { inTokens: true, outTokens: true } }),
    ]);

    let paid = 0;
    let trial = 0;
    let suspended = 0;
    let expired = 0;
    let mrr = 0;
    let botOn = 0;
    let noPage = 0;
    let expiringSoon = 0;
    let today = 0;
    let week = 0;
    let last30 = 0;
    let repliesMonth = 0;

    const todayKey = this.dayKey(now);
    const daily = new Map<string, number>();
    for (let i = 13; i >= 0; i--) daily.set(this.dayKey(now - i * DAY), 0);

    for (const s of shops) {
      const a = shopAccess(s);
      if (s.status === 'SUSPENDED') suspended++;
      else if (a.reason === 'EXPIRED') expired++;
      else if (s.plan === 'TRIAL') trial++;
      else {
        paid++;
        mrr += PLANS[s.plan as PlanId]?.price || 0;
      }
      if (s.botEnabled) botOn++;
      if (!s._count.pages) noPage++;
      if (s.usagePeriod === month) repliesMonth += s.usageReplies;
      if (s.status !== 'SUSPENDED' && a.daysLeft !== null && a.daysLeft >= 0 && a.daysLeft <= (s.plan === 'TRIAL' ? 3 : 7)) expiringSoon++;

      const t = s.createdAt.getTime();
      const k = this.dayKey(t);
      if (k === todayKey) today++;
      if (now - t < 7 * DAY) week++;
      if (now - t < 30 * DAY) last30++;
      if (daily.has(k)) daily.set(k, (daily.get(k) || 0) + 1);
    }

    const pendingPayments = await this.prisma.shopPayment.count({ where: { status: 'PENDING' } });
    return {
      total: shops.length,
      paid,
      trial,
      expired,
      suspended,
      mrr,
      pendingPayments,
      botOn,
      noPage,
      expiringSoon,
      signups: { today, week, month: last30 },
      daily: [...daily.entries()].map(([date, count]) => ({ date, count })),
      revenue: revAll._sum.amount || 0,
      revenueMonth: revMonth._sum.amount || 0,
      repliesMonth,
      tokens: { in: tok._sum.inTokens || 0, out: tok._sum.outTokens || 0 },
    };
  }

  private filterWhere(filter?: string): any {
    const now = new Date();
    switch (filter) {
      case 'TRIAL':
        return { plan: 'TRIAL' };
      case 'PAID':
        return { plan: { in: PAID_PLANS } };
      case 'SUSPENDED':
        return { status: 'SUSPENDED' };
      case 'PENDING':
        return { approved: false };
      case 'NOPAGE':
        return { pages: { none: {} } };
      case 'BOT_ON':
        return { botEnabled: true };
      case 'EXPIRED':
        return {
          OR: [
            { plan: 'TRIAL', trialEndsAt: { lt: now } },
            { plan: { in: PAID_PLANS }, planEndsAt: null },
            { plan: { in: PAID_PLANS }, planEndsAt: { lt: new Date(now.getTime() - GRACE_DAYS * DAY) } },
          ],
        };
      default:
        return {};
    }
  }

  async shops(search: string | undefined, take: number, skip: number, filter?: string) {
    const q = String(search || '').trim();
    const and: any[] = [];
    if (q) {
      and.push({
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          {
            members: {
              some: {
                user: { OR: [{ phone: { contains: q } }, { name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] },
              },
            },
          },
        ],
      });
    }
    const f = this.filterWhere(filter);
    if (Object.keys(f).length) and.push(f);
    const where: any = and.length ? { AND: and } : {};

    const [rows, total] = await Promise.all([
      this.prisma.shop.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(100, Math.max(1, take)),
        skip: Math.max(0, skip),
        include: {
          members: { where: { role: 'OWNER' }, take: 1, include: { user: { select: { name: true, phone: true, email: true } } } },
          pages: { select: { pageId: true, name: true, status: true }, orderBy: { createdAt: 'asc' } },
          _count: { select: { pages: true, orders: true, products: true, chats: true } },
        },
      }),
      this.prisma.shop.count({ where }),
    ]);

    const ids = rows.map((r) => r.id);
    const since = new Date(`${monthKey()}-01T00:00:00+06:00`);
    const [tokens, last, paidSum] = await Promise.all([
      this.prisma.shopAiUsage.groupBy({
        by: ['shopId'],
        where: { shopId: { in: ids }, createdAt: { gte: since } },
        _sum: { inTokens: true, outTokens: true },
      }),
      this.prisma.shopChat.groupBy({ by: ['shopId'], where: { shopId: { in: ids } }, _max: { lastMessageAt: true } }),
      this.prisma.shopPayment.groupBy({ by: ['shopId'], where: { shopId: { in: ids }, status: 'APPROVED' }, _sum: { amount: true } }),
    ]);
    const tk = new Map<string, any>((tokens as any[]).map((t) => [t.shopId, t._sum]));
    const lc = new Map<string, any>((last as any[]).map((t) => [t.shopId, t._max.lastMessageAt]));
    const pd = new Map<string, number>((paidSum as any[]).map((t) => [t.shopId, t._sum.amount || 0]));

    const items = rows.map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      approved: s.approved,
      plan: s.plan,
      botEnabled: s.botEnabled,
      createdAt: s.createdAt,
      trialEndsAt: s.trialEndsAt,
      planEndsAt: s.planEndsAt,
      owner: s.members[0]?.user || null,
      pages: s.pages,
      counts: s._count,
      access: shopAccess(s),
      tokens: { in: tk.get(s.id)?.inTokens || 0, out: tk.get(s.id)?.outTokens || 0 },
      lastChatAt: lc.get(s.id) || null,
      totalPaid: pd.get(s.id) || 0,
    }));
    return { items, total };
  }

  /** Ekta shop-er puro chhobi (Details button) */
  async detail(id: string) {
    const s = await this.prisma.shop.findUnique({
      where: { id },
      include: {
        members: { include: { user: { select: { name: true, phone: true, email: true, createdAt: true } } } },
        pages: { select: { pageId: true, name: true, status: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
        botSettings: true,
      },
    });
    if (!s) throw new NotFoundException('Shop not found');

    const [orders, chats, payments, sales, products, chatCount, messages, tok] = await Promise.all([
      this.prisma.shopOrder.findMany({
        where: { shopId: id },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, number: true, customerName: true, total: true, status: true, createdAt: true },
      }),
      this.prisma.shopChat.findMany({
        where: { shopId: id },
        orderBy: { lastMessageAt: 'desc' },
        take: 5,
        select: { id: true, name: true, lastText: true, lastFrom: true, lastMessageAt: true, unread: true },
      }),
      this.prisma.shopPayment.findMany({
        where: { shopId: id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, plan: true, months: true, amount: true, status: true, method: true, trxId: true, createdAt: true },
      }),
      this.prisma.shopOrder.aggregate({ where: { shopId: id, status: { not: 'CANCELLED' } }, _sum: { total: true }, _count: true }),
      this.prisma.shopProduct.count({ where: { shopId: id } }),
      this.prisma.shopChat.count({ where: { shopId: id } }),
      this.prisma.shopMessage.count({ where: { chat: { shopId: id } } }),
      this.prisma.shopAiUsage.aggregate({ where: { shopId: id }, _sum: { inTokens: true, outTokens: true } }),
    ]);

    return {
      shop: {
        id: s.id,
        name: s.name,
        status: s.status,
      approved: s.approved,
        plan: s.plan,
        botEnabled: s.botEnabled,
        createdAt: s.createdAt,
        trialEndsAt: s.trialEndsAt,
        planEndsAt: s.planEndsAt,
        access: shopAccess(s),
      },
      members: s.members.map((m) => ({ role: m.role, user: m.user })),
      pages: s.pages,
      bot: s.botSettings
        ? {
            botName: s.botSettings.botName,
            tone: s.botSettings.tone,
            bargainEnabled: s.botSettings.bargainEnabled,
            deliveryInside: s.botSettings.deliveryInside,
            deliveryOutside: s.botSettings.deliveryOutside,
          }
        : null,
      stats: { orders: sales._count, sales: sales._sum.total || 0, products, chats: chatCount, messages },
      tokens: { in: tok._sum.inTokens || 0, out: tok._sum.outTokens || 0 },
      orders,
      chats,
      payments,
    };
  }

  async payments(status?: string) {
    const where: any = {};
    if (status) {
      if (!['PENDING', 'APPROVED', 'REJECTED'].includes(status)) throw new BadRequestException('Invalid status');
      where.status = status;
    }
    return this.prisma.shopPayment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { shop: { select: { id: true, name: true, plan: true, planEndsAt: true, members: { where: { role: 'OWNER' }, take: 1, select: { user: { select: { name: true, phone: true } } } } } } },
    });
  }

  async approve(id: string) {
    const p = await this.prisma.shopPayment.findUnique({ where: { id }, include: { shop: true } });
    if (!p) throw new NotFoundException('Payment not found');
    if (p.status !== 'PENDING') throw new BadRequestException('This payment was already reviewed');

    // ekei plan-e meyad thakte renew korle meyad-er sathe jog hoy, noile ajke theke
    const now = Date.now();
    const cur = p.shop.planEndsAt ? p.shop.planEndsAt.getTime() : 0;
    const base = p.shop.plan === p.plan && cur > now ? cur : now;
    const planEndsAt = new Date(base + p.months * 30 * DAY);

    await this.prisma.$transaction(async (tx) => {
      const claim = await tx.shopPayment.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'APPROVED', reviewedAt: new Date() } });
      if (!claim.count) throw new BadRequestException('This payment was already reviewed');
      await tx.shop.update({
        where: { id: p.shopId },
        data: { plan: p.plan, planEndsAt, ...(p.shop.status === 'SUSPENDED' ? {} : { status: 'ACTIVE' }) },
      });
    });
    pageCache.clear();
    this.notify.planActivated(p.shopId, PLANS[p.plan as PlanId]?.name || p.plan);
    return true;
  }

  async reject(id: string, note?: string) {
    const p = await this.prisma.shopPayment.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Payment not found');
    if (p.status !== 'PENDING') throw new BadRequestException('This payment was already reviewed');
    const n = String(note || '').trim().slice(0, 200) || null;
    await this.prisma.shopPayment.update({ where: { id }, data: { status: 'REJECTED', note: n, reviewedAt: new Date() } });
    this.notify.paymentRejected(p.shopId, n || '');
    return true;
  }

  /** Suspend/unsuspend, plan override, meyad barano, bot on/off */
  async setShop(id: string, input: any) {
    const shop = await this.prisma.shop.findUnique({ where: { id } });
    if (!shop) throw new NotFoundException('Shop not found');
    const data: any = {};

    if (input?.status !== undefined) {
      if (!['TRIAL', 'ACTIVE', 'SUSPENDED'].includes(input.status)) throw new BadRequestException('Invalid status');
      data.status = input.status;
    }
    if (input?.approved !== undefined) {
      data.approved = !!input.approved;
      // approve korar din theke 7 din trial dhoro
      if (data.approved && !shop.approved && shop.plan === 'TRIAL' && input?.plan === undefined) {
        data.trialEndsAt = new Date(Date.now() + 7 * DAY);
      }
    }
    if (input?.botEnabled !== undefined) data.botEnabled = !!input.botEnabled;
    let plan = shop.plan;
    if (input?.plan !== undefined) {
      if (!(input.plan in PLANS)) throw new BadRequestException('Invalid plan');
      plan = input.plan;
      data.plan = plan;
    }
    const days = input?.extendDays == null || input.extendDays === '' ? 0 : Math.round(Number(input.extendDays));
    if (days) {
      if (!Number.isFinite(days) || days < 1 || days > 366) throw new BadRequestException('extendDays must be 1-366');
      const field = plan === 'TRIAL' ? 'trialEndsAt' : 'planEndsAt';
      const cur = shop[field] ? shop[field]!.getTime() : 0;
      data[field] = new Date(Math.max(Date.now(), cur) + days * DAY);
    }
    if (!Object.keys(data).length) throw new BadRequestException('Nothing to change');

    const updated = await this.prisma.shop.update({ where: { id }, data });
    pageCache.clear();
    return { id: updated.id, status: updated.status, approved: updated.approved, plan: updated.plan, access: shopAccess(updated) };
  }
}

@Resolver()
export class ShopAdminResolver {
  constructor(private svc: ShopAdminService) {}

  @Query('saasOverview')
  @UseGuards(AdminGuard)
  overview() {
    return this.svc.overview();
  }

  @Query('saasShops')
  @UseGuards(AdminGuard)
  shops(
    @Args('search', { nullable: true }) search?: string,
    @Args('take', { type: () => Int, nullable: true }) take?: number,
    @Args('skip', { type: () => Int, nullable: true }) skip?: number,
    @Args('filter', { nullable: true }) filter?: string,
  ) {
    return this.svc.shops(search, take ?? 30, skip ?? 0, filter);
  }

  @Query('saasShop')
  @UseGuards(AdminGuard)
  shop(@Args('id') id: string) {
    return this.svc.detail(id);
  }

  @Query('saasPayments')
  @UseGuards(AdminGuard)
  payments(@Args('status', { nullable: true }) status?: string) {
    return this.svc.payments(status);
  }

  @Mutation('saasApprovePayment')
  @UseGuards(AdminGuard)
  approve(@Args('id') id: string) {
    return this.svc.approve(id);
  }

  @Mutation('saasRejectPayment')
  @UseGuards(AdminGuard)
  reject(@Args('id') id: string, @Args('note', { nullable: true }) note?: string) {
    return this.svc.reject(id, note);
  }

  @Mutation('saasSetShop')
  @UseGuards(AdminGuard)
  setShop(@Args('id') id: string, @Args('input') input: any) {
    return this.svc.setShop(id, input);
  }
}