import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { getRequest, JwtAuthGuard } from '../auth/guards';
import { PrismaService } from '../prisma/prisma.module';

const okCache = new Map<string, number>(); // approved user-der ke 15 sec cache

/** Login thaka lagbe + shop approved howa lagbe. Na hole feature API kaj korbe na */
@Injectable()
export class ShopApprovedGuard extends JwtAuthGuard {
  constructor(private prisma: PrismaService) {
    super();
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const ok = await super.canActivate(ctx);
    if (!ok) return false;

    const user = getRequest(ctx).user;
    const hit = okCache.get(user.id);
    if (hit && hit > Date.now()) return true;

    const m = await this.prisma.shopMember.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      select: { shop: { select: { approved: true } } },
    });
    if (m && !m.shop.approved) throw new ForbiddenException('SHOP_NOT_APPROVED');

    if (okCache.size > 2000) okCache.clear();
    okCache.set(user.id, Date.now() + 15_000);
    return true;
  }
}