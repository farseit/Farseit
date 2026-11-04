import { ShopApprovedGuard } from './shop-guard';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Prisma } from '@prisma/client';
import { CurrentUser, JwtAuthGuard } from '../auth/guards';
import { PrismaService } from '../prisma/prisma.module';
import { ShopBotService } from './shop-bot.service';
import { limitsFor } from './shop-plans';
import { randomBytes as nodeRandomBytes } from 'crypto';
const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;

function int(v: any, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
function str(v: any, max: number): string {
  return String(v ?? '').trim().slice(0, max);
}

function statusMessage(status: string, number: number, total: number, shop: string): string | null {
  switch (status) {
    case 'CONFIRMED':
      return `✅ আপনার অর্ডার #${number} কনফার্ম হয়েছে। মোট ৳${total}। শীঘ্রই ডেলিভারির জন্য পাঠানো হবে। - ${shop}`;
    case 'SHIPPED':
      return `🚚 আপনার অর্ডার #${number} ডেলিভারির জন্য পাঠানো হয়েছে। খুব শীঘ্রই আপনার কাছে পৌঁছে যাবে। - ${shop}`;
    case 'DELIVERED':
      return `🎉 আপনার অর্ডার #${number} ডেলিভারি সম্পন্ন হয়েছে। আমাদের সাথে কেনাকাটার জন্য ধন্যবাদ! - ${shop}`;
    case 'CANCELLED':
      return `দুঃখিত, আপনার অর্ডার #${number} বাতিল করা হয়েছে। কিছু জানার থাকলে মেসেজ করুন। - ${shop}`;
    default:
      return null;
  }
}

@Injectable()
export class ShopDataService {
  constructor(
    private prisma: PrismaService,
    private bot: ShopBotService,
  ) {}

  /** Login kora user kon shop-er member + tar role. Shob query ei shopId diye bandha */
  private async member(userId: string) {
    const m = await this.prisma.shopMember.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } });
    if (!m) throw new NotFoundException('You do not have a shop yet');
    return m;
  }
  private async ownerShopId(userId: string) {
    const m = await this.member(userId);
    if (m.role !== 'OWNER') throw new ForbiddenException('Only the shop owner can do this');
    return m.shopId;
  }

  // ------------------------------------------------------------ products
  async products(userId: string) {
    const { shopId } = await this.member(userId);
    return this.prisma.shopProduct.findMany({ where: { shopId }, orderBy: { createdAt: 'desc' }, take: 500 });
  }

  async saveProduct(userId: string, input: any) {
    const { shopId } = await this.member(userId);
    const name = str(input?.name, 120);
    if (name.length < 2) throw new BadRequestException('Product name is required');
    const price = int(input?.price, 1, 10_000_000, 0);
    if (price < 1) throw new BadRequestException('Price must be greater than 0');

    const options = Array.isArray(input?.options)
      ? input.options
          .slice(0, 5)
          .map((o: any) => ({
            name: str(o?.name, 30),
            values: (Array.isArray(o?.values) ? o.values : []).map((v: any) => str(v, 30)).filter(Boolean).slice(0, 30),
          }))
          .filter((o: any) => o.name && o.values.length)
      : [];
    const images = (Array.isArray(input?.images) ? input.images : [])
      .map((u: any) => str(u, 500))
      .filter((u: string) => /^https?:\/\//i.test(u))
      .slice(0, 5);
    const minPrice = input?.minPrice == null || input.minPrice === '' ? null : Math.min(price, int(input.minPrice, 0, 10_000_000, price));

    const data = {
      name,
      description: str(input?.description, 3000) || null,
      price,
      minPrice,
      stock: int(input?.stock, 0, 1_000_000, 0),
      trackStock: input?.trackStock !== false,
      images,
      options: options.length ? options : undefined,
      active: input?.active !== false,
    };

    if (input?.id) {
      const found = await this.prisma.shopProduct.findFirst({ where: { id: String(input.id), shopId }, select: { id: true } });
      if (!found) throw new NotFoundException('Product not found');
      return this.prisma.shopProduct.update({ where: { id: found.id }, data: { ...data, options: options.length ? options : Prisma.DbNull } });
    }
    const shop = await this.prisma.shop.findUnique({ where: { id: shopId }, select: { plan: true } });
    const max = limitsFor(shop?.plan || 'TRIAL').products;
    if ((await this.prisma.shopProduct.count({ where: { shopId } })) >= max) {
      throw new BadRequestException(`Your plan allows up to ${max} products. Please upgrade to add more.`);
    }
    return this.prisma.shopProduct.create({ data: { ...data, shopId, code: nodeRandomBytes(5).toString('hex') } });
  }

  async deleteProduct(userId: string, id: string) {
    const { shopId } = await this.member(userId);
    const r = await this.prisma.shopProduct.deleteMany({ where: { id, shopId } });
    return r.count > 0;
  }

  // ------------------------------------------------------------ bot settings
  async botSettings(userId: string) {
    const { shopId } = await this.member(userId);
    return (await this.prisma.shopBotSettings.findUnique({ where: { shopId } })) || (await this.prisma.shopBotSettings.create({ data: { shopId } }));
  }

  async saveBotSettings(userId: string, input: any) {
    const shopId = await this.ownerShopId(userId);
    const data = {
      botName: str(input?.botName, 40) || 'Assistant',
      tone: input?.tone === 'FORMAL' ? 'FORMAL' : 'FRIENDLY',
      greeting: str(input?.greeting, 1000) || null,
      insideArea: str(input?.insideArea, 80) || 'ঢাকা সিটির ভিতরে',
      deliveryInside: int(input?.deliveryInside, 0, 5000, 60),
      deliveryOutside: int(input?.deliveryOutside, 0, 5000, 120),
      bargainEnabled: !!input?.bargainEnabled,
      rules: str(input?.rules, 3000) || null,
    };
    return this.prisma.shopBotSettings.upsert({ where: { shopId }, update: data, create: { shopId, ...data } });
  }

  // ------------------------------------------------------------ orders
  async orders(userId: string, status?: string, take = 30, skip = 0) {
    const { shopId } = await this.member(userId);
    const where: any = { shopId };
    if (status) {
      if (!(ORDER_STATUSES as readonly string[]).includes(status)) throw new BadRequestException('Invalid status');
      where.status = status;
    }
    const [items, total] = await Promise.all([
      this.prisma.shopOrder.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        take: int(take, 1, 100, 30),
        skip: int(skip, 0, 100000, 0),
      }),
      this.prisma.shopOrder.count({ where }),
    ]);
    return { items, total };
  }

    async setOrderStatus(userId: string, id: string, status: string) {
    const { shopId } = await this.member(userId);
    if (!(ORDER_STATUSES as readonly string[]).includes(status)) throw new BadRequestException('Invalid status');

    const before = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "ShopOrder" WHERE "id" = ${id} AND "shopId" = ${shopId} FOR UPDATE`;
      const order = await tx.shopOrder.findFirst({ where: { id, shopId }, include: { items: true } });
      if (!order) throw new NotFoundException('Order not found');
      // cancel hole stock ferot, cancel theke abar chalu hole abar kete nei
      const toCancel = status === 'CANCELLED' && order.status !== 'CANCELLED';
      const fromCancel = order.status === 'CANCELLED' && status !== 'CANCELLED';
      if (toCancel || fromCancel) {
        for (const it of order.items) {
          if (!it.productId) continue;
          await tx.shopProduct.updateMany({
            where: { id: it.productId, shopId, trackStock: true, ...(fromCancel ? { stock: { gte: it.qty } } : {}) },
            data: { stock: toCancel ? { increment: it.qty } : { decrement: it.qty } },
          });
        }
      }
      await tx.shopOrder.update({ where: { id: order.id }, data: { status: status as any } });
      return order.status as string;
    });

    const order = await this.prisma.shopOrder.findFirst({ where: { id, shopId }, include: { items: true } });
    let notified = 'SKIPPED';
    if (order && before !== status) {
      const shop = await this.prisma.shop.findUnique({ where: { id: shopId }, select: { name: true } });
      const text = statusMessage(status, order.number, order.total, shop?.name || '');
      if (text) notified = await this.bot.notifyCustomer(shopId, order.chatId, text).catch(() => 'FAILED');
    }
    return { ...order, notified };
  }
}

@Resolver()
export class ShopDataResolver {
  constructor(private svc: ShopDataService) {}

  @Query('shopProducts')
  @UseGuards(ShopApprovedGuard)
  products(@CurrentUser() me: any) {
    return this.svc.products(me.id);
  }

  @Mutation('shopSaveProduct')
  @UseGuards(ShopApprovedGuard)
  saveProduct(@CurrentUser() me: any, @Args('input') input: any) {
    return this.svc.saveProduct(me.id, input);
  }

  @Mutation('shopDeleteProduct')
  @UseGuards(ShopApprovedGuard)
  deleteProduct(@CurrentUser() me: any, @Args('id') id: string) {
    return this.svc.deleteProduct(me.id, id);
  }

  @Query('shopBotSettings')
  @UseGuards(ShopApprovedGuard)
  botSettings(@CurrentUser() me: any) {
    return this.svc.botSettings(me.id);
  }

  @Mutation('shopSaveBotSettings')
  @UseGuards(ShopApprovedGuard)
  saveBotSettings(@CurrentUser() me: any, @Args('input') input: any) {
    return this.svc.saveBotSettings(me.id, input);
  }

  @Query('shopOrders')
  @UseGuards(ShopApprovedGuard)
  orders(
    @CurrentUser() me: any,
    @Args('status', { nullable: true }) status?: string,
    @Args('take', { type: () => Int, nullable: true }) take?: number,
    @Args('skip', { type: () => Int, nullable: true }) skip?: number,
  ) {
    return this.svc.orders(me.id, status, take ?? 30, skip ?? 0);
  }

  @Mutation('shopSetOrderStatus')
  @UseGuards(ShopApprovedGuard)
  setOrderStatus(@CurrentUser() me: any, @Args('id') id: string, @Args('status') status: string) {
    return this.svc.setOrderStatus(me.id, id, status);
  }
}