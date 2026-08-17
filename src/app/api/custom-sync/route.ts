import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decryptCustomAppToken, encryptCustomAppToken } from "@/lib/custom-app-crypto";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const NO_STORE_HEADERS = { "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate", Pragma: "no-cache", Expires: "0" };

type CustomAppSettings = {
  enabled: boolean;
  baseUrl: string;
  endpointPath: string;
  method: "GET" | "POST";
  itemsPath: string;
  idField: string;
  statusField: string;
  updatedAtField: string;
  labelField: string;
  authHeader: string;
  authScheme: "Bearer" | "Raw";
  tokenEncrypted?: string;
  lastSyncAt?: string | null;
  lastSyncStatus?: "ok" | "error" | "stale" | null;
  lastSyncError?: string | null;
};

function json(data: unknown, status = 200) { return NextResponse.json(data, { status, headers: NO_STORE_HEADERS }); }
function cleanUrl(value: unknown) {
  const raw = typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";
  if (!raw || raw.length > 800 || !/^https?:\/\//i.test(raw)) throw new Error("رابط Custom App يجب أن يبدأ بـ http أو https");
  const url = new URL(raw);
  if (url.username || url.password || url.hash) throw new Error("رابط Custom App غير صالح");
  return url.toString().replace(/\/$/, "");
}
function cleanPath(value: unknown, fallback: string) { const path = typeof value === "string" && value.trim() ? value.trim() : fallback; return path.startsWith("/") ? path : `/${path}`; }
function cleanField(value: unknown, fallback: string) { const field = typeof value === "string" && value.trim() ? value.trim() : fallback; if (!/^[A-Za-z0-9_.-]{1,120}$/.test(field)) throw new Error("اسم حقل Custom App غير صالح"); return field; }
async function readSettings() { const row = await db.appSettings.findUnique({ where: { id: "singleton" } }); if (!row?.settingsJson) return {}; try { const value = JSON.parse(row.settingsJson); return value && typeof value === "object" ? value as Record<string, unknown> : {}; } catch { return {}; } }
function readCustom(raw: unknown): CustomAppSettings {
  if (!raw || typeof raw !== "object") return { enabled: false, baseUrl: "", endpointPath: "/api/live-status", method: "GET", itemsPath: "statuses", idField: "studentCode", statusField: "status", updatedAtField: "updatedAt", labelField: "label", authHeader: "Authorization", authScheme: "Bearer" };
  const value = raw as Record<string, unknown>;
  return { enabled: value.enabled === true, baseUrl: typeof value.baseUrl === "string" ? value.baseUrl : "", endpointPath: typeof value.endpointPath === "string" ? value.endpointPath : "/api/live-status", method: value.method === "POST" ? "POST" : "GET", itemsPath: typeof value.itemsPath === "string" ? value.itemsPath : "statuses", idField: typeof value.idField === "string" ? value.idField : "studentCode", statusField: typeof value.statusField === "string" ? value.statusField : "status", updatedAtField: typeof value.updatedAtField === "string" ? value.updatedAtField : "updatedAt", labelField: typeof value.labelField === "string" ? value.labelField : "label", authHeader: typeof value.authHeader === "string" ? value.authHeader : "Authorization", authScheme: value.authScheme === "Raw" ? "Raw" : "Bearer", tokenEncrypted: typeof value.tokenEncrypted === "string" ? value.tokenEncrypted : undefined, lastSyncAt: typeof value.lastSyncAt === "string" ? value.lastSyncAt : null, lastSyncStatus: value.lastSyncStatus === "ok" || value.lastSyncStatus === "error" || value.lastSyncStatus === "stale" ? value.lastSyncStatus : null, lastSyncError: typeof value.lastSyncError === "string" ? value.lastSyncError : null };
}
async function getCustom() { const settings = await readSettings(); return readCustom(settings.customApp); }
function safeConfig(value: CustomAppSettings) { return { enabled: value.enabled, baseUrl: value.baseUrl, endpointPath: value.endpointPath, method: value.method, itemsPath: value.itemsPath, idField: value.idField, statusField: value.statusField, updatedAtField: value.updatedAtField, labelField: value.labelField, authHeader: value.authHeader, authScheme: value.authScheme, hasToken: Boolean(value.tokenEncrypted), lastSyncAt: value.lastSyncAt ?? null, lastSyncStatus: value.lastSyncStatus ?? null, lastSyncError: value.lastSyncError ?? null }; }
async function saveCustom(next: CustomAppSettings) { const settings = await readSettings(); settings.customApp = next; await db.appSettings.upsert({ where: { id: "singleton" }, create: { id: "singleton", settingsJson: JSON.stringify(settings) }, update: { settingsJson: JSON.stringify(settings) } }); }
function readPath(value: unknown, pathValue: string): unknown { if (!pathValue || pathValue === ".") return value; return pathValue.split(".").filter(Boolean).reduce<unknown>((current, part) => current && typeof current === "object" ? (current as Record<string, unknown>)[part] : undefined, value); }
function normalizeStatus(value: unknown): "correct" | "wrong" | "waiting" | "unknown" { const v = String(value ?? "").toLowerCase(); if (["correct", "right", "true", "green", "success", "صحيح"].includes(v)) return "correct"; if (["wrong", "false", "red", "error", "incorrect", "خطأ"].includes(v)) return "wrong"; if (["waiting", "pending", "yellow", "active", "نشط"].includes(v)) return "waiting"; return "unknown"; }
async function customRequest(config: CustomAppSettings) {
  if (!config.baseUrl || !config.tokenEncrypted) throw new Error("أكمل إعداد رابط Custom App وToken أولاً");
  const token = await decryptCustomAppToken(config.tokenEncrypted);
  const url = new URL(`${config.baseUrl}${cleanPath(config.endpointPath, "/api/live-status")}`);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (config.authHeader) headers[config.authHeader] = config.authScheme === "Bearer" ? `Bearer ${token}` : token;
  const response = await fetch(url, { method: config.method, headers, ...(config.method === "POST" ? { body: JSON.stringify({ since: config.lastSyncAt ?? null }) } : {}), cache: "no-store", signal: AbortSignal.timeout(15_000) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Custom App HTTP ${response.status}`);
  return payload;
}

export async function GET() { try { return json({ ok: true, data: safeConfig(await getCustom()) }); } catch (error) { return json({ ok: false, error: error instanceof Error ? error.message : "تعذر قراءة Custom App" }, 500); } }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = typeof body?.action === "string" ? body.action : "config.get";
    if (action === "config.get") return json({ ok: true, data: safeConfig(await getCustom()) });
    if (action === "config.save") {
      const previous = await getCustom();
      const next: CustomAppSettings = { ...previous, enabled: body.enabled === true, baseUrl: body.baseUrl ? cleanUrl(body.baseUrl) : previous.baseUrl, endpointPath: cleanPath(body.endpointPath, previous.endpointPath), method: body.method === "POST" ? "POST" : "GET", itemsPath: cleanField(body.itemsPath, previous.itemsPath), idField: cleanField(body.idField, previous.idField), statusField: cleanField(body.statusField, previous.statusField), updatedAtField: cleanField(body.updatedAtField, previous.updatedAtField), labelField: cleanField(body.labelField, previous.labelField), authHeader: typeof body.authHeader === "string" ? body.authHeader.trim().slice(0, 80) : previous.authHeader, authScheme: body.authScheme === "Raw" ? "Raw" : "Bearer", tokenEncrypted: typeof body.token === "string" && body.token.trim() ? await encryptCustomAppToken(body.token.trim()) : previous.tokenEncrypted, lastSyncError: null };
      await saveCustom(next); return json({ ok: true, data: safeConfig(next) });
    }
    if (action === "config.reset") { const settings = await readSettings(); delete settings.customApp; await db.appSettings.upsert({ where: { id: "singleton" }, create: { id: "singleton", settingsJson: JSON.stringify(settings) }, update: { settingsJson: JSON.stringify(settings) } }); return json({ ok: true, data: safeConfig(readCustom(null)) }); }
    if (action === "config.clearToken") { const current = await getCustom(); const next = { ...current, enabled: false, tokenEncrypted: undefined }; await saveCustom(next); return json({ ok: true, data: safeConfig(next) }); }
    if (action === "test" || action === "pull") {
      const current = await getCustom(); const raw = await customRequest(current); const list = readPath(raw, current.itemsPath); const items = Array.isArray(list) ? list : [];
      const statuses = items.map((item) => { const object = item && typeof item === "object" ? item as Record<string, unknown> : {}; return { externalId: String(readPath(object, current.idField) ?? ""), status: normalizeStatus(readPath(object, current.statusField)), updatedAt: String(readPath(object, current.updatedAtField) ?? new Date().toISOString()), label: String(readPath(object, current.labelField) ?? "") }; }).filter((item) => item.externalId);
      if (action === "test") return json({ ok: true, data: { connected: true, count: statuses.length } });
      const next = { ...current, lastSyncAt: new Date().toISOString(), lastSyncStatus: "ok" as const, lastSyncError: null }; await saveCustom(next); return json({ ok: true, data: { statuses, sampledAt: next.lastSyncAt, semantics: "external_app_status" } });
    }
    return json({ ok: false, error: "إجراء Custom App غير معروف" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر الاتصال بـCustom App";
    try { const current = await getCustom(); await saveCustom({ ...current, lastSyncAt: new Date().toISOString(), lastSyncStatus: "error", lastSyncError: message.slice(0, 240) }); } catch {}
    return json({ ok: false, error: message }, 502);
  }
}
