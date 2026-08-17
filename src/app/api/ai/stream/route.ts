import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sse(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const upstreamUrl = new URL("/api/ai", req.url);
  const upstream = await fetch(upstreamUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": req.headers.get("x-forwarded-for") || "local" },
    body: JSON.stringify({ ...body, action: "generate", onChunk: undefined }),
    cache: "no-store",
  });
  const payload = await upstream.json().catch(() => ({ ok: false, error: "استجابة AI غير صالحة" }));
  if (!upstream.ok || !payload?.ok) {
    return new Response(sse({ error: payload?.error || "تعذر تشغيل AI" }), { status: upstream.status || 500, headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-store" } });
  }
  const text = String(payload.data?.text || "");
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const chunks = text.match(/[\s\S]{1,80}/g) || [text];
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(sse({ text: chunk })));
          await new Promise((resolve) => setTimeout(resolve, 8));
        }
        controller.enqueue(encoder.encode(sse({ done: true, usage: payload.data?.usage, provider: payload.data?.provider, model: payload.data?.model })));
        controller.close();
      } catch (error) {
        controller.enqueue(encoder.encode(sse({ error: error instanceof Error ? error.message : "فشل بث AI" })));
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-store", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}
