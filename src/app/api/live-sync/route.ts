import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const NO_STORE_HEADERS = { "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate", Pragma: "no-cache", Expires: "0" };
const liveEventLocks = new Map<string, Promise<void>>();
let lastLiveClaimCleanupAt = 0;

async function cleanupOldLiveClaims() {
  const now = Date.now();
  if (now - lastLiveClaimCleanupAt < 6 * 60 * 60 * 1000) return;
  lastLiveClaimCleanupAt = now;
  await db.liveSyncClaim.deleteMany({ where: { createdAt: { lt: new Date(now - 35 * 24 * 60 * 60 * 1000) } } });
}

async function withEventLock<T>(eventId: string, work: () => Promise<T>): Promise<T> {
  const previous = liveEventLocks.get(eventId) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const queued = previous.catch(() => undefined).then(work);
  void queued.then(() => release(), () => release());
  liveEventLocks.set(eventId, gate);
  try {
    return await queued;
  } finally {
    if (liveEventLocks.get(eventId) === gate) liveEventLocks.delete(eventId);
  }
}

type LiveAnswer = {
  eventId?: string;
  studentCode: string;
  lessonId: string;
  ideaId?: string;
  isCorrect: boolean;
  timestamp: string | number;
  sessionId?: string;
  questionId?: string;
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE_HEADERS });
}

function safeString(value: unknown, label: string, max = 180): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`${label} غير صالح`);
  return value.trim();
}

function parseTimestamp(value: unknown): string {
  const date = typeof value === "number" ? new Date(value) : new Date(typeof value === "string" ? value : "");
  if (Number.isNaN(date.getTime())) throw new Error("timestamp غير صالح");
  const now = Date.now();
  if (date.getTime() < now - 1000 * 60 * 60 * 24 * 30 || date.getTime() > now + 1000 * 60 * 10) throw new Error("timestamp خارج النطاق المسموح");
  return date.toISOString();
}

function requireToken(request: NextRequest): void {
  const expected = process.env.LIVE_SYNC_SHARED_SECRET?.trim();
  if (!expected) return;
  const received = request.headers.get("x-bisalasa-live-token") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!received || received !== expected) throw new Error("Live Sync غير مصرح");
}

function normalizeBody(body: unknown): LiveAnswer[] {
  const raw = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const list = Array.isArray(raw.events) ? raw.events : [raw];
  if (list.length < 1 || list.length > 100) throw new Error("يجب إرسال حدث واحد إلى 100 حدث");
  return list.map((item) => {
    const value = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const studentCode = safeString(value.studentCode, "studentCode", 120);
    const lessonId = safeString(value.lessonId, "lessonId", 180);
    const eventId = typeof value.eventId === "string" && value.eventId.trim() ? value.eventId.trim().slice(0, 180) : undefined;
    const ideaId = typeof value.ideaId === "string" && value.ideaId.trim() ? value.ideaId.trim().slice(0, 180) : undefined;
    const sessionId = typeof value.sessionId === "string" && value.sessionId.trim() ? value.sessionId.trim().slice(0, 180) : undefined;
    const questionId = typeof value.questionId === "string" && value.questionId.trim() ? value.questionId.trim().slice(0, 180) : undefined;
    if (typeof value.isCorrect !== "boolean") throw new Error("isCorrect يجب أن يكون boolean");
    const timestamp = parseTimestamp(value.timestamp);
    return { eventId, studentCode, lessonId, ideaId, isCorrect: value.isCorrect, timestamp, sessionId, questionId };
  });
}

