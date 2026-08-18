# Deploying to Vercel

Step-by-step guide to get this app live on Vercel with your Neon Postgres database, Razorpay payments, and phone-OTP auth.

Expect ~15 minutes end to end.

---

## Before you start

You need accounts on:
- **Vercel** — https://vercel.com (free hobby tier is enough)
- **Neon** — https://console.neon.tech (free tier is enough; use the region closest to your customers)
- **Razorpay** — https://dashboard.razorpay.com (test keys are free; live keys require KYC + a bank account)
- **GitHub / GitLab / Bitbucket** — to push this repo so Vercel can build from it

And installed locally:
- Node 20+
- Git

---

## 1. Push the code to git

```bash
git init                                    # if not already a repo
git add .
git commit -m "Ready to deploy"
git branch -M main
git remote add origin git@github.com:<you>/modest-borg.git
git push -u origin main
```

Make sure `.env` is NOT committed — the `.gitignore` in this repo already excludes it, but double-check with `git status` before pushing.

---

## 2. Create the production database on Neon

1. Go to https://console.neon.tech and create a new project.
2. **Choose a region close to your customers.** This repo defaults Vercel to `sin1` (Singapore) via `vercel.json` — pair it with a Neon region in the same continent (e.g. `ap-southeast-1` for Singapore/India users). Every 5000 km of distance adds ~50 ms to every DB query.
3. On the Neon dashboard, copy TWO connection strings:
   - **Pooled** (has `-pooler` in the hostname) → use for `DATABASE_URL`
   - **Direct/unpooled** (no `-pooler`) → use for `DIRECT_URL`, only used by Prisma Migrate

Both should include `?sslmode=require`.

### Apply the schema to your new DB (from your laptop, once)

```bash
# From the project root, with the prod strings in your local .env:
npx prisma db push          # creates all tables from prisma/schema.prisma
npm run db:seed             # loads categories, products, banners, coupons, admin user
```

The seed reads `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` from your `.env` and creates the admin login. **Change these to something strong before running seed on prod** — they become the credentials for `/admin/login`.

---

## 3. Import the repo into Vercel

1. https://vercel.com/new → pick your git provider → select the `modest-borg` repo.
2. Vercel auto-detects Next.js. Leave "Framework Preset" as **Next.js** and don't override build/install commands (`vercel.json` sets them).
3. **Don't deploy yet.** Click **Environment Variables** first.

---

## 4. Set environment variables in Vercel

Add every value from `.env.example`. Copy from your local `.env`, but generate a fresh `JWT_SECRET` for prod (never reuse dev secrets).

### Required — the app will not boot without these

| Key | Value | Where to get it |
|---|---|---|
| `DATABASE_URL` | `postgresql://...-pooler...?sslmode=require` | Neon dashboard, "Pooled connection" |
| `DIRECT_URL` | `postgresql://...?sslmode=require` | Neon dashboard, "Direct connection" |
| `JWT_SECRET` | 48+ random chars | `openssl rand -base64 48` |
| `ADMIN_SEED_EMAIL` | e.g. `owner@yourstore.com` | You pick |
| `ADMIN_SEED_PASSWORD` | strong password | You pick — this logs in at `/admin/login` |

### For real payments (leave blank if you're not taking payments yet)

| Key | Value |
|---|---|
| `RAZORPAY_KEY_ID` | From Razorpay dashboard → Settings → API Keys |
| `RAZORPAY_KEY_SECRET` | Same page |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Same value as `RAZORPAY_KEY_ID` |

### For SMS OTP delivery (leave blank to log OTPs to the Vercel function logs — fine for a soft launch)

| Key | Value |
|---|---|
| `TWILIO_ACCOUNT_SID` | Twilio console |
| `TWILIO_AUTH_TOKEN` | Twilio console |
| `TWILIO_FROM_NUMBER` | Your Twilio number |

### Geofence tuning (optional — defaults to Paradip, 3 km radius)

| Key | Default |
|---|---|
| `STORE_ID` | `STORE_PARADIP_MAIN` |
| `STORE_NAME` | `Satyug 10-Minute Store · Paradip` |
| `STORE_LAT` | `20.287694` |
| `STORE_LNG` | `86.609111` |
| `DELIVERY_RADIUS_KM` | `3` (decimals OK, e.g. `2.5`) |
| `DELIVERY_ETA_MINUTES` | `10` |

### CORS for the future Android app

| Key | Value |
|---|---|
| `ALLOWED_ORIGINS` | Comma-list, e.g. `https://app.satyug.com,capacitor://localhost` — leave blank if only browsers hit the API |

### Never commit or paste anywhere

`JWT_SECRET`, `DATABASE_URL`, `RAZORPAY_KEY_SECRET`, `CLOUDINARY_API_SECRET`, `TWILIO_AUTH_TOKEN` — Vercel's env UI is the only place they should live.

