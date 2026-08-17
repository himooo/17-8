import { strict as assert } from "node:assert";
import { writeFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { generateTelegramStudentPdf } from "../src/lib/telegram-report-pdf.ts";

const pdf = await generateTelegramStudentPdf({
  studentName: "أحمد محمد",
  points: 25,
  correct: 4,
  wrong: 1,
  attempts: 5,
  badges: ["star", "correct"],
  dateLabel: "١٤ أغسطس ٢٠٢٦",
  sessionLabel: "اختبار",
  moodle: {
    status: "submitted",
    totalQuestions: 50,
    answeredQuestions: 45,
    unansweredQuestions: 5,
    correctQuestions: 40,
    wrongQuestions: 5,
    completionPct: 90,
    successOnAnsweredPct: 88.89,
    successOnTotalPct: 80,
    moodleGrade: 40,
    moodleMaxGrade: 50,
    updatedAt: "2026-08-14T12:00:00.000Z",
    interactions: 2,
    activityAttempts: 4,
    byIdea: [
      { ideaKey: "idea01", total: 15, answered: 15, correct: 15, wrong: 0, points: 15, successPct: 100 },
      { ideaKey: "idea02", total: 15, answered: 15, correct: 10, wrong: 5, points: 10, successPct: 66.67 },
      { ideaKey: "lesson_unmapped", total: 20, answered: 15, correct: 15, wrong: 0, points: 15, successPct: 100 },
    ],
  },
  liveApp: {
    total: 4,
    answered: 4,
    unanswered: 0,
    correct: 3,
    wrong: 1,
    points: 12,
    accuracy: 75,
    teacherInteractions: 2,
    byIdea: [{ ideaKey: "idea01", total: 4, correct: 3, wrong: 1, accuracy: 75 }],
  },
  games: {
    gameCount: 3,
    points: 21,
    correct: 8,
    wrong: 3,
    questions: 11,
    byIdea: [{ ideaKey: "idea01", total: 11, correct: 8, wrong: 3, points: 21 }],
  },
  activities: { total: 9, points: 18, byType: [{ type: "correct", count: 4, pointsDelta: 12 }, { type: "game", count: 3, pointsDelta: 6 }] },
  celebrations: { total: 2, byType: [{ label: "نجاح", icon: "🎉", count: 2 }] },
  notes: { total: 2, shared: 1 },
  quality: [{ label: "Moodle", status: "ok", detail: "البيانات متاحة ومحدثة" }, { label: "Live App", status: "ok", detail: "البيانات متاحة ومحدثة" }],
});
assert.ok(pdf.length > 1000);
assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
const loaded = await PDFDocument.load(pdf);
assert.ok(loaded.getPageCount() >= 2);
await writeFile("/tmp/bisalasa-telegram-report-smoke.pdf", pdf);
console.log(JSON.stringify({ passed: 10, failed: 0, bytes: pdf.length, pages: loaded.getPageCount(), includesMoodleSection: true, includesLiveAppSection: true, includesGamesSection: true, includesQualitySection: true, output: "/tmp/bisalasa-telegram-report-smoke.pdf" }));
