import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Lightweight liveness/readiness probe for local teacher-operated deployments.
 * It intentionally exposes no database details, provider credentials, or student data.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "bisalasa",
      uptime: Number(process.uptime().toFixed(3)),
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