For each variable, tick **Production**, **Preview**, and **Development** unless you want per-environment values.

---

## 5. Deploy

Click **Deploy**. Vercel will:
1. `npm install` (which runs `prisma generate` via `postinstall`)
2. `prisma generate && next build` (from `vercel.json`)
3. Publish to `https://<your-project>.vercel.app`

Watch the build logs. If it succeeds, hit the URL — you should land on the customer storefront, which will immediately prompt for location permission (that's the serviceability gate).

---

## 6. First-run checks

Open a fresh incognito tab at `https://<your-project>.vercel.app` and confirm:

- [ ] Location prompt appears
- [ ] If you're within `DELIVERY_RADIUS_KM` of `STORE_LAT/LNG`, catalog loads. If not, you see "Out of delivery zone" and can enter coordinates manually.
- [ ] Category filter works, product grid renders
- [ ] Add a product to cart → cart pill shows at the bottom
- [ ] Tap cart pill → drawer opens → tap "Proceed to Checkout"
- [ ] `/auth` — request OTP → dev OTP shows in Vercel function logs (if Twilio isn't set) → verify → JWT cookie set → back to storefront
- [ ] Place COD order → order appears in `/orders`
- [ ] Log in at `/admin/login` with your seed credentials → dashboard renders → the order shows in the Kanban board → advance status through `confirmed → packed → out_for_delivery → delivered`

If any step fails, check **Vercel → Deployments → your latest deployment → Runtime Logs**.

---

## 7. Custom domain

1. Vercel → Project → Settings → Domains → add `satyug.com` (or your domain).
2. Update your DNS registrar with the CNAME/A record Vercel shows.
3. Cert is auto-issued in ~1 minute.
4. Add both `satyug.com` and `www.satyug.com` to `ALLOWED_ORIGINS` if you have any cross-origin caller.
5. Update `NEXT_PUBLIC_APP_URL` env var to your custom domain and redeploy.

---

## 8. Razorpay live-mode switch

You start on test mode (`rzp_test_*`). When ready for real payments:

1. Complete Razorpay KYC + link a settlement bank account.
2. Get your live key pair (`rzp_live_*`).
3. In Vercel env, replace `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID` with the live values.
4. Redeploy (Vercel → Deployments → three-dot menu → Redeploy).
5. Do one small end-to-end test order with a real card / UPI to confirm.

---

## Common gotchas

**"Can't reach database server"**
Wrong `DATABASE_URL`. Make sure you used the **pooled** string (has `-pooler` in the hostname). Regular Neon direct strings max out at ~100 concurrent connections; the pooled string supports thousands.

**"Serverless function timed out (10s)"**
Vercel Hobby has a 10s default; `vercel.json` raises Razorpay routes to 30s and everything else to 15s. If you need longer, upgrade to Pro or move the slow work to a background job.

**"Location permission not asked"**
The site MUST be served over HTTPS for `navigator.geolocation` to work. Vercel gives you HTTPS for free — just don't visit via `http://` explicitly.

**"Admin login fails with correct password"**
The password from `ADMIN_SEED_PASSWORD` is bcrypt-hashed and stored in DB during `npm run db:seed`. Changing the env var after seeding does NOT change the DB row. Re-seed: `npm run db:seed` (safe to re-run; upserts).

**Cold-start latency**
First hit after ~5 min of idle takes ~1–2 s (Vercel cold start + Prisma engine boot). Warm invocations are ~50–100 ms. The pooled Neon HTTP connection means no cold connect-pool overhead.

**Changes to `STORES_JSON` via `/api/admin/geofence` don't persist**
That endpoint mutates `process.env` on ONE Lambda instance only. For durable geofence changes on Vercel, edit the env var in the Vercel dashboard and redeploy. (Or move the store config to Prisma — a small follow-up task.)

**Dark Stores admin edits don't persist across cold starts**
`/admin/dark-stores` currently uses the file-DB fallback (`lib/db.ts`), which is in-memory-only on Vercel. When you promote this feature, migrate its state to a Prisma `Store` model.

**Bundle got large / build slow**
If you keep adding admin panels, check that `import`s are tree-shakeable — don't `import * as Icons from "lucide-react"`, import the specific icons.

---

## Rolling back a bad deploy

Vercel → Deployments → find the last known-good deploy → three-dot → **Promote to Production**. Takes ~5 seconds. Env changes are versioned with the deployment.

---

## Monitoring, at ₹0

- **Vercel Analytics** — free, click "Enable" in Analytics tab. Gives you page views + Core Web Vitals.
- **Vercel Log Drains** — if you want structured logs in Datadog / Better Stack later.
- **Neon Console** — shows DB query stats, slow queries, storage.
- **Razorpay Dashboard** — every transaction, refund, and dispute.

Nothing costs money until you outgrow the free tiers.
