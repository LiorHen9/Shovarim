import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

// Fast path only: checks whether a session cookie is present, not whether
// it's valid. Full verification (adminAuth.verifySessionCookie) happens in
// app/(protected)/layout.tsx — see docs/ARCHITECTURE.md.
//
// Pages only — deliberately NOT /api/chat. Redirecting an API route to an
// HTML login page breaks its callers: fetch() follows the 307 transparently,
// gets 200 HTML back, and ChatPanel then fails parsing it as NDJSON and
// reports a connection error for what is really an expired session. The
// route handler returns a proper 401 JSON via requireUid() instead, which is
// also what node_modules/next/dist/docs .../proxy.md advises ("always verify
// authentication and authorization inside each Server Function rather than
// relying on Proxy alone").
const PROTECTED_PREFIXES = ["/dashboard", "/cards", "/reports", "/settings", "/chat"];

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
  ],
};
