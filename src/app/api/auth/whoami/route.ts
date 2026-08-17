// app/api/auth/whoami/route.ts — Get the current API token and set it as a cookie
//
// C15 fix (2026-AUG): the browser needs the API token to make authenticated
// requests. This route:
// 1. Returns the singleton token (or generates one on first call)
// 2. Sets it as an httpOnly cookie so all same-origin requests are auto-authorized
//
// This is safe because:
// - The platform is LAN-only single-teacher (no multi-tenant)
// - The cookie is httpOnly (JS cannot read it → no XSS theft)
// - SameSite=Strict (no CSRF via cross-site requests)
// - The token is also required for /api/backup download via ?token= query param

import { NextResponse } from "next/server";
import { getApiToken, AUTH_COOKIE_NAME } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const token = await getApiToken();
    const res = NextResponse.json({
      ok: true,
      authenticated: true,
      tokenPreview: token.slice(0, 8) + "..." + token.slice(-4),
    });
    // Set httpOnly + SameSite=Strict cookie. Secure=false because LAN is HTTP.
    res.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production" && process.env.HTTPS === "1",
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });
    return res;
  } catch (error) {
    console.error("[auth/whoami] failed:", error);
    return NextResponse.json(
      { ok: false, error: "تعذر إصدار رمز المصادقة" },
      { status: 500 }
    );
  }
}
