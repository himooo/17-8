#!/usr/bin/env node
const os = require("node:os");
const path = require("node:path");
if (!process.env.DATABASE_URL) process.env.DATABASE_URL = "file:" + path.join(os.tmpdir(), "bisalasa-v10-suite.db").replace(/\\/g, "/");
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
const { authFetch } = require("./lib/api-client.cjs");
const BASE = process.env.BASE || "http://127.0.0.1:3040";
const results = [];

async function api(path, body) {
  const response = await authFetch(`${BASE}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, payload };
}
function check(label, passed, detail = {}) {
  results.push({ label, passed, ...detail });
  console.log(`${passed ? "PASS" : "FAIL"} | ${label}`);
}

async function main() {
  const sourceLimit = await api("/api/db/curriculumFactoryDrafts.upsert", { args: [{ title: "V10 limit", sourceText: "أ".repeat(120001), manifestJson: "{}", questionsJson: "[]", stage: 1, status: "draft" }] });
  check("raw lesson text max 120000", sourceLimit.status === 400, { status: sourceLimit.status });

  const overQuestions = Array.from({ length: 501 }, (_, index) => ({ text: `سؤال ${index}`, lessonId: "v10-lesson-1", correctAnswer: "2", options: ["1", "2"] }));
  const questionLimit = await api("/api/db/questions.bulkCreate", { args: [overQuestions] });
  check("bulk question limit 500", questionLimit.status === 400, { status: questionLimit.status });

  const warmTimes = [];
  for (let index = 0; index < 100; index += 1) {
    const started = Date.now();
    const response = await fetch(`${BASE}/api/health?sample=${index}`);
    warmTimes.push(Date.now() - started);
    if (response.status !== 200) break;
  }
  warmTimes.sort((a, b) => a - b);
  const p95 = warmTimes[Math.max(0, Math.ceil(warmTimes.length * 0.95) - 1)] || Infinity;
  check("warm health p95 < 100ms", p95 < 100, { samples: warmTimes.length, p95 });

  const stressClassId = "v10-stress-class";
  await db.classRoom.upsert({ where: { id: stressClassId }, update: { name: "V10 stress" }, create: { id: stressClassId, name: "V10 stress", description: "bounded stress" } });
  await db.student.deleteMany({ where: { id: { startsWith: "v10-stress-student-" } } });
  const students = Array.from({ length: 1000 }, (_, index) => ({ id: `v10-stress-student-${index}`, classId: stressClassId, name: `Stress Student ${index}`, studentCode: `STRESS-${index}` }));
  const started = Date.now();
  await db.student.createMany({ data: students });
  const createMs = Date.now() - started;
  const listed = await db.student.count({ where: { id: { startsWith: "v10-stress-student-" } } });
  check("1000 students direct data-layer stress", listed === 1000 && createMs < 10_000, { count: listed, durationMs: createMs });

  await db.gameResult.deleteMany({ where: { id: { startsWith: "v10-stress-game-" } } });
  const gameStarted = Date.now();
  await db.gameResult.createMany({ data: Array.from({ length: 100 }, (_, index) => ({ id: `v10-stress-game-${index}`, gameType: "quickfire", gameMode: "individual", questionCount: 1 })) });
  const gameMs = Date.now() - gameStarted;
  const games = await db.gameResult.count({ where: { id: { startsWith: "v10-stress-game-" } } });
  check("100 game results data-layer stress", games === 100 && gameMs < 10_000, { count: games, durationMs: gameMs });

  await db.gameResult.deleteMany({ where: { id: { startsWith: "v10-stress-game-" } } });
  await db.student.deleteMany({ where: { id: { startsWith: "v10-stress-student-" } } });
  await db.classRoom.delete({ where: { id: stressClassId } }).catch(() => undefined);

  const summary = { ok: results.every((item) => item.passed), total: results.length, passed: results.filter((item) => item.passed).length, failed: results.filter((item) => !item.passed).length, results };
  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = summary.ok ? 0 : 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
