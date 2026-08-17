const { authFetch } = require('./lib/api-client.cjs');
const assert = require("node:assert/strict");
const BASE = process.env.BASE || "http://127.0.0.1:3012";
async function dbPost(operation, args = []) {
  const response = await authFetch(`${BASE}/api/db/${operation}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ args }) });
  const payload = await response.json();
  assert.equal(payload.ok, true, `${operation}: ${JSON.stringify(payload)}`);
  return payload.data;
}
async function live(method, path, body) {
  const response = await authFetch(`${BASE}/api/live-sync${path}`, { method, headers: { "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const payload = await response.json();
  assert.equal(payload.ok, true, `${method} ${path}: ${JSON.stringify(payload)}`);
  return payload.data;
}
(async () => {
  const suffix = Date.now();
  const classId = `live-sync-class-${suffix}`;
  const studentId = `live-sync-student-${suffix}`;
  const studentCode = `live-qa-${suffix}`;
  const lessonId = `live-lesson-${suffix}`;
  await dbPost("classes.create", [classId, "Live Sync QA", "", "#0142A0"]);
  await dbPost("students.upsert", [studentId, classId, { name: "طالب Live QA", studentCode, isAbsent: false }]);
  const timestamp = new Date().toISOString();
  const event = { eventId: `event-${suffix}`, studentCode, lessonId, ideaId: "idea-1", questionId: "q-1", isCorrect: true, timestamp };
  const first = await live("POST", "", event);
  assert.equal(first.accepted, 1);
  assert.equal(first.duplicates, 0);
  const second = await live("POST", "", event);
  assert.equal(second.duplicates, 1);
  assert.equal(second.accepted, 0);
  const feed = await live("GET", `?since=${encodeURIComponent(new Date(Date.now() - 30_000).toISOString())}&lessonId=${encodeURIComponent(lessonId)}`);
  assert.ok(feed.events.some((item) => item.eventId === event.eventId && item.isCorrect === true));
  await dbPost("students.delete", [studentId]);
  await dbPost("classes.delete", [classId]);
  console.log(JSON.stringify({ ok: true, suite: "live-sync-smoke", checks: 8, accepted: first.accepted, duplicateSuppressed: second.duplicates, feedEvents: feed.events.length }, null, 2));
})().catch((error) => { console.error(error.stack || error); process.exit(1); });
