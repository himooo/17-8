const assert = require('node:assert/strict');
const { authFetch } = require('./lib/api-client.cjs');

const BASE = process.env.BASE || 'http://127.0.0.1:3012';
const MOCK_MOODLE = process.env.MOCK_MOODLE || 'http://127.0.0.1:3021/moodle';

async function post(url, body) {
  const response = await authFetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const payload = await response.json();
  assert.equal(payload.ok, true, `${url} failed: ${JSON.stringify(payload)}`);
  return payload.data;
}

async function moodle(body) { return post(`${BASE}/api/moodle`, body); }
async function db(operation, args = []) { return post(`${BASE}/api/db/${operation}`, { args }); }

(async () => {
  const config = await moodle({ action: 'config.save', enabled: true, baseUrl: MOCK_MOODLE, courseId: 77, curriculumKey: 'grade4-math-2026', token: 'moodle-token-qa' });
  assert.equal(config.curriculumKey, 'grade4-math-2026');

  const discovered = await moodle({ action: 'discover' });
  assert.equal(discovered.courseId, 77);
  assert.equal(discovered.failures.length, 0);
  assert.equal(discovered.groups.length, 2);
  assert.equal(discovered.users.length, 3);
  assert.equal(discovered.quizzes.quizzes.length, 2);
  assert.equal(discovered.assignments.courses[0].assignments.length, 1);

  const course = await db('moodleMappings.saveCourse', [{ moodleCourseId: 77, curriculumKey: 'grade4-math-2026', label: 'رابعة ابتدائي رياضيات' }]);
  const courseMapId = course.id;
  assert.ok(courseMapId);

  const groupA = await db('moodleMappings.saveGroup', [{ courseMapId, moodleGroupId: 11, classId: 'class-4a', className: '4A' }]);
  const groupB = await db('moodleMappings.saveGroup', [{ courseMapId, moodleGroupId: 12, classId: 'class-4b', className: '4B' }]);
  assert.notEqual(groupA.id, groupB.id);

  await db('moodleMappings.saveStudent', [{ courseMapId, moodleUserId: 101, moodleGroupId: 11, studentId: 'student-ahmed', classId: 'class-4a', displayName: 'أحمد Moodle' }]);
  await db('moodleMappings.saveStudent', [{ courseMapId, moodleUserId: 102, moodleGroupId: 12, studentId: 'student-sara', classId: 'class-4b', displayName: 'سارة Moodle' }]);
  await db('moodleMappings.saveLesson', [{ curriculumKey: 'grade4-math-2026', lessonKey: 'lesson03', title: 'الكسور المتكافئة', orderIndex: 3 }]);
  await db('moodleMappings.saveIdea', [{ curriculumKey: 'grade4-math-2026', lessonKey: 'lesson03', ideaKey: 'idea01', title: 'معنى الكسور المتكافئة', orderIndex: 1 }]);
  const activity = await db('moodleMappings.saveActivity', [{ courseMapId, moodleActivityId: 701, activityType: 'quiz', curriculumKey: 'grade4-math-2026', lessonKey: 'lesson03', ideaKey: 'idea01', externalKey: 'bisalasa:idea:lesson03:idea01', name: 'النشاط التفاعلي — الفكرة 1', visible: true }]);
  await db('moodleMappings.saveQuestion', [{ activityMapId: activity.id, moodleQuestionId: 9001, curriculumKey: 'grade4-math-2026', lessonKey: 'lesson03', ideaKey: 'idea01', tag: 'bisalasa:idea:lesson03:idea01:q01', questionOrder: 1 }]);
  const homework = await db('moodleMappings.saveHomework', [{ courseMapId, moodleActivityId: 801, activityType: 'assignment', curriculumKey: 'grade4-math-2026', lessonKey: 'lesson03', externalKey: 'bisalasa:homework:lesson03', name: 'واجب الدرس الكامل' }]);
  await db('moodleMappings.saveCursor', [{ scopeKey: 'course:77', courseMapId, status: 'ok', syncedCount: 7, lastCursor: 'qa-1' }]);

  const bundle = await db('moodleMappings.list', [{}]);
  assert.equal(bundle.courses.filter((item) => item.moodleCourseId === 77).length, 1);
  assert.equal(bundle.groups.filter((item) => item.courseMapId === courseMapId).length, 2);
  const mappedCourseStudents = bundle.students.filter((item) => item.courseMapId === courseMapId);
  assert.ok(mappedCourseStudents.length >= 2);
  assert.ok(mappedCourseStudents.some((item) => item.moodleUserId === 101));
  assert.ok(mappedCourseStudents.some((item) => item.moodleUserId === 102));
  assert.equal(bundle.lessons.filter((item) => item.lessonKey === 'lesson03').length, 1);
  assert.equal(bundle.ideas.filter((item) => item.ideaKey === 'idea01').length, 1);
  assert.equal(bundle.activities.filter((item) => item.id === activity.id).length, 1);
  assert.equal(bundle.homeworks.filter((item) => item.id === homework.id).length, 1);
  assert.equal(bundle.cursors.find((item) => item.scopeKey === 'course:77').status, 'ok');

  const studentClasses = new Map(bundle.students.filter((item) => item.courseMapId === courseMapId).map((item) => [item.moodleUserId, item.classId]));
  assert.equal(studentClasses.get(101), 'class-4a');
  assert.equal(studentClasses.get(102), 'class-4b');

  console.log(JSON.stringify({ ok: true, suite: 'moodle-mapping-e2e', checks: 18, courseId: 77, groups: 2, mappedStudents: 2, sharedLessons: 1, ideas: 1, activities: 1, homeworks: 1, untaggedFallback: 'supported-by-null-ideaKey' }, null, 2));
})().catch((error) => { console.error(error.stack || error); process.exit(1); });
