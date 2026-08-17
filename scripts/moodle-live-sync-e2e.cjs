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
  // Self-seed: each suite runs on an isolated DB copy, so the Moodle config +
  // course-77 maps must exist before syncResults (mirrors moodle-advanced fixture).
  await post(`${BASE}/api/moodle`, { action: 'config.save', enabled: true, baseUrl: process.env.MOCK_MOODLE || 'http://127.0.0.1:3021/moodle', courseId: 77, curriculumKey: 'grade4-math-2026', token: 'moodle-token-qa' });
  const course0 = await db('moodleMappings.saveCourse', [{ moodleCourseId: 77, curriculumKey: 'grade4-math-2026', label: 'QA Moodle', enabled: true }]);
  const activity0 = await db('moodleMappings.saveActivity', [{ courseMapId: course0.id, moodleActivityId: 701, activityType: 'quiz', curriculumKey: 'grade4-math-2026', lessonKey: 'lesson03', ideaKey: 'idea01', name: 'QA activity', visible: true, mappingMode: 'tag', confidence: 1 }]);
  await db('moodleMappings.saveQuestion', [{ activityMapId: activity0.id, moodleQuestionId: 7101, curriculumKey: 'grade4-math-2026', lessonKey: 'lesson03', ideaKey: 'idea01', tag: 'bisalasa:idea:lesson03:idea01' }]);
  // Homework ingestion needs the lesson/idea maps + the assignment (801) homework map.
  await db('moodleMappings.saveLesson', [{ curriculumKey: 'grade4-math-2026', lessonKey: 'lesson03', title: 'الكسور المتكافئة', orderIndex: 3 }]);
  await db('moodleMappings.saveIdea', [{ curriculumKey: 'grade4-math-2026', lessonKey: 'lesson03', ideaKey: 'idea01', title: 'معنى الكسور المتكافئة', orderIndex: 1 }]);
  await db('moodleMappings.saveHomework', [{ courseMapId: course0.id, moodleActivityId: 801, activityType: 'assignment', curriculumKey: 'grade4-math-2026', lessonKey: 'lesson03', externalKey: 'bisalasa:homework:lesson03', name: 'واجب الدرس الكامل' }]);
  for (const moodleUserId of [101, 102, 103]) {
    const studentId = `moodle-qa-student-${moodleUserId}`;
    await db('students.upsert', [studentId, null, { name: `QA ${moodleUserId}` }]);
    await db('moodleMappings.saveStudent', [{ courseMapId: course0.id, moodleUserId, studentId, displayName: `QA ${moodleUserId}`, enabled: true }]);
  }

  const mappings = await db('moodleMappings.list');
  const course = mappings.courses.find((item) => Number(item.moodleCourseId) === 77);
  if (course?.id) await db('moodleMappings.saveCursor', [{ scopeKey: `results:${course.id}`, courseMapId: course.id, lastCursor: null, status: 'never', nextPollMs: 5000, metadataJson: '{}' }]);
  const first = await post(`${BASE}/api/moodle`, { action: 'syncResults' });
  const second = await post(`${BASE}/api/moodle`, { action: 'syncResults' });
  for (const run of [first, second]) {
    assert.equal(run.failures.length, 0);
    assert.ok(run.students >= 2);
  }
  assert.ok((first.attempts >= 4 && first.homeworkSnapshots >= 2 && first.homeworkQuestions >= 50) || first.changed >= 2, `first sync did not process Moodle data: ${JSON.stringify(first)}`);
  if (second.changed === 0) {
    // Core delta contract: unchanged records are skipped, nothing reprocessed.
    // The mock fixture returns exactly 3 unchanged student records per poll.
    assert.ok(second.skipped >= 3, `second delta should skip unchanged records: ${JSON.stringify(second)}`);
    assert.equal(second.attempts, 0);
    assert.equal(second.homeworkSnapshots, 0);
    assert.equal(second.homeworkQuestions, 0);
  } else {
    assert.ok(second.attempts >= 4);
    assert.ok(second.homeworkSnapshots >= 2);
    assert.ok(second.homeworkQuestions >= 50);
  }
  const ahmed = await db('moodleResults.studentSummary', [{ moodleUserId: 101 }]);
  const sara = await db('moodleResults.studentSummary', [{ moodleUserId: 102 }]);
  assert.ok(ahmed.snapshots.some((row) => row.status === 'submitted'));
  assert.ok(ahmed.homeworkQuestions.some((row) => row.ideaKey === 'idea01'));
  assert.ok(ahmed.homeworkQuestions.some((row) => row.ideaKey === 'idea02'));
  assert.ok(ahmed.homeworkQuestions.some((row) => row.ideaKey === null));
  assert.equal(sara.snapshots[0].status, 'not_submitted');
  assert.equal(new Set(ahmed.attempts.map((row) => `${row.ideaRunId || ''}:${row.moodleUserId}:${row.moodleQuestionId}:${row.moodleAttemptId}`)).size, ahmed.attempts.length);
  console.log(JSON.stringify({ ok: true, suite: 'moodle-live-sync-e2e', checks: 12, first, second, ahmed: { snapshots: ahmed.snapshots.length, questionResults: ahmed.homeworkQuestions.length, attempts: ahmed.attempts.length }, sara: { status: sara.snapshots[0].status } }, null, 2));
})().catch((error) => { console.error(error.stack || error); process.exit(1); });
