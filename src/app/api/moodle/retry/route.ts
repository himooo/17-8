import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { processMoodleSyncEvent, retryBackoffMs } from "@/lib/moodle-v10";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const HEADERS = { "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate", Pragma: "no-cache" };
function json(data: unknown, status = 200) { return NextResponse.json(data, { status, headers: HEADERS }); }

export async function GET() {
  const now = new Date();
  const pending = await db.moodleSyncRetry.findMany({ where: { status: "pending", nextRetryAt: { lte: now }, retryCount: { lt: 3 } }, include: { event: true }, orderBy: { nextRetryAt: "asc" }, take: 20 });
  const results: Array<Record<string, unknown>> = [];
  for (const retry of pending) {
    const claimed = await db.moodleSyncRetry.updateMany({ where: { id: retry.id, status: "pending" }, data: { status: "retrying" } });
    if (claimed.count !== 1) continue;
    try {
      const processed = await processMoodleSyncEvent(retry.eventId);
      if (processed.ok) {
        await db.moodleSyncRetry.update({ where: { id: retry.id }, data: { status: "success", retryCount: { increment: 1 }, lastError: null } });
        results.push({ id: retry.id, eventId: retry.eventId, status: "success" });
      } else {
        const message = processed.validation.errors.join("; ").slice(0, 500) || "validation failed";
        await db.moodleSyncRetry.update({ where: { id: retry.id }, data: { status: "dead", retryCount: { increment: 1 }, lastError: message } });
        results.push({ id: retry.id, eventId: retry.eventId, status: "dead", reason: message });
      }
    } catch (error) {
      const retryCount = retry.retryCount + 1;
      const dead = retryCount >= retry.maxRetries;
      const message = error instanceof Error ? error.message.slice(0, 500) : "Moodle retry failed";
      await db.moodleSyncRetry.update({ where: { id: retry.id }, data: { status: dead ? "dead" : "pending", retryCount, nextRetryAt: new Date(Date.now() + retryBackoffMs(retryCount)), lastError: message } });
      results.push({ id: retry.id, eventId: retry.eventId, status: dead ? "dead" : "pending", retryCount, error: message });
    }
  }
  return json({ ok: true, processed: results.length, results, pending: await db.moodleSyncRetry.count({ where: { status: "pending" } }), dead: await db.moodleSyncRetry.count({ where: { status: "dead" } }) });
}

export async function POST() { return GET(); }
