import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { fail, handler, ok, parseJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/send-otp
 * Body: { phone: string }
 *
 * Generates a 6-digit OTP, stores a bcrypt hash in `OtpChallenge` (5-min TTL),
 * then dispatches via SMS if credentials are set — otherwise logs to the
 * server console (dev mode). In dev, `DEV_OTP_MASTER_CODE` is also accepted
 * on the verify side, so you never actually need to receive an SMS.
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

async function trySendSms(phone: string, otp: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const auth = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !auth || !from) {
    console.log(`[DEV OTP] ${phone} → ${otp}`);
    return true;
  }

  try {
    const basicAuth = btoa(`${sid}:${auth}`);
    const params = new URLSearchParams({
      To: phone,
      From: from,
      Body: `Your Satyug verification code is ${otp}. Valid for 5 minutes.`,
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
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.warn("[Twilio] send failed:", res.status, data);
      // In dev we still succeed; the code is in the logs.
      return process.env.NODE_ENV !== "production";
    }
    return true;
  } catch (err) {
    console.warn("[Twilio] error:", err);
    return process.env.NODE_ENV !== "production";
  }
}

export const POST = handler(async (req: NextRequest) => {
  const body = await parseJson(req, bodySchema);
  if (body instanceof NextResponse) return body;

  const phone = normalizePhone(body.phone);
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const codeHash = await bcrypt.hash(otp, 8);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  // Invalidate any older challenges for this phone
  await prisma.otpChallenge.deleteMany({ where: { phone } });
  await prisma.otpChallenge.create({ data: { phone, codeHash, expiresAt } });

  const sent = await trySendSms(phone, otp);
  if (!sent) return fail("Failed to dispatch OTP. Try again.", 502);

  return ok({
    message: `OTP sent to ${phone}.`,
    // Only include the OTP in dev — never in production.
    devOtp: process.env.NODE_ENV !== "production" ? otp : undefined,
  });
});
