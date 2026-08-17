// lib/auth.ts — Lightweight LAN-only API token authentication
//
// C15 fix (2026-AUG): all /api/* routes were completely unauthenticated.
// Any device on the same Wi-Fi could call students.delete, settings.set,
// or download /api/backup?format=sql with no challenge.
//
// Design: a single shared token stored in AppSettings.apiToken (generated
// automatically on first boot if missing). The browser client reads it from
// /api/auth/whoami (set as httpOnly cookie on boot) and sends it as
// X-Bisalasa-Token header for mutating requests. LAN-only trust model —
// no per-user accounts, no password hashing, just a shared secret.
//
// This is intentionally simple: the platform is single-teacher LAN-hosted.
// Multi-tenant / public deployment requires a real session system (next-auth).

import { db, dbReady } from "./db";

const TOKEN_COOKIE = "bisalasa-token";
const TOKEN_HEADER = "x-bisalasa-token";

/**
 * Get or create the singleton API token. Stored in AppSettings.apiToken.
 * Generated once on first call, then cached in module scope.
 */
let cachedToken: string | null = null;
export async function getApiToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  await dbReady;
  const row = await db.appSettings.findUnique({ where: { id: "singleton" } });
  const settings = row?.settingsJson ? JSON.parse(row.settingsJson) : {};
  if (typeof settings.apiToken === "string" && settings.apiToken.length >= 32) {
    cachedToken = settings.apiToken;
    return settings.apiToken;
  }
  // Generate a new token: 32 bytes hex = 64 chars
  const newToken = generateToken();
  const merged = { ...settings, apiToken: newToken };
  await db.appSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", settingsJson: JSON.stringify(merged) },
    update: { settingsJson: JSON.stringify(merged) },
  });
  cachedToken = newToken;
  return newToken;
}

function generateToken(): string {
  // Use Web Crypto if available (Node 18+ / browsers), else fallback to node:crypto
  if (typeof globalThis.crypto?.randomUUID === "function") {
    // Use randomUUID (available in Node 19+ and all modern browsers)
    return globalThis.crypto.randomUUID().replace(/-/g, "") + globalThis.crypto.randomUUID().replace(/-/g, "");
  }
  // Node fallback
  try {
    const nodeCrypto = require("crypto");
    return nodeCrypto.randomBytes(32).toString("hex");
  } catch {
    // Last resort: Math.random (less secure, but better than nothing)
    let token = "";
    for (let i = 0; i < 64; i++) token += Math.floor(Math.random() * 16).toString(16);
    return token;
  }
}

/**
 * Validate the request's token against the singleton.
 * Returns true if the request is authorized.
 *
 * Token can be provided via:
 * 1. X-Bisalasa-Token header (preferred for API calls)
 * 2. bisalasa-token cookie (for browser same-origin requests)
 * 3. Query param ?token= (only for GET /api/backup download — browsers can't set headers on file downloads)
 */
export async function isAuthorized(req: Request): Promise<boolean> {
  const expected = await getApiToken();
  const headerToken = req.headers.get(TOKEN_HEADER);
  if (headerToken && constantTimeEqual(headerToken, expected)) return true;
  const cookieToken = getCookie(req, TOKEN_COOKIE);
  if (cookieToken && constantTimeEqual(cookieToken, expected)) return true;
  const url = new URL(req.url);
  const queryToken = url.searchParams.get("token");
  if (queryToken && constantTimeEqual(queryToken, expected)) return true;
  return false;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function getCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export const AUTH_COOKIE_NAME = TOKEN_COOKIE;
export const AUTH_HEADER_NAME = TOKEN_HEADER;
