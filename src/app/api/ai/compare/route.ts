import { NextRequest } from "next/server";
import { POST as aiPost } from "@/app/api/ai/route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const rawModels = Array.isArray(body.models) ? body.models : [];
  const models = rawModels
    .slice(0, 4)
    .map((item) => (typeof item === "string" ? { model: item } : item))
    .filter((item) => Boolean(item && typeof item === "object"));
  const forwarded = {
    ...body,
    action: "compare",
    input: typeof body.input === "string" ? body.input : body.prompt,
    models,
  };
  return aiPost(new NextRequest(request.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(forwarded),
  }));
}
