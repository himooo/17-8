const { authFetch } = require('./lib/api-client.cjs');
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:3012';
const MOCK = 'http://127.0.0.1:3020/v1';
const prefix = `aiqa-${Date.now()}`;
const results = [];
async function req(method, url, body) {
  const response = await authFetch(`${BASE}${url}`, { method, headers: body === undefined ? {} : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, payload };
}
function check(name, condition, detail) { results.push({ name, ok: Boolean(condition), detail }); }
async function main() {
  const invalid = await req('POST', '/api/ai', { action: 'keys.create', provider: 'custom', label: 'bad', key: 'short' });
  check('rejects short AI key', invalid.status === 400 && invalid.payload.ok === false, invalid);
  const missingBase = await req('POST', '/api/ai', { action: 'keys.create', provider: 'custom', label: 'missing-base', key: 'mock-key-good-000000' });
  check('rejects custom key without baseUrl', missingBase.status === 400 && missingBase.payload.ok === false, missingBase);

  const fail = await req('POST', '/api/ai', { action: 'keys.create', provider: 'custom', apiKind: 'openai-compatible', label: `${prefix}-fail`, key: 'mock-key-fail-000000', baseUrl: MOCK, model: 'mock-math-fast', priority: 0, maxConcurrency: 1 });
  const good = await req('POST', '/api/ai', { action: 'keys.create', provider: 'custom', apiKind: 'openai-compatible', label: `${prefix}-good`, key: 'mock-key-good-000000', baseUrl: MOCK, model: 'mock-math-pro', priority: 1, maxConcurrency: 2 });
  check('creates failing custom key', fail.status === 201 && fail.payload.ok === true, fail);
  check('creates healthy custom key', good.status === 201 && good.payload.ok === true, good);
  const failId = fail.payload.data?.id;
  const goodId = good.payload.data?.id;

  const preview = await req('POST', '/api/ai', { action: 'keys.modelsPreview', provider: 'custom', apiKind: 'openai-compatible', key: 'mock-key-good-000000', baseUrl: MOCK });
  check('modelsPreview discovers paginated mock models', preview.status === 200 && preview.payload.ok && preview.payload.data.length === 3 && preview.payload.data.some((m) => m.id === 'mock-math-pro') && preview.payload.data.some((m) => m.id === 'mock-page-2'), preview);
  const models = await req('GET', `/api/ai?resource=models&provider=custom&keyId=${encodeURIComponent(goodId)}`);
  check('persisted key model discovery works', models.status === 200 && models.payload.ok && models.payload.data.length === 3 && models.payload.data.some((m) => m.id === 'mock-page-2'), models);

  const rotation = await req('POST', '/api/ai', { action: 'generate', input: 'اختبار دوران المفاتيح', operation: 'qa-rotation' });
  check('rotation falls through failed key to healthy key', rotation.status === 200 && rotation.payload.ok && rotation.payload.data.keyId === goodId && rotation.payload.data.text === 'جاهز من Mock API', rotation);
  const keysAfterRotation = await req('GET', '/api/ai?resource=keys');
  const failRow = keysAfterRotation.payload.data?.keys?.find((k) => k.id === failId);
  const goodRow = keysAfterRotation.payload.data?.keys?.find((k) => k.id === goodId);
  check('failed key enters cooldown and healthy key records success', failRow?.status === 'cooldown' && failRow.failureCount >= 1 && goodRow?.successCount >= 1, { failRow, goodRow });
  check('keys endpoint never returns encrypted key', !JSON.stringify(keysAfterRotation).includes('encryptedKey'), keysAfterRotation);

  const generated = await req('POST', '/api/ai', { action: 'generate', keyId: goodId, input: 'قل جاهز', systemInstruction: 'اختبار', maxOutputTokens: 128 });
  check('freeform generate returns text', generated.status === 200 && generated.payload.ok && generated.payload.data.text === 'جاهز من Mock API', generated);
  const analyzed = await req('POST', '/api/ai', { action: 'analyzeLesson', keyId: goodId, input: 'حلل الدرس: الكسور والنصف' });
  check('analyzeLesson parses structured JSON', analyzed.status === 200 && analyzed.payload.ok && analyzed.payload.data.result.summary && analyzed.payload.data.result.objectives.length === 1, analyzed);
  const questions = await req('POST', '/api/ai', { action: 'generateQuestions', keyId: goodId, lessonId: 'qa-lesson', count: 2, input: 'أنشئ أسئلة عن الكسور والنصف' });
  check('generateQuestions validates and returns two questions', questions.status === 200 && questions.payload.ok && questions.payload.data.questions.length === 2 && questions.payload.data.rejected.length === 0 && questions.payload.data.questions.every((q) => q.options.includes(q.correctAnswer)), questions);
  const whiteboard = await req('POST', '/api/ai', { action: 'whiteboardAssist', keyId: goodId, input: 'حوّل المسألة إلى عنصر سبورة: 2/4' });
  check('whiteboardAssist parses safe suggestion', whiteboard.status === 200 && whiteboard.payload.ok && whiteboard.payload.data.result.kind === 'equation' && Array.isArray(whiteboard.payload.data.result.steps), whiteboard);
  const tested = await req('POST', '/api/ai', { action: 'keys.test', id: goodId });
  check('keys.test succeeds against mock provider', tested.status === 200 && tested.payload.ok && tested.payload.data.connected === true, tested);
  const usage = await req('GET', '/api/ai?resource=usage');
  check('usage telemetry records successful and failed provider calls', usage.status === 200 && usage.payload.ok && usage.payload.data.some((e) => e.operation === 'qa-rotation' && e.ok === false) && usage.payload.data.some((e) => e.operation === 'qa-rotation' && e.ok === true), usage);

  const emptyGenerate = await req('POST', '/api/ai', { action: 'generate', keyId: goodId, input: '' });
  check('rejects empty generation input', emptyGenerate.status === 400 && emptyGenerate.payload.ok === false, emptyGenerate);
  const invalidAction = await req('POST', '/api/ai', { action: 'unknown-action' });
  check('rejects unknown AI action', invalidAction.status === 400 && invalidAction.payload.ok === false, invalidAction);
  const updated = await req('POST', '/api/ai', { action: 'keys.update', id: goodId, label: `${prefix}-good-updated`, priority: 2, maxConcurrency: 3 });
  check('updates key priority and concurrency', updated.status === 200 && updated.payload.ok && updated.payload.data.priority === 2, updated);
  const reactivated = await req('POST', '/api/ai', { action: 'keys.reactivate', id: failId });
  check('reactivates failed key explicitly', reactivated.status === 200 && reactivated.payload.ok && reactivated.payload.data.status === 'active', reactivated);
  const deletedFail = await req('POST', '/api/ai', { action: 'keys.delete', id: failId });
  check('deletes mock failing key', deletedFail.status === 200 && deletedFail.payload.ok && deletedFail.payload.data.deleted === true, deletedFail);
  const deletedGood = await req('POST', '/api/ai', { action: 'keys.delete', id: goodId });
  check('deletes mock healthy key and cleans fixture', deletedGood.status === 200 && deletedGood.payload.ok && deletedGood.payload.data.deleted === true, deletedGood);

  const summary = { base: BASE, mock: MOCK, total: results.length, passed: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results };
  fs.writeFileSync(path.resolve(process.cwd(), 'qa-ai-mock-e2e.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ total: summary.total, passed: summary.passed, failed: summary.failed, failures: results.filter((r) => !r.ok) }, null, 2));
  process.exitCode = summary.failed ? 1 : 0;
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
