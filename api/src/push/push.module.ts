import { Injectable, Module, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser, JwtAuthGuard } from '../auth/guards';
import { PrismaService } from '../prisma/prisma.module';

/**
 * Browser push subscription save/remove. Asol push pathano kaj ShopNotifyService (shop/shop-notify.service.ts) kore.
 * VAPID key na thakle publicKey khali ferot dey, frontend tokhon push button dekhay na.
 */
@Injectable()
export class PushService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  get publicKey() {
    const clean = (v?: string) => (v || '').trim().replace(/^["']|["']$/g, '');
    const pub = clean(this.config.get<string>('VAPID_PUBLIC_KEY'));
    const priv = clean(this.config.get<string>('VAPID_PRIVATE_KEY'));
    return pub && priv ? pub : '';
  }

  async save(userId: string, endpoint: string, p256dh: string, auth: string) {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { p256dh, auth, userId },
      create: { endpoint, p256dh, auth, userId },
    });
    return true;
  }

  /** Nijer subscription-i shudhu muchte parbe */
  async remove(endpoint: string, userId: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint, userId } });
    return true;
  }
}

@Resolver()
export class PushResolver {
  constructor(private push: PushService) {}

  @Query('pushPublicKey')
  @UseGuards(JwtAuthGuard)
  key() {
    return this.push.publicKey;
  }

  @Mutation('savePushSubscription')
  @UseGuards(JwtAuthGuard)
  save(
    @CurrentUser() user: any,
    @Args('endpoint') endpoint: string,
    @Args('p256dh') p256dh: string,
    @Args('auth') auth: string,
  ) {
    return this.push.save(user.id, endpoint, p256dh, auth);
  }

  @Mutation('removePushSubscription')
  @UseGuards(JwtAuthGuard)
  remove(@CurrentUser() user: any, @Args('endpoint') endpoint: string) {
    return this.push.remove(endpoint, user.id);
  }
}

@Module({ providers: [PushService, PushResolver], exports: [PushService] })
export class PushModule {}
