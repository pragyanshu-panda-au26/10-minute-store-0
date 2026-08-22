import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { fail, handler, ok, parseJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { isTestPhone } from "@/lib/testOtp";
import { enforceRateLimit } from "@/lib/rateLimit";

/**
 * POST /api/send-otp
 * Body: { phone: string }
 *
 * Generates a 6-digit OTP, stores a bcrypt hash in `OtpChallenge` (5-min TTL),
 * then dispatches via SMS if credentials are set.
 *
 * Twilio failures — surfaced in the response as `{ smsError, twilioCode }`
 * and logged loudly server-side, so a broken SMS setup is obvious instead of
 * silently swallowed. In dev, the OTP is also returned as `devOtp` so you
 * can test without receiving an SMS at all.
 */

const bodySchema = z.object({
  phone: z.string().min(6).max(20),
});

// E.164 normalize: assume Indian numbers unless a + prefix is given.
function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (input.trim().startsWith("+")) return "+" + digits;
  if (digits.length === 10) return "+91" + digits;
  return "+" + digits;
}

type SmsResult =
  | { ok: true; provider: "hanuotp" | "twilio" }
  | { ok: false; provider: "hanuotp" | "twilio"; status: number; code?: number; message: string; moreInfo?: string };

/**
 * HanuOTP — the primary Indian SMS provider (India-native DLT-approved
 * template gateway, reliable to Indian carriers where Twilio international
 * routes get intermittently blocked). Called with a 10-digit local number
 * (the API rejects E.164 with the leading +91), the OTP, and an API key.
 *
 *   GET https://api.hanuotp.in/sms-otp.php
 *       ?number=<10-digit>
 *       &OTP=<6-digit>
 *       &apikey=<key>
 *       &templatesid=<templateId>
 */
async function trySendHanuOtp(phone: string, otp: string): Promise<SmsResult | "no_provider"> {
  const apiKey = process.env.HANUOTP_API_KEY;
  if (!apiKey) return "no_provider";
  const template = process.env.HANUOTP_TEMPLATE_ID || "default";

  // Provider expects the local 10-digit number, not E.164. Normalize back.
  const localDigits = phone.replace(/\D/g, "").slice(-10);
  if (localDigits.length !== 10) {
    return {
      ok: false,
      provider: "hanuotp",
      status: 400,
      message: `HanuOTP requires a 10-digit Indian phone; got "${phone}"`,
    };
  }

  const url = new URL("https://api.hanuotp.in/sms-otp.php");
  url.searchParams.set("number", localDigits);
  url.searchParams.set("OTP", otp);
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("templatesid", template);

  try {
    const res = await fetch(url.toString(), { method: "GET" });
    // Provider responds JSON. Their exact success key isn't documented in the
    // snippet we were given ("console.log(JSON.parse(data))"), so we treat
    // HTTP 2xx + any of the common truthy markers as success.
    const text = await res.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch { /* body may be plain text */ }

    const providerOk =
      res.ok &&
      // Accept any of these common shapes without being brittle about the key
      (data?.status === "success" ||
        data?.status === true ||
        data?.success === true ||
        /success|sent|ok/i.test(String(data?.message ?? text)));

    if (providerOk) {
      console.log(`[HanuOTP] queued to=${localDigits} response=${text.slice(0, 120)}`);
      return { ok: true, provider: "hanuotp" };
    }

    console.error(
      `[HanuOTP] send FAILED  status=${res.status}  body=${text.slice(0, 200)}`
    );
    return {
      ok: false,
      provider: "hanuotp",
      status: res.status,
      message: data?.message || text.slice(0, 200) || "HanuOTP request failed",
    };
  } catch (err: any) {
    console.error("[HanuOTP] network error:", err);
    return {
      ok: false,
      provider: "hanuotp",
      status: 0,
      message: err?.message ?? "HanuOTP network error",
    };
  }
}

/**
 * Twilio — fallback provider. Only used if HanuOTP isn't configured OR
 * if HanuOTP returned a hard failure (network error, 5xx). Kept so the
 * existing Twilio setup keeps working for anyone on the older config.
 */
