const http = require('http');
const port = Number(process.env.PORT || 3020);
const models = [
  { id: 'mock-math-fast', owned_by: 'qa-provider', context_length: 8192, supported_actions: ['chat.completions'] },
  { id: 'mock-math-pro', owned_by: 'qa-provider', context_length: 32768, supported_actions: ['chat.completions'] },
];
function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) });
  res.end(payload);
}
function bodyText(body) {
  return (body?.messages || []).map((m) => typeof m.content === 'string' ? m.content : '').join('\n');
}
const server = http.createServer((req, res) => {
  const auth = req.headers.authorization || '';
  if (req.method === 'GET' && req.url === '/v1/models') return json(res, 200, { data: models, nextPageToken: 'page2' });
  if (req.method === 'GET' && req.url === '/v1/models?pageToken=page2') return json(res, 200, { data: [{ id: 'mock-page-2', owned_by: 'qa-provider' }] });
  if (req.method !== 'POST' || req.url !== '/v1/chat/completions') return json(res, 404, { error: { message: 'mock route not found' } });
  if (auth.includes('mock-key-fail-000000')) return json(res, 503, { error: { message: 'mock upstream temporary failure' } });
  if (!auth.includes('mock-key-good-000000')) return json(res, 401, { error: { message: 'mock unauthorized' } });
  let raw = '';
  req.on('data', (chunk) => { raw += chunk; });
  req.on('end', () => {
    let body = {};
    try { body = JSON.parse(raw || '{}'); } catch { return json(res, 400, { error: { message: 'invalid json' } }); }
    const text = bodyText(body);
    let content = 'جاهز من Mock API';
    if (text.includes('حلل الدرس')) {
      content = JSON.stringify({ summary: 'تحليل درس الكسور التجريبي', objectives: ['تمييز الكسر'], concepts: ['البسط والمقام'], risks: ['الخلط بينهما'], activities: ['تمثيل نصف'], suggestedQuestions: ['ما بسط 1/2؟'] });
    } else if (text.includes('أنشئ')) {
      content = JSON.stringify({ questions: [
        { text: 'ما قيمة 1/2؟', correctAnswer: '0.5', options: ['0.25', '0.5', '1', '2'], rewardPoints: 3, difficulty: 'easy', tags: ['fractions'], explanation: 'النصف يساوي 0.5' },
        { text: 'ما بسط 3/4؟', correctAnswer: '3', options: ['3', '4', '7', '1'], rewardPoints: 3, difficulty: 'medium', tags: ['fractions'], explanation: 'البسط هو العدد العلوي' },
      ] });
    } else if (text.includes('عنصر سبورة')) {
      content = JSON.stringify({ kind: 'equation', title: 'تبسيط كسر', text: 'تبسيط 2/4', latex: '\\frac{2}{4}=\\frac{1}{2}', steps: ['اقسم البسط والمقام على 2'], warnings: [] });
    }
    return json(res, 200, { id: 'mock-completion', object: 'chat.completion', choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: content.length } });
  });
});
server.listen(port, '127.0.0.1', () => console.log(`mock-ai-provider listening on ${port}`));
