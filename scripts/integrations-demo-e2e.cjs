const { authFetch } = require('./lib/api-client.cjs');
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:3012';
const results = [];
async function api(method, pathName, body, headers = {}) {
  const response = await authFetch(`${BASE}${pathName}`, { method, headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, payload };
}
function check(name, condition, detail) { results.push({ name, ok: Boolean(condition), detail }); }
async function main() {
  const prefix = `int-${Date.now()}`;
  const classId = `${prefix}-class`;
  const studentId = `${prefix}-student`;
  const code = `${prefix}-code`.toUpperCase();
  let r = await api('POST', '/api/db/classes.create', { args: [classId, 'فصل تكامل خارجي', '', '#123456'] });
  check('fixture class created', r.status === 200 && r.payload.ok, r);
  r = await api('POST', '/api/db/students.upsert', { args: [studentId, classId, { name: 'طالب Telegram QA', studentCode: code }] });
  check('fixture student created with code', r.status === 200 && r.payload.ok, r);
  r = await api('POST', '/api/db/moodleMappings.saveCourse', { args: [{ moodleCourseId: 779, curriculumKey: `${prefix}-curriculum`, label: 'QA Telegram Moodle' }] });
  const courseMapId = r.payload.data?.id;
  r = await api('POST', '/api/db/moodleMappings.saveHomework', { args: [{ courseMapId, moodleActivityId: 879, activityType: 'assignment', curriculumKey: `${prefix}-curriculum`, lessonKey: 'telegram-lesson', externalKey: `bisalasa:homework:${prefix}`, name: 'واجب Telegram QA' }] });
  const homeworkMapId = r.payload.data?.id;
  r = await api('POST', '/api/db/moodleResults.homeworkSnapshotUpsert', { args: [{ homeworkMapId, studentId, moodleUserId: 9001, moodleSubmissionId: 9901, status: 'submitted', totalQuestions: 2, answeredQuestions: 1, correctQuestions: 1, wrongQuestions: 0, moodleGrade: 1, moodleMaxGrade: 2, submittedAt: '2026-08-14T12:00:00.000Z' }] });
  const snapshotId = r.payload.data?.id;
  await api('POST', '/api/db/moodleResults.homeworkQuestionUpsert', { args: [{ snapshotId, moodleQuestionId: 1, curriculumKey: `${prefix}-curriculum`, lessonKey: 'telegram-lesson', ideaKey: 'idea-telegram', isAnswered: true, isCorrect: true, pointsEarned: 1 }] });
  await api('POST', '/api/db/moodleResults.homeworkQuestionUpsert', { args: [{ snapshotId, moodleQuestionId: 2, curriculumKey: `${prefix}-curriculum`, lessonKey: 'telegram-lesson', ideaKey: null, isAnswered: false, isCorrect: null, pointsEarned: 0 }] });
  check('fixture student includes Moodle homework snapshot', Boolean(snapshotId && homeworkMapId), { snapshotId, homeworkMapId });
  r = await api('POST', '/api/live-sync', { eventId: `${prefix}-live-event`, studentCode: code, lessonId: 'telegram-lesson', ideaId: 'idea-telegram', questionId: 'live-q-1', isCorrect: true, timestamp: new Date().toISOString() });
  check('Live App answer is accepted for the linked student', r.status === 200 && r.payload.ok && r.payload.data.accepted === 1, r);

  r = await api('POST', '/api/moodle', { action: 'config.save', enabled: true, baseUrl: 'http://127.0.0.1:3021/moodle', token: 'moodle-token-qa', courseId: 77 });
  check('Moodle config saves encrypted token', r.status === 200 && r.payload.ok && r.payload.data.hasToken === true && !JSON.stringify(r.payload).includes('moodle-token-qa'), r);
  r = await api('POST', '/api/moodle', { action: 'test' });
  check('Moodle test reaches mock site info', r.status === 200 && r.payload.ok && r.payload.data.connected && r.payload.data.siteName === 'Moodle QA', r);
  r = await api('POST', '/api/moodle', { action: 'syncStudents' });
  check('Moodle sync returns three enrolled users', r.status === 200 && r.payload.ok && r.payload.data.count === 3 && r.payload.data.students.some((s) => s.moodleUserId === 101), r);
  r = await api('POST', '/api/moodle', { action: 'liveStatus' });
  check('Moodle liveStatus maps engagement semantics', r.status === 200 && r.payload.ok && r.payload.data.semantics === 'engagement_only' && r.payload.data.statuses.length === 3 && r.payload.data.statuses.some((s) => s.status === 'waiting'), r);
  r = await api('POST', '/api/moodle', { action: 'config.save', enabled: true, baseUrl: 'http://127.0.0.1:3021/moodle', token: 'wrong-token-qa', courseId: 77 });
  check('Moodle wrong token config can be saved for failure test', r.status === 200 && r.payload.ok, r);
  r = await api('POST', '/api/moodle', { action: 'test' });
  check('Moodle failure becomes safe 502 and records error', r.status === 502 && r.payload.ok === false, r);
  r = await api('POST', '/api/moodle', { action: 'config.reset' });
  check('Moodle reset clears token config', r.status === 200 && r.payload.ok && r.payload.data.hasToken === false, r);

  r = await api('POST', '/api/custom-sync', { action: 'config.save', enabled: true, baseUrl: 'http://127.0.0.1:3021', endpointPath: '/custom/api/live-status', method: 'GET', itemsPath: 'payload.students', idField: 'code', statusField: 'state', updatedAtField: 'changed', labelField: 'display', authHeader: 'Authorization', authScheme: 'Bearer', token: 'custom-token-qa' });
  check('Custom App config saves field mapping', r.status === 200 && r.payload.ok && r.payload.data.itemsPath === 'payload.students' && r.payload.data.hasToken === true, r);
  r = await api('POST', '/api/custom-sync', { action: 'test' });
  check('Custom App test maps three external records', r.status === 200 && r.payload.ok && r.payload.data.connected && r.payload.data.count === 3, r);
  r = await api('POST', '/api/custom-sync', { action: 'pull' });
  check('Custom App pull normalizes correct/wrong/active statuses', r.status === 200 && r.payload.ok && r.payload.data.statuses.length === 3 && r.payload.data.statuses.some((s) => s.status === 'correct') && r.payload.data.statuses.some((s) => s.status === 'wrong') && r.payload.data.statuses.some((s) => s.status === 'waiting'), r);
  r = await api('POST', '/api/custom-sync', { action: 'config.save', enabled: true, baseUrl: 'http://127.0.0.1:3021', endpointPath: '/custom/api/fail', method: 'GET', itemsPath: 'payload.students', idField: 'code', statusField: 'state', updatedAtField: 'changed', labelField: 'display', authHeader: 'Authorization', authScheme: 'Bearer', token: 'custom-token-qa' });
  check('Custom App failure fixture saves', r.status === 200 && r.payload.ok, r);
  r = await api('POST', '/api/custom-sync', { action: 'pull' });
  check('Custom App failure returns safe 502', r.status === 502 && r.payload.ok === false, r);
  r = await api('POST', '/api/custom-sync', { action: 'config.reset' });
  check('Custom App reset clears configuration', r.status === 200 && r.payload.ok && r.payload.data.hasToken === false, r);

  r = await api('POST', '/api/telegram', { action: 'config.save', enabled: true, autoSend: false, schedule: 'manual', token: 'QA_TOKEN' });
  check('Telegram config saves encrypted token without returning it', r.status === 200 && r.payload.ok && r.payload.data.hasToken === true && !JSON.stringify(r.payload).includes('QA_TOKEN'), r);
  r = await api('POST', '/api/telegram', { action: 'test' });
  check('Telegram test reaches mock getMe', r.status === 200 && r.payload.ok && r.payload.data.connected && r.payload.data.username === 'bisalasa_qa_bot', r);
  r = await api('POST', '/api/telegram', { action: 'students.codes', classId });
  check('Telegram generates/returns student code safely', r.status === 200 && r.payload.ok && r.payload.data.some((s) => s.id === studentId && s.studentCode === code), r);
  r = await api('POST', '/api/telegram', { action: 'webhook.set', webhookUrl: 'https://qa.example.test/telegram', secret: 'QaSecret_123' });
  check('Telegram webhook set stores only safe config', r.status === 200 && r.payload.ok && r.payload.data.webhookUrl === 'https://qa.example.test/telegram' && !JSON.stringify(r.payload).includes('QaSecret_123'), r);
  r = await api('POST', '/api/telegram', { message: { chat: { id: 555 }, text: code, from: { username: 'parent_qa' } } }, { 'x-telegram-bot-api-secret-token': 'wrong-secret' });
  check('Telegram rejects wrong webhook secret', r.status === 401 && r.payload.ok === false, r);
  r = await api('POST', '/api/telegram', { message: { chat: { id: 555 }, text: '/start', from: { username: 'parent_qa' } } }, { 'x-telegram-bot-api-secret-token': 'QaSecret_123' });
  check('Telegram /start is handled through mock sendMessage', r.status === 200 && r.payload.ok && r.payload.data.action === 'start', r);
  r = await api('POST', '/api/telegram', { message: { chat: { id: 555 }, text: 'INVALID-CODE', from: { username: 'parent_qa' } } }, { 'x-telegram-bot-api-secret-token': 'QaSecret_123' });
  check('Telegram invalid student code is handled safely', r.status === 200 && r.payload.ok && r.payload.data.action === 'invalid-code', r);
  r = await api('POST', '/api/telegram', { message: { chat: { id: 555 }, text: code, from: { username: 'parent_qa' } } }, { 'x-telegram-bot-api-secret-token': 'QaSecret_123' });
  check('Telegram valid code links parent to student', r.status === 200 && r.payload.ok && r.payload.data.action === 'linked' && r.payload.data.studentId === studentId, r);
  r = await api('POST', '/api/telegram', { action: 'sendStudentReport', studentId });
  check('Telegram sends Arabic PDF report with Moodle and Live App analysis', r.status === 200 && r.payload.ok && r.payload.data.sent === true && r.payload.data.pdf === true && r.payload.data.moodleIncluded === true && r.payload.data.liveAppIncluded === true, r);
  r = await api('POST', '/api/telegram', { action: 'config.save', enabled: true, autoSend: true, schedule: 'session' });
  check('Telegram session auto-send config persists', r.status === 200 && r.payload.ok && r.payload.data.enabled === true, r);
  r = await api('POST', '/api/telegram', { action: 'sendSessionReports', autoOnly: true, sessionId: 'qa-session' });
  check('Telegram sendSessionReports sends linked student', r.status === 200 && r.payload.ok && r.payload.data.total >= 1 && r.payload.data.sent >= 1, r);
  r = await api('POST', '/api/telegram', { action: 'webhook.info' });
  check('Telegram webhook info reaches mock', r.status === 200 && r.payload.ok && r.payload.data.pending_update_count === 0, r);
  r = await api('POST', '/api/telegram', { action: 'webhook.delete' });
  check('Telegram webhook delete reaches mock', r.status === 200 && r.payload.ok, r);
  r = await api('POST', '/api/telegram', { action: 'config.clearToken' });
  check('Telegram clearToken disables and removes token', r.status === 200 && r.payload.ok && r.payload.data.hasToken === false && r.payload.data.enabled === false, r);

  const mockRequests = JSON.parse(fs.readFileSync('/tmp/bisalasa-mock-integrations-requests.json', 'utf8'));
  check('mock observed Telegram, Moodle and Custom requests', mockRequests.some((x) => x.url.includes('/getMe')) && mockRequests.some((x) => x.url.includes('/moodle/webservice')) && mockRequests.some((x) => x.url === '/custom/api/live-status'), { count: mockRequests.length });
  const summary = { total: results.length, passed: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results };
  fs.writeFileSync(path.resolve(process.cwd(), 'qa-integrations-demo-e2e.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ total: summary.total, passed: summary.passed, failed: summary.failed, failures: results.filter((r) => !r.ok) }, null, 2));
  process.exitCode = summary.failed ? 1 : 0;
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
