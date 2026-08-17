import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const query = typeof body.query === "string" ? body.query.trim().slice(0, 200) : "";
    if (!query) return json({ ok: false, error: "عبارة البحث مطلوبة" }, 400);
    const limit = Math.max(1, Math.min(50, Number(body.limit) || 20));
    const rows = await db.importedLesson.findMany({
      where: {
        OR: [
          { title: { contains: query } },
          { subtitle: { contains: query } },
          { content: { contains: query } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: { _count: { select: { questions: true } } },
    });
    return json({ ok: true, data: rows, mode: "local-text" });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message.slice(0, 240) : "فشل بحث الدروس" }, 500);
  }
}
