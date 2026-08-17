const fs = require("node:fs");
const path = require("node:path");

(async () => {
const base = process.env.BASE || "http://127.0.0.1:3030";
const inputPath = path.resolve(process.argv[2] || "/home/ubuntu/bisalasa-demo-import-pack");
const isFile = fs.existsSync(inputPath) && fs.statSync(inputPath).isFile();
const backupPath = isFile ? inputPath : path.join(inputPath, "bisalasa-demo-backup.json");
const packDir = path.dirname(backupPath);
const backup = JSON.parse(fs.readFileSync(backupPath, "utf8"));
const tables = backup.tables;
const checks = [];
function check(name, ok, detail = "") { checks.push({ name, ok: Boolean(ok), detail }); }
function ids(rows) { return new Set((rows || []).map((row) => row.id)); }
async function request(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, body };
}

check("backup version", backup.__version === "6.0-demo", backup.__version);
check("one class", tables.classes.length === 1, tables.classes.length);
check("twelve students", tables.students.length === 12, tables.students.length);
check("three groups", tables.groups.length === 3, tables.groups.length);
check("four lessons", tables.lessons.length === 4, tables.lessons.length);
check("48 questions", tables.questions.length === 48, tables.questions.length);
check("lesson content has slide manifest", tables.lessons.every((lesson) => lesson.content.includes('id="slide-manifest"')), "all lesson HTML");
check("fraction teaching asset exists", fs.existsSync(path.join(packDir, "assets", "fraction-parts.svg")), "assets/fraction-parts.svg");
check("gift images are not empty", tables.studentGifts.concat(tables.giftCatalog || []).every((gift) => typeof (gift.giftImage || gift.image) === "string" && (gift.giftImage || gift.image).length > 0), "local WebP paths");
const lessonIds = ids(tables.lessons);
const studentIds = ids(tables.students);
const gameIds = ids(tables.gameResults);
const celebrationIds = ids(tables.celebrationCatalog);
check("questions reference lessons", tables.questions.every((question) => lessonIds.has(question.lessonId)), "foreign keys");
check("groups reference class", tables.groups.every((group) => group.classId === tables.classes[0].id), "foreign keys");
check("games reference session", tables.gameResults.every((game) => game.sessionId === tables.sessions[0].id), "foreign keys");
check("participants reference students and games", tables.gameParticipants.every((row) => studentIds.has(row.studentId) && gameIds.has(row.gameResultId)), "foreign keys");
check("game questions reference games and lessons", tables.gameQuestions.every((row) => gameIds.has(row.gameResultId) && tables.questions.some((q) => q.id === row.questionId)), "foreign keys");
check("celebrations reference catalog", tables.celebrationEvents.every((event) => celebrationIds.has(event.celebrationId)), "foreign keys");

const restored = await request(`${base}/api/backup`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(backup) });
check("restore API 200", restored.status === 200 && restored.body?.ok === true, JSON.stringify(restored.body));
check("restore counts", restored.body?.data?.restored?.students === 12 && restored.body?.data?.restored?.lessons === 4 && restored.body?.data?.restored?.questions === 48, JSON.stringify(restored.body?.data?.restored));
const exported = await request(`${base}/api/backup?format=json&reason=demo-validation`);
check("backup export 200", exported.status === 200 && exported.body?.tables, String(exported.status));
check("export preserves counts", exported.body?.tables?.students?.length === 12 && exported.body?.tables?.lessons?.length === 4 && exported.body?.tables?.questions?.length === 48, JSON.stringify({ students: exported.body?.tables?.students?.length, lessons: exported.body?.tables?.lessons?.length, questions: exported.body?.tables?.questions?.length }));
const classId = tables.classes[0].id;
const grades = await request(`${base}/grades?classId=${encodeURIComponent(classId)}`);
const gradesText = typeof grades.body === "string" ? grades.body : JSON.stringify(grades.body);
check("grades route 200 after restore", grades.status === 200, String(grades.status));
check("class visible after restore", gradesText.includes("رابعة ابتدائي"), "grades HTML");

const summary = { ok: checks.every((item) => item.ok), checks: checks.length, passed: checks.filter((item) => item.ok).length, failed: checks.filter((item) => !item.ok).length, restore: restored.body, exportCounts: { students: exported.body?.tables?.students?.length, lessons: exported.body?.tables?.lessons?.length, questions: exported.body?.tables?.questions?.length }, checksDetail: checks };
console.log(JSON.stringify(summary, null, 2));
process.exit(summary.ok ? 0 : 1);
})();
