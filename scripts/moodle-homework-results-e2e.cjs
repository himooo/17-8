const assert = require('node:assert/strict');
const { authFetch } = require('./lib/api-client.cjs');
const BASE = process.env.BASE || 'http://127.0.0.1:3012';
async function post(url, body) {
  const response = await authFetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const payload = await response.json();
  assert.equal(payload.ok, true, `${url}: ${JSON.stringify(payload)}`);
  return payload.data;
}
async function db(op, args = []) { return post(`${BASE}/api/db/${op}`, { args }); }
(async () => {
  const curriculumKey = 'grade4-math-2026';
  const studentAhmedId = `student-ahmed-${Date.now()}`;
  const studentSaraId = `student-sara-${Date.now()}`;
  const sessionId = `qa-session-homework-${Date.now()}`;
  const course = await db('moodleMappings.saveCourse', [{ moodleCourseId: 77, curriculumKey, label: 'رابعة ابتدائي رياضيات' }]);
  const courseMapId = course.id;
  await db('moodleMappings.saveLesson', [{ curriculumKey, lessonKey: 'lesson03', title: 'الكسور المتكافئة' }]);
  await db('moodleMappings.saveIdea', [{ curriculumKey, lessonKey: 'lesson03', ideaKey: 'idea01', title: 'المفهوم الأساسي' }]);
  await db('moodleMappings.saveIdea', [{ curriculumKey, lessonKey: 'lesson03', ideaKey: 'idea02', title: 'التطبيق' }]);
  const homework = await db('moodleMappings.saveHomework', [{ courseMapId, moodleActivityId: 801, activityType: 'assignment', curriculumKey, lessonKey: 'lesson03', externalKey: 'bisalasa:homework:lesson03', name: 'واجب الدرس الكامل' }]);
  const run = await db('moodleResults.ideaRunCreate', [{ sessionId, curriculumKey, lessonKey: 'lesson03', ideaKey: 'idea01' }]);

  for (let q = 1; q <= 50; q += 1) {
    const answered = q <= 45;
    const correct = answered && q <= 40;
    const ideaKey = q <= 15 ? 'idea01' : q <= 30 ? 'idea02' : null;
    await db('moodleResults.homeworkQuestionUpsert', [{ snapshotId: 'pending', moodleQuestionId: 0, curriculumKey, lessonKey: 'lesson03', ideaKey, isAnswered: answered, isCorrect: correct, pointsEarned: correct ? 1 : 0 }]).catch(() => {});
  }

  const snapshotAhmed = await db('moodleResults.homeworkSnapshotUpsert', [{ homeworkMapId: homework.id, studentId: studentAhmedId, moodleUserId: 101, moodleSubmissionId: 5001, status: 'submitted', totalQuestions: 50, answeredQuestions: 45, correctQuestions: 40, wrongQuestions: 5, moodleGrade: 40, moodleMaxGrade: 50, submittedAt: '2026-08-14T12:00:00.000Z' }]);
  for (let q = 1; q <= 50; q += 1) {
    const answered = q <= 45;
    const correct = answered && q <= 40;
    const ideaKey = q <= 15 ? 'idea01' : q <= 30 ? 'idea02' : null;
    await db('moodleResults.homeworkQuestionUpsert', [{ snapshotId: snapshotAhmed.id, moodleQuestionId: q, curriculumKey, lessonKey: 'lesson03', ideaKey, isAnswered: answered, isCorrect: correct, pointsEarned: correct ? 1 : 0, answeredAt: answered ? '2026-08-14T12:00:00.000Z' : null }]);
  }
  const snapshotSara = await db('moodleResults.homeworkSnapshotUpsert', [{ homeworkMapId: homework.id, studentId: studentSaraId, moodleUserId: 102, status: 'not_submitted', totalQuestions: 50, answeredQuestions: 0, correctQuestions: 0, wrongQuestions: 0, moodleGrade: 0, moodleMaxGrade: 50 }]);

  const firstAttempt = await db('moodleResults.ideaAttemptUpsert', [{ ideaRunId: run.id, studentId: studentAhmedId, moodleUserId: 101, moodleAttemptId: 9001, moodleQuestionId: 7011, studentAnswer: 'أ', isCorrect: false, pointsEarned: 0, status: 'answered' }]);
  const secondAttempt = await db('moodleResults.ideaAttemptUpsert', [{ ideaRunId: run.id, studentId: studentAhmedId, moodleUserId: 101, moodleAttemptId: 9001, moodleQuestionId: 7011, studentAnswer: 'ب', isCorrect: true, pointsEarned: 1, status: 'answered' }]);
  assert.equal(firstAttempt.id, secondAttempt.id, 'idea attempt must be idempotent');

  const student = await db('moodleResults.studentSummary', [{ studentId: studentAhmedId }]);
  assert.equal(student.snapshots[0].completionPct, 90);
  assert.equal(student.snapshots[0].successOnAnsweredPct, 88.89);
  assert.equal(student.snapshots[0].successOnTotalPct, 80);
  assert.equal(student.homeworkQuestions.length, 50);
  assert.equal(student.attempts.length, 1);

  const classSummary = await db('moodleResults.classSummary', [{ studentIds: [studentAhmedId, studentSaraId] }]);
  assert.equal(classSummary.byStudent.length, 2);
  assert.equal(classSummary.byStudent.find((row) => row.studentId === studentSaraId).latest.status, 'not_submitted');
  assert.ok(classSummary.byIdea.some((row) => row.ideaKey === 'idea01'));
  assert.ok(classSummary.byIdea.some((row) => row.ideaKey === 'idea02'));
  assert.ok(classSummary.byIdea.some((row) => row.ideaKey === 'lesson_unmapped'));

  console.log(JSON.stringify({ ok: true, suite: 'moodle-homework-results-e2e', checks: 16, totalQuestions: 50, submitted: { studentId: studentAhmedId, completionPct: 90, successOnAnsweredPct: 88.89, successOnTotalPct: 80 }, notSubmitted: { studentId: studentSaraId, status: snapshotSara.status }, ideaBuckets: classSummary.byIdea.map((row) => row.ideaKey) }, null, 2));
})().catch((error) => { console.error(error.stack || error); process.exit(1); });
