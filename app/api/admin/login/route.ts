import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { fail, handler, ok, parseJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { setAuthCookie, signJwtToken } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rateLimit";

const bodySchema = z.object({
  email: z.string().email().max(120),
  password: z.string().min(6).max(200),
});

export const POST = handler(async (req: NextRequest) => {
  const body = await parseJson(req, bodySchema);
  if (body instanceof NextResponse) return body;

  // Two-dimensional rate limit on admin login — per email (blocks targeting
  // a specific admin) AND per IP (blocks a spray across many emails from one
  // attacker). The bcrypt cost is enough to make offline attacks expensive;
  // this closes the online path.
  const email = body.email.toLowerCase().trim();
  const denied =
    enforceRateLimit(req, { bucket: "admin-login:email", perMinute: 5, perHour: 20, keyExtra: email }) ||
    enforceRateLimit(req, { bucket: "admin-login:ip", perMinute: 10, perHour: 60 });
  if (denied) return denied;

  const admin = await prisma.admin.findUnique({
    where: { email: body.email.toLowerCase().trim() },
  });

  // Constant-time-ish response: always compare, even if user missing.
  const passwordOk = admin
    ? await bcrypt.compare(body.password, admin.passwordHash)
    : await bcrypt.compare(body.password, "$2a$12$" + "x".repeat(53));

  if (!admin || !passwordOk) return fail("Invalid credentials", 401);

  const token = await signJwtToken({
    userId: admin.id,
    email: admin.email,
    name: admin.name,
    role: "admin",
    tokenVersion: admin.tokenVersion,
  });

  const response = ok({
    message: "Logged in.",
    // Bearer token for mobile / non-browser clients.
    token,
    tokenType: "Bearer" as const,
    expiresIn: 7 * 24 * 60 * 60,
    user: { id: admin.id, email: admin.email, name: admin.name, role: "admin" as const },
  });
  setAuthCookie(response, token);
  return response;
});

// CORS preflight for mobile clients
export { handleOptions as OPTIONS } from "@/lib/api";
