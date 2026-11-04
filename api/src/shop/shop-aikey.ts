import { ShopApprovedGuard } from './shop-guard';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser, JwtAuthGuard } from '../auth/guards';
import { decryptSecret, encryptSecret } from '../common/crypto';
import { rateLimit } from '../common/rate-limit';
import { PrismaService } from '../prisma/prisma.module';
import { reportIssue } from './shop-health';

const MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1';

export type KeyStatus = 'OK' | 'INVALID' | 'QUOTA';
type Check = { ok: boolean; status: KeyStatus | 'ERROR'; message: string };

@Injectable()
export class ShopAiKeyService {
  constructor(private prisma: PrismaService) {}

  private async member(userId: string, ownerOnly = false) {
    const m = await this.prisma.shopMember.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } });
    if (!m) throw new NotFoundException('You do not have a shop yet');
    if (ownerOnly && m.role !== 'OWNER') throw new ForbiddenException('Only the shop owner can do this');
    return m;
  }

  /** Google-e ekta halka call (model list) diye key thik kina dekhe. Reply-er quota khoroch hoy na */
  async check(key: string): Promise<Check> {
    try {
      const model = process.env.GEMINI_BYOK_MODEL || 'gemini-flash-lite-latest';
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with OK' }] }], generationConfig: { maxOutputTokens: 8 } }),
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) return { ok: true, status: 'OK', message: '' };
      if (res.status === 429) return { ok: false, status: 'QUOTA', message: 'Google says this key has reached its limit right now. Try again later.' };
      if (res.status === 404) return { ok: false, status: 'ERROR', message: `Google does not know the model "${model}". Set GEMINI_BYOK_MODEL to a model your key can use.` };
      if ([400, 401, 403].includes(res.status)) return { ok: false, status: 'INVALID', message: 'Google did not accept this key. Check that you copied the whole key.' };
      return { ok: false, status: 'ERROR', message: `Could not verify the key (Google returned ${res.status}). Please try again.` };
    } catch {
      return { ok: false, status: 'ERROR', message: 'Could not reach Google to verify the key. Please try again.' };
    }
  }

  private view(row: any) {
    if (!row) return { configured: false, status: 'NONE', last4: null, lastError: null, checkedAt: null };
    return { configured: true, status: row.status, last4: row.last4, lastError: row.lastError, checkedAt: row.checkedAt };
  }

  async status(userId: string) {
    const m = await this.member(userId);
    return this.view(await this.prisma.shopAiKey.findUnique({ where: { shopId: m.shopId } }));
  }

  async save(userId: string, raw: string) {
    const m = await this.member(userId, true);
    await rateLimit(`aikey:${m.shopId}`, 10, 3600 * 1000, 'Too many attempts. Please try again in an hour.');
    const key = String(raw || '').trim().replace(/^["']+|["']+$/g, '');
    if (key.length < 20 || key.length > 300 || /\s/.test(key)) throw new BadRequestException('This does not look like a Gemini API key. Copy the whole key without spaces.');
    const c = await this.check(key);
    if (!c.ok) throw new BadRequestException(c.message);
    const row = await this.prisma.shopAiKey.upsert({
      where: { shopId: m.shopId },
      update: { keyEnc: encryptSecret(key), last4: key.slice(-4), status: 'OK', lastError: null, checkedAt: new Date() },
      create: { shopId: m.shopId, keyEnc: encryptSecret(key), last4: key.slice(-4) },
    });
    return this.view(row);
  }

  /** Save kora key abar check kore status update kore */
  async test(userId: string) {
    const m = await this.member(userId, true);
    await rateLimit(`aikey:${m.shopId}`, 10, 3600 * 1000, 'Too many attempts. Please try again in an hour.');
    const row = await this.prisma.shopAiKey.findUnique({ where: { shopId: m.shopId } });
    if (!row) throw new BadRequestException('No key saved yet');
    const c = await this.check(decryptSecret(row.keyEnc));
    if (c.ok) return this.view(await this.prisma.shopAiKey.update({ where: { shopId: m.shopId }, data: { status: 'OK', lastError: null, checkedAt: new Date() } }));
    if (c.status === 'ERROR') throw new BadRequestException(c.message); // Google-e pouchano gelo na, status bodlabo na
    return this.view(await this.prisma.shopAiKey.update({ where: { shopId: m.shopId }, data: { status: c.status, lastError: c.message, checkedAt: new Date() } }));
  }

  async remove(userId: string) {
    const m = await this.member(userId, true);
    await this.prisma.shopAiKey.deleteMany({ where: { shopId: m.shopId } });
    return true;
  }

  // ------------------------------------------------------------ bot-er jonno
  /** Shop-er nijer key. Nai ba INVALID hole null */
  async keyFor(shopId: string): Promise<string | null> {
    const row = await this.prisma.shopAiKey.findUnique({ where: { shopId } });
    if (!row || row.status === 'INVALID') return null;
    try {
      return decryptSecret(row.keyEnc);
    } catch {
      return null;
    }
  }

  /** Status bodlale tobei DB-te lekhe, tai thik thakle reply-protit extra write hoy na */
  async mark(shopId: string, status: KeyStatus, message: string | null) {
    const r = await this.prisma.shopAiKey
      .updateMany({ where: { shopId, status: { not: status } }, data: { status, lastError: message, checkedAt: new Date() } })
      .catch(() => ({ count: 0 }));
    if (!r.count || status === 'OK') return; // status bodlayni, ba thik hoye geche (health page nijei issue bondho kore)
    await reportIssue(this.prisma, shopId, status === 'INVALID' ? 'AI_KEY_INVALID' : 'AI_KEY_QUOTA', {
      severity: status === 'INVALID' ? 'ERROR' : 'WARN',
      message: status === 'INVALID' ? 'Google rejected your Gemini key, so the bot is paused.' : 'Your Gemini key reached its limit, so the bot is paused until it resets.',
      detail: message || undefined,
    });
  }
}

@Resolver()
export class ShopAiKeyResolver {
  constructor(private svc: ShopAiKeyService) {}

  @Query('shopAiKey')
  @UseGuards(ShopApprovedGuard)
  status(@CurrentUser() me: any) {
    return this.svc.status(me.id);
  }

  @Mutation('shopSaveAiKey')
  @UseGuards(ShopApprovedGuard)
  save(@CurrentUser() me: any, @Args('key') key: string) {
    return this.svc.save(me.id, key);
  }

  @Mutation('shopTestAiKey')
  @UseGuards(ShopApprovedGuard)
  test(@CurrentUser() me: any) {
    return this.svc.test(me.id);
  }

  @Mutation('shopRemoveAiKey')
  @UseGuards(ShopApprovedGuard)
  remove(@CurrentUser() me: any) {
    return this.svc.remove(me.id);
  }
}