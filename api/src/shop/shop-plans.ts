import { PrismaService } from '../prisma/prisma.module';

export type PlanId = 'TRIAL' | 'STARTER' | 'PRO' | 'BUSINESS';

/** Dam/limit ekhane thik koro. price = ekmaser taka. replies = mase koyta AI reply */
export const PLANS: Record<PlanId, { name: string; price: number; replies: number; pages: number; products: number }> = {
  TRIAL: { name: 'Trial', price: 0, replies: 150, pages: 1, products: 30 },
  STARTER: { name: 'Starter', price: 499, replies: 1000, pages: 1, products: 150 },
  PRO: { name: 'Pro', price: 1499, replies: 5000, pages: 3, products: 1000 },
  BUSINESS: { name: 'Business', price: 3999, replies: 20000, pages: 10, products: 10000 },
};
export const PAID_PLANS: PlanId[] = ['STARTER', 'PRO', 'BUSINESS'];
export const GRACE_DAYS = 3; // paid plan-er meyad shesh hole ei kodin bot cholbe

/** Dhaka (UTC+6) onujayi mas, jemon "2026-10" */
export const monthKey = (d = new Date()) => new Date(d.getTime() + 6 * 3600 * 1000).toISOString().slice(0, 7);

type AccessInput = {
  status: string;
  approved?: boolean;
  plan: string;
  trialEndsAt: Date | string | null;
  planEndsAt: Date | string | null;
  usagePeriod: string | null;
  usageReplies: number;
};

/** Bot ei shop-er jonno uttor dite parbe ki na, ar plan-er obostha */
export function shopAccess(s: AccessInput) {
  const known = s.plan in PLANS;
  const p = PLANS[(known ? s.plan : 'TRIAL') as PlanId];
  const isTrial = !known || s.plan === 'TRIAL';
  const endRaw = isTrial ? s.trialEndsAt : s.planEndsAt;
  const endMs = endRaw ? new Date(endRaw).getTime() : isTrial ? Infinity : 0;
  const graceMs = isTrial ? 0 : GRACE_DAYS * 86400000;
  const used = s.usagePeriod === monthKey() ? s.usageReplies : 0;

  let reason: null | 'PENDING' | 'SUSPENDED' | 'EXPIRED' | 'LIMIT' = null;
  if (s.approved === false) reason = 'PENDING';
  else if (s.status === 'SUSPENDED') reason = 'SUSPENDED';
  else if (Date.now() > endMs + graceMs) reason = 'EXPIRED';
  else if (used >= p.replies) reason = 'LIMIT';

  return {
    ok: !reason,
    reason,
    plan: known ? s.plan : 'TRIAL',
    planName: p.name,
    limit: p.replies,
    used,
    pagesLimit: p.pages,
    expiresAt: Number.isFinite(endMs) ? new Date(endMs).toISOString() : null,
    daysLeft: Number.isFinite(endMs) ? Math.ceil((endMs - Date.now()) / 86400000) : null,
  };
}

/** Ekta AI reply gone: mase-r counter 1 barai (mas bodlale 1 theke shuru) */
export async function consumeReply(prisma: PrismaService, shopId: string) {
  const period = monthKey();
  const r = await prisma.shop.updateMany({ where: { id: shopId, usagePeriod: period }, data: { usageReplies: { increment: 1 } } });
  if (!r.count) await prisma.shop.update({ where: { id: shopId }, data: { usagePeriod: period, usageReplies: 1 } });
}

/** Plan-er limit (AI reply / page / product). Ochena plan hole Trial-er limit */
export function limitsFor(plan: string) {
  const p = PLANS[(plan in PLANS ? plan : 'TRIAL') as PlanId];
  return { aiReplies: p.replies, pages: p.pages, products: p.products };
}