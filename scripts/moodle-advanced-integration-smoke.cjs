const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const os = require('node:os');
const path = require('node:path');
process.env.DATABASE_URL ||= `file:${path.join(os.tmpdir(), 'bisalasa-perf-final.db').replace(/\\/g, '/')}`;
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authFetch } = require('./lib/api-client.cjs');
const BASE = process.env.BASE || 'http://127.0.0.1:3032';
async function seedMoodleMaps() {
  const course = await prisma.moodleCourseMap.upsert({ where: { moodleCourseId_curriculumKey: { moodleCourseId: 77, curriculumKey: 'grade4-math-2026' } }, create: { moodleCourseId: 77, curriculumKey: 'grade4-math-2026', label: 'Moodle QA', enabled: true }, update: { enabled: true } });
  const activity = await prisma.moodleActivityMap.upsert({ where: { courseMapId_moodleActivityId_activityType: { courseMapId: course.id, moodleActivityId: 701, activityType: 'quiz' } }, create: { courseMapId: course.id, moodleActivityId: 701, activityType: 'quiz', curriculumKey: 'grade4-math-2026', lessonKey: 'lesson03', ideaKey: 'idea01', name: 'QA activity', visible: true, mappingMode: 'tag', confidence: 1, sourceFingerprint: 'qa-activity-701' }, update: { visible: true, lessonKey: 'lesson03', ideaKey: 'idea01' } });
  await prisma.moodleQuestionMap.upsert({ where: { activityMapId_moodleQuestionId: { activityMapId: activity.id, moodleQuestionId: 7101 } }, create: { activityMapId: activity.id, moodleQuestionId: 7101, curriculumKey: 'grade4-math-2026', lessonKey: 'lesson03', ideaKey: 'idea01', tag: 'bisalasa:idea:lesson03:idea01' }, update: { ideaKey: 'idea01' } });
  for (const moodleUserId of [101, 102, 103]) {
    const studentId = `moodle-qa-student-${moodleUserId}`;
    await prisma.student.upsert({
      where: { id: studentId },
      create: { id: studentId, name: `QA ${moodleUserId}`, points: 0, correctAnswers: 0, wrongAnswers: 0, attempts: 0 },
      update: { name: `QA ${moodleUserId}` },
    });
    await prisma.moodleStudentMap.upsert({
      where: { courseMapId_moodleUserId: { courseMapId: course.id, moodleUserId } },
      create: { courseMapId: course.id, moodleUserId, studentId, displayName: `QA ${moodleUserId}`, enabled: true },
      update: { studentId, enabled: true },
    });
  }
  return course.id;
}
async function post(path, body, headers = {}) {
  const response = await authFetch(`${BASE}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, payload };
}
async function main() {
  let checks = 0;
  let result = await post('/api/moodle', { action: 'config.save', enabled: true, baseUrl: 'http://127.0.0.1:3021/moodle', courseId: 77, curriculumKey: 'grade4-math-2026', token: 'moodle-token-qa' });
  assert.equal(result.status, 200); assert.equal(result.payload.ok, true); checks += 2;
  result = await post('/api/moodle', { action: 'discover' });
  assert.equal(result.status, 200); assert.equal(result.payload.ok, true); assert.ok(Array.isArray(result.payload.data.sections)); assert.ok(result.payload.data.sections.length >= 2); assert.ok(result.payload.data.activities.length >= 2); const discoveryResult = result.payload.data; checks += 5;
  result = await post('/api/moodle', { action: 'liveStatus' });
  assert.equal(result.payload.ok, true); assert.ok(result.payload.data.nextPollMs >= 5000); checks += 2;
  const liveSecond = await post('/api/moodle', { action: 'liveStatus' });
  assert.equal(liveSecond.payload.ok, true); assert.equal(liveSecond.payload.data.changed, false); assert.ok(liveSecond.payload.data.nextPollMs >= 10000); checks += 3;
  await seedMoodleMaps();
  result = await post('/api/moodle', { action: 'probe' }); assert.equal(result.payload.ok, true); assert.equal(result.payload.data.ok, true); checks += 2;
  result = await post('/api/moodle', { action: 'health' }); assert.equal(result.payload.ok, true); assert.equal(result.payload.data.connectionOk, true); checks += 2;
  result = await post('/api/moodle', { action: 'reconcile' }); assert.equal(result.payload.ok, true); assert.ok(result.payload.data.students); assert.ok(result.payload.data.activities); checks += 3;
  result = await post('/api/moodle', { action: 'syncGroups' }); assert.equal(result.payload.ok, true); assert.ok(typeof result.payload.data.changed === 'number'); checks += 2;
  result = await post('/api/moodle', { action: 'listCourseMaps' }); assert.equal(result.payload.ok, true); assert.ok(result.payload.data.some((item) => item.moodleCourseId === 77)); checks += 2;
  result = await post('/api/moodle', { action: 'syncResults' }); assert.equal(result.payload.ok, true); assert.equal(result.payload.data.courseId, 77); checks += 2;
  const retryEvent = await prisma.moodleSyncEvent.create({ data: { courseId: 77, eventHash: `qa-retry-${Date.now()}`, eventType: 'answer', source: 'test', status: 'accepted', moodleUserId: 999, questionId: 7101, ideaId: 'idea01', metadataJson: '{}' } });
  await prisma.moodleSyncRetry.create({ data: { eventId: retryEvent.id, status: 'pending', retryCount: 0, maxRetries: 1, nextRetryAt: new Date(Date.now() - 1000) } });
  result = await authFetch(`${BASE}/api/moodle/retry`); const retryPayload = await result.json(); assert.equal(result.status, 200); assert.equal(retryPayload.ok, true); assert.ok(retryPayload.results.some((item) => item.eventId === retryEvent.id && item.status === 'dead')); checks += 3;
  const rotated = await post('/api/moodle', { action: 'webhook.rotate' });
  assert.equal(rotated.payload.ok, true); assert.equal(rotated.payload.data.webhookEnabled, true); assert.equal(typeof rotated.payload.data.secretForSetup, 'string'); const secret = rotated.payload.data.secretForSetup; checks += 3;
  const body = JSON.stringify({ courseId: 77, eventType: 'answer', moodleUserId: 101, questionId: 7101, ideaId: 'idea01', studentAnswer: 'أ', isCorrect: true, answeredAt: new Date().toISOString() });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = `sha256=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;
  let webhook = await authFetch(`${BASE}/api/moodle/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-bisalasa-timestamp': timestamp, 'x-bisalasa-signature': signature }, body });
  let webhookPayload = await webhook.json();
  assert.equal(webhook.status, 202); assert.equal(webhookPayload.data.duplicate, false); assert.equal(webhookPayload.data.processed, true); checks += 3;
  const invalidBody = JSON.stringify({ courseId: 77, eventType: 'answer', moodleUserId: 999, questionId: 7101, ideaId: 'idea01', nonce: `invalid-${Date.now()}` });
  const invalidTimestamp = Math.floor(Date.now() / 1000).toString();
  const invalidSignature = `sha256=${createHmac('sha256', secret).update(`${invalidTimestamp}.${invalidBody}`).digest('hex')}`;
  const invalidWebhook = await authFetch(`${BASE}/api/moodle/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-bisalasa-timestamp': invalidTimestamp, 'x-bisalasa-signature': invalidSignature }, body: invalidBody });
  const invalidPayload = await invalidWebhook.json();
  assert.equal(invalidWebhook.status, 400); assert.equal(invalidPayload.data.pendingValidation, true); assert.ok(invalidPayload.details.some((item) => item.includes('not mapped'))); checks += 3;
  webhook = await authFetch(`${BASE}/api/moodle/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-bisalasa-timestamp': timestamp, 'x-bisalasa-signature': signature }, body });
  webhookPayload = await webhook.json();
  assert.equal(webhook.status, 200); assert.equal(webhookPayload.data.duplicate, true); checks += 2;
  webhook = await authFetch(`${BASE}/api/moodle/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-bisalasa-timestamp': timestamp, 'x-bisalasa-signature': 'sha256=invalid' }, body });
  assert.equal(webhook.status, 401); checks += 1;
  console.log(JSON.stringify({ ok: true, suite: 'moodle-advanced-integration-smoke', checks, sections: discoveryResult.sections.length, activities: discoveryResult.activities.length, liveNextPollMs: liveSecond.payload.data.nextPollMs, webhookDuplicateSuppressed: true, validationPending: true, reconciliation: true, healthProbe: true, retryQueue: true }, null, 2));
}
main().catch((error) => { console.error(error.stack || error); process.exit(1); }).finally(() => prisma.$disconnect());
