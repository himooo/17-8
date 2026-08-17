import assert from "node:assert/strict";
import { buildSmartContext } from "../src/lib/smart-context.ts";

const result = buildSmartContext({
  manifest: {
    lessonId: "smart-qa",
    title: "الكسور",
    subtitle: "درس رياضيات",
    currentStep: 2,
    currentIdeaId: "fractions",
    ideas: [{ id: "fractions", title: "تعريف الكسر", steps: [
      { step: 1, title: "البسط", script: "شرح سابق طويل" },
      { step: 2, title: "المقام", script: "شرح حالي" },
    ] }],
  },
  currentStep: 2,
  currentIdeaId: "fractions",
  lessonQuestions: [{ text: "ما البسط؟", ideaId: "fractions", stepNumber: 1, difficulty: "easy" }],
  lessonContext: { "smart-qa": { summary: "درس عن الأجزاء", objectives: ["تمييز البسط والمقام"], commonMistakes: ["عكس العددين"] } },
  students: [{ id: "s1", points: 3, correctAnswers: 1, wrongAnswers: 1, attempts: 2, isAbsent: false }],
  liveStatuses: { "live:s1:fractions": { source: "live", status: "wrong", updatedAt: new Date().toISOString(), ideaId: "fractions", lessonId: "smart-qa", isCorrect: false } },
  teacherNotesAllowed: true,
  studentDataAllowed: false,
  moodle: { officialGrade: 88, studentName: "يجب ألا يظهر" },
  maxChars: 4000,
});
assert.ok(result.text.includes("المقام"));
assert.ok(result.text.includes("الأجزاء"));
assert.ok(result.text.includes("لا أسماء ولا معرفات"));
assert.ok(!result.text.includes("يجب ألا يظهر"));
assert.ok(result.chars <= 4000);
assert.equal(result.payload.class.rosterCount, 1);
console.log(JSON.stringify({ ok: true, suite: "smart-context-smoke", checks: 6, chars: result.chars, truncated: result.truncated }, null, 2));
