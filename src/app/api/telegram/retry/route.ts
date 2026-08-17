import { NextRequest } from "next/server";
import { POST as telegramPost } from "@/app/api/telegram/route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  return telegramPost(new NextRequest(request.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, action: "queue.process" }),
  }));
}
