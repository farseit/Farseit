import { BadRequestException, Injectable } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { clientIp, rateLimit } from '../common/rate-limit';
import { PrismaService } from '../prisma/prisma.module';
import { ShopNotifyService } from './shop-notify.service';
import { shopAccess } from './shop-plans';

const str = (v: any, max: number) => String(v ?? '').trim().slice(0, max);

function normPhone(v: any): string | null {
  const d = String(v || '').replace(/[^\d+]/g, '').replace(/^\+?88/, '');
  return /^01[3-9]\d{8}$/.test(d) ? d : null;
}

@Injectable()
export class ShopLandingService {
  constructor(
    private prisma: PrismaService,
    private notify: ShopNotifyService,
  ) {}

  private async load(code: string) {
    const c = str(code, 40);
    if (!/^[a-z0-9]{6,20}$/i.test(c)) return null;
    return this.prisma.shopProduct.findFirst({ where: { code: c, active: true }, include: { shop: true } });
  }

  /** Public: landing page-er data. minPrice kokhono ber hoy na */
  async view(code: string) {
    const p = await this.load(code);
    if (!p) return null;
    const [s, page] = await Promise.all([
      this.prisma.shopBotSettings.findUnique({ where: { shopId: p.shopId } }),
      this.prisma.shopPage.findFirst({ where: { shopId: p.shopId, status: 'ACTIVE' }, orderBy: { createdAt: 'asc' }, select: { pageId: true } }),
    ]);
    const access = shopAccess(p.shop as any);
    return {
      code: p.code,
      name: p.name,
      description: p.description,
      price: p.price,
      images: p.images,
      options: p.options || [],
      inStock: !p.trackStock || p.stock > 0,
      maxQty: p.trackStock ? Math.max(0, Math.min(p.stock, 10)) : 10,
      canBargain: !!s?.bargainEnabled && p.minPrice != null && p.minPrice < p.price,
      accepting: access.reason !== 'SUSPENDED' && access.reason !== 'EXPIRED' && access.reason !== 'PENDING',
      shopName: p.shop.name,
      messengerUrl: page ? `https://m.me/${page.pageId}` : null,
      delivery: { inside: s?.deliveryInside ?? 60, outside: s?.deliveryOutside ?? 120, insideArea: s?.insideArea ?? '' },
    };
  }

  /** Public: landing page theke order */
  async order(code: string, input: any, ip: string) {
    await rateLimit(`landing-ip:${ip}`, 8, 3600 * 1000, 'Too many orders from this network. Please try again later.');
    const p = await this.load(code);
    if (!p) throw new BadRequestException('This product is not available');
    const access = shopAccess(p.shop as any);
    if (access.reason === 'SUSPENDED' || access.reason === 'EXPIRED' || access.reason === 'PENDING') throw new BadRequestException('This shop is not taking orders right now');

    const phone = normPhone(input?.phone);
    if (!phone) throw new BadRequestException('Please enter a valid mobile number like 01XXXXXXXXX');
    await rateLimit(`landing-phone:${phone}`, 3, 3600 * 1000, 'Too many orders with this number. Please try again later.');
    const name = str(input?.name, 80);
    if (name.length < 2) throw new BadRequestException('Please enter your name');
    const address = str(input?.address, 300);
    if (address.length < 10) throw new BadRequestException('Please enter your full address (area, road, house, district)');
    const zone = input?.zone === 'OUTSIDE' ? 'OUTSIDE' : 'INSIDE';
    const qty = Math.round(Number(input?.qty));
    if (!Number.isFinite(qty) || qty < 1 || qty > 20) throw new BadRequestException('Invalid quantity');

    // size/color: shop-er deya list theke-i nite hobe
    const defs: { name: string; values: string[] }[] = Array.isArray(p.options) ? (p.options as any) : [];
    const chosen = input?.options && typeof input.options === 'object' ? input.options : {};
    const picked: string[] = [];
    for (const d of defs) {
      const real = d.values.find((v) => v.toLowerCase() === String(chosen[d.name] ?? '').toLowerCase());
      if (!real) throw new BadRequestException(`Please choose ${d.name}`);
      picked.push(`${d.name}: ${real}`);
    }
    if (p.trackStock && p.stock < qty) throw new BadRequestException(p.stock > 0 ? `Only ${p.stock} left in stock` : 'Sorry, this product is out of stock');

    const s = await this.prisma.shopBotSettings.findUnique({ where: { shopId: p.shopId } });
    const subtotal = p.price * qty;
    const deliveryCharge = zone === 'INSIDE' ? s?.deliveryInside ?? 60 : s?.deliveryOutside ?? 120;
    const total = subtotal + deliveryCharge;

    // 2 minute-er moddhe hubohu order hole double na kore agerta-i dekhai
    const dup = await this.prisma.shopOrder.findFirst({
      where: { shopId: p.shopId, phone, total, source: 'LANDING', createdAt: { gte: new Date(Date.now() - 2 * 60 * 1000) } },
    });
    if (dup) return { number: dup.number, subtotal: dup.subtotal, deliveryCharge: dup.deliveryCharge, total: dup.total, duplicate: true };

    try {
      const order = await this.prisma.$transaction(async (tx) => {
        if (p.trackStock) {
          const r = await tx.shopProduct.updateMany({ where: { id: p.id, shopId: p.shopId, stock: { gte: qty } }, data: { stock: { decrement: qty } } });
          if (!r.count) throw new Error('STOCK');
        }
        const seq = await tx.shop.update({ where: { id: p.shopId }, data: { orderSeq: { increment: 1 } }, select: { orderSeq: true } });
        return tx.shopOrder.create({
          data: {
            shopId: p.shopId,
            number: seq.orderSeq,
            customerName: name,
            phone,
            address,
            zone,
            subtotal,
            deliveryCharge,
            total,
            source: 'LANDING',
            items: { create: [{ productId: p.id, name: p.name, option: picked.length ? picked.join(', ') : null, price: p.price, qty }] },
          },
        });
      });
      this.notify.newOrder(p.shopId, { id: order.id, number: order.number, customerName: name, total });
      return { number: order.number, subtotal, deliveryCharge, total };
    } catch (e: any) {
      if (String(e?.message) === 'STOCK') throw new BadRequestException('Sorry, this product just went out of stock');
      throw e;
    }
  }
}

@Resolver()
export class ShopLandingResolver {
  constructor(private svc: ShopLandingService) {}

  @Query('shopLanding')
  landing(@Args('code') code: string) {
    return this.svc.view(code);
  }

  @Mutation('shopLandingOrder')
  order(@Args('code') code: string, @Args('input') input: any, @Context() ctx: any) {
    return this.svc.order(code, input, clientIp(ctx));
  }
}