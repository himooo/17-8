import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decryptAiKey } from "@/lib/ai-key-crypto";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function safeText(value: unknown, max = 20_000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function mockEmbedding(text: string) {
  const vector = Array.from({ length: 8 }, (_, index) => {
    let value = 0;
    for (let i = index; i < text.length; i += 8) value = (value * 31 + text.charCodeAt(i)) % 1000;
    return Number(((value / 1000) * 2 - 1).toFixed(6));
  });
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => Number((value / norm).toFixed(6)));
}

async function getKey(input: Record<string, unknown>) {
  const keyId = typeof input.keyId === "string" ? input.keyId : "";
  const provider = typeof input.provider === "string" ? input.provider : "openai";
  if (provider === "mock") return { provider, key: "mock", baseUrl: "" };
  const row = keyId ? await db.aiProviderKey.findUnique({ where: { id: keyId } }) : await db.aiProviderKey.findFirst({ where: { provider, isActive: true, status: "active" }, orderBy: [{ priority: "asc" }, { createdAt: "asc" }] });
  if (!row) throw new Error("لا يوجد مفتاح capability مفعّل لهذا المزود");
  return { provider, key: await decryptAiKey(row.encryptedKey), baseUrl: (row.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "") };
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const action = safeText(form.get("action"), 20) || "stt";
      const provider = safeText(form.get("provider"), 40) || "openai";
      const file = form.get("audio");
      if (action !== "stt" || !(file instanceof File)) return json({ ok: false, error: "ملف audio مطلوب لـSTT" }, 400);
      if (file.size > 16 * 1024 * 1024) return json({ ok: false, error: "حجم الصوت يتجاوز 16MB" }, 413);
      if (provider === "mock") return json({ ok: true, data: { text: "نص صوتي تجريبي من مزود الاختبار المحلي", provider: "mock", language: "ar" } });
      const candidate = await getKey({ provider, keyId: form.get("keyId") });
      const body = new FormData();
      body.append("file", file, file.name || "audio.webm");
      body.append("model", safeText(form.get("model"), 100) || "whisper-1");
      body.append("language", safeText(form.get("language"), 10) || "ar");
      const response = await fetch(`${candidate.baseUrl}/audio/transcriptions`, { method: "POST", headers: { Authorization: `Bearer ${candidate.key}` }, body, signal: AbortSignal.timeout(60_000) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return json({ ok: false, error: "فشل مزود STT", providerStatus: response.status }, response.status);
      return json({ ok: true, data: { text: safeText(payload.text, 40_000), provider, language: payload.language || "ar", segments: payload.segments || [] } });
    }

    const input = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = safeText(input.action, 30);
    const text = safeText(input.text || input.prompt || input.input);
    const candidate = await getKey(input);
    if (candidate.provider === "mock") {
      if (action === "embeddings") return json({ ok: true, data: { embedding: mockEmbedding(text), dimensions: 8, model: "mock-embedding", provider: "mock" } });
      if (action === "image") return json({ ok: true, data: { url: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="100%" height="100%" fill="#eff6ff"/><circle cx="256" cy="256" r="150" fill="none" stroke="#2563eb" stroke-width="8"/><text x="256" y="260" text-anchor="middle" font-size="22" fill="#1e3a8a">Bisalasa Demo</text></svg>`)}`, provider: "mock" } });
      if (action === "vision") return json({ ok: true, data: { text: "تحليل صورة تجريبي: الصورة متاحة للتحليل، والقرار النهائي للمدرس.", provider: "mock" } });
      return json({ ok: true, data: { result: "استجابة capability تجريبية", provider: "mock" } });
    }

    if (action === "embeddings") {
      if (!text) return json({ ok: false, error: "text مطلوب للـembeddings" }, 400);
      const response = await fetch(`${candidate.baseUrl}/embeddings`, { method: "POST", headers: { Authorization: `Bearer ${candidate.key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: safeText(input.model, 160) || "text-embedding-3-small", input: text }), signal: AbortSignal.timeout(45_000) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return json({ ok: false, error: "فشل embeddings provider", providerStatus: response.status }, response.status);
      const embedding = payload?.data?.[0]?.embedding;
      if (!Array.isArray(embedding)) return json({ ok: false, error: "استجابة embeddings غير صالحة" }, 502);
      return json({ ok: true, data: { embedding, dimensions: embedding.length, model: input.model || "text-embedding-3-small", provider: candidate.provider } });
    }

    if (action === "image") {
      if (!text) return json({ ok: false, error: "prompt مطلوب للصورة" }, 400);
      const response = await fetch(`${candidate.baseUrl}/images/generations`, { method: "POST", headers: { Authorization: `Bearer ${candidate.key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: safeText(input.model, 120) || "dall-e-3", prompt: text, size: safeText(input.size, 20) || "1024x1024", quality: safeText(input.quality, 20) || "standard", n: 1 }), signal: AbortSignal.timeout(90_000) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return json({ ok: false, error: "فشل image provider", providerStatus: response.status }, response.status);
      return json({ ok: true, data: { url: payload?.data?.[0]?.url || null, b64Json: payload?.data?.[0]?.b64_json || null, provider: candidate.provider } });
    }

    if (action === "vision") {
      const imageUrl = safeText(input.imageUrl, 2_000);
      if (!text || !imageUrl) return json({ ok: false, error: "input وimageUrl مطلوبان للرؤية" }, 400);
      const response = await fetch(`${candidate.baseUrl}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${candidate.key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: safeText(input.model, 160) || "gpt-4o-mini", messages: [{ role: "user", content: [{ type: "text", text }, { type: "image_url", image_url: { url: imageUrl, detail: "auto" } }] }], max_tokens: 1200 }), signal: AbortSignal.timeout(60_000) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return json({ ok: false, error: "فشل vision provider", providerStatus: response.status }, response.status);
      return json({ ok: true, data: { text: payload?.choices?.[0]?.message?.content || "", provider: candidate.provider, model: input.model || "gpt-4o-mini" } });
    }

    return json({ ok: false, error: "capability غير معروفة" }, 400);
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message.slice(0, 240) : "فشل capability" }, 500);
  }
}