async function trySendTwilio(phone: string, otp: string): Promise<SmsResult | "no_provider"> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const auth = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !auth || !from) return "no_provider";

  try {
    const basicAuth = btoa(`${sid}:${auth}`);
    const params = new URLSearchParams({
      To: phone,
      From: from,
      Body: `Your 10minute verification code is ${otp}. Valid for 5 minutes.`,
    });
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );
    const data: any = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error(
        `[Twilio] send FAILED  status=${res.status}  code=${data?.code}  message="${data?.message}"  moreInfo=${data?.more_info}`
      );
      return {
        ok: false,
        provider: "twilio",
        status: res.status,
        code: data?.code,
        message: data?.message || "Twilio request failed",
        moreInfo: data?.more_info,
      };
    }
    console.log(`[Twilio] queued sid=${data?.sid} to=${phone}`);
    return { ok: true, provider: "twilio" };
  } catch (err: any) {
    console.error("[Twilio] network error:", err);
    return {
      ok: false,
      provider: "twilio",
      status: 0,
      message: err?.message ?? "Twilio network error",
    };
  }
}

/**
 * Provider chain: HanuOTP first (India-native, DLT-compliant). If HanuOTP
 * isn't configured we fall through to Twilio. If HanuOTP is configured but
 * the send fails, we still try Twilio when it's available so a single
 * provider hiccup doesn't lock the customer out. Returns "no_provider"
 * only when neither is configured.
 */
async function trySendSms(phone: string, otp: string): Promise<SmsResult | "no_provider"> {
  const hanu = await trySendHanuOtp(phone, otp);
  if (hanu !== "no_provider") {
    if (hanu.ok) return hanu;
    // Hard failure — try Twilio if it's configured; otherwise return the
    // HanuOTP error so the client sees a real reason.
    const twilio = await trySendTwilio(phone, otp);
    if (twilio === "no_provider") return hanu;
    return twilio;
  }
  const twilio = await trySendTwilio(phone, otp);
  if (twilio === "no_provider") {
    console.log(`[DEV OTP] ${phone} → ${otp}  (no SMS provider configured)`);
    return "no_provider";
  }
  return twilio;
}

