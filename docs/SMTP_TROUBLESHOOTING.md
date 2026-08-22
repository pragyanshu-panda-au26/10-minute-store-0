# SMTP Troubleshooting — GoDaddy Workspace

The app sends transactional email via `lib/email.ts` using SMTP env vars
(`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, …).

## Current state — 2026-08-21

Wired up against **`connect@satyuglifestyle.com`** on `smtpout.secureserver.net:465`.
An initial `verify()` handshake returns:

```
Invalid login: 535 Authentication Failed for connect@satyuglifestyle.com
```

That's a mailbox-side issue, not a code issue. The most likely causes below,
ranked by how often we see each. Please work through them in order.

## 1. Is the mailbox actually GoDaddy Workspace, or Microsoft 365 via GoDaddy?

Log in at https://sso.godaddy.com/ → **My Products**. If the mailbox appears
under **"Microsoft 365"** (or "Email & Office → Microsoft 365"), it is NOT a
Workspace mailbox — Workspace was end-of-lifed for new signups. Microsoft 365
mailboxes reject `smtpout.secureserver.net`. Use instead:

```
SMTP_HOST     = smtp.office365.com
SMTP_PORT     = 587
SMTP_SECURE   = false      # STARTTLS
SMTP_USER     = connect@satyuglifestyle.com
SMTP_PASS     = <APP PASSWORD, not the login password>   # see §3
```

## 2. Is SMTP Auth turned on for this mailbox?

For **Workspace Email**:
- GoDaddy → **Email & Office → Manage** → the mailbox → **Advanced settings**
- Make sure **SMTP (Outgoing)** is enabled and note the exact host it quotes
  (some regions use `smtp.secureserver.net` instead of `smtpout.…`).

For **Microsoft 365**:
- Microsoft 365 admin → **Users → Active Users → the mailbox → Mail →
  Manage email apps** → tick **Authenticated SMTP**.
- Microsoft has been disabling SMTP AUTH by default since 2022; it must be
  explicitly re-enabled per mailbox.

## 3. If two-step verification is on, you need an app password

Regular passwords are refused when 2FA is enabled — this is the single most
common cause of a `535` on a mailbox you know the password to.

- **Workspace Email**: no separate app password concept; disable 2FA on the
  webmail account, or use the specific "Outbound Mail" password if configured.
- **Microsoft 365**: <https://mysignins.microsoft.com/security-info> → **Add
  method → App password**. Generate one for "Satyug SMTP", paste the
  16-character result into `SMTP_PASS`, restart the dev server.

## 4. Fresh mailbox — wait, then retry

Newly-provisioned Workspace mailboxes can take **up to 60 minutes** to
propagate SMTP AUTH permissions across GoDaddy's edge nodes. If the mailbox
was created today, try again in an hour.

## 5. Verify from your machine

```bash
node -e "import('nodemailer').then(async({default:n})=>{const t=n.createTransport({host:process.env.SMTP_HOST,port:+process.env.SMTP_PORT,secure:process.env.SMTP_SECURE==='true',name:process.env.SMTP_EHLO_NAME,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}});try{await t.verify();console.log('OK')}catch(e){console.error('FAIL',e.message)}})"
```

- `OK` → credentials are good; the app should now send.
- `535 Authentication Failed` → the password / SMTP-Auth setting is the issue.
- `Invalid HELO / EHLO requires valid address` → `SMTP_EHLO_NAME` is missing or
  set to a non-DNS string. Set it to the mailbox domain.

## When it works — verify end-to-end

1. Restart `npm run dev` so the new env vars take effect.
2. Sign in as a customer whose profile has a real email address in the DB.
3. Place a COD order for ₹1.
4. Watch the server log for `[email] sent to=<addr> messageId=…`.
5. Confirm inbox delivery (Gmail may take up to 30s the first time).

## Fallback while auth is blocked

The app keeps working with SMTP down — every `sendEmail` call catches its
own error and only writes to `console.warn`. Orders still get placed; the
customer just doesn't receive a confirmation email until the mailbox is
authenticating properly.
