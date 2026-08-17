#!/usr/bin/env node
const { authFetch } = require('./lib/api-client.cjs');
const assert = require("node:assert/strict");
const BASE = process.env.BASE || "http://127.0.0.1:3024";
const suffix = Date.now().toString(36);
const classId = `live_concurrency_class_${suffix}`;
const studentId = `live_concurrency_student_${suffix}`;
const studentCode = `LIVE-${suffix}`;

async function call(op, args = []) {
  const response = await authFetch(`${BASE}/api/db/${op}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ args }) });
  const payload = await response.json();
  assert.equal(response.ok, true, `${op}: ${JSON.stringify(payload)}`);
  assert.equal(payload.ok, true, `${op}: ${JSON.stringify(payload)}`);
  return payload.data;
}
async function live(body) {
  const response = await authFetch(`${BASE}/api/live-sync`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: response.status, payload: await response.json() };
}

(async () => {
  await call("classes.create", [classId, "Live concurrency", "", "#123456"]);
  await call("students.upsert", [studentId, classId, { name: "Live concurrency student", studentCode }]);
  const timestamp = new Date().toISOString();
  const event = { eventId: `same-event-${suffix}`, studentCode, lessonId: "lesson-concurrency", ideaId: "idea-a", isCorrect: true, timestamp };
  const responses = await Promise.all(Array.from({ length: 20 }, () => live(event)));
  const accepted = responses.filter((row) => row.status === 200 && row.payload?.data?.accepted === 1).length;
  const duplicates = responses.reduce((sum, row) => sum + Number(row.payload?.data?.duplicates ?? 0), 0);
  const student = await call("students.list", []);
  const row = student.find((item) => item.id === studentId);
  assert.equal(accepted, 1, JSON.stringify(responses));
  assert.equal(duplicates, 19, JSON.stringify(responses));
  assert.equal(row.attempts, 1);
  assert.equal(row.correctAnswers, 1);
  await call("students.delete", [studentId]);
  await call("classes.delete", [classId]);
  console.log(JSON.stringify({ ok: true, suite: "live-sync-concurrency-smoke", checks: 4, accepted, duplicates, attempts: row.attempts }));
})().catch(async (error) => {
  console.error(error.stack || error);
  try { await call("students.delete", [studentId]); } catch {}
  try { await call("classes.delete", [classId]); } catch {}
  process.exit(1);
});
