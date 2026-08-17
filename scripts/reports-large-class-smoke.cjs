#!/usr/bin/env node
const { authFetch } = require('./lib/api-client.cjs');
const assert = require("node:assert/strict");
const BASE = process.env.BASE || "http://127.0.0.1:3024";
const suffix = Date.now().toString(36);
const classId = `reports_large_class_${suffix}`;
const count = 100;
const students = Array.from({ length: count }, (_, index) => ({ id: `reports_large_student_${suffix}_${index}`, code: `RL-${suffix}-${index}`, name: `طالب اختبار ${index}` }));
async function call(op, args = []) {
  const response = await authFetch(`${BASE}/api/db/${op}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ args }) });
  const payload = await response.json();
  assert.equal(response.ok, true, `${op}: ${JSON.stringify(payload)}`);
  assert.equal(payload.ok, true, `${op}: ${JSON.stringify(payload)}`);
  return payload.data;
}
(async () => {
  await call("classes.create", [classId, "Large QA class", "performance", "#123456"]);
  try {
    const started = performance.now();
    await Promise.all(students.map((student) => call("students.upsert", [student.id, classId, { name: student.name, studentCode: student.code }])));
    const created = performance.now();
    const report = await call("reports.class", [{ classId, sessionId: null }]);
    const elapsed = Math.round(performance.now() - started);
    assert.equal(report.totals.students, count);
    assert.equal(report.rows.length, count);
    assert.equal(new Set(report.rows.map((row) => row.student?.id)).size, count);
    console.log(JSON.stringify({ ok: true, suite: "reports-large-class-smoke", checks: 5, students: count, upsertMs: Math.round(created - started), reportMs: Math.round(performance.now() - created), totalMs: elapsed, rows: report.rows.length }));
  } finally {
    for (const student of students) { try { await call("students.delete", [student.id]); } catch {} }
    try { await call("classes.delete", [classId]); } catch {}
  }
})().catch((error) => { console.error(error.stack || error); process.exit(1); });
