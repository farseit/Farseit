import { HttpException, HttpStatus } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';

/**
 * Rate limit counter DB-te thake ("RateLimit" table), tai server restart ba ekadhik instance-e-o ek hishab cholbe.
 * DB-te kaj na korle (down ba bind kora nai) in-memory counter-e fallback kore, jate limit kokhono bondho na hoy.
 */
let db: PrismaClient | null = null;
const mem = new Map<string, { count: number; reset: number }>();

/** PrismaService start hole ekbar call hoy. Sathe purono rate-limit ar webhook dedupe row-o muche dey (10 minute por por) */
export function bindRateLimitStore(prisma: PrismaClient) {
  db = prisma;
  const t = setInterval(async () => {
    try {
      await prisma.rateLimit.deleteMany({ where: { resetAt: { lt: new Date() } } });
      await prisma.webhookEvent.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 2 * 24 * 3600 * 1000) } } });
    } catch {
      /* next round-e abar chesta korbe */
    }
  }, 10 * 60 * 1000);
  t.unref();
}

function memHit(key: string, windowMs: number): number {
  const now = Date.now();
  const b = mem.get(key);
  if (!b || b.reset <= now) {
    mem.set(key, { count: 1, reset: now + windowMs });
    return 1;
  }
  b.count++;
  return b.count;
}

// fallback map-er purono entry muche felo
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of mem) if (b.reset <= now) mem.delete(k);
}, 10 * 60 * 1000).unref();

/** DB-te ek atomic query-te count barie ferot dey. Window sesh hole 1 theke abar shuru */
async function hit(key: string, windowMs: number): Promise<number> {
  if (db) {
    try {
      const secs = windowMs / 1000;
      const rows = await db.$queryRaw<{ count: number }[]>`
        INSERT INTO "RateLimit" ("key", "count", "resetAt")
        VALUES (${key}, 1, timezone('utc', now()) + make_interval(secs => ${secs}::float8))
        ON CONFLICT ("key") DO UPDATE SET
          "count" = CASE WHEN "RateLimit"."resetAt" <= timezone('utc', now()) THEN 1 ELSE "RateLimit"."count" + 1 END,
          "resetAt" = CASE WHEN "RateLimit"."resetAt" <= timezone('utc', now()) THEN timezone('utc', now()) + make_interval(secs => ${secs}::float8) ELSE "RateLimit"."resetAt" END
        RETURNING "count"`;
      return Number(rows[0]?.count ?? 1);
    } catch {
      /* DB-te problem: niche in-memory fallback */
    }
  }
  return memHit(key, windowMs);
}

/** `windowMs`-er moddhe `max` bar-er beshi hole 429 error dey. Ekhon async, tai call-er age `await` lagbe */
export async function rateLimit(key: string, max: number, windowMs: number, message = 'Too many requests. Please try again later.') {
  const count = await hit(key, windowMs);
  if (count > max) throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
}

/** Shudhu in-memory rate limit, DB-te kichu likhe na. Beshi-bar-hit hoy ar kom-guruttopurno jaygay (jemon visit tracking). Restart-e reset hoy, ekadhik instance-e alada gone */
export function rateLimitMem(key: string, max: number, windowMs: number, message = 'Too many requests. Please try again later.') {
  if (memHit(key, windowMs) > max) throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
}

export const clientIp = (ctx: any): string => ctx?.req?.ip || ctx?.req?.socket?.remoteAddress || 'unknown';