# Secret Rotation Runbook

**When to run this**: before the first real customer touches the app, immediately
if a laptop with `.env` was lost, or on any suspicion the repo was cloned by an
untrusted party. Also: whenever a developer leaves the team.

`.env` is `.gitignore`d, so nothing has ever left the repo — but every secret
currently in that file has been visible to every laptop that ever cloned this
project. Treat those values as compromised the moment you're not certain the
audience is trusted.

## Plan

1. Generate the new value for each item below.
2. Set it in every environment (local `.env`, Vercel preview, Vercel production).
3. Restart / redeploy so the new value takes effect.
4. Revoke or rotate the OLD value at the source (Twilio console, Neon, etc.).
5. Verify the app still works end-to-end.

Do them in this order — the ones at the top are cheapest to break and highest
impact if leaked.

## 1. `JWT_SECRET`

- Generate a fresh 48-byte random string:
  ```bash
  openssl rand -base64 48
  ```
- Put the value in `.env`, then in Vercel → Settings → Environment Variables
  (Production **and** Preview). No secondary console — this key is ours only.
- Redeploy. Every currently-signed-in customer will need to sign in again.
  That's the point: this rotation logs out every stolen session.

## 2. Neon (`DATABASE_URL` + `DIRECT_URL`)

- Neon Console → your project → **Roles** → click `neondb_owner` → **Reset
  password**. Copy the new pooled URL from **Connection Details**; the direct
  URL swap-out is the same connection with `-pooler` removed.
- Update `.env` locally and both URLs in Vercel env vars.
- Redeploy.
- No manual "kill old sessions" step — the password reset does that.

## 3. Razorpay (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`)

- Razorpay Dashboard → **Settings → API Keys** → **Regenerate Test Key**
  (and later, when you go live, generate a Live pair the same way).
- Copy the new **Key Id** into `NEXT_PUBLIC_RAZORPAY_KEY_ID` (safe to expose)
  and the paired **Key Secret** into `RAZORPAY_KEY_SECRET` (never exposed).
- The old key is disabled immediately by regenerate — any in-flight checkout
  will fail the signature verify on next attempt. Preferably run this outside
  business hours.

## 4. Cloudinary (`CLOUDINARY_API_SECRET`)

- Cloudinary Console → **Settings → API Keys** → **Add new key** → copy the
  new secret into `CLOUDINARY_API_SECRET`. Keep the old key ACTIVE for ~24 h
  so any in-flight admin-upload requests finish, then **Disable** the old.
- `CLOUDINARY_CLOUD_NAME` (also exposed as `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`)
  and `CLOUDINARY_API_KEY` don't change unless you rotate to a new sub-account.
- **Also check**: `CLOUDINARY_API_KEY="dtyem72cg"` in the current `.env` looks
  suspiciously like the cloud name copied twice. Real Cloudinary API keys are
  15 digits. Verify.

## 5. Twilio (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`)

- Twilio Console → **Account → API Keys & Tokens → Auth Token** → **Change
  Auth Token**. This kills every request signed with the old token.
- `TWILIO_ACCOUNT_SID` doesn't rotate — it identifies your account.
- `TWILIO_FROM_NUMBER` doesn't rotate — it's your bought phone number.
- Test: send yourself an OTP after rotation via a test-allowlist phone.

## 6. Firebase (`NEXT_PUBLIC_FIREBASE_*`)

- Firebase Console → **Project settings → General**. The web-app config
  values here are `NEXT_PUBLIC_*` on purpose — they identify a public web
  app, not a secret. Rotation only matters if you rotate the whole project.
- Do lock down: **App Check** (require attestation), **Authentication →
  Authorized domains** (add prod + preview, remove localhost in prod).

## 7. Google Maps (`GOOGLE_MAPS_SERVER_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`)

- Google Cloud Console → **APIs & Services → Credentials** → click the key
  → **Regenerate key**.
- Set the same value in both env vars (or two separate keys — see the
  earlier discussion in this repo).
- Enable ONLY these APIs on the key: Maps JavaScript API, Maps Static API,
  Geocoding API. Cap the daily quota per API.

## 8. `DEV_OTP_MASTER_CODE`

- Change to any 6-digit value you like — this is only used by allowlisted
  test phones in production.
- With this branch's changes (`ALLOW_MASTER_OTP=1` gate), preview
  environments no longer accept the master code for arbitrary numbers,
  which was the real risk.

## Verification checklist

After rotation, run this end-to-end on production:

- [ ] Sign in with a real phone (not test allowlist) — real SMS arrives.
- [ ] Add to cart, checkout on COD — order lands in admin dashboard.
- [ ] Same again on Razorpay Test — payment succeeds, webhook fires.
- [ ] Admin login works.
- [ ] Upload a product image via `/admin/inventory` — Cloudinary URL comes back.
- [ ] Address form loads a Google map with a draggable pin.
- [ ] `curl -i https://<prod>/api/store-settings` — response has no error.

If any of the above fails, the rotation left an env var behind — check the
Vercel environment tab for the failing service.
