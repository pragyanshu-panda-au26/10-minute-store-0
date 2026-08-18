# Satyug 10-Minute Store

A production-grade quick-commerce app for a single-owner grocery store — customers order via a phone-first PWA, and the owner delivers every order themselves. No rider fleet, no dispatch complexity.

Built with Next.js 16 (App Router), Prisma 7, Neon Postgres, Zustand, Tailwind v4, and Razorpay.

## What's inside

- **Customer app** (`/`) — mobile-first storefront: category browse, search, product detail modal, cart drawer, checkout (Razorpay or COD), order tracking, order history, profile & address book, help.
- **Owner console** (`/admin`) — dashboard, Kanban order board (pending → confirmed → packed → out for delivery → delivered), inventory catalog, customers, coupons, banners, delivery zones. Password-protected.
- **Real database** — Prisma models for products, categories, orders, customers, addresses, coupons, banners, inventory transactions, OTP challenges, and admins. Money is stored as integer paise.
- **Auth** — HTTP-only JWT cookie sessions. Customers sign in with phone + SMS OTP (dev mode logs the OTP to the console). Admins sign in with email + bcrypt-hashed password.

## First-time setup

Prerequisite: Node 20+, npm.

```bash
# 1. Install dependencies
npm install

# 2. Create your .env from the template and fill in the values
cp .env.example .env
```

Open `.env` and set at minimum:

- `DATABASE_URL` and `DIRECT_URL` — get these from [Neon](https://console.neon.tech). Pooled string for the app, unpooled for migrations.
- `JWT_SECRET` — generate with `openssl rand -base64 48`.
- `ADMIN_SEED_EMAIL` and `ADMIN_SEED_PASSWORD` — used by the seed script to create the first admin.

Then:

```bash
# 3. Create the tables in your Neon database
npm run db:push          # first run — creates schema without a migration
# (or, if you want tracked migrations)
# npm run db:migrate

# 4. Seed initial catalog, coupons, banners, and the admin user
npm run db:seed

# 5. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the storefront and [http://localhost:3000/admin/login](http://localhost:3000/admin/login) for the owner console.

**Dev OTP:** in dev mode, `/api/send-otp` prints the OTP to the terminal and also returns it in the JSON response. You can also set `DEV_OTP_MASTER_CODE=123456` and use that as a universal test code — never active in production.

## Payments (Razorpay)

Get test API keys from [Razorpay Dashboard](https://dashboard.razorpay.com/app/keys):

- Set `RAZORPAY_KEY_ID` (server, `rzp_test_*`)
- Set `RAZORPAY_KEY_SECRET` (server, keep secret)
- Set `NEXT_PUBLIC_RAZORPAY_KEY_ID` (client, same as `RAZORPAY_KEY_ID`)

The checkout flow: client → POST `/api/orders` (creates DB order, decrements stock in a transaction) → POST `/api/checkout/razorpay/create-order` → Razorpay Checkout modal → POST `/api/checkout/razorpay/verify` (HMAC-SHA256 signature check, then marks order paid + confirmed).

## SMS OTP for production

Two options:

1. **Twilio** — set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`. The existing `/api/send-otp` route will use them automatically.
2. **Firebase Phone Auth** — swap the client-side flow in `components/customer/AuthModal.tsx` and `app/(customer)/auth/page.tsx` to use `firebase/auth` and post the resulting Firebase ID token to a new server route that verifies it via the Firebase Admin SDK, then issues our JWT cookie.

Either way, the DB-backed `OtpChallenge` table + `/api/verify-otp` endpoint handle rate-limiting, expiration, and session issuance.

## Deploying to Vercel

1. Push this repo to GitHub.
2. In Vercel, import the repo and set **all** env vars from your `.env` — especially `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`.
3. Vercel will run `npm run build`, which includes `prisma generate`.
4. After the first deploy, run migrations against the Neon prod branch:
   ```bash
   DATABASE_URL="<prod pooled>" DIRECT_URL="<prod direct>" npx prisma migrate deploy
   DATABASE_URL="<prod pooled>" DIRECT_URL="<prod direct>" npm run db:seed
   ```

**Important:** Every serverless function opens its own Prisma+Neon connection via the HTTP driver. Use the **pooled** Neon connection string (has `-pooler` in the hostname) for `DATABASE_URL` to avoid exhausting connections.

## Available scripts

```
npm run dev         # Next.js dev server on 0.0.0.0:3000
npm run build       # prisma generate && next build
npm run start       # production server
npm run lint

npm run db:push     # push schema without a migration (first-time)
npm run db:migrate  # create + apply a dev migration
npm run db:deploy   # apply pending migrations (CI / prod)
npm run db:seed     # seed catalog + admin user
npm run db:studio   # Prisma Studio GUI
npm run db:reset    # wipe + reseed (dev only!)
```

## Project layout

```
app/
  (customer)/       # public storefront + protected /orders + /checkout
  (admin)/admin/    # owner console (JWT-protected via proxy.ts)
  api/              # server routes — all Prisma-backed
components/
  customer/         # storefront widgets
  admin/            # console widgets
lib/
  prisma.ts         # Prisma client singleton (Neon adapter)
  auth.ts           # HMAC-SHA256 JWT (Web Crypto — works Node & Edge)
  api.ts            # Route helpers: handler, requireAuth, parseJson, ok/fail
  money.ts          # rupees ↔ paise (never floats!)
  serializers.ts    # Prisma rows → JSON shape for the client
prisma/
  schema.prisma     # Neon Postgres data model
  seed.ts           # `npm run db:seed`
store/              # Zustand: cart, orders, products, user session
proxy.ts            # Next 16 middleware — protects /admin + /checkout + /orders
```

## Order lifecycle

```
pending ──► confirmed ──► packed ──► out_for_delivery ──► delivered
                                                       └► cancelled  (any → cancelled restores stock)
```

Only the owner can move an order forward, via the Kanban board or Order Details modal.

## Known follow-ups

- **Full mobile polish sweep:** most screens are mobile-first but need a pass at 375px for sticky-header overlap edges and safe-area insets on iOS.
- **Coupon / Banner admin panels:** currently display-only against the API. Full CRUD UI is next.
- **Delivery zone editor:** the `DeliveryZone` model is in place but the admin UI still uses hardcoded zones.
- **Push notifications:** consider Web Push or Firebase Cloud Messaging for real-time order updates.
