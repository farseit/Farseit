# Farse AI — API

NestJS 10 · GraphQL (schema-first) · Prisma 5 · PostgreSQL

- `src/auth` — register, login, password reset (SMS), JWT
- `src/shop` — SaaS core: shop register, Facebook Page connect, bot (`shop-bot.service`), AI (`shop-ai.service`), inbox, products, orders, billing/plans (`shop-plans.ts`), super admin, health checks, product landing
- `src/shop/shop-webhook.ts` — Facebook webhook (`GET/POST /webhook`)
- `src/upload` — image upload (Cloudinary ba local disk)
- `src/push` — browser push subscription

Plan/dam bodlate: `src/shop/shop-plans.ts` (`PLANS`).
Env list: `.env.example`. Health check: `GET /health`.
