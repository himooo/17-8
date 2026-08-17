import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decryptMoodleToken } from "@/lib/moodle-crypto";
import { processMoodleSyncEvent } from "@/lib/moodle-v10";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_BODY = 64 * 1024;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const HEADERS = { "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate", Pragma: "no-cache" };

function json(data: unknown, status = 200) { return NextResponse.json(data, { status, headers: HEADERS }); }
async function readMoodleSettings() {
  const row = await db.appSettings.findUnique({ where: { id: "singleton" } });
  if (!row?.settingsJson) return null;
  try {
    const settings = JSON.parse(row.settingsJson) as Record<string, unknown>;
    const moodle = settings.moodle as Record<string, unknown> | undefined;
    if (!moodle || moodle.webhookEnabled !== true || typeof moodle.webhookSecretEncrypted !== "string") return null;
    return { courseId: typeof moodle.courseId === "number" ? moodle.courseId : null, secret: await decryptMoodleToken(moodle.webhookSecretEncrypted) };
  } catch { return null; }
}
function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
function verifySignature(raw: string, secret: string, request: NextRequest) {
  const timestamp = request.headers.get("x-bisalasa-timestamp") || "";
  const signature = request.headers.get("x-bisalasa-signature") || "";
  if (!timestamp || !signature) return false;
  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > MAX_CLOCK_SKEW_MS) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex")}`;
  return safeEqual(signature, expected);
}
function asInt(value: unknown) { const n = Number(value); return Number.isInteger(n) && n > 0 ? n : null; }

export async function POST(request: NextRequest) {
  try {
    const raw = await request.text();
    if (raw.length === 0 || raw.length > MAX_BODY) return json({ ok: false, error: "Webhook body غير صالح أو أكبر من الحد المسموح" }, 413);
    const config = await readMoodleSettings();
    if (!config) return json({ ok: false, error: "Webhook Moodle غير مفعّل" }, 404);
    if (!verifySignature(raw, config.secret, request)) return json({ ok: false, error: "توقيع webhook غير صالح أو منتهي" }, 401);
    const body = JSON.parse(raw) as Record<string, unknown>;
    const courseId = asInt(body.courseId ?? body.courseid) ?? config.courseId;
    if (!courseId || (config.courseId && courseId !== config.courseId)) return json({ ok: false, error: "Course ID غير مسموح" }, 403);
    const eventType = typeof body.eventType === "string" ? body.eventType.slice(0, 80) : "answer";
    const eventHash = createHash("sha256").update(raw).digest("hex");
    const existing = await db.moodleSyncEvent.findUnique({ where: { eventHash }, select: { id: true } });
    if (existing) return json({ ok: true, data: { accepted: true, duplicate: true, eventHash } });
    const event = await db.moodleSyncEvent.create({ data: { courseId, sessionId: typeof body.sessionId === "string" ? body.sessionId.slice(0, 160) : null, eventHash, eventType, source: "webhook", status: "accepted", moodleUserId: asInt(body.moodleUserId ?? body.userid), questionId: asInt(body.questionId ?? body.questionid), ideaId: typeof body.ideaId === "string" ? body.ideaId.slice(0, 160) : null, studentAnswer: typeof body.studentAnswer === "string" ? body.studentAnswer.slice(0, 4000) : null, isCorrect: typeof body.isCorrect === "boolean" ? body.isCorrect : null, answeredAt: typeof body.answeredAt === "string" ? new Date(body.answeredAt) : null, processedAt: null, metadataJson: JSON.stringify({ receivedFrom: "signed-webhook", keys: Object.keys(body).slice(0, 40) }) } });
    try {
      const processed = await processMoodleSyncEvent(event.id);
      if (!processed.ok) return json({ ok: false, error: "Event validation failed", details: processed.validation.errors, data: { accepted: false, pendingValidation: true, eventId: event.id, eventHash } }, 400);
      return json({ ok: true, data: { accepted: true, duplicate: false, processed: true, eventId: event.id, eventHash } }, 202);
    } catch (processingError) {
      await db.moodleSyncRetry.upsert({ where: { eventId: event.id }, create: { eventId: event.id, status: "pending", retryCount: 0, nextRetryAt: new Date(), lastError: processingError instanceof Error ? processingError.message.slice(0, 500) : "Moodle event processing failed" }, update: { status: "pending", nextRetryAt: new Date(), lastError: processingError instanceof Error ? processingError.message.slice(0, 500) : "Moodle event processing failed" } });
      return json({ ok: true, data: { accepted: true, queued: true, eventId: event.id, eventHash } }, 202);
    }
  } catch (error) {
    if (error instanceof SyntaxError) return json({ ok: false, error: "Webhook JSON غير صالح" }, 400);
    return json({ ok: false, error: "تعذر معالجة webhook" }, 500);
  }
}
