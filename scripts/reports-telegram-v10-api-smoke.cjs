#!/usr/bin/env node
const assert = require("node:assert/strict");
const { authFetch } = require("./lib/api-client.cjs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const BASE = process.env.BASE || "http://127.0.0.1:3032";
const suffix = Date.now().toString(36);
const classA = `rta_${suffix}`;
const classB = `rtb_${suffix}`;
const studentA = `rsta_${suffix}`;
const studentB = `rstb_${suffix}`;
const studentCode = `BS-2026-${suffix.slice(-6).toUpperCase()}`;

async function api(path, options = {}) { const response = await authFetch(`${BASE}${path}`, { ...options, headers: { "content-type": "application/json", ...(options.headers || {}) } }); const payload = await response.json().catch(() => ({})); assert.equal(response.ok, true, `${path} HTTP ${response.status}: ${JSON.stringify(payload)}`); assert.equal(payload.ok, true, `${path}: ${JSON.stringify(payload)}`); return payload.data; }
async function db(op, args = []) { return api(`/api/db/${op}`, { method: "POST", body: JSON.stringify({ args }) }); }

(async () => {
  await db("classes.create", [classA, "تقارير A", "QA", "#0142A0"]);
  await db("classes.create", [classB, "تقارير B", "QA", "#0f766e"]);
  // C20: points/stats are not writable via students.upsert — seed through the
  // audited award endpoints so reports see real deltas.
  await db("students.upsert", [studentA, classA, { name: "طالب A", studentCode }]);
  await db("students.upsert", [studentB, classB, { name: "طالب B" }]);
  await db("students.awardPoints", [studentA, 20]);
  await db("students.awardPoints", [studentB, 5]);
  await db("students.awardCorrect", [studentA, 3]);
  await db("students.awardCorrect", [studentA, 3]);
  await db("students.awardCorrect", [studentA, 3]);
  await db("students.awardCorrect", [studentA, 3]);
  await db("students.awardWrong", [studentA]);
  // C20: parent chat binding goes through the Telegram link flow only — set the
  // fixture directly (same pattern as moodle-advanced's Prisma seeding).
  await prisma.student.update({ where: { id: studentA }, data: { parentTelegramChatId: "chat-qa" } });
  await db("studentNotes.create", [{ studentId: studentA, text: "يحتاج مراجعة الكسور", isShared: true }]);
  await db("studentActivities.create", [{ studentId: studentA, type: "correct", pointsDelta: 3, description: "أجاب سؤالاً بشكل صحيح" }]);
  const noteSearch = await db("studentNotes.search", [{ studentId: studentA, query: "الكسور", sharedOnly: true }]);
  assert.equal(noteSearch.length, 1);
  const timeline = await db("students.timeline", [{ studentId: studentA, limit: 20 }]);
  assert.ok(timeline.some((row) => row.kind === "note") && timeline.some((row) => row.kind === "activity"));
  await db("attendance.save", [classA, "2026-08-01", [studentA]]);
  await db("attendance.save", [classA, "2026-08-02", []]);
  const attendance = await db("reports.attendance", [{ classId: classA, start: "2026-08-01", end: "2026-08-31" }]);
  assert.equal(attendance.totalDays, 2); assert.equal(attendance.absent, 1); assert.equal(attendance.present, 1);
  const classReport = await db("reports.class", [{ classId: classA }]);
  assert.equal(classReport.rows.length, 1);
  const comparison = await db("reports.compare", [{ classAId: classA, classBId: classB }]);
  assert.equal(comparison.leader, "A");
  const teacher = await db("reports.teacher", [{ classId: classA }]);
  assert.equal(typeof teacher.participationRate, "number");
  const games = await db("reports.games", [{ classId: classA }]);
  assert.equal(typeof games.totalGames, "number");
  const defaults = await db("reports.templates.list", [{ kind: "parent" }]);
  assert.ok(defaults.length >= 1);
  const template = await db("reports.templates.save", [{ name: `QA template ${suffix}`, kind: "parent", language: "en", sections: ["summary", "attendance", "achievements"] }]);
  assert.equal(template.language, "en");
  const conflict = await db("reports.templates.save", [{ id: template.id, revision: 999, name: "conflict", sections: ["summary"] }]);
  assert.equal(conflict.conflict, true);
  const schedule = await db("reports.schedules.save", [{ kind: "telegram-report", frequency: "weekly", enabled: true, classId: classA, nextRunAt: new Date(Date.now() - 1000).toISOString() }]);
  const claimedSchedule = await db("reports.schedules.claim", []);
  assert.equal(claimedSchedule.id, schedule.id);
  await db("reports.schedules.complete", [{ id: schedule.id, enabled: false, nextRunAt: null }]);
  const pref = await db("telegram.preferences.save", [{ studentId: studentA, chatId: "chat-qa", language: "en", sections: ["summary", "attendance"], frequency: "weekly", liveEvents: true, reminders: true }]);
  assert.equal(pref.language, "en");
  const prefRead = await db("telegram.preferences.get", [studentA]);
  assert.equal(prefRead.sections.length, 2);
  const telegramTemplate = await db("telegram.templates.save", [{ name: `QA Telegram ${suffix}`, type: "summary", language: "en", template: "Hello {name} — {points} points", variablesJson: JSON.stringify(["name", "points"]) }]);
  assert.equal(telegramTemplate.language, "en");
  const telegramTemplates = await db("telegram.templates.list", [{ type: "summary", language: "en" }]);
  assert.ok(telegramTemplates.some((row) => row.id === telegramTemplate.id));
  const queue = await db("telegram.queue.enqueue", [{ chatId: "chat-qa", studentId: studentA, method: "sendMessage", payloadJson: JSON.stringify({ chat_id: "chat-qa", text: "QA queue" }), kind: "qa", idempotencyKey: `qa:${suffix}` }]);
  const duplicate = await db("telegram.queue.enqueue", [{ chatId: "chat-qa", studentId: studentA, method: "sendMessage", payloadJson: JSON.stringify({ chat_id: "chat-qa", text: "duplicate" }), kind: "qa", idempotencyKey: `qa:${suffix}` }]);
  assert.equal(duplicate.id, queue.id);
  const claimedQueue = await db("telegram.queue.claim", []); assert.equal(claimedQueue.id, queue.id);
  await db("telegram.queue.complete", [queue.id]);
  const config = await api("/api/telegram", { method: "POST", body: JSON.stringify({ action: "config.save", enabled: true, autoSend: false, schedule: "manual", token: "123:mock" }) });
  assert.equal(config.hasToken, true);
  const event = await api("/api/telegram", { method: "POST", body: JSON.stringify({ action: "notifyEvent", studentId: studentA, text: "QA live event" }) });
  assert.equal(event.sent, true);
  const photo = await api("/api/telegram", { method: "POST", body: JSON.stringify({ action: "sendPhotoCard", studentId: studentA, photoUrl: "https://cdn.example.test/bisalasa-card.png" }) });
  assert.equal(photo.sent, true);
  const processedQueue = await db("telegram.queue.enqueue", [{ chatId: "chat-qa", method: "sendMessage", payloadJson: JSON.stringify({ chat_id: "chat-qa", text: "QA process" }), kind: "qa-process", idempotencyKey: `qa-process:${suffix}` }]);
  const process = await api("/api/telegram", { method: "POST", body: JSON.stringify({ action: "queue.process", limit: 3 }) });
  assert.ok(process.processed >= 1);
  await api("/api/telegram", { method: "POST", body: JSON.stringify({ action: "config.clearToken" }) });
  await db("reports.templates.delete", [template.id]);
  await db("telegram.templates.delete", [telegramTemplate.id]);
  await db("reports.schedules.delete", [schedule.id]);
  await db("classes.delete", [classA]);
  await db("classes.delete", [classB]);
  console.log(JSON.stringify({ ok: true, suite: "reports-telegram-v10-api-smoke", checks: 23, processedQueue: processedQueue.id }));
await prisma.$disconnect();
})().catch((error) => { console.error(error.stack || error); process.exit(1); });