function stableEventId(event: LiveAnswer): string {
  if (event.eventId) return event.eventId;
  return createHash("sha256").update(JSON.stringify(event)).digest("hex").slice(0, 48);
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const sinceValue = url.searchParams.get("since");
    const lessonId = url.searchParams.get("lessonId");
    const since = sinceValue ? new Date(sinceValue) : new Date(Date.now() - 1000 * 60 * 15);
    if (Number.isNaN(since.getTime())) return json({ ok: false, error: "since غير صالح" }, 400);
    const rows = await db.studentActivity.findMany({ where: { description: { startsWith: "live-sync:" }, createdAt: { gt: since } }, orderBy: { createdAt: "asc" }, take: 500 });
    const studentIds = Array.from(new Set(rows.map((row) => row.studentId).filter((id): id is string => Boolean(id))));
    const students = studentIds.length ? await db.student.findMany({ where: { id: { in: studentIds } }, select: { id: true, studentCode: true } }) : [];
    const codeByStudentId = new Map(students.map((student) => [student.id, student.studentCode]));
    const events = rows.map((row) => {
      let metadata: Record<string, unknown> = {};
      try { metadata = JSON.parse(row.metadataJson) as Record<string, unknown>; } catch { /* keep safe defaults */ }
      return { eventId: String(metadata.eventId ?? row.description.slice("live-sync:".length)), studentCode: row.studentId ? codeByStudentId.get(row.studentId) ?? null : null, lessonId: typeof metadata.lessonId === "string" ? metadata.lessonId : null, ideaId: typeof metadata.ideaId === "string" ? metadata.ideaId : null, questionId: typeof metadata.questionId === "string" ? metadata.questionId : null, isCorrect: row.type === "correct", timestamp: row.createdAt.toISOString(), pointsDelta: row.pointsDelta };
    }).filter((event) => !lessonId || event.lessonId === lessonId);
    return json({ ok: true, data: { events, sampledAt: new Date().toISOString() } });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "تعذر قراءة Live Sync" }, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    requireToken(request);
    await cleanupOldLiveClaims();
    const body = await request.json().catch(() => ({}));
    const events = normalizeBody(body);
    const results: Array<Record<string, unknown>> = [];
    for (const event of events) {
      const eventId = stableEventId(event);
      const description = `live-sync:${eventId}`;
      const metadataJson = JSON.stringify({ source: "live-app", eventId, lessonId: event.lessonId, ideaId: event.ideaId ?? null, questionId: event.questionId ?? null, answeredAt: event.timestamp });
      const existing = await db.studentActivity.findFirst({ where: { description } });
      if (existing) {
        results.push({ eventId, duplicate: true, status: existing.type === "correct" ? "correct" : "wrong", activityId: existing.id });
        continue;
      }
      const student = await db.student.findUnique({ where: { studentCode: event.studentCode } });
      if (!student) {
        results.push({ eventId, duplicate: false, accepted: false, error: "الطالب غير مرتبط في بسالسة", studentCode: event.studentCode });
        continue;
      }
      const pointsDelta = event.isCorrect ? 1 : 0;
      const result = await withEventLock(eventId, async () => {
        const serializedExisting = await db.studentActivity.findFirst({ where: { description } });
        if (serializedExisting) return { eventId, duplicate: true, status: serializedExisting.type === "correct" ? "correct" : "wrong", activityId: serializedExisting.id };
        try {
          const activity = await db.$transaction(async (tx) => {
            const claim = await tx.liveSyncClaim.create({ data: { eventId } });
            const created = await tx.studentActivity.create({ data: { studentId: student.id, sessionId: event.sessionId, type: event.isCorrect ? "correct" : "wrong", pointsDelta, description, metadataJson, createdAt: new Date(event.timestamp) } });
            await tx.liveSyncClaim.update({ where: { id: claim.id }, data: { activityId: created.id } });
            await tx.student.update({ where: { id: student.id }, data: { points: { increment: pointsDelta }, correctAnswers: { increment: event.isCorrect ? 1 : 0 }, wrongAnswers: { increment: event.isCorrect ? 0 : 1 }, attempts: { increment: 1 } } });
            return created;
          });
          return { eventId, duplicate: false, accepted: true, studentId: student.id, studentCode: event.studentCode, status: event.isCorrect ? "correct" : "wrong", pointsDelta, activityId: activity.id };
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            const claimed = await db.liveSyncClaim.findUnique({ where: { eventId }, select: { activityId: true } });
            if (claimed) return { eventId, duplicate: true, status: event.isCorrect ? "correct" : "wrong", activityId: claimed.activityId };
          }
          throw error;
        }
      });
      results.push(result);
    }
    return json({ ok: true, data: { accepted: results.filter((result) => result.accepted === true).length, duplicates: results.filter((result) => result.duplicate === true).length, rejected: results.filter((result) => result.accepted === false).length, results } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر استقبال Live Sync";
    return json({ ok: false, error: message }, message === "Live Sync غير مصرح" ? 401 : 400);
  }
}
