# Farse AI (FarseIT) — Messenger sales chatbot SaaS

Duto project:

- `api/` — NestJS + GraphQL + Prisma/PostgreSQL backend (register/login, shop dashboard API, Facebook webhook, AI bot, billing, super admin)
- `web/` — Next.js 14 frontend: FarseIT company landing page (`/`) + user login/register (`/shop/start`) + shop dashboard (`/shop/*`) + super admin (`/admin/saas`) + product order pages (`/p/<code>`)

## Local run

```bash
# 1) backend
cd api
cp .env.example .env        # DATABASE_URL, JWT_SECRET, TOKEN_ENC_KEY ... bhoro
npm install
npx prisma generate
npx prisma migrate deploy   # table toiri
npm run seed                # super admin user toiri (ADMIN_PHONE / ADMIN_PASSWORD)
npm run start:dev           # http://localhost:4000/graphql

# 2) frontend
cd ../web
cp .env.example .env.local
npm install
npm run dev                 # http://localhost:3000
```

## Pages

| URL | Kaj |
|---|---|
| `/` | FarseIT company landing page + Farse AI section + pricing |
| `/shop/start` | Register / Login (`?mode=login` dile login tab) |
| `/shop` ... `/shop/inbox, orders, products, bot, connect, ai, billing, health` | User-er chatbot dashboard |
| `/admin/saas` | Super admin: shop approve, payment approve, plan, suspend (shudhu role ADMIN) |
| `/p/<code>` | Product-er public order page (dashboard theke link) |

## Kibhabe kaj kore

1. User `/shop/start` e register kore (shop + account toiri, 7 din trial, **approved = false**).
2. Super admin `/admin/saas` e giye shop **approve** kore. Approve na howa porjonto user dashboard-e dhukte pare na (pending screen dekhay).
3. User dashboard-e **Facebook Page** connect kore, nijer **Gemini AI key** dey (SHOP_REQUIRE_OWN_KEY=true hole), product add kore, bot **on** kore.
4. Customer Messenger-e message dile bot reply dey, order ney, dashboard-e order ashe.
5. Trial/plan sesh hole user bKash/Nagad payment submit kore, super admin approve korle plan active hoy.

## Facebook (Meta) setup

1. developers.facebook.com e app toiri, **Messenger** product add koro.
2. Webhooks callback URL: `https://<api-domain>/webhook`, Verify token = `.env` er `FB_VERIFY_TOKEN`. Subscribe: `messages`, `messaging_postbacks`, `message_echoes`.
3. `FB_APP_ID`, `FB_APP_SECRET` backend `.env` e; `NEXT_PUBLIC_FB_APP_ID` frontend e.
4. Permissions (live korte App Review lage): `pages_show_list`, `pages_messaging`, `pages_manage_metadata`, `pages_read_engagement`, `business_management`.

## Deploy

Duto folder-e-i `Dockerfile` ache. Backend-e `DATABASE_URL` ar baki `.env` variable dao; start-e `prisma migrate deploy` auto chole.
Frontend build-e `NEXT_PUBLIC_API_URL` (backend URL) dite hobe. Backend `CORS_ORIGIN` e frontend URL dao.