export const POST = handler(async (req: NextRequest) => {
  const body = await parseJson(req, bodySchema);
  if (body instanceof NextResponse) return body;

  const phone = normalizePhone(body.phone);

  // Twilio SMS costs real money; a bare send-otp endpoint is the classic
  // burn-your-bill target. Two windows: per phone (blocks resend spam
  // from the intended user) and per IP (blocks the fan-out attack that
  // rotates the To number).
  const denied =
    enforceRateLimit(req, { bucket: "send-otp:phone", perMinute: 2, perHour: 6, perDay: 20, keyExtra: phone }) ||
    enforceRateLimit(req, { bucket: "send-otp:ip", perMinute: 10, perHour: 60, perDay: 200 });
  if (denied) return denied;

  // Test-phone shortcut — skip Twilio entirely, return the master code so
  // the client can autofill. Works in prod too, only for allowlisted phones.
  if (isTestPhone(phone)) {
    const master = process.env.DEV_OTP_MASTER_CODE || "123456";
    console.log(`[send-otp] test-phone allowlist hit for ${phone} — master code is ${master}`);
    // We STILL write a matching challenge so `/api/verify-otp` succeeds even
    // if DEV_OTP_MASTER_CODE isn't set (belt-and-suspenders).
    const codeHash = await bcrypt.hash(master, 8);
    await prisma.otpChallenge.deleteMany({ where: { phone } });
    // Align the challenge TTL with the copy sent to the user. The old value
    // was 60 minutes while the SMS copy elsewhere said "Valid for 5 minutes",
    // confusing QA and support. Test-phone challenges now share the same
    // 5-minute TTL as normal OTPs.
    await prisma.otpChallenge.create({
      data: { phone, codeHash, expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
    });
    return ok({
      message: `Test phone recognized — use OTP ${master}. Valid for 5 minutes.`,
      smsSent: false,
      testMode: true,
      devOtp: master, // always returned for test phones, regardless of NODE_ENV
    });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const codeHash = await bcrypt.hash(otp, 8);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  // Invalidate any older challenges for this phone (a fresh request wins)
  await prisma.otpChallenge.deleteMany({ where: { phone } });
  await prisma.otpChallenge.create({ data: { phone, codeHash, expiresAt } });

  const smsResult = await trySendSms(phone, otp);

  // "Return the OTP in the response" is a local-dev convenience. Previously
  // gated only on `NODE_ENV !== "production"`, which also fires on every
  // preview/staging deploy and inline-leaks the code to real users. Tighten
  // to true local development: NODE_ENV === "development" AND the request
  // came from localhost. In every other environment, callers get the OTP
  // via SMS only.
  const host = req.headers.get("host") || "";
  const isLocalhost = /^(localhost|127\.0\.0\.1|\[::1\])(:|$)/i.test(host);
  const isDev = process.env.NODE_ENV === "development" && isLocalhost;

  // No Twilio configured — the challenge is stored, the OTP is in the server
  // logs, and (in dev) we return it in the response so the client can autofill.
  if (smsResult === "no_provider") {
    return ok({
      message: `OTP generated for ${phone}. (SMS provider not configured — check server logs.)`,
      smsSent: false,
      devOtp: isDev ? otp : undefined,
    });
  }

  // Twilio failed — return the exact error so the client can show it and you
  // can debug. In prod we still succeed if there's another OTP delivery path
  // planned, but for now we bubble the failure up as a 502 with details.
  if (!smsResult.ok) {
    // Explain the most common failure modes inline
    const hint = twilioHint(smsResult.code, smsResult.message);
    return NextResponse.json(
      {
        success: false,
        message: `SMS send failed: ${smsResult.message}${hint ? ` — ${hint}` : ""}`,
        smsError: {
          status: smsResult.status,
          code: smsResult.code,
          message: smsResult.message,
          moreInfo: smsResult.moreInfo,
          hint,
        },
        // Even on failure, dev clients can still complete the flow
        devOtp: isDev ? otp : undefined,
      },
      { status: 502 }
    );
  }

  return ok({
    message: `OTP sent to ${phone}.`,
    smsSent: true,
    devOtp: isDev ? otp : undefined,
  });
});

/**
 * Turn a Twilio error code into a one-line fix hint. Covers the ~5 issues
 * that account for 95 % of India-based SMS-not-working reports.
 * Full list: https://www.twilio.com/docs/api/errors
 */
function twilioHint(code: number | undefined, message: string): string | null {
  const m = message.toLowerCase();
  if (code === 21211) return "The `To` phone number isn't valid E.164 format (e.g. +919876543210).";
  if (code === 21608 || m.includes("unverified"))
    return "Twilio TRIAL accounts can only send to numbers you've verified. Verify the number at console.twilio.com → Phone Numbers → Verified Caller IDs, OR upgrade the account.";
  if (code === 21610) return "This recipient replied STOP to your sender number. They must reply START to opt back in.";
  if (code === 21606 || code === 21659)
    return "The `From` number isn't SMS-capable or isn't owned by your account. Buy an SMS-enabled number in Twilio Console and set TWILIO_FROM_NUMBER to it in E.164 (+18001234567).";
  if (code === 20003) return "Auth failed — TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN is wrong.";
  if (code === 30007 || code === 30008 || m.includes("blocked") || m.includes("carrier"))
    return "The Indian carrier blocked the message. For production SMS in India you MUST register a DLT template/sender ID with a local partner (Kaleyra, MSG91, Gupshup) — Twilio international routes to India are unreliable. See https://www.twilio.com/docs/messaging/guides/india";
  if (code === 21612)
    return "The `From` number can't reach that destination country. Enable geo-permissions for India in Twilio Console → Messaging → Settings → Geo Permissions.";
  return null;
}
