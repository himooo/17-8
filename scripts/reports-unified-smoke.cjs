#!/usr/bin/env node
const { authFetch } = require('./lib/api-client.cjs');
const assert = require("node:assert/strict");

const BASE = process.env.BASE || "http://127.0.0.1:3014";
const suffix = Date.now().toString(36);
const classId = `report_class_${suffix}`;
const studentId = `report_student_${suffix}`;
const student2Id = `report_student2_${suffix}`;
const sessionId = null;

async function call(operation, args = []) {
  const response = await authFetch(`${BASE}/api/db/${operation}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ args }),
  });
  const payload = await response.json();
  assert.equal(response.ok, true, `${operation} HTTP ${response.status}: ${JSON.stringify(payload)}`);
  assert.equal(payload.ok, true, `${operation}: ${JSON.stringify(payload)}`);
  return payload.data;
}

(async () => {
  await call("classes.create", [classId, "صف تقارير موحد", "QA", "#0142A0"]);
  // C20: stats are seeded via the audited award endpoints (snapshot baseline 12).
  await call("students.upsert", [studentId, classId, { name: "طالب التقرير", moodleUserId: 900001, moodleUsername: "report_student" }]);
  await call("students.upsert", [student2Id, classId, { name: "طالب ثانٍ", moodleUserId: 900002 }]);
  await call("students.awardPoints", [studentId, 12]);
  const session = await call("sessions.start", [classId, "حصة التقرير الموحد"]);
  const activeSessionId = session.id;
  // Recreate the mid-session deltas (+3 points, +1 correct, +1 wrong, +2 attempts)
  await call("students.awardCorrect", [studentId, 3]);
  await call("students.awardWrong", [studentId]);
  await call("studentActivities.create", [{ studentId, sessionId: activeSessionId, type: "correct", pointsDelta: 2, description: "live-sync: idea-a", metadataJson: JSON.stringify({ ideaId: "idea-a", source: "live" }) }]);
  await call("studentActivities.create", [{ studentId, sessionId: activeSessionId, type: "wrong", pointsDelta: 0, description: "live-sync: idea-a", metadataJson: JSON.stringify({ ideaId: "idea-a", source: "live" }) }]);
  await call("studentActivities.create", [{ studentId, sessionId: activeSessionId, type: "game", pointsDelta: 5, description: "لعبة تحدي الفكرة", metadataJson: JSON.stringify({ gameType: "quiz", ideaId: "idea-a" }) }]);
  const celebration = await call("celebrationEvents.create", [{ studentId, sessionId: activeSessionId, celebrationId: "qa-celebration", celebrationLabel: "نجاح", celebrationIcon: "🎉" }]);
  assert.equal(celebration.studentId, studentId);
  await call("studentNotes.create", [{ studentId, sessionId: activeSessionId, text: "تم التدخل مع الطالب", isShared: true }]);
  const curriculum = await call("moodleMappings.saveCurriculum", [{ curriculumKey: `qa_${suffix}`, academicYear: "2026", grade: "رابعة", subject: "رياضيات", title: "رياضيات QA" }]);
  const courseMap = await call("moodleMappings.saveCourse", [{ moodleCourseId: 990001, curriculumKey: curriculum.curriculumKey, label: "QA Moodle" }]);
  const homeworkMap = await call("moodleMappings.saveHomework", [{ courseMapId: courseMap.id, moodleActivityId: 990002, curriculumKey: curriculum.curriculumKey, lessonKey: "lesson-a", name: "واجب الفكرة" }]);
  const snapshot = await call("moodleResults.homeworkSnapshotUpsert", [{ homeworkMapId: homeworkMap.id, studentId, moodleUserId: 900001, moodleSubmissionId: 990003, status: "submitted", totalQuestions: 4, answeredQuestions: 3, correctQuestions: 2, wrongQuestions: 1, moodleGrade: 8, moodleMaxGrade: 10, sourceUpdatedAt: new Date().toISOString() }]);
  await call("moodleResults.homeworkQuestionUpsert", [{ snapshotId: snapshot.id, moodleQuestionId: 990011, curriculumKey: curriculum.curriculumKey, lessonKey: "lesson-a", ideaKey: "idea-a", isAnswered: true, isCorrect: true, pointsEarned: 3 }]);
  await call("moodleResults.homeworkQuestionUpsert", [{ snapshotId: snapshot.id, moodleQuestionId: 990012, curriculumKey: curriculum.curriculumKey, lessonKey: "lesson-a", ideaKey: null, isAnswered: false, isCorrect: null, pointsEarned: 0 }]);
  const game = await call("gameResults.create", [{ sessionId: activeSessionId, gameType: "quiz", gameMode: "individual", ideaId: "idea-a", questionCount: 2 }]);
  await call("gameResults.addParticipant", [{ gameResultId: game.id, studentId, studentName: "طالب التقرير", pointsEarned: 7, correctCount: 1, wrongCount: 1, isWinner: false }]);
  await call("gameResults.addQuestion", [{ gameResultId: game.id, questionText: "سؤال لعبة", studentId, studentAnswer: "أ", isCorrect: true, pointsEarned: 7 }]);
  const studentReport = await call("reports.student", [{ studentId, sessionId: activeSessionId, classId }]);
  assert.equal(studentReport.student.id, studentId);
  assert.deepEqual(studentReport.local, { points: 3, correct: 1, wrong: 1, attempts: 2, accuracyPct: 50 });
  assert.equal(studentReport.interactive.total, 2);
  assert.equal(studentReport.games.gameCount, 1);
  assert.equal(studentReport.games.points, 7);
  // 3 seeded activities only — server-side award ops do not create activity
  // rows (the client store logs activities for UI-triggered awards).
  assert.equal(studentReport.activities.total, 3);
  assert.equal(studentReport.celebrations.total, 1);
  assert.equal(studentReport.notes.shared, 1);
  assert.equal(studentReport.homework.latest.moodleGrade, 8);
  assert.equal(studentReport.homework.byIdea.length, 2);
  assert.ok(studentReport.quality.some((row) => row.source === "moodle" && row.status === "ok"));
  const classReport = await call("reports.class", [{ classId, sessionId: activeSessionId }]);
  assert.equal(classReport.rows.length, 2);
  const classRow = classReport.rows.find((row) => row.student.id === studentId);
  assert.ok(classRow);
  assert.equal(classRow.games.points, 7);
  assert.equal(classReport.totals.gamePoints, 7);
  assert.equal(classReport.totals.interactiveCorrect, 1);
  assert.equal(classReport.totals.homeworkGradeCount, 1);
  console.log(JSON.stringify({ ok: true, suite: "reports-unified-smoke", checks: 16, student: { interactive: studentReport.interactive.total, games: studentReport.games.points, activities: studentReport.activities.total }, classRows: classReport.rows.length }));
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
