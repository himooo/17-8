import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decryptTelegramSecret, encryptTelegramSecret } from "@/lib/telegram-crypto";
import { generateTelegramStudentPdf } from "@/lib/telegram-report-pdf";
import { buildStudentReport } from "@/lib/report-aggregator";
import { createRateLimiter, makeIdempotencyKey, makeParentKeyboard, parseTelegramCallback, parseTelegramCommand, parentSections, renderMessageTemplate, retryDelayMs } from "@/lib/reports-telegram-v10";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = { "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate", Pragma: "no-cache", Expires: "0" };
const telegramRateLimit = createRateLimiter(30, 60_000);
type TelegramSchedule = "session" | "weekly" | "monthly" | "manual";
type TelegramSettings = { enabled: boolean; autoSend: boolean; schedule: TelegramSchedule; tokenEncrypted?: string; webhookSecretEncrypted?: string; webhookUrl?: string; lastSendAt?: string | null; lastSendStatus?: "ok" | "error" | null; lastSendError?: string | null };

function json(data: unknown, status = 200) { return NextResponse.json(data, { status, headers: NO_STORE_HEADERS }); }
function safeConfig(value: TelegramSettings) { return { enabled: value.enabled, autoSend: value.autoSend, schedule: value.schedule, hasToken: Boolean(value.tokenEncrypted), webhookUrl: value.webhookUrl ?? "", lastSendAt: value.lastSendAt ?? null, lastSendStatus: value.lastSendStatus ?? null, lastSendError: value.lastSendError ?? null }; }
async function readSettings() { const row = await db.appSettings.findUnique({ where: { id: "singleton" } }); try { const parsed = row?.settingsJson ? JSON.parse(row.settingsJson) : {}; return parsed && typeof parsed === "object" ? parsed as Record<string, any> : {}; } catch { return {}; } }
async function readTelegram(): Promise<TelegramSettings> { const settings = await readSettings(); const raw = settings.telegram; if (!raw || typeof raw !== "object") return { enabled: false, autoSend: false, schedule: "manual" }; const v = raw as Record<string, any>; return { enabled: v.enabled === true, autoSend: v.autoSend === true, schedule: v.schedule === "session" || v.schedule === "weekly" || v.schedule === "monthly" || v.schedule === "manual" ? v.schedule : "manual", tokenEncrypted: typeof v.tokenEncrypted === "string" ? v.tokenEncrypted : undefined, webhookSecretEncrypted: typeof v.webhookSecretEncrypted === "string" ? v.webhookSecretEncrypted : undefined, webhookUrl: typeof v.webhookUrl === "string" ? v.webhookUrl : "", lastSendAt: typeof v.lastSendAt === "string" ? v.lastSendAt : null, lastSendStatus: v.lastSendStatus === "ok" || v.lastSendStatus === "error" ? v.lastSendStatus : null, lastSendError: typeof v.lastSendError === "string" ? v.lastSendError : null }; }
async function saveTelegram(next: TelegramSettings) { const settings = await readSettings(); settings.telegram = next; await db.appSettings.upsert({ where: { id: "singleton" }, create: { id: "singleton", settingsJson: JSON.stringify(settings) }, update: { settingsJson: JSON.stringify(settings) } }); }
function cleanUrl(value: unknown) { const raw = typeof value === "string" ? value.trim() : ""; if (!raw || raw.length > 500) throw new Error("رابط Webhook مطلوب وطوله غير مناسب"); const parsed = new URL(raw); if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash) throw new Error("رابط Telegram Webhook يجب أن يكون HTTPS"); return parsed.toString(); }
function telegramApiBase() { return (process.env.TELEGRAM_API_BASE_URL || "https://api.telegram.org").replace(/\/+$/, ""); }

