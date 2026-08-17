import { randomUUID, createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decryptAiKey, encryptAiKey, maskAiKey } from "@/lib/ai-key-crypto";
import { backoffMs, canonicalWebhookBody, isAllowedWebhookEvent, isSafeWebhookUrl, normalizeWebhookEvents, signWebhook } from "@/lib/webhook-v10";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(data: unknown, status = 200) { return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } }); }

async function deliver(target: { id: string; url: string; secretEncrypted: string; retryCount: number }, event: string, payload: unknown) {
  if (!isAllowedWebhookEvent(event) || !isSafeWebhookUrl(target.url)) throw new Error("webhook event أو URL غير مسموح");
  const secret = await decryptAiKey(target.secretEncrypted);
  const eventId = randomUUID();
  let lastError = "فشل الإرسال";
  for (let attempt = 0; attempt <= Math.min(8, Math.max(0, target.retryCount)); attempt += 1) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, backoffMs(attempt)));
    const timestamp = Math.floor(Date.now() / 1000);
    const body = canonicalWebhookBody(event, payload, timestamp, eventId);
    try {
      const response = await fetch(target.url, { method: "POST", headers: { "Content-Type": "application/json", "X-Bisalasa-Event": event, "X-Bisalasa-Event-Id": eventId, "X-Bisalasa-Timestamp": String(timestamp), "X-Bisalasa-Signature": signWebhook(secret, body) }, body, signal: AbortSignal.timeout(15_000), cache: "no-store" });
      if (response.ok) {
        await db.externalWebhookTarget.update({ where: { id: target.id }, data: { lastStatus: String(response.status), lastError: null, lastDeliveredAt: new Date() } }).catch(() => undefined);
        return { ok: true, status: response.status, eventId, attempts: attempt + 1 };
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) { lastError = error instanceof Error ? error.message.slice(0, 200) : "network"; }
  }
  await db.externalWebhookTarget.update({ where: { id: target.id }, data: { lastStatus: "failed", lastError } }).catch(() => undefined);
  return { ok: false, error: lastError, eventId };
}

export async function GET() {
  const targets = await db.externalWebhookTarget.findMany({ orderBy: { updatedAt: "desc" }, select: { id: true, label: true, url: true, eventsJson: true, enabled: true, retryCount: true, lastStatus: true, lastError: true, lastDeliveredAt: true, createdAt: true, updatedAt: true } });
  return json({ ok: true, data: targets });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "deliver";
    if (action === "save") {
      const label = typeof body.label === "string" ? body.label.trim().slice(0, 120) : "";
      const url = typeof body.url === "string" ? body.url.trim().slice(0, 500) : "";
      const secret = typeof body.secret === "string" ? body.secret.trim() : "";
      if (!label || !isSafeWebhookUrl(url) || secret.length < 16 || secret.length > 500) return json({ ok: false, error: "label/URL آمن/secret صالح مطلوبون" }, 400);
      const eventsJson = JSON.stringify(normalizeWebhookEvents(body.events));
      const data = { label, url, secretEncrypted: await encryptAiKey(secret), eventsJson, enabled: body.enabled !== false, retryCount: Number.isInteger(body.retryCount) ? Math.min(8, Math.max(0, Number(body.retryCount))) : 3 };
      const target = typeof body.id === "string" && body.id ? await db.externalWebhookTarget.update({ where: { id: body.id }, data }) : await db.externalWebhookTarget.create({ data });
      return json({ ok: true, data: { id: target.id, label: target.label, url: target.url, eventsJson: target.eventsJson, enabled: target.enabled, keyHint: maskAiKey(secret) } });
    }
    if (action === "delete") {
      if (typeof body.id !== "string" || !body.id) return json({ ok: false, error: "id مطلوب" }, 400);
      await db.externalWebhookTarget.delete({ where: { id: body.id } });
      return json({ ok: true, data: { deleted: true } });
    }
    if (action === "deliver") {
      const targetId = typeof body.targetId === "string" ? body.targetId : "";
      const event = typeof body.event === "string" ? body.event : "";
      const payload = body.payload && typeof body.payload === "object" ? body.payload : {};
      if (!targetId || !isAllowedWebhookEvent(event)) return json({ ok: false, error: "targetId/event غير صالح" }, 400);
      const target = await db.externalWebhookTarget.findUnique({ where: { id: targetId } });
      if (!target || !target.enabled) return json({ ok: false, error: "webhook غير موجود أو متوقف" }, 404);
      return json(await deliver(target, event, payload));
    }
    return json({ ok: false, error: "action غير معروفة" }, 400);
  } catch (error) { return json({ ok: false, error: error instanceof Error ? error.message.slice(0, 200) : "webhook failed" }, 500); }
}

export async function DELETE(request: NextRequest) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return json({ ok: false, error: "id مطلوب" }, 400);
  await db.externalWebhookTarget.delete({ where: { id } });
  return json({ ok: true, data: { deleted: true } });
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const expected = process.env.BISALASA_REST_API_KEY;
  const provided = request.headers.get("x-bisalasa-api-key") || "";
  if (!expected || createHash("sha256").update(provided).digest("hex") !== createHash("sha256").update(expected).digest("hex")) return json({ ok: false, error: "REST API key غير صالحة" }, 401);
  if (body.resource !== "health") return json({ ok: false, error: "REST API read-only: resource غير مسموح" }, 403);
  return json({ ok: true, data: { service: "bisalasa", mode: "teacher-local", pullOnly: true, generatedAt: new Date().toISOString() } });
}
