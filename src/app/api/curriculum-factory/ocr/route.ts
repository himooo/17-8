import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const MAX_BYTES = 8 * 1024 * 1024;
const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/tiff": "tiff",
  "image/bmp": "bmp",
};

function normalizeLanguage(value: FormDataEntryValue | null) {
  const requested = typeof value === "string" ? value : "ara+eng";
  return requested === "ara" || requested === "eng" || requested === "ara+eng" ? requested : "ara+eng";
}

export async function POST(request: NextRequest) {
  const tempDirectory = path.join(process.cwd(), ".data", "ocr-tmp");
  const tempId = randomUUID();
  const tempInput = path.join(tempDirectory, `${tempId}.input`);
  const tempOutput = path.join(tempDirectory, `${tempId}.text`);
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "صورة OCR مطلوبة" }, { status: 400 });
    if (!MIME_EXTENSIONS[file.type]) return NextResponse.json({ ok: false, error: "يدعم OCR صور PNG وJPG وWEBP وGIF وTIFF وBMP فقط" }, { status: 415 });
    if (file.size <= 0 || file.size > MAX_BYTES) return NextResponse.json({ ok: false, error: "حجم صورة OCR يجب أن يكون بين 1 بايت و8 MB" }, { status: 413 });

    const language = normalizeLanguage(form.get("language"));
    const key = `curriculum-factory/ocr/${new Date().toISOString().slice(0, 10)}/${tempId}.${MIME_EXTENSIONS[file.type]}`;
    const storageRoot = path.join(process.cwd(), "public", "manus-storage");
    await mkdir(path.dirname(path.join(storageRoot, key)), { recursive: true });
    await mkdir(tempDirectory, { recursive: true });
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(storageRoot, key), bytes, { flag: "wx" });
    await writeFile(tempInput, bytes, { flag: "wx" });

    try {
      await execFileAsync("tesseract", [tempInput, tempOutput, "-l", language, "--psm", "6"], { timeout: 90_000, maxBuffer: 2 * 1024 * 1024 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "محرك OCR غير متاح";
      return NextResponse.json({ ok: false, error: `تعذر تشغيل OCR المحلي: ${message}` }, { status: 503 });
    }

    const text = (await readFile(`${tempOutput}.txt`, "utf8")).replace(/\r\n/g, "\n").trim();
    return NextResponse.json({
      ok: true,
      data: {
        text,
        language,
        wordCount: text ? text.split(/\s+/).length : 0,
        asset: { id: `asset-${tempId}`, key, url: `/manus-storage/${key}`, alt: file.name.replace(/\.[^.]+$/, ""), source: "book-crop", type: "illustration", status: "final", filename: file.name, mimeType: file.type, size: file.size },
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "تعذر معالجة صورة OCR" }, { status: 500 });
  } finally {
    await rm(tempInput, { force: true }).catch(() => undefined);
    await rm(`${tempOutput}.txt`, { force: true }).catch(() => undefined);
  }
}
