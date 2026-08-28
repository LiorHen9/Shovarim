import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

// Fast path only: checks whether a session cookie is present, not whether
// it's valid. Full verification (adminAuth.verifySessionCookie) happens in
// app/(protected)/layout.tsx — see docs/ARCHITECTURE.md.
const PROTECTED_PREFIXES = ["/dashboard", "/cards", "/reports", "/settings", "/chat", "/api/chat"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isProtected && !request.cookies.has(SESSION_COOKIE_NAME)) {
    const loginUrl = new URL("/", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/cards/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/chat/:path*",
    "/api/chat/:path*",
  ],
};
