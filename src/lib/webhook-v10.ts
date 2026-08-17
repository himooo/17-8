import { createHmac, timingSafeEqual } from "node:crypto";
import { isAllowedWebhookEvent, isSafeWebhookUrl, type WebhookEvent } from "@/lib/settings-ai-v10";

export { isAllowedWebhookEvent, isSafeWebhookUrl };

export function canonicalWebhookBody(event: WebhookEvent, payload: unknown, timestamp: number, eventId: string) {
  return JSON.stringify({ event, eventId, timestamp, payload });
}

export function signWebhook(secret: string, body: string) {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

export function verifyWebhookSignature(secret: string, body: string, signature: string) {
  const expected = signWebhook(secret, body);
  const left = Buffer.from(expected);
  const right = Buffer.from(signature || "");
  return left.length === right.length && timingSafeEqual(left, right);
}

export function normalizeWebhookEvents(value: unknown): WebhookEvent[] {
  const parsed: unknown = Array.isArray(value) ? value : (() => { try { return JSON.parse(typeof value === "string" ? value : "[]"); } catch { return []; } })();
  const values: unknown[] = Array.isArray(parsed) ? parsed : [];
  const allowed = values.filter((item): item is WebhookEvent => isAllowedWebhookEvent(item));
  return Array.from(new Set<WebhookEvent>(allowed));
}

export function backoffMs(attempt: number) {
  return Math.min(30_000, Math.max(250, 2 ** Math.max(0, attempt) * 250));
}
