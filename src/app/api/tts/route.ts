// ====================================================================
//  /api/tts/route.ts — Proxy لـ Google Translate TTS
//
//  يحل مشكلة CORS: المتصفح لا يستطيع جلب الصوت مباشرة من Google
//  لأن Google لا ترسل Access-Control-Allow-Origin.
//  هذا الـ API proxy يجلب الصوت من الخادم ويعيده مع CORS headers.
//
//  الاستخدام:
//    GET /api/tts?text=مرحبا&lang=ar
//    → يرجع audio/mpeg
// ====================================================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decryptAiKey } from "@/lib/ai-key-crypto";

const GOOGLE_TTS_URL = "https://translate.google.com/translate_tts";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const text = searchParams.get("text");
    const lang = searchParams.get("lang") || "ar";

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Missing 'text' parameter" },
        { status: 400 }
      );
    }

    // حدّ طول النص (Google يقبل ~200 حرف)
    const truncatedText = text.substring(0, 200);

    // بناء URL
    const params = new URLSearchParams({
      ie: "UTF-8",
      tl: lang,
      client: "tw-ob",
      q: truncatedText,
    });
    const url = `${GOOGLE_TTS_URL}?${params.toString()}`;

    // جلب الصوت من Google (مع User-Agent لأن Google يتطلبه)
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "audio/mpeg, audio/*, */*",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Google TTS returned ${response.status}` },
        { status: response.status }
      );
    }

    const audioBuffer = await response.arrayBuffer();

    // أعد الصوت مع CORS headers
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.byteLength.toString(),
        "Cache-Control": "public, max-age=86400", // cache لمدة يوم
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error) {
    console.error("[TTS API] Error:", error);
    return NextResponse.json(
      { error: "TTS fetch failed" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const text = typeof body.text === "string" ? body.text.trim().slice(0, 4000) : "";
    const provider = typeof body.provider === "string" ? body.provider : "openai";
    if (!text) return NextResponse.json({ error: "text مطلوب" }, { status: 400 });
    const keyId = typeof body.keyId === "string" ? body.keyId : "";
    const row = keyId ? await db.aiProviderKey.findUnique({ where: { id: keyId } }) : await db.aiProviderKey.findFirst({ where: { provider: provider === "elevenlabs" || provider === "google-cloud" ? "custom" : provider, isActive: true, status: "active" }, orderBy: [{ priority: "asc" }, { createdAt: "asc" }] });
    if (!row) return NextResponse.json({ error: "لا يوجد مفتاح TTS مفعّل" }, { status: 400 });
    const key = await decryptAiKey(row.encryptedKey);
    if (provider === "elevenlabs") {
      const voiceId = typeof body.voiceId === "string" && body.voiceId ? body.voiceId : "21m00Tcm4TlvDq8ikWAM";
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, { method: "POST", headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" }, body: JSON.stringify({ text, model_id: typeof body.model === "string" ? body.model : "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.75 } }), signal: AbortSignal.timeout(60_000) });
      if (!response.ok) return NextResponse.json({ error: `ElevenLabs TTS ${response.status}` }, { status: response.status });
      return new NextResponse(await response.arrayBuffer(), { status: 200, headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
    }
    if (provider === "google-cloud") {
      const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(key)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input: { text }, voice: { languageCode: typeof body.lang === "string" ? body.lang : "ar-XA", name: typeof body.voice === "string" ? body.voice : undefined }, audioConfig: { audioEncoding: "MP3", speakingRate: typeof body.rate === "number" ? body.rate : 1 } }), signal: AbortSignal.timeout(60_000) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || typeof payload.audioContent !== "string") return NextResponse.json({ error: `Google Cloud TTS ${response.status}` }, { status: response.status });
      return new NextResponse(Buffer.from(payload.audioContent, "base64"), { status: 200, headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
    }
    const baseUrl = (row.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
    const response = await fetch(`${baseUrl}/audio/speech`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: typeof body.model === "string" ? body.model : "tts-1", input: text, voice: typeof body.voice === "string" ? body.voice : "alloy", response_format: "mp3" }), signal: AbortSignal.timeout(60_000) });
    if (!response.ok) return NextResponse.json({ error: `OpenAI TTS ${response.status}` }, { status: response.status });
    return new NextResponse(await response.arrayBuffer(), { status: 200, headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message.slice(0, 200) : "TTS failed" }, { status: 500 });
  }
}

// معالجة طلبات CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
