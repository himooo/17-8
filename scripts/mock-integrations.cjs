const http = require('http');
const fs = require('fs');
const port = Number(process.env.PORT || 3021);
const requests = [];
const attemptNow = Math.floor(Date.now() / 1000);
function json(res, status, body) { const payload = JSON.stringify(body); res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) }); res.end(payload); }
function readBody(req, done) { let raw = ''; req.on('data', (chunk) => { raw += chunk; }); req.on('end', () => { let body = {}; try { body = raw ? JSON.parse(raw) : {}; } catch {} done(body, raw); }); }
function moodleUsers() {
  const now = Math.floor(Date.now() / 1000);
  return [
    { id: 101, username: 'moodle_ahmed', fullname: 'أحمد Moodle', email: 'ahmed@example.test', lastaccess: now, groups: [{ id: 11, name: '4A' }] },
    { id: 102, username: 'moodle_sara', fullname: 'سارة Moodle', email: 'sara@example.test', lastaccess: 0, groups: [{ id: 12, name: '4B' }] },
    { id: 103, username: 'moodle_layla', fullname: 'ليلى Moodle', email: 'layla@example.test', lastaccess: now, groups: [{ id: 11, name: '4A' }] },
  ];
}
function homeworkQuestions(userId, total = 50) {
  const answeredLimit = userId === 101 ? 45 : userId === 103 ? 12 : 0;
  const correctLimit = userId === 101 ? 40 : userId === 103 ? 8 : 0;
  return Array.from({ length: total }, (_, index) => {
    const q = index + 1;
    const answered = q <= answeredLimit;
    const correct = answered && q <= correctLimit;
    const tags = q <= 15 ? ['bisalasa:idea:lesson03:idea01'] : q <= 30 ? ['bisalasa:idea:lesson03:idea02'] : [];
    return { questionid: q, answer: answered ? `إجابة-${q}` : null, correct, isanswered: answered, points: correct ? 1 : 0, tags };
  });
}
function quizAttempt(quizId, userId) {
  if (userId === 102) return [];
  if (quizId === 701) return [{ id: 701000 + userId, userid: userId, quiz: quizId, state: 'finished', timestart: attemptNow - 120, timefinish: attemptNow, questions: [
    { questionid: 7101, answer: 'أ', correct: userId === 101, isanswered: true, points: userId === 101 ? 1 : 0 },
    { questionid: 7102, answer: 'ب', correct: true, isanswered: true, points: 1 },
    { questionid: 7103, answer: userId === 103 ? null : 'ج', correct: userId === 101, isanswered: userId !== 103, points: userId === 101 ? 1 : 0 },
    { questionid: 7104, answer: 'د', correct: false, isanswered: true, points: 0 },
  ] }];
  if (quizId === 702) return [{ id: 702000 + userId, userid: userId, quiz: quizId, state: 'finished', timestart: attemptNow - 900, timefinish: attemptNow, questioncount: 50, questions: homeworkQuestions(userId, 50) }];
  return [];
}
function assignmentSubmission(assignmentId, userId) {
  if (userId === 102) return [];
  const questions = homeworkQuestions(userId, 50);
  return [{ id: 801000 + userId, userid: userId, assignmentid: assignmentId, status: userId === 103 ? 'draft' : 'submitted', grade: userId === 101 ? 40 : 8, maxgrade: 50, timemodified: attemptNow, questioncount: 50, questions }];
}
function telegram(path, body) {
  const method = path.split('/').pop();
  if (method === 'getMe') return { ok: true, result: { id: 999, is_bot: true, first_name: 'Bisalasa QA Bot', username: 'bisalasa_qa_bot' } };
  if (method === 'getWebhookInfo') return { ok: true, result: { url: 'https://qa.example.test/telegram', pending_update_count: 0 } };
  if (method === 'setWebhook') return { ok: true, result: true };
  if (method === 'deleteWebhook') return { ok: true, result: true };
  if (method === 'sendMessage') return { ok: true, result: { message_id: 1, chat: { id: body.chat_id }, text: body.text } };
  if (method === 'sendDocument') return { ok: true, result: { message_id: 2, document: { file_id: 'qa-pdf' } } };
  return { ok: false, description: `unknown mock telegram method ${method}` };
}
const server = http.createServer((req, res) => {
  const entry = { method: req.method, url: req.url, authorization: req.headers.authorization || '', secret: req.headers['x-telegram-bot-api-secret-token'] || '' };
  requests.push(entry);
  fs.writeFileSync('/tmp/bisalasa-mock-integrations-requests.json', JSON.stringify(requests, null, 2));
  if (/^\/bot[^/]+\//.test(req.url || '')) return readBody(req, (body) => json(res, 200, telegram(req.url, body)));
  if (req.url?.startsWith('/moodle/webservice/rest/server.php')) {
    const params = new URL(`http://mock${req.url}`).searchParams;
    if (params.get('wstoken') !== 'moodle-token-qa') return json(res, 200, { exception: 'invalid_token', errorcode: 'invalidtoken', message: 'invalid token' });
    const fn = params.get('wsfunction');
    if (fn === 'core_webservice_get_site_info') return json(res, 200, { sitename: 'Moodle QA', userid: 77 });
    if (fn === 'core_course_get_courses') return json(res, 200, [{ id: 77, fullname: 'رابعة ابتدائي رياضيات', shortname: 'G4-MATH', summary: 'محتوى مشترك لكل الفصول' }]);
    if (fn === 'core_course_get_contents') return json(res, 200, [
      { id: 11, name: 'الباب الأول — الكسور', section: 1, visible: 1, modules: [{ id: 701, instance: 701, modname: 'quiz', name: 'النشاط التفاعلي — الفكرة 1', visible: 1 }] },
      { id: 12, name: 'الباب الثاني — الواجب', section: 2, visible: 1, modules: [{ id: 702, instance: 702, modname: 'quiz', name: 'واجب الدرس الكامل', visible: 1 }] },
    ]);
    if (fn === 'core_group_get_course_groups') return json(res, 200, [{ id: 11, name: '4A', courseid: 77 }, { id: 12, name: '4B', courseid: 77 }]);
    if (fn === 'core_enrol_get_enrolled_users') return json(res, 200, moodleUsers());
    if (fn === 'mod_quiz_get_quizzes_by_courses') return json(res, 200, { quizzes: [{ id: 701, course: 77, name: 'النشاط التفاعلي — الفكرة 1', visible: 1, tags: ['bisalasa:idea:lesson03:idea01'] }, { id: 702, course: 77, name: 'واجب الدرس الكامل', visible: 1, tags: ['bisalasa:homework:lesson03'], questioncount: 50 }] });
    if (fn === 'mod_assign_get_assignments') return json(res, 200, { courses: [{ id: 77, assignments: [{ id: 801, name: 'واجب الدرس الكامل', duedate: 0, visible: 1, tags: ['bisalasa:homework:lesson03'] }] }] });
    if (fn === 'mod_quiz_get_user_attempts') { const quizId = Number(params.get('quizid')); const userId = Number(params.get('userid')); return json(res, 200, { attempts: quizAttempt(quizId, userId) }); }
    if (fn === 'mod_quiz_get_attempt_review') { const attemptId = Number(params.get('attemptid')); const quizId = Math.floor(attemptId / 1000); const userId = attemptId % 1000; const attempts = quizAttempt(quizId, userId); return json(res, 200, { questions: attempts[0]?.questions || [] }); }
    if (fn === 'mod_assign_get_submissions') { const assignmentId = Number(params.get('assignmentids[0]')); const userId = Number(params.get('userids[0]')); return json(res, 200, { assignments: [{ assignmentid: assignmentId, submissions: assignmentSubmission(assignmentId, userId) }] }); }
    return json(res, 200, { exception: 'unknown_function', message: 'unknown function' });
  }
  if (req.url === '/custom/api/live-status') return json(res, 200, { payload: { students: [
    { code: 'QA-001', state: 'correct', changed: '2026-08-14T06:00:00.000Z', display: 'أحمد Custom' },
    { code: 'QA-002', state: 'wrong', changed: '2026-08-14T06:01:00.000Z', display: 'سارة Custom' },
    { code: 'QA-003', state: 'active', changed: '2026-08-14T06:02:00.000Z', display: 'ليلى Custom' },
  ] } });
  if (req.url === '/custom/api/fail') return json(res, 503, { error: 'custom unavailable' });
  return json(res, 404, { error: 'mock integration route not found' });
});
server.listen(port, '127.0.0.1', () => { console.log(`mock-integrations listening on ${port}`); });
setInterval(() => fs.writeFileSync('/tmp/bisalasa-mock-integrations-requests.json', JSON.stringify(requests, null, 2)), 500);
