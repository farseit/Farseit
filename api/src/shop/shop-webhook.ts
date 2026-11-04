import { Controller, ForbiddenException, Get, HttpCode, Logger, Post, Query, RawBodyRequest, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { routeEvent } from './shop-router';

/**
 * Facebook Messenger webhook. Meta app-er Webhooks-e callback URL hobe:  https://<api-domain>/webhook
 * (/messenger/webhook-o kaj kore). Verify token = FB_VERIFY_TOKEN, signature = FB_APP_SECRET.
 */
@Controller()
export class ShopWebhookController {
  private log = new Logger('Webhook');

  constructor(private config: ConfigService) {}

  private validSignature(raw: Buffer | undefined, header?: string): boolean {
    const secret = this.config.get<string>('FB_APP_SECRET');
    if (!secret) return process.env.NODE_ENV !== 'production'; // shudhu development-e check skip
    if (!raw || !header?.startsWith('sha256=')) return false;
    const expected = createHmac('sha256', secret).update(raw).digest('hex');
    const got = header.slice(7);
    return got.length === expected.length && timingSafeEqual(Buffer.from(got), Buffer.from(expected));
  }

  @Get(['webhook', 'messenger/webhook'])
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    const expected = this.config.get<string>('FB_VERIFY_TOKEN');
    if (mode === 'subscribe' && expected && token === expected) return challenge;
    throw new ForbiddenException();
  }

  @Post(['webhook', 'messenger/webhook'])
  @HttpCode(200)
  receive(@Req() req: RawBodyRequest<Request>) {
    if (!this.validSignature(req.rawBody, req.headers['x-hub-signature-256'] as string)) {
      this.log.warn('webhook rejected: bad/missing signature (check FB_APP_SECRET)');
      throw new ForbiddenException('Bad signature');
    }
    const body: any = req.body;
    if (body?.object !== 'page') return 'IGNORED';
    for (const entry of body.entry || []) {
      for (const ev of entry.messaging || []) {
        // Meta-ke sathe sathe uttor diye, bot-er kaj background-e
        routeEvent(entry.id, ev).catch((e) => this.log.error(e?.stack || String(e)));
      }
    }
    return 'EVENT_RECEIVED';
  }
}
