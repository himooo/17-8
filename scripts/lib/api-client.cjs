#!/usr/bin/env node
// Shared authenticated fetch for API smoke scripts.
// The API token middleware (C15) requires a token on protected routes; the
// token is issued as an httpOnly cookie by /api/auth/whoami. This helper
// boots one cookie per origin (scripts may talk to several servers) and
// attaches it to every subsequent call.
const cookieByOrigin = new Map();

async function authFetch(url, options = {}) {
  const origin = new URL(url).origin;
  if (!cookieByOrigin.has(origin)) {
    let tokenCookie = null;
    try {
      const res = await fetch(`${origin}/api/auth/whoami`);
      const setCookie = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
      tokenCookie = setCookie.map((c) => c.split(";")[0]).find((c) => c.startsWith("bisalasa-token=")) ?? null;
    } catch {
      tokenCookie = null;
    }
    cookieByOrigin.set(origin, tokenCookie);
  }
  const headers = { ...(options.headers || {}) };
  const cookie = cookieByOrigin.get(origin);
  if (cookie) headers.cookie = cookie;
  return fetch(url, { ...options, headers });
}

module.exports = { authFetch };
