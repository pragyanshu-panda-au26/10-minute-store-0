import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { fail, handler, ok, parseJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { setAuthCookie, signJwtToken } from "@/lib/auth";

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

  // Dev-mode master OTP bypass (never active in production)
  const master = process.env.DEV_OTP_MASTER_CODE;
  const isMasterMatch =
    process.env.NODE_ENV !== "production" && master && otp === master;

  if (!isMasterMatch) {
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
