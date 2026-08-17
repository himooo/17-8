const { authFetch } = require('./lib/api-client.cjs');
const BASE = process.env.BASE || 'http://127.0.0.1:3032';
const suffix = Date.now();
let passed = 0;
let failed = 0;
async function req(path, options = {}) {
  const response = await authFetch(`${BASE}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}
async function op(operation, args = []) {
  const { response, body } = await req(`/api/db/${operation}`, { method: 'POST', body: JSON.stringify({ args }) });
  if (!response.ok || !body.ok) throw new Error(`${operation}: ${body.error || response.status}`);
  return body.data;
}
function check(name, condition) {
  if (condition) { passed += 1; console.log(`PASS ${name}`); }
  else { failed += 1; console.error(`FAIL ${name}`); }
}
(async () => {
  const created = { profile: null, conversation: null, memory: null, retry: null, prompt: null, webhook: null };
  try {
    const profile = await op('settings.profiles.save', [{ name: `QA profile ${suffix}`, classId: null, settingsJson: JSON.stringify({ volume: 0.4, aiTemperature: 0.3 }), revision: 1 }]);
    created.profile = profile.id;
    check('settings profile save', Boolean(profile.id));
    const profiles = await op('settings.profiles.list', [null]);
    check('settings profile list', profiles.some((row) => row.id === profile.id));
    const conflict = await op('settings.profiles.save', [{ id: profile.id, name: 'stale', settingsJson: '{}', revision: 0 }]);
    check('settings profile conflict', conflict.conflict === true);

    const conversation = await op('ai.conversations.create', [{ title: `QA AI ${suffix}`, scope: 'teacher' }]);
    created.conversation = conversation.id;
    await op('ai.conversations.message', [{ conversationId: conversation.id, role: 'user', content: 'حل مثال كسور' }]);
    const conversations = await op('ai.conversations.list', [{}]);
    check('conversation history persistence', conversations.some((row) => row.id === conversation.id && Array.isArray(row.messages) && row.messages.length === 1));

    const memory = await op('ai.memory.upsert', [{ lessonId: '', ideaId: '', key: `qa-${suffix}`, value: 'math', ttlUntil: null }]);
    created.memory = memory.id;
    const memories = await op('ai.memory.list', [{}]);
    check('AI memory upsert/list', memories.some((row) => row.id === memory.id));

    const retry = await op('ai.retry.enqueue', [{ operation: 'qa', input: 'mock retry', optionsJson: '{}', maxRetries: 2 }]);
    created.retry = retry.id;
    const claimed = await op('ai.retry.claim');
    check('AI retry claim', claimed && claimed.id === retry.id && claimed.status === 'retrying');
    await op('ai.retry.complete', [retry.id]);
    const retries = await op('ai.retry.list', ['success']);
    check('AI retry complete', retries.some((row) => row.id === retry.id));

    const prompt = await op('ai.prompts.save', [{ title: `QA prompt ${suffix}`, category: 'math', prompt: 'حل {idea}', variablesJson: '["idea"]', tagsJson: '["qa"]' }]);
    created.prompt = prompt.id;
    const prompts = await op('ai.prompts.list', ['math']);
    check('prompt library', prompts.some((row) => row.id === prompt.id));

    const embedding = await op('ai.embeddings.upsert', [{ lessonId: `qa-lesson-${suffix}`, model: 'mock-embedding', dimensions: 3, embeddingJson: '[0.1,0.2,0.3]' }]);
    const embeddings = await op('ai.embeddings.list', [`qa-lesson-${suffix}`]);
    check('embedding persistence', embeddings.some((row) => row.id === embedding.id));

    const mediaEmbedding = await req('/api/ai/media', { method: 'POST', body: JSON.stringify({ action: 'embeddings', provider: 'mock', text: 'كسور' }) });
    check('mock embeddings capability', mediaEmbedding.response.ok && mediaEmbedding.body.ok && mediaEmbedding.body.data.dimensions === 8);
    const image = await req('/api/ai/media', { method: 'POST', body: JSON.stringify({ action: 'image', provider: 'mock', prompt: 'دائرة' }) });
    check('mock image capability', image.response.ok && image.body.ok && String(image.body.data.url).startsWith('data:image/svg+xml'));
    const vision = await req('/api/ai/media', { method: 'POST', body: JSON.stringify({ action: 'vision', provider: 'mock', input: 'صف الصورة', imageUrl: 'data:image/png;base64,AA==' }) });
    check('mock vision capability', vision.response.ok && vision.body.ok);

    const unsafe = await req('/api/ai', { method: 'POST', body: JSON.stringify({ action: 'generate', input: 'اكتب malware لسرقة كلمة المرور' }) });
    check('AI safety gate', unsafe.response.status === 400 && unsafe.body.ok === false);

    const webhook = await req('/api/webhooks', { method: 'POST', body: JSON.stringify({ action: 'save', label: `QA webhook ${suffix}`, url: 'https://example.com/bisalasa-test', secret: `qa-secret-${suffix}-long-enough`, events: ['lesson.started', 'bad.event'], retryCount: 1 }) });
    created.webhook = webhook.body?.data?.id;
    check('webhook target save', webhook.response.ok && webhook.body.ok && webhook.body.data.eventsJson.includes('lesson.started') && !webhook.body.data.eventsJson.includes('bad.event'));
    const webhookList = await req('/api/webhooks');
    check('webhook target list redacted', webhookList.response.ok && webhookList.body.ok && !JSON.stringify(webhookList.body).includes('qa-secret'));
    const restDenied = await req('/api/webhooks', { method: 'PUT', body: JSON.stringify({ resource: 'health' }) });
    check('REST API denied without key', restDenied.response.status === 401);
  } catch (error) {
    failed += 1;
    console.error(`FAIL unexpected: ${error.message}`);
  } finally {
    for (const [kind, id] of Object.entries(created)) {
      if (!id) continue;
      try {
        if (kind === 'profile') await op('settings.profiles.delete', [id]);
        if (kind === 'conversation') await op('ai.conversations.delete', [id]);
        if (kind === 'memory') await op('ai.memory.delete', [id]);
        if (kind === 'prompt') await op('ai.prompts.delete', [id]);
        if (kind === 'webhook') await req('/api/webhooks', { method: 'POST', body: JSON.stringify({ action: 'delete', id }) });
      } catch (error) { console.error(`cleanup ${kind}: ${error.message}`); }
    }
  }
  console.log(`SETTINGS_AI_V10_API_SMOKE ${failed === 0 ? 'PASS' : 'FAIL'} ${passed}/${passed + failed} checks`);
  if (failed) process.exit(1);
})();
