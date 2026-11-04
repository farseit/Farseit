import { ShopApprovedGuard } from './shop-guard';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser, JwtAuthGuard } from '../auth/guards';
import { PrismaService } from '../prisma/prisma.module';
import { ShopBotService } from './shop-bot.service';
import { shopAccess } from './shop-plans';
import { pageCache } from './shop-router';

const CHAT_SELECT = {
  id: true,
  pageId: true,
  name: true,
  aiEnabled: true,
  handoffUntil: true,
  unread: true,
  lastText: true,
  lastFrom: true,
  lastMessageAt: true,
  createdAt: true,
} as const; // psid bahire jay na

@Injectable()
export class ShopInboxService {
  constructor(
    private prisma: PrismaService,
    private bot: ShopBotService,
  ) {}

  private async member(userId: string) {
    const m = await this.prisma.shopMember.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } });
    if (!m) throw new NotFoundException('You do not have a shop yet');
    return m;
  }

  async chats(userId: string, unreadOnly: boolean, take: number, skip: number) {
    const { shopId } = await this.member(userId);
    const where: any = { shopId };
    if (unreadOnly) where.unread = { gt: 0 };
    const [items, total, sum] = await Promise.all([
      this.prisma.shopChat.findMany({
        where,
        select: CHAT_SELECT,
        orderBy: { lastMessageAt: 'desc' },
        take: Math.min(100, Math.max(1, take)),
        skip: Math.max(0, skip),
      }),
      this.prisma.shopChat.count({ where }),
      this.prisma.shopChat.aggregate({ where: { shopId }, _sum: { unread: true } }),
    ]);
    return { items, total, unreadTotal: sum._sum.unread || 0 };
  }

  /** Chat khulle unread 0 hoy */
  async chat(userId: string, id: string) {
    const { shopId } = await this.member(userId);
    const chat = await this.prisma.shopChat.findFirst({ where: { id, shopId }, select: CHAT_SELECT });
    if (!chat) throw new NotFoundException('Chat not found');
    const rows = await this.prisma.shopMessage.findMany({ where: { chatId: id }, orderBy: { createdAt: 'desc' }, take: 80 });
    rows.reverse();
    if (chat.unread) await this.prisma.shopChat.update({ where: { id }, data: { unread: 0 } });
    const orders = await this.prisma.shopOrder.findMany({ where: { shopId, chatId: id }, orderBy: { createdAt: 'desc' }, take: 5, include: { items: true } });
    return { chat: { ...chat, unread: 0 }, messages: rows, orders };
  }

  async reply(userId: string, chatId: string, text: string) {
    const { shopId } = await this.member(userId);
    const t = String(text || '').trim().slice(0, 1900);
    if (!t) throw new BadRequestException('Message is empty');
    return this.bot.adminSend(shopId, chatId, t);
  }

  /** on=true: bot abar chalu (handoff-o shesh). on=false: ei chat-e bot bondho */
  async setChatBot(userId: string, chatId: string, on: boolean) {
    const { shopId } = await this.member(userId);
    const r = await this.prisma.shopChat.updateMany({
      where: { id: chatId, shopId },
      data: on ? { aiEnabled: true, handoffUntil: null } : { aiEnabled: false },
    });
    if (!r.count) throw new NotFoundException('Chat not found');
    return true;
  }

  /** Puro shop-er bot on/off (owner only) */
  async setBotEnabled(userId: string, enabled: boolean) {
    const m = await this.member(userId);
    if (m.role !== 'OWNER') throw new ForbiddenException('Only the shop owner can do this');
    if (enabled) {
      const [pages, products] = await Promise.all([
        this.prisma.shopPage.count({ where: { shopId: m.shopId, status: 'ACTIVE' } }),
        this.prisma.shopProduct.count({ where: { shopId: m.shopId, active: true } }),
      ]);
      if (!pages) throw new BadRequestException('Connect a Facebook Page first');
      if (!products) throw new BadRequestException('Add at least one active product before turning the bot on');
      const shop = await this.prisma.shop.findUnique({ where: { id: m.shopId } });
      if (!shop || shop.status === 'SUSPENDED') throw new ForbiddenException('This shop is suspended');
      const reason = shopAccess(shop).reason;
      if (reason === 'EXPIRED') throw new BadRequestException('Your plan has ended. Please renew it to turn the bot on');
    }
    await this.prisma.shop.update({ where: { id: m.shopId }, data: { botEnabled: enabled } });
    pageCache.clear();
    return true;
  }
}

@Resolver()
export class ShopInboxResolver {
  constructor(private svc: ShopInboxService) {}

  @Query('shopChats')
  @UseGuards(ShopApprovedGuard)
  chats(
    @CurrentUser() me: any,
    @Args('unreadOnly', { nullable: true }) unreadOnly?: boolean,
    @Args('take', { type: () => Int, nullable: true }) take?: number,
    @Args('skip', { type: () => Int, nullable: true }) skip?: number,
  ) {
    return this.svc.chats(me.id, !!unreadOnly, take ?? 30, skip ?? 0);
  }

  @Query('shopChat')
  @UseGuards(ShopApprovedGuard)
  chat(@CurrentUser() me: any, @Args('id') id: string) {
    return this.svc.chat(me.id, id);
  }

  @Mutation('shopReply')
  @UseGuards(ShopApprovedGuard)
  reply(@CurrentUser() me: any, @Args('chatId') chatId: string, @Args('text') text: string) {
    return this.svc.reply(me.id, chatId, text);
  }

  @Mutation('shopSetChatBot')
  @UseGuards(ShopApprovedGuard)
  setChatBot(@CurrentUser() me: any, @Args('chatId') chatId: string, @Args('on') on: boolean) {
    return this.svc.setChatBot(me.id, chatId, on);
  }

  @Mutation('shopSetBotEnabled')
  @UseGuards(ShopApprovedGuard)
  setBotEnabled(@CurrentUser() me: any, @Args('enabled') enabled: boolean) {
    return this.svc.setBotEnabled(me.id, enabled);
  }
}