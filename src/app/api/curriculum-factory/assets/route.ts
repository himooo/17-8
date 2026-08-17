import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;
const MIME_EXTENSIONS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg" };

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "ملف الصورة مطلوب" }, { status: 400 });
    if (!MIME_EXTENSIONS[file.type]) return NextResponse.json({ ok: false, error: "نوع الصورة غير مسموح؛ استخدم PNG أو JPG أو WEBP أو GIF أو SVG" }, { status: 415 });
    if (file.size <= 0 || file.size > MAX_BYTES) return NextResponse.json({ ok: false, error: "حجم الصورة يجب أن يكون بين 1 بايت و5 MB" }, { status: 413 });
    const key = `curriculum-factory/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${MIME_EXTENSIONS[file.type]}`;
    const root = path.join(process.cwd(), "public", "manus-storage");
    await mkdir(path.join(root, path.dirname(key.replace(/^curriculum-factory\//, ""))), { recursive: true });
    await writeFile(path.join(root, key.replace(/^curriculum-factory\//, "")), Buffer.from(await file.arrayBuffer()), { flag: "wx" });
    return NextResponse.json({ ok: true, data: { key, url: `/manus-storage/${key}`, mimeType: file.type, size: file.size } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "تعذر رفع الصورة" }, { status: 500 });
  }
}
