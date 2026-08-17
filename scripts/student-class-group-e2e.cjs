const { authFetch } = require('./lib/api-client.cjs');
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:3012';
const prefix = `qa-${Date.now()}-`;
const results = [];

async function call(op, args = []) {
  const response = await authFetch(`${BASE}/api/db/${encodeURIComponent(op)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ args }),
  });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, payload };
}

function pass(name, detail) { results.push({ name, ok: true, detail }); }
function fail(name, detail) { results.push({ name, ok: false, detail }); }
function assert(name, condition, detail) { condition ? pass(name, detail) : fail(name, detail); }

async function expectOk(name, op, args, predicate = () => true) {
  const result = await call(op, args);
  assert(name, result.status === 200 && result.payload.ok === true && predicate(result.payload.data), { status: result.status, error: result.payload.error });
  return result.payload.data;
}

async function expectReject(name, op, args, expectedStatus = 400) {
  const result = await call(op, args);
  assert(name, result.status === expectedStatus && result.payload.ok === false, { status: result.status, error: result.payload.error });
  return result;
}

async function main() {
  const classA = `${prefix}class-a`;
  const classB = `${prefix}class-b`;
  const classC = `${prefix}class-c`;
  await expectOk('create empty class A', 'classes.create', [classA, 'صف الاختبار A', 'حالات الطلاب', '#0142A0']);
  await expectOk('create empty class B', 'classes.create', [classB, 'صف الاختبار B', '', '#DA151C']);
  await expectOk('create class C for cascade', 'classes.create', [classC, 'صف الحذف', '', '#10b981']);
  const classes = await expectOk('list classes includes all created', 'classes.list', [], (rows) => [classA, classB, classC].every((id) => rows.some((row) => row.id === id)));
  assert('class list is array', Array.isArray(classes), { count: classes.length });

  const orphanId = `${prefix}orphan`;
  await expectOk('create student without class', 'students.upsert', [orphanId, null, { name: 'طالب بلا فصل', studentCode: `${prefix}orphan-code` }]);
  const orphanList = await expectOk('orphan appears in global list', 'students.list', [], (rows) => rows.some((row) => row.id === orphanId && row.classId === null));
  assert('orphan list result is array', Array.isArray(orphanList), { count: orphanList.length });
  await expectOk('move orphan into class A', 'students.update', [orphanId, { classId: classA }], (row) => row.classId === classA);
  await expectOk('move student back to no class', 'students.update', [orphanId, { classId: null }], (row) => row.classId === null);

  const ids = [];
  for (let i = 1; i <= 12; i++) {
    const id = `${prefix}s${i}`; ids.push(id);
    await expectOk(`create class-A student ${i}`, 'students.upsert', [id, classA, { name: `طالب ${i}`, studentCode: `${prefix}code-${i}` }]);
  }
  const classAStudents = await expectOk('listByClass returns 12 class-A students', 'students.listByClass', [classA], (rows) => rows.length === 12);
  assert('all class-A students have class A', classAStudents.every((row) => row.classId === classA), { bad: classAStudents.filter((row) => row.classId !== classA).map((row) => row.id) });
  await expectOk('create same name in different class', 'students.upsert', [`${prefix}same-b`, classB, { name: 'طالب 1', studentCode: `${prefix}same-b` }]);
  await expectOk('duplicate check finds same name in class A', 'students.findByNameInClass', ['طالب 1', classA], (row) => row?.classId === undefined && row?.id === ids[0]);
  await expectOk('duplicate check does not confuse class B record', 'students.findByNameInClass', ['طالب 1', classB], (row) => row?.id === `${prefix}same-b`);
  await expectOk('duplicate check is blank-safe', 'students.findByNameInClass', ['', classA], (row) => row === null);
  await expectReject('duplicate studentCode is rejected', 'students.upsert', [`${prefix}duplicate-code`, classA, { name: 'تكرار كود', studentCode: `${prefix}code-1` }], 400);

  // C20: parentPhone is blocked from students.update (Telegram link flow only)
  await expectOk('update student profile and title', 'students.update', [ids[0], { name: 'طالب 1 معدل', title: 'نجم', parentPhone: '01000000000', unexpectedField: 'must-not-persist' }], (row) => row.name === 'طالب 1 معدل' && row.title === 'نجم' && (row.parentPhone === undefined || row.parentPhone === null));
  const updated = await expectOk('updated student has no unexpected field', 'students.list', [], (rows) => !('unexpectedField' in (rows.find((row) => row.id === ids[0]) || {})));
  assert('updated student is in global list', updated.some((row) => row.id === ids[0]), { id: ids[0] });
  await expectOk('student update with no valid field is safe skip', 'students.update', [ids[0], { unexpectedOnly: true }], (row) => row?.skipped === true && row.reason === 'no_valid_fields');
  await expectOk('move student from A to B', 'students.update', [ids[1], { classId: classB }], (row) => row.classId === classB);
  const afterMoveA = await expectOk('class A count decreases after move', 'students.listByClass', [classA], (rows) => rows.length === 11);
  const afterMoveB = await expectOk('class B contains moved student', 'students.listByClass', [classB], (rows) => rows.some((row) => row.id === ids[1]));
  assert('move counts are consistent', afterMoveA.length === 11 && afterMoveB.some((row) => row.id === ids[1]), { a: afterMoveA.length, b: afterMoveB.length });

  await expectOk('mark one student absent', 'students.setAbsent', [ids[2], true], (row) => row.isAbsent === true);
  await expectOk('set title on present student', 'students.setTitle', [ids[3], 'بطل'], (row) => row.title === 'بطل');
  await expectOk('award points is additive', 'students.awardPoints', [ids[3], 7], (row) => row.points === 7);
  await expectOk('award correct updates counters', 'students.awardCorrect', [ids[3], 3], (row) => row.points === 10 && row.correctAnswers === 1 && row.attempts === 1);
  await expectOk('award wrong updates counters', 'students.awardWrong', [ids[3]], (row) => row.wrongAnswers === 1 && row.attempts === 2);
  await expectOk('award good try updates counters', 'students.awardGoodTry', [ids[3]], (row) => row.points === 11 && row.attempts === 3);
  await expectOk('award badge creates linked record', 'students.awardBadge', [ids[3], 'helper', 'QA badge'], (row) => row.studentId === ids[3]);
  await expectOk('reset session clears lastCalled for class', 'students.resetSession', [classA], (row) => row.count >= 0);
  await expectOk('set absent false restores student', 'students.setAbsent', [ids[2], false], (row) => row.isAbsent === false);

  const split = await expectOk('autoSplit creates requested groups', 'groups.autoSplit', [classA, 3], (rows) => Array.isArray(rows) && rows.length === 3);
  const splitIds = split.flatMap((group) => JSON.parse(group.studentIds || '[]'));
  const expectedActive = new Set(ids.filter((id) => id !== ids[1]));
  assert('autoSplit excludes moved student', !splitIds.includes(ids[1]), { moved: ids[1] });
  assert('autoSplit distributes active class-A students exactly once', splitIds.length === expectedActive.size && new Set(splitIds).size === splitIds.length && splitIds.every((id) => expectedActive.has(id)), { total: splitIds.length, expected: expectedActive.size });
  const customGroup = `${prefix}custom-group`;
  await expectOk('save custom group', 'groups.save', [{ id: customGroup, classId: classA, name: 'مجموعة مخصصة', color: '#123456', groupPoints: 4, studentIds: JSON.stringify([ids[0], ids[2]]) }], (row) => row.id === customGroup && row.groupPoints === 4);
  await expectOk('add group points is additive', 'groups.addPoints', [customGroup, 6], (row) => row.groupPoints === 10);
  await expectOk('list groups for class', 'groups.list', [classA], (rows) => rows.some((row) => row.id === customGroup) && rows.length >= 4);
  await expectReject('autoSplit rejects zero groups', 'groups.autoSplit', [classA, 0], 400);
  await expectReject('autoSplit rejects more than 32 groups', 'groups.autoSplit', [classA, 33], 400);
  await expectReject('autoSplit rejects non-integer groups', 'groups.autoSplit', [classA, 2.5], 400);
  await expectReject('groups.save requires an id', 'groups.save', [{ classId: classA, name: 'bad' }], 400);

  await expectOk('delete student removes it from group JSON', 'students.delete', [ids[0]], (row) => row.id === ids[0]);
  const groupsAfterStudentDelete = await expectOk('group membership cleans deleted student', 'groups.list', [classA], (rows) => rows.every((group) => !JSON.parse(group.studentIds || '[]').includes(ids[0])));
  assert('group cleanup covers all groups', groupsAfterStudentDelete.every((group) => !JSON.parse(group.studentIds || '[]').includes(ids[0])), { groupCount: groupsAfterStudentDelete.length });
  await expectOk('delete custom group', 'groups.delete', [customGroup], (row) => row.id === customGroup);
  await expectOk('delete missing student is safe skip', 'students.delete', [`${prefix}missing`], (row) => row.skipped === true && row.reason === 'student_not_found');
  await expectOk('update missing student is safe skip', 'students.update', [`${prefix}missing`, { name: 'x' }], (row) => row.skipped === true && row.reason === 'student_not_in_sqlite');
  await expectOk('award missing student is safe skip', 'students.awardPoints', [`${prefix}missing`, 5], (row) => row.skipped === true && row.reason === 'student_not_in_db');

  const cascadeStudent = `${prefix}cascade-student`;
  await expectOk('create cascade student', 'students.upsert', [cascadeStudent, classC, { name: 'طالب الحذف', studentCode: `${prefix}cascade-code` }]);
  await expectOk('create cascade group', 'groups.save', [{ id: `${prefix}cascade-group`, classId: classC, name: 'مجموعة الحذف', studentIds: JSON.stringify([cascadeStudent]) }]);
  await expectOk('delete class cascades students and groups', 'classes.delete', [classC], (row) => row.id === classC);
  const cascadeStudents = await expectOk('cascade removed class students', 'students.listByClass', [classC], (rows) => rows.length === 0);
  const cascadeGroups = await expectOk('cascade removed class groups', 'groups.list', [classC], (rows) => rows.length === 0);
  assert('cascade queries return empty arrays', cascadeStudents.length === 0 && cascadeGroups.length === 0, { cascadeStudents, cascadeGroups });

  const invalidStudent = await call('students.upsert', [`${prefix}invalid`, classA, { studentCode: `${prefix}invalid-code` }]);
  assert('student without required name is rejected', invalidStudent.status >= 400 && invalidStudent.payload.ok === false, { status: invalidStudent.status, error: invalidStudent.payload.error });
  await expectOk('delete class A', 'classes.delete', [classA], (row) => row.id === classA);
  await expectOk('delete class B', 'classes.delete', [classB], (row) => row.id === classB);
  await expectOk('delete orphan student', 'students.delete', [orphanId], (row) => row.id === orphanId);

  const summary = { base: BASE, prefix, total: results.length, passed: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results };
  fs.writeFileSync(path.resolve(process.cwd(), 'qa-student-class-group-e2e.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = summary.failed ? 1 : 0;
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
