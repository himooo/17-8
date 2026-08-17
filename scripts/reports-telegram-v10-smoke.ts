import assert from "node:assert/strict";
import { buildAttendanceAnalytics, buildComparativeReport, createRateLimiter, DEFAULT_REPORT_TEMPLATES, makeIdempotencyKey, makeParentKeyboard, normalizeReportTemplate, parseTelegramCallback, parseTelegramCommand, parentSections, renderMessageTemplate, retryDelayMs, rowsToCsv } from "../src/lib/reports-telegram-v10.ts";

const checks: string[] = [];
function check(name: string, value: unknown) { assert.ok(value, name); checks.push(name); }

const template = normalizeReportTemplate({ name: "قالب QA", kind: "parent", language: "en", sections: ["summary", "summary", "invalid" as never], revision: 2 }, "parent");
check("template normalization", template.sections.length === 1 && template.language === "en");
check("default templates", DEFAULT_REPORT_TEMPLATES.length >= 4);
check("template rendering", renderMessageTemplate("{name}:{points}:{missing}", { name: "A", points: 4 }) === "A:4:");
check("command parse", parseTelegramCommand("/report@BisalasaBot").command === "report");
check("command link arg", parseTelegramCommand("/link BS-2026-ABCD").argument === "BS-2026-ABCD");
const keyboard = makeParentKeyboard("student_1", "ar");
check("keyboard scope", JSON.stringify(keyboard).includes("weekly:student_1"));
check("callback parse", parseTelegramCallback("attendance:student_1")?.action === "attendance");
check("callback reject", parseTelegramCallback("attendance:student_1:other") === null);
check("retry backoff", retryDelayMs(3) === 240_000);
check("idempotency", makeIdempotencyKey("report", "chat/1", "student/1", "2026-08-15").includes("report:chat_1"));
const limiter = createRateLimiter(2, 1000);
check("rate limit first", limiter("chat", 0));
check("rate limit second", limiter("chat", 1));
check("rate limit rejects third", !limiter("chat", 2));
check("rate limit resets", limiter("chat", 1001));
const prefs = parentSections({ language: "en", sections: ["summary", "unknown" as never], frequency: "weekly", liveEvents: true, reminders: false });
check("parent preference allowlist", prefs.language === "en" && prefs.sections.length === 1 && prefs.liveEvents);
const attendance = buildAttendanceAnalytics([{ studentId: "s1", name: "أ", date: "2026-08-01", status: "present" }, { studentId: "s1", name: "أ", date: "2026-08-02", status: "absent" }, { studentId: "s2", name: "ب", date: "2026-08-01", status: "late" }], { start: "2026-08-01", end: "2026-08-31" });
check("attendance aggregation", attendance.totalDays === 2 && attendance.absent === 1 && attendance.late === 1);
const report = (name: string, points: number) => ({ generatedAt: "2026-08-15", scope: { classId: name, sessionId: null, className: name }, rows: [{ rank: 1, generatedAt: "2026-08-15", scope: { sessionId: null, classId: name, moodleIndependentHomework: true }, student: { id: `${name}-s`, name: "س", classId: name, moodleUserId: null, moodleUsername: null, points, correctAnswers: 1, wrongAnswers: 0, attempts: 1, accuracyPct: 100, title: null, isAbsent: false }, session: { count: 1, id: null, name: null, startedAt: null }, local: { points, correct: 1, wrong: 0, attempts: 1, accuracyPct: 100 }, interactive: { total: 1, answered: 1, unanswered: 0, correct: 1, wrong: 0, points: 1, accuracyPct: 100, byIdea: [], teacherInteractions: 1 }, homework: { latest: null, historyCount: 0, byIdea: [] }, games: { gameCount: 1, points: 2, correct: 1, wrong: 0, questions: 1, byIdea: [] }, activities: { total: 1, points: 1, byType: [], recent: [] }, fairness: { picks: 1, manualPicks: 0, automaticPicks: 1, byIdea: [] }, celebrations: { total: 0, byType: [] }, notes: { total: 0, shared: 0, recent: [] }, quality: [] }], totals: { students: 1, localPoints: points, localCorrect: 1, localWrong: 0, interactiveAnswered: 1, interactiveCorrect: 1, homeworkGradeCount: 0, gamePoints: 2 } });
const comparison = buildComparativeReport(report("A", 8), report("B", 3));
check("comparative report", comparison.leader === "A" && comparison.deltas.averagePoints === 5);
const csv = rowsToCsv(["الاسم", "النقاط"], [["أ,ب", 4]]);
check("csv escaping", csv.includes('"أ,ب"') && csv.endsWith("\r\n"));
console.log(JSON.stringify({ ok: true, suite: "reports-telegram-v10-smoke", checks: checks.length, names: checks }));
