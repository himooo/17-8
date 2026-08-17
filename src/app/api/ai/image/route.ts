import { NextRequest } from "next/server";
import { POST as mediaPost } from "@/app/api/ai/media/route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const forwarded = {
    ...body,
    action: "image",
    prompt: typeof body.prompt === "string" ? body.prompt : body.input,
  };
  return mediaPost(new NextRequest(request.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(forwarded),
  }));
}
