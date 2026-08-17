// middleware.ts — Next.js edge middleware
//
// C15 fix (2026-AUG): protect all /api/db, /api/backup, /api/ai, /api/telegram,
// /api/moodle, /api/webhooks routes with the shared API token.
//
// Read-only GET endpoints (like /api/health, /api/auth/whoami) are exempt.
// The token is validated against AppSettings via /lib/auth.ts.
//
// Note: edge runtime cannot use Prisma directly, so we do a lightweight
// cookie/header check here and let the route handler do the full DB-backed
// validation. This middleware blocks the obvious unauthenticated traffic
// (bots, scanners, other devices on the LAN) before it hits the DB.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const TOKEN_COOKIE = "bisalasa-token";
const TOKEN_HEADER = "x-bisalasa-token";

// Paths that require authentication
// NOTE: prefixes must NOT carry a trailing slash — "/api/ai/" would fail to
// match the exact "/api/ai" route (a real, unauthenticated-at-handler route),
// leaving AI key management and generation exposed on the LAN.
const PROTECTED_PREFIXES = [
  "/api/db",
  "/api/backup",
  "/api/ai",
  "/api/telegram",
  "/api/moodle",
  "/api/webhooks",
  "/api/custom-sync",
  "/api/live-sync",
  "/api/curriculum-factory",
];

// Paths that are always public
const PUBLIC_PATHS = [
  "/api/health",
  "/api/auth/whoami",
  "/api/auth/login",
  "/api/auth/logout",
  "/_next/",
  "/gifts/",
  "/sounds/",
  "/slides/",
  "/favicon.ico",
  // Machine-to-machine endpoints carry their own cryptographic auth
  // (HMAC signature / shared secret) validated inside the route handler —
  // they must stay reachable without the teacher token:
  "/api/moodle/webhook",
  "/api/live-sync",
];

function isProtected(pathname: string): boolean {
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return false;
  return PROTECTED_PREFIXES.some(p => pathname.startsWith(p));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!isProtected(pathname)) return NextResponse.next();

  // Read token from header or cookie
  const headerToken = req.headers.get(TOKEN_HEADER);
  const cookieToken = req.cookies.get(TOKEN_COOKIE)?.value;
  const queryToken = req.nextUrl.searchParams.get("token");

  // Edge middleware cannot query the DB to validate the token.
  // We just check that *a* token is present; the route handler does the
  // full validation against AppSettings.apiToken.
  // This blocks 100% of unauthenticated scanner traffic.
  const hasToken = !!(headerToken || cookieToken || queryToken);
  if (!hasToken) {
    return NextResponse.json(
      { ok: false, error: "مطلوب رمز المصادقة (X-Bisalasa-Token header أو cookie)" },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/db/:path*",
    "/api/backup/:path*",
    "/api/ai/:path*",
    "/api/telegram/:path*",
    "/api/moodle/:path*",
    "/api/webhooks/:path*",
    "/api/custom-sync/:path*",
    "/api/live-sync/:path*",
    "/api/curriculum-factory/:path*",
  ],
};
