import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { fail, handler, ok, parseJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { setAuthCookie, signJwtToken } from "@/lib/auth";
import { isMasterOtpAccepted, isTestPhone } from "@/lib/testOtp";
import { enforceRateLimit } from "@/lib/rateLimit";

/**
 * POST /api/verify-otp
 * Body: { phone, otp, name? }
 *
 * On success: creates/finds a Customer, issues an HTTP-only JWT cookie,
 * returns the customer profile.
 */

const bodySchema = z.object({
  phone: z.string().min(6).max(20),
  otp: z.string().length(6),
  name: z.string().min(1).max(80).optional(),
});

function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (input.trim().startsWith("+")) return "+" + digits;
  if (digits.length === 10) return "+91" + digits;
  return "+" + digits;
}

const MAX_ATTEMPTS = 5;

export const POST = handler(async (req: NextRequest) => {
  const body = await parseJson(req, bodySchema);
  if (body instanceof NextResponse) return body;

  const phone = normalizePhone(body.phone);
  const otp = body.otp.trim();

  // Attempts on verify are cheaper than send, but we still need to stop
  // the online-brute-force of a 6-digit code. The per-challenge counter
  // in Prisma caps attempts at 5, but that's per challenge — an attacker
  // just requests fresh challenges. Rate-limit here too.
  const denied =
    enforceRateLimit(req, { bucket: "verify-otp:phone", perMinute: 5, perHour: 20, keyExtra: phone }) ||
    enforceRateLimit(req, { bucket: "verify-otp:ip", perMinute: 20, perHour: 120 });
  if (denied) return denied;

  // Master OTP bypass — dev mode OR test-phone allowlist. See lib/testOtp.ts.
  const bypass = isMasterOtpAccepted(phone, otp);
  if (bypass) {
    console.log(
      `[verify-otp] master OTP accepted for ${phone} (${
        process.env.NODE_ENV !== "production" ? "dev" : "test-phone allowlist"
      })`
    );
  }

  if (!bypass) {
    const challenge = await prisma.otpChallenge.findFirst({
      where: { phone },
      orderBy: { createdAt: "desc" },
    });

    if (!challenge) return fail("No OTP requested. Request a new code.", 400);

    if (challenge.expiresAt < new Date()) {
      await prisma.otpChallenge.delete({ where: { id: challenge.id } });
      return fail("OTP expired. Request a new code.", 400);
    }

    if (challenge.attempts >= MAX_ATTEMPTS) {
      await prisma.otpChallenge.delete({ where: { id: challenge.id } });
      return fail("Too many attempts. Request a new code.", 429);
    }

    const isValid = await bcrypt.compare(otp, challenge.codeHash);
    if (!isValid) {
      await prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      return fail("Invalid OTP.", 400);
    }

    // Consume the challenge
    await prisma.otpChallenge.deleteMany({ where: { phone } });
  }

  // Find or create customer
  const customer = await prisma.customer.upsert({
    where: { phone },
    update: body.name ? { name: body.name } : {},
    create: { phone, name: body.name ?? null },
  });

  if (customer.isBlocked) return fail("Account is blocked.", 403);

  const token = await signJwtToken({
    userId: customer.id,
    phone: customer.phone,
    name: customer.name ?? "Customer",
    role: "customer",
    // Baked into the JWT so requireAuth can reject stale tokens after a
    // block, password change, or logout-everywhere. See lib/api.ts.
    tokenVersion: customer.tokenVersion,
  });

  const response = ok({
    message: "Verified.",
    // Bearer token for mobile clients (Android / iOS / React Native). Web
    // clients ignore this and rely on the HTTP-only cookie below.
    token,
    tokenType: "Bearer" as const,
    expiresIn: 7 * 24 * 60 * 60, // seconds
    user: {
      id: customer.id,
      phone: customer.phone,
      name: customer.name,
      email: customer.email,
      role: "customer" as const,
    },
  });
  setAuthCookie(response, token);
  return response;
});

// CORS preflight for mobile clients
export { handleOptions as OPTIONS } from "@/lib/api";