// C21 fix (2026-AUG): scrub the bot token from Telegram error messages.
// Telegram sometimes includes the full request URL (which contains /bot<TOKEN>/)
// in the description field, leaking the secret to the client.
function scrubTelegramError(message: string, token: string): string {
  const safe = message.replace(new RegExp(token, "g"), "***").replace(/\/bot\d+:A[A-Za-z0-9_-]+\//g, "/bot***/");
  return safe.slice(0, 240);
}

async function telegramRequest(config: TelegramSettings, method: string, body?: Record<string, unknown>) {
  if (!config.tokenEncrypted) throw new Error("أدخل Telegram Bot Token أولاً");
  const chatId = body?.chat_id == null ? "" : String(body.chat_id);
  if (chatId && /^send(Message|Document|Photo|Animation)$/.test(method) && !telegramRateLimit(chatId)) {
    throw new Error("Telegram rate limit exceeded — حاول بعد دقيقة");
  }
  const token = await decryptTelegramSecret(config.tokenEncrypted);
  const response = await fetch(`${telegramApiBase()}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok !== true) {
    const desc = typeof payload?.description === "string" ? payload.description : `Telegram HTTP ${response.status}`;
    throw new Error(scrubTelegramError(desc, token));
  }
  return payload.result;
}

async function telegramDocument(config: TelegramSettings, chatId: string, pdf: Buffer, filename: string, caption: string, replyMarkup?: Record<string, unknown>) {
  if (!config.tokenEncrypted) throw new Error("أدخل Telegram Bot Token أولاً");
  if (!telegramRateLimit(chatId)) throw new Error("Telegram rate limit exceeded — حاول بعد دقيقة");
  const token = await decryptTelegramSecret(config.tokenEncrypted);
  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("document", new Blob([new Uint8Array(pdf)], { type: "application/pdf" }), filename);
  form.append("caption", caption);
  form.append("parse_mode", "HTML");
  if (replyMarkup) form.append("reply_markup", JSON.stringify(replyMarkup));
  const response = await fetch(`${telegramApiBase()}/bot${token}/sendDocument`, {
    method: "POST",
    body: form,
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok !== true) {
    const desc = typeof payload?.description === "string" ? payload.description : `Telegram document HTTP ${response.status}`;
    throw new Error(scrubTelegramError(desc, token));
  }
  return payload.result;
}
function escapeHtml(value: unknown) { return String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char] ?? char)); }
function makeCode() { return `BS-${new Date().getFullYear()}-${crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase()}`; }
async function ensureCode(student: { id: string; studentCode: string | null }) { if (student.studentCode) return student.studentCode; const code = makeCode(); const updated = await db.student.update({ where: { id: student.id }, data: { studentCode: code } }); return updated.studentCode as string; }


async function sendSummary(config: TelegramSettings, studentId: string, sessionId?: string | null) {
  const student = await db.student.findUnique({ where: { id: studentId }, include: { badges: { orderBy: { awardedAt: "desc" }, take: 5 } } });
  if (!student?.parentTelegramChatId) throw new Error("الطالب غير مربوط بولي أمر على Telegram");
  const report = await buildStudentReport(student.id, { sessionId });
  if (!report) throw new Error("تعذر بناء تقرير الطالب");
  const preference = await db.telegramParentPreference.findUnique({ where: { studentId: student.id } });
  let savedSections: unknown[] = [];
  try { savedSections = preference?.sectionsJson ? JSON.parse(preference.sectionsJson) : []; } catch {}
  const prefs = parentSections({ language: preference?.language === "en" ? "en" : "ar", sections: savedSections as never, frequency: preference?.frequency as never, liveEvents: preference?.liveEvents === true, reminders: preference?.reminders === true });
  const show = (section: string) => prefs.sections.includes(section as never);
  const en = prefs.language === "en";
  const dateLabel = new Date().toLocaleDateString(en ? "en-US" : "ar-EG");
  const homework = report.homework.latest;
  const customTemplate = await db.telegramMessageTemplate.findFirst({ where: { type: "summary", language: prefs.language, enabled: true }, orderBy: { updatedAt: "desc" } });
  const templateText = customTemplate ? renderMessageTemplate(customTemplate.template, { name: student.name, points: report.local.points, accuracy: report.local.accuracyPct, interactiveAccuracy: report.interactive.accuracyPct ?? "—", homeworkGrade: homework?.moodleGrade ?? "—", gamesPoints: report.games.points, achievements: student.badges.length }) : "";
  const text = [templateText,
    en ? "<b>Bisalasa report</b>" : "<b>تقرير بسلاسة</b>",
    en ? `Student: <b>${escapeHtml(student.name)}</b>` : `الطالب: <b>${escapeHtml(student.name)}</b>`,
    show("summary") ? (en ? `Local points: ${report.local.points}` : `النقاط المحلية: ${report.local.points}`) : "",
    show("interactive") ? (en ? `Interactive: ${report.interactive.correct} correct of ${report.interactive.answered} answered • accuracy ${report.interactive.accuracyPct == null ? "—" : `${report.interactive.accuracyPct}%`}` : `التفاعل: ${report.interactive.correct} صحيح من ${report.interactive.answered} محلول • الدقة ${report.interactive.accuracyPct == null ? "—" : `${report.interactive.accuracyPct}%`}`) : "",
    show("games") ? (en ? `Games: ${report.games.gameCount} • ${report.games.points} points` : `الألعاب: ${report.games.gameCount} لعبة • ${report.games.points} نقطة`) : "",
    show("homework") ? (homework ? (en ? `Moodle homework: ${homework.completionPct}% complete • grade ${homework.moodleGrade == null ? "—" : `${homework.moodleGrade}/${homework.moodleMaxGrade ?? "—"}`}` : `واجب Moodle: ${homework.completionPct}% إكمال • الدرجة ${homework.moodleGrade == null ? "—" : `${homework.moodleGrade}/${homework.moodleMaxGrade ?? "—"}`}`) : (en ? "No Moodle homework" : "لا يوجد واجب Moodle مسجل")) : "",
    show("attendance") ? (en ? `Attendance is included in the attached report.` : "تفاصيل الحضور موجودة في التقرير المرفق.") : "",
    show("achievements") ? (en ? `Achievements: ${student.badges.length}` : `الإنجازات: ${student.badges.length}`) : "",
    show("fairness") ? (en ? `Participation: ${report.fairness.picks} picks • ${report.fairness.manualPicks} manual` : `المشاركة: ${report.fairness.picks} اختيار • ${report.fairness.manualPicks} يدوي`) : "",
    show("notes") ? (en ? `Shared teacher notes: ${report.notes.shared}` : `ملاحظات المعلم المشتركة: ${report.notes.shared}`) : "",
    sessionId ? (en ? `Session: ${escapeHtml(sessionId)}` : `الجلسة: ${escapeHtml(sessionId)}`) : "",
    en ? "This is an automated summary; the teacher remains the final decision-maker." : "هذا ملخص آلي للمراجعة، وقرار المعلم هو المرجع النهائي.",
  ].filter(Boolean).join("\n");
  const pdf = await generateTelegramStudentPdf({
    studentName: student.name,
    points: report.local.points,
    correct: report.local.correct,
    wrong: report.local.wrong,
    attempts: report.local.attempts,
    badges: student.badges.map((badge) => badge.type),
    dateLabel,
    sessionLabel: sessionId ?? undefined,
    moodle: homework ? { ...homework, interactions: report.interactive.teacherInteractions, activityAttempts: report.interactive.answered, byIdea: report.homework.byIdea.map((row) => ({ ...row, successPct: row.accuracyPct })) } : undefined,
    liveApp: report.interactive.total ? { total: report.interactive.total, answered: report.interactive.answered, unanswered: report.interactive.unanswered, correct: report.interactive.correct, wrong: report.interactive.wrong, points: report.interactive.points, accuracy: report.interactive.accuracyPct, byIdea: report.interactive.byIdea.map((row) => ({ ...row, accuracy: row.accuracyPct })), teacherInteractions: report.interactive.teacherInteractions } : undefined,
    games: report.games,
    activities: report.activities,
    fairness: report.fairness,
    celebrations: report.celebrations,
    notes: report.notes,
    quality: report.quality,
  });
  await telegramDocument(config, student.parentTelegramChatId, pdf, `bisalasa-report-${student.id}.pdf`, text, makeParentKeyboard(student.id, prefs.language));
  return { studentId, sent: true, pdf: true, language: prefs.language, sections: prefs.sections, moodleIncluded: Boolean(homework), liveAppIncluded: report.interactive.total > 0, gamesIncluded: report.games.gameCount > 0, fairnessIncluded: report.fairness.picks > 0 };
}

async function enqueueStudentReport(studentId: string, sessionId?: string | null) {
  const student = await db.student.findUnique({ where: { id: studentId }, select: { id: true, parentTelegramChatId: true } });
  if (!student?.parentTelegramChatId) return null;
  const period = sessionId || new Date().toISOString().slice(0, 10);
  const idempotencyKey = makeIdempotencyKey("student-report", student.parentTelegramChatId, student.id, period);
  const existing = await db.telegramMessageQueue.findUnique({ where: { idempotencyKey } });
  if (existing) return existing;
  return db.telegramMessageQueue.create({ data: { chatId: student.parentTelegramChatId, studentId: student.id, kind: "student-report", method: "studentReport", payloadJson: JSON.stringify({ studentId: student.id, sessionId: sessionId ?? null }), idempotencyKey, maxAttempts: 5 } });
}

function nextScheduleAt(frequency: string, from = new Date()) { const next = new Date(from); if (frequency === "daily") next.setDate(next.getDate() + 1); else if (frequency === "monthly") next.setMonth(next.getMonth() + 1); else next.setDate(next.getDate() + 7); return next; }

export async function GET() { try { return json({ ok: true, data: safeConfig(await readTelegram()) }); } catch (error) { return json({ ok: false, error: error instanceof Error ? error.message : "تعذر قراءة Telegram" }, 500); } }

export async function POST(req: NextRequest) {
  if (req.headers.has("x-telegram-bot-api-secret-token")) return handleWebhook(req);
  try {
    const body = await req.json().catch(() => ({}));
    const action = typeof body?.action === "string" ? body.action : "config.get";
    if (action === "config.get") return json({ ok: true, data: safeConfig(await readTelegram()) });
    if (action === "config.save") { const previous = await readTelegram(); const token = typeof body.token === "string" ? body.token.trim() : ""; const next: TelegramSettings = { ...previous, enabled: body.enabled === true, autoSend: body.autoSend === true, schedule: body.schedule === "session" || body.schedule === "weekly" || body.schedule === "monthly" || body.schedule === "manual" ? body.schedule : previous.schedule, tokenEncrypted: token ? await encryptTelegramSecret(token) : previous.tokenEncrypted, lastSendError: null }; await saveTelegram(next); return json({ ok: true, data: safeConfig(next) }); }
    if (action === "config.reset") { const settings = await readSettings(); delete settings.telegram; await db.appSettings.upsert({ where: { id: "singleton" }, create: { id: "singleton", settingsJson: JSON.stringify(settings) }, update: { settingsJson: JSON.stringify(settings) } }); return json({ ok: true, data: safeConfig({ enabled: false, autoSend: false, schedule: "manual" }) }); }
    if (action === "config.clearToken") { const current = await readTelegram(); const next = { ...current, enabled: false, autoSend: false, tokenEncrypted: undefined, webhookSecretEncrypted: undefined }; await saveTelegram(next); return json({ ok: true, data: safeConfig(next) }); }
    if (action === "students.codes") { const rows = await db.student.findMany({ where: typeof body.classId === "string" && body.classId ? { classId: body.classId } : undefined, orderBy: { name: "asc" } }); const result: Array<{ id: string; name: string; studentCode: string; linked: boolean; parentTelegramUsername: string | null }> = []; for (const row of rows) { const code = await ensureCode({ id: row.id, studentCode: row.studentCode }); result.push({ id: row.id, name: row.name, studentCode: code, linked: Boolean(row.parentTelegramChatId), parentTelegramUsername: row.parentTelegramUsername ?? null }); } return json({ ok: true, data: result }); }
    if (action === "test") { const result = await telegramRequest(await readTelegram(), "getMe"); return json({ ok: true, data: { connected: true, username: result?.username ?? null, firstName: result?.first_name ?? null } }); }
    if (action === "webhook.set") { const current = await readTelegram(); const webhookUrl = cleanUrl(body.webhookUrl); const secret = typeof body.secret === "string" && body.secret.trim() ? body.secret.trim() : crypto.randomBytes(24).toString("hex"); if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) throw new Error("Webhook secret غير صالح"); await telegramRequest(current, "setWebhook", { url: webhookUrl, secret_token: secret, allowed_updates: ["message", "callback_query"], drop_pending_updates: body.dropPending === true }); const next = { ...current, webhookUrl, webhookSecretEncrypted: await encryptTelegramSecret(secret) }; await saveTelegram(next); return json({ ok: true, data: { ...safeConfig(next), secretCreated: !body.secret, secretForSetup: body.secret ? undefined : secret } }); }
    if (action === "webhook.delete") { const current = await readTelegram(); await telegramRequest(current, "deleteWebhook", { drop_pending_updates: body.dropPending === true }); const next = { ...current, webhookUrl: "", webhookSecretEncrypted: undefined }; await saveTelegram(next); return json({ ok: true, data: safeConfig(next) }); }
    if (action === "webhook.info") return json({ ok: true, data: await telegramRequest(await readTelegram(), "getWebhookInfo") });
    if (action === "sendStudentReport") { const current = await readTelegram(); const result = await sendSummary(current, String(body.studentId || ""), typeof body.sessionId === "string" ? body.sessionId : null); return json({ ok: true, data: result }); }
    if (action === "sendSessionReports") { const current = await readTelegram(); if (body.autoOnly === true && !(current.enabled && current.autoSend && current.schedule === "session")) return json({ ok: true, data: { skipped: true, reason: "الإرسال التلقائي غير مفعّل لنهاية الحصة" } }); const students = await db.student.findMany({ where: { parentTelegramChatId: { not: null } }, select: { id: true } }); const results: Array<Record<string, unknown>> = []; for (const student of students) { try { results.push(await sendSummary(current, student.id, typeof body.sessionId === "string" ? body.sessionId : null)); } catch (error) { const queued = await enqueueStudentReport(student.id, typeof body.sessionId === "string" ? body.sessionId : null); results.push({ studentId: student.id, sent: false, queued: Boolean(queued), error: error instanceof Error ? error.message : "فشل الإرسال" }); } } const next = { ...current, lastSendAt: new Date().toISOString(), lastSendStatus: results.some((item) => item.sent === false) ? "error" as const : "ok" as const, lastSendError: results.find((item) => item.sent === false)?.error as string | undefined }; await saveTelegram(next); return json({ ok: true, data: { total: results.length, sent: results.filter((item) => item.sent === true).length, queued: results.filter((item) => item.queued === true).length, results } }); }
    if (action === "sendPhotoCard") {
      const studentId = typeof body.studentId === "string" ? body.studentId : "";
      const photoUrl = typeof body.photoUrl === "string" ? body.photoUrl.trim() : "";
      if (!studentId || !photoUrl) throw new Error("studentId وphotoUrl مطلوبان");
      const parsedUrl = new URL(photoUrl);
      if (parsedUrl.protocol !== "https:" || parsedUrl.username || parsedUrl.password || parsedUrl.hostname === "localhost" || parsedUrl.hostname === "127.0.0.1") throw new Error("photoUrl يجب أن يكون HTTPS عاماً");
      const student = await db.student.findUnique({ where: { id: studentId } });
      if (!student?.parentTelegramChatId) return json({ ok: true, data: { skipped: true, reason: "الطالب غير مربوط" } });
      const current = await readTelegram();
      try { await telegramRequest(current, "sendPhoto", { chat_id: student.parentTelegramChatId, photo: photoUrl, caption: `بطاقة الطالب: ${student.name}`, reply_markup: makeParentKeyboard(student.id) }); return json({ ok: true, data: { sent: true, method: "sendPhoto" } }); } catch (error) { const fallback = await sendSummary(current, student.id); return json({ ok: true, data: { sent: true, method: "pdf-fallback", reason: error instanceof Error ? error.message : "فشل الصورة", fallback } }); }
    }
    if (action === "notifyEvent") {
      const studentId = typeof body.studentId === "string" ? body.studentId : "";
      const eventText = typeof body.text === "string" ? body.text.trim().slice(0, 1000) : "";
      if (!studentId || !eventText) throw new Error("studentId وtext مطلوبان");
      const student = await db.student.findUnique({ where: { id: studentId } });
      const preference = student ? await db.telegramParentPreference.findUnique({ where: { studentId } }) : null;
      if (!student?.parentTelegramChatId || preference?.liveEvents !== true) return json({ ok: true, data: { skipped: true, reason: "live events غير مفعلة أو الطالب غير مربوط" } });
      await telegramRequest(await readTelegram(), "sendMessage", { chat_id: student.parentTelegramChatId, text: eventText, reply_markup: makeParentKeyboard(student.id, preference.language === "en" ? "en" : "ar") });
      return json({ ok: true, data: { sent: true, studentId } });
    }
    if (action === "reminders.dispatch") {
      const current = await readTelegram();
      const students = await db.student.findMany({ where: { isAbsent: true, parentTelegramChatId: { not: null } }, select: { id: true, name: true, parentTelegramChatId: true } });
      const results: Array<Record<string, unknown>> = [];
      for (const student of students) {
        const preference = await db.telegramParentPreference.findUnique({ where: { studentId: student.id } });
        if (!preference?.reminders || !student.parentTelegramChatId) { results.push({ studentId: student.id, skipped: true }); continue; }
        try { await telegramRequest(current, "sendMessage", { chat_id: student.parentTelegramChatId, text: preference.language === "en" ? `Reminder: ${student.name} was marked absent.` : `تذكير: تم تسجيل ${student.name} غائباً.`, reply_markup: makeParentKeyboard(student.id, preference.language === "en" ? "en" : "ar") }); results.push({ studentId: student.id, sent: true }); } catch (error) { const queued = await enqueueStudentReport(student.id); results.push({ studentId: student.id, sent: false, queued: Boolean(queued), error: error instanceof Error ? error.message : "فشل التذكير" }); }
      }
      return json({ ok: true, data: { total: results.length, sent: results.filter((row) => row.sent === true).length, results } });
    }
    if (action === "queue.process") {
      const current = await readTelegram();
      const limit = Math.max(1, Math.min(20, Number.isInteger(body.limit) ? Number(body.limit) : 10));
      const results: Array<Record<string, unknown>> = [];
      for (let index = 0; index < limit; index += 1) {
        const row = await db.telegramMessageQueue.findFirst({ where: { status: "pending", nextAttemptAt: { lte: new Date() }, attempts: { lt: 8 } }, orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }] });
        if (!row) break;
        const claimed = await db.telegramMessageQueue.update({ where: { id: row.id }, data: { status: "sending", attempts: { increment: 1 } } });
        try {
          let result: unknown;
          if (claimed.method === "studentReport") { const payload = JSON.parse(claimed.payloadJson) as { studentId?: string; sessionId?: string | null }; if (!payload.studentId) throw new Error("studentId غير موجود في queue"); result = await sendSummary(current, payload.studentId, payload.sessionId); }
          else { const payload = JSON.parse(claimed.payloadJson) as Record<string, unknown>; result = await telegramRequest(current, claimed.method, payload); }
          await db.telegramMessageQueue.update({ where: { id: claimed.id }, data: { status: "sent", sentAt: new Date(), lastError: null } });
          results.push({ id: claimed.id, status: "sent", result });
        } catch (error) {
          const dead = claimed.attempts >= claimed.maxAttempts;
          await db.telegramMessageQueue.update({ where: { id: claimed.id }, data: { status: dead ? "dead" : "pending", nextAttemptAt: new Date(Date.now() + retryDelayMs(claimed.attempts)), lastError: error instanceof Error ? error.message.slice(0, 1000) : "فشل الإرسال" } });
          results.push({ id: claimed.id, status: dead ? "dead" : "pending", error: error instanceof Error ? error.message : "فشل الإرسال" });
        }
      }
      return json({ ok: true, data: { processed: results.length, results } });
    }
    if (action === "schedule.dispatch") {
      const current = await readTelegram();
      if (!(current.enabled && current.autoSend)) return json({ ok: true, data: { skipped: true, reason: "Telegram autoSend غير مفعّل" } });
      const now = new Date();
      const schedule = await db.reportSchedule.findFirst({ where: { enabled: true, nextRunAt: { lte: now }, kind: "telegram-report" }, orderBy: { nextRunAt: "asc" } });
      if (!schedule) return json({ ok: true, data: { skipped: true, reason: "لا يوجد تقرير مستحق" } });
      const claimed = await db.reportSchedule.update({ where: { id: schedule.id }, data: { enabled: false, lastRunAt: now, lastStatus: "claimed" } });
      const students = await db.student.findMany({ where: { parentTelegramChatId: { not: null }, ...(claimed.classId ? { classId: claimed.classId } : {}) }, select: { id: true } });
      const results: Array<Record<string, unknown>> = [];
      for (const student of students) { try { results.push(await sendSummary(current, student.id)); } catch (error) { const queued = await enqueueStudentReport(student.id); results.push({ studentId: student.id, sent: false, queued: Boolean(queued), error: error instanceof Error ? error.message : "فشل الإرسال" }); } }
      const nextRunAt = nextScheduleAt(claimed.frequency, now);
      await db.reportSchedule.update({ where: { id: claimed.id }, data: { enabled: true, nextRunAt, lastStatus: results.some((item) => item.sent === false) ? "partial" : "ok", lastError: results.find((item) => item.sent === false)?.error as string | undefined } });
      return json({ ok: true, data: { scheduleId: claimed.id, total: results.length, sent: results.filter((item) => item.sent === true).length, queued: results.filter((item) => item.queued === true).length, nextRunAt: nextRunAt.toISOString(), results } });
    }
    return json({ ok: false, error: "إجراء Telegram غير معروف" }, 400);
  } catch (error) { const message = error instanceof Error ? error.message : "تعذر تنفيذ Telegram"; return json({ ok: false, error: message }, 502); }
}

async function linkedStudent(chatId: string) { return db.student.findFirst({ where: { parentTelegramChatId: chatId }, orderBy: { updatedAt: "desc" } }); }
async function acknowledgeCallback(config: TelegramSettings, callbackId: string, text?: string) { try { await telegramRequest(config, "answerCallbackQuery", { callback_query_id: callbackId, text }); } catch {} }

async function handleWebhook(req: NextRequest) {
  const config = await readTelegram();
  if (!config.webhookSecretEncrypted) return json({ ok: false, error: "Webhook secret غير مضبوط" }, 401);
  const expected = await decryptTelegramSecret(config.webhookSecretEncrypted);
  const supplied = req.headers.get("x-telegram-bot-api-secret-token") || "";
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return json({ ok: false, error: "Webhook غير مصرح" }, 401);
  const update = await req.json().catch(() => ({}));
  const callback = update?.callback_query;
  if (callback) {
    const chatId = callback?.message?.chat?.id == null ? "" : String(callback.message.chat.id);
    const parsed = typeof callback?.data === "string" ? parseTelegramCallback(callback.data) : null;
    if (!chatId || !parsed) { await acknowledgeCallback(config, String(callback?.id ?? ""), "طلب غير صالح"); return json({ ok: true, data: { handled: false, action: "invalid-callback" } }); }
    const student = await db.student.findUnique({ where: { id: parsed.studentId } });
    if (!student || String(student.parentTelegramChatId) !== chatId) { await acknowledgeCallback(config, String(callback.id), "هذا التقرير غير متاح لهذا الحساب"); return json({ ok: true, data: { handled: false, action: "callback-forbidden" } }); }
    await acknowledgeCallback(config, String(callback.id));
    if (parsed.action === "report" || parsed.action === "weekly") await sendSummary(config, student.id);
    else {
      const report = await buildStudentReport(student.id);
      if (!report) throw new Error("تعذر بناء التقرير");
      const en = (await db.telegramParentPreference.findUnique({ where: { studentId: student.id } }))?.language === "en";
      const text = parsed.action === "attendance" ? (en ? `Attendance status: ${student.isAbsent ? "absent" : "present"}.` : `حالة الحضور: ${student.isAbsent ? "غائب" : "حاضر"}.`) : parsed.action === "achievements" ? (en ? `Achievements and badges: ${report.celebrations.total} celebrations.` : `الإنجازات والاحتفالات: ${report.celebrations.total} احتفال.`) : (en ? "The teacher will contact you through the agreed channel." : "سيتواصل معك المدرس عبر قناة التواصل المتفق عليها.");
      await telegramRequest(config, "sendMessage", { chat_id: chatId, text, reply_markup: makeParentKeyboard(student.id, en ? "en" : "ar") });
    }
    return json({ ok: true, data: { handled: true, action: parsed.action, studentId: student.id } });
  }
  const message = update?.message;
  const chatId = message?.chat?.id == null ? "" : String(message.chat.id);
  const text = typeof message?.text === "string" ? message.text.trim() : "";
  if (!chatId) return json({ ok: true, data: { handled: false } });
  const parsedCommand = parseTelegramCommand(text);
  if (parsedCommand.command === "start") { await telegramRequest(config, "sendMessage", { chat_id: chatId, text: "أهلاً بك في تقارير بسلاسة. أرسل /link ثم كود الطالب لبدء الربط." }); return json({ ok: true, data: { handled: true, action: "start" } }); }
  if (parsedCommand.command === "help") { await telegramRequest(config, "sendMessage", { chat_id: chatId, text: "الأوامر: /start، /help، /link BS-YYYY-CODE، /report، /weekly، /attendance، /achievements، /contact" }); return json({ ok: true, data: { handled: true, action: "help" } }); }
  if (parsedCommand.command === "link" || parsedCommand.argument) {
    const normalized = (parsedCommand.command === "link" ? parsedCommand.argument : text).replace(/^\/link\s+/i, "").trim().toUpperCase();
    const student = normalized ? await db.student.findFirst({ where: { studentCode: normalized } }) : null;
    if (!student) { await telegramRequest(config, "sendMessage", { chat_id: chatId, text: "لم أجد هذا الكود. راجع المدرس وتأكد من كتابته كما هو." }); return json({ ok: true, data: { handled: true, action: "invalid-code" } }); }
    await db.student.update({ where: { id: student.id }, data: { parentTelegramChatId: chatId, parentTelegramUsername: typeof message?.from?.username === "string" ? message.from.username : null } });
    await db.telegramParentPreference.upsert({ where: { studentId: student.id }, create: { studentId: student.id, chatId }, update: { chatId, revision: { increment: 1 } } });
    await telegramRequest(config, "sendMessage", { chat_id: chatId, text: `تم ربط ولي الأمر بالطالب: ${student.name}. ستصل التقارير عند تفعيل الإرسال من المدرس.`, reply_markup: makeParentKeyboard(student.id) }); return json({ ok: true, data: { handled: true, action: "linked", studentId: student.id } });
  }
  const student = await linkedStudent(chatId);
  if (!student) { await telegramRequest(config, "sendMessage", { chat_id: chatId, text: "اربط طالباً أولاً باستخدام /link ثم كود الطالب." }); return json({ ok: true, data: { handled: true, action: "not-linked" } }); }
  if (parsedCommand.command === "report" || parsedCommand.command === "weekly") await sendSummary(config, student.id);
  else if (parsedCommand.command === "attendance" || parsedCommand.command === "achievements" || parsedCommand.command === "contact") await telegramRequest(config, "sendMessage", { chat_id: chatId, text: parsedCommand.command === "attendance" ? `حالة الحضور الحالية: ${student.isAbsent ? "غائب" : "حاضر"}.` : parsedCommand.command === "achievements" ? "يمكنك الضغط على زر التقرير لرؤية ملف الإنجازات المرفق." : "سيتواصل معك المدرس عبر قناة التواصل المتفق عليها.", reply_markup: makeParentKeyboard(student.id) });
  else await telegramRequest(config, "sendMessage", { chat_id: chatId, text: "استخدم /help لرؤية الأوامر المتاحة.", reply_markup: makeParentKeyboard(student.id) });
  return json({ ok: true, data: { handled: true, action: parsedCommand.command, studentId: student.id } });
}
