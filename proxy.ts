import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifyJwtToken } from "@/lib/auth";

/**
 * Next.js 16 renamed `middleware` -> `proxy`.
 *
 * Route protection:
 *  - /orders  -> require a valid customer or admin JWT (redirect to /auth)
 *  - /admin (except /admin/login) -> require a valid ADMIN JWT (redirect to /admin/login)
 *  - /admin/login -> if already logged in as admin, bounce to /admin
 *
 * NOTE: /checkout is deliberately NOT protected here. The CheckoutPage renders
 * an inline "Sign in to place your order" banner + AuthModal for guests, which
 * keeps the cart context on-screen — matching Blinkit's modal-on-cart pattern.
 * Bouncing guests to /auth?redirect=/checkout used to lose the cart state and
 * break the funnel.
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isCustomerProtected = pathname.startsWith("/orders");
  const isAdminLogin = pathname === "/admin/login";
  const isAdminProtected = pathname.startsWith("/admin") && !isAdminLogin;

  if (!isCustomerProtected && !isAdminProtected && !isAdminLogin) {
    return NextResponse.next();
  }

  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const payload = await verifyJwtToken(token);

  // Already-authenticated admin visiting /admin/login -> straight to dashboard
  if (isAdminLogin && payload?.role === "admin") {
    const url = req.nextUrl.clone();
    url.pathname = "/admin";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isCustomerProtected) {
    if (!payload) {
      const url = req.nextUrl.clone();
      url.pathname = "/auth";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (isAdminProtected) {
    if (!payload || payload.role !== "admin") {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/orders/:path*", "/admin/:path*"],
};
