const { authFetch } = require('./lib/api-client.cjs');
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:3012';
const prefix = `rel-${Date.now()}-`;
const results = [];
async function call(op, args = []) {
  const response = await authFetch(`${BASE}/api/db/${encodeURIComponent(op)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ args }) });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, payload };
}
function ok(name, detail) { results.push({ name, ok: true, detail }); }
function bad(name, detail) { results.push({ name, ok: false, detail }); }
function assert(name, condition, detail) { condition ? ok(name, detail) : bad(name, detail); }
async function must(name, op, args, predicate = () => true) {
  const r = await call(op, args);
  assert(name, r.status === 200 && r.payload.ok === true && predicate(r.payload.data), { status: r.status, error: r.payload.error });
  return r.payload.data;
}
async function main() {
  const classId = `${prefix}class`;
  const studentIds = [`${prefix}s1`, `${prefix}s2`, `${prefix}s3`];
  const groupId = `${prefix}group`;
  await must('create relational class', 'classes.create', [classId, 'فصل علاقات QA', '', '#123456']);
  for (let i = 0; i < studentIds.length; i++) await must(`create relational student ${i + 1}`, 'students.upsert', [studentIds[i], classId, { name: `طالب علاقات ${i + 1}`, studentCode: `${prefix}code-${i + 1}` }]);
  const session = await must('start session with class snapshot', 'sessions.start', [classId, 'جلسة علاقات QA'], (s) => s.classId === classId);
  const snapshots = await must('session snapshot contains exactly class students', 'sessions.snapshotStudents', [session.id], (rows) => rows.length === 3 && rows.every((row) => studentIds.includes(row.studentId)));
  assert('snapshot rows are unique per student', new Set(snapshots.map((row) => row.studentId)).size === 3, { ids: snapshots.map((row) => row.studentId) });

  const awardCalls = Array.from({ length: 20 }, () => call('students.awardCorrect', [studentIds[0], 3]));
  const awardResults = await Promise.all(awardCalls);
  assert('20 concurrent awardCorrect requests succeed', awardResults.every((r) => r.status === 200 && r.payload.ok), { statuses: awardResults.map((r) => r.status) });
  const first = await must('concurrent increments are atomic', 'students.findByName', ['طالب علاقات 1', classId], (row) => row.points === 60 && row.correctAnswers === 20 && row.attempts === 20);
  const badges = await must('concurrent awards create 20 badges', 'students.list', [], (rows) => (rows.find((row) => row.id === studentIds[0])?.badges || []).length === 20);
  assert('first student state is returned', !!first, { id: first?.id });
  assert('badge count matches award count', (badges.find((row) => row.id === studentIds[0])?.badges || []).length === 20, {});

  await must('session delta reflects concurrent awards', 'sessions.getStudentDelta', [session.id, studentIds[0]], (data) => data?.delta?.points === 60 && data.delta.correct === 20 && data.delta.attempts === 20);
  await must('attendance creates one record', 'attendance.save', [classId, '2099-01-01', [studentIds[1]]], (row) => row.classId === classId);
  await must('attendance same date updates existing record', 'attendance.save', [classId, '2099-01-01', [studentIds[2]]], (row) => JSON.parse(row.absentStudentIds).length === 1 && JSON.parse(row.absentStudentIds)[0] === studentIds[2]);
  const attendance = await must('attendance list has one record for date', 'attendance.list', [classId], (rows) => rows.filter((row) => row.date === '2099-01-01').length === 1);
  assert('attendance update persists latest absent id', JSON.parse(attendance.find((row) => row.date === '2099-01-01').absentStudentIds)[0] === studentIds[2], {});

  await must('save relational group', 'groups.save', [{ id: groupId, classId, name: 'مجموعة العلاقات', color: '#123456', studentIds: JSON.stringify(studentIds), groupPoints: 0 }]);
  const groupPointCalls = Array.from({ length: 15 }, () => call('groups.addPoints', [groupId, 2]));
  const groupPointResults = await Promise.all(groupPointCalls);
  assert('15 concurrent group point updates succeed', groupPointResults.every((r) => r.status === 200 && r.payload.ok), { statuses: groupPointResults.map((r) => r.status) });
  await must('group points increments are atomic', 'groups.list', [classId], (rows) => rows.find((row) => row.id === groupId)?.groupPoints === 30);

  const game = await must('create game result linked to session', 'gameResults.create', [{ sessionId: session.id, gameType: 'quiz-show', gameMode: 'individual', ideaId: 'fractions', questionCount: 2, configJson: JSON.stringify({ source: 'lesson' }) }]);
  await must('add game participant', 'gameResults.addParticipant', [{ gameResultId: game.id, studentId: studentIds[0], studentName: 'طالب علاقات 1', pointsEarned: 3, correctCount: 1, wrongCount: 0, isWinner: true }]);
  await must('add game question', 'gameResults.addQuestion', [{ gameResultId: game.id, questionText: 'ما نصف 1؟', studentId: studentIds[0], studentAnswer: '1/2', isCorrect: true, pointsEarned: 3 }]);
  const recentGames = await must('recent game includes nested participant and question', 'gameResults.listRecent', [1], (rows) => rows[0]?.participants?.length === 1 && rows[0]?.questions?.length === 1);
  assert('game result relation is nested', recentGames[0].id === game.id, { id: recentGames[0].id });

  const note = await must('create student note', 'studentNotes.create', [{ studentId: studentIds[0], sessionId: session.id, text: 'ملاحظة اختبارية عربية', isShared: false }]);
  await must('list note by student and session', 'studentNotes.listByStudent', [studentIds[0], session.id], (rows) => rows.some((row) => row.id === note.id && row.text === 'ملاحظة اختبارية عربية'));
  await must('mark note shared', 'studentNotes.markShared', [note.id], (row) => row.isShared === true);
  await must('create student activity', 'studentActivities.create', [{ studentId: studentIds[0], sessionId: session.id, type: 'game-correct', pointsDelta: 3, description: 'إجابة صحيحة', metadataJson: JSON.stringify({ gameId: game.id }) }]);
  const aggregate = await must('aggregate activity by type', 'studentActivities.aggregateByType', [studentIds[0], session.id], (rows) => rows.some((row) => row.type === 'game-correct' && row.count === 1 && row.pointsDelta === 3));
  assert('activity aggregate is present', aggregate.some((row) => row.type === 'game-correct'), { aggregate });

  const celebration = await must('create celebration event linked to student/session', 'celebrationEvents.create', [{ studentId: studentIds[0], sessionId: session.id, celebrationId: 'confetti', celebrationLabel: 'كونفيتي', celebrationIcon: '🎉', note: 'اختبار' }]);
  await must('list celebration by student', 'celebrationEvents.listByStudent', [studentIds[0], session.id], (rows) => rows.some((row) => row.id === celebration.id));
  await must('list celebration by session', 'celebrationEvents.listBySession', [session.id], (rows) => rows.some((row) => row.id === celebration.id));

  const gift = await must('save QA gift', 'gifts.save', [{ id: `${prefix}gift`, name: 'هدية QA', category: 'toy', image: '/gifts/star.png', description: 'هدية علاقات' }]);
  await must('award gift to student', 'gifts.awardToStudent', [studentIds[0], gift.id, gift.name, gift.image]);
  await must('list gift by student', 'gifts.listByStudent', [studentIds[0]], (rows) => rows.some((row) => row.giftId === gift.id));
  await must('save QA prize', 'prizes.save', [{ id: `${prefix}prize`, name: 'جائزة QA', color: '#f59e0b', points: 5, type: 'points', icon: '⭐' }]);
  await must('save QA sound', 'sounds.save', [{ id: `${prefix}sound`, name: 'صوت QA', filePath: '/sounds/qa.mp3', celebrationType: 'confetti' }]);
  await must('settings merge preserves existing keys', 'settings.set', [{ backupAutoEnabled: true }]);
  const settings = await must('settings get returns QA flag', 'settings.get', [], (data) => data.backupAutoEnabled === true);
  assert('settings response is object', settings && typeof settings === 'object' && !Array.isArray(settings), { keys: Object.keys(settings).length });
  await must('stats summary includes class students and sessions', 'stats.summary', [classId], (data) => data.students === 3 && data.sessions >= 1 && data.gameResults >= 1);
  await must('end session persists statsJson', 'sessions.end', [session.id, { totalQuestions: 2, correctAnswers: 1, participationCount: 3 }], (row) => row.endedAt && JSON.parse(row.statsJson).totalQuestions === 2);
  await must('session list returns ended session', 'sessions.list', [classId], (rows) => rows.some((row) => row.id === session.id && row.endedAt));

  await must('delete relational class cascades relation rows', 'classes.delete', [classId], (row) => row.id === classId);
  const [studentsAfter, groupsAfter, sessionsAfter, gamesAfter] = await Promise.all([
    call('students.listByClass', [classId]), call('groups.list', [classId]), call('sessions.list', [classId]), call('gameResults.listRecent', [100]),
  ]);
  assert('class deletion removes students', studentsAfter.status === 200 && studentsAfter.payload.data.length === 0, studentsAfter.payload);
  assert('class deletion removes groups', groupsAfter.status === 200 && groupsAfter.payload.data.length === 0, groupsAfter.payload);
  assert('class deletion nulls sessions', sessionsAfter.status === 200 && sessionsAfter.payload.data.every((row) => row.classId !== classId), sessionsAfter.payload);
  assert('class deletion preserves historical game shell and anonymizes student references', gamesAfter.status === 200 && gamesAfter.payload.data.some((row) => row.id === game.id && row.participants.length === 0 && row.questions.every((question) => question.studentId === null)), { game: gamesAfter.payload.data.find((row) => row.id === game.id) });

  const summary = { base: BASE, prefix, total: results.length, passed: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results };
  fs.writeFileSync(path.resolve(process.cwd(), 'qa-db-relational-concurrency.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = summary.failed ? 1 : 0;
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
