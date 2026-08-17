const { authFetch } = require('./lib/api-client.cjs');
const assert = require("node:assert/strict");
const BASE = process.env.BASE || "http://127.0.0.1:3012";
const MOCK = "http://127.0.0.1:3020/v1";
async function request(path, body) {
  const response = await authFetch(`${BASE}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: response.status, payload: await response.json().catch(() => ({})) };
}
(async () => {
  const prefix = `limitqa-${Date.now()}`;
  const first = await request("/api/ai", { action: "keys.create", provider: "custom", apiKind: "openai-compatible", label: `${prefix}-first`, key: "mock-key-good-000000", baseUrl: MOCK, model: "mock-math-fast", priority: 0, rpmLimit: 1, dailyLimit: 2 });
  const second = await request("/api/ai", { action: "keys.create", provider: "custom", apiKind: "openai-compatible", label: `${prefix}-second`, key: "mock-key-good-000000", baseUrl: MOCK, model: "mock-math-pro", priority: 1, rpmLimit: 10, dailyLimit: 10 });
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  const firstId = first.payload.data.id;
  const secondId = second.payload.data.id;
  const run1 = await request("/api/ai", { action: "generate", input: "limit test 1", operation: "qa-limit" });
  assert.equal(run1.status, 200);
  assert.equal(run1.payload.data.keyId, firstId);
  const run2 = await request("/api/ai", { action: "generate", input: "limit test 2", operation: "qa-limit" });
  assert.equal(run2.status, 200);
  assert.equal(run2.payload.data.keyId, secondId);
  const keys = await authFetch(`${BASE}/api/ai?resource=keys`).then((response) => response.json());
  const firstRow = keys.data.keys.find((row) => row.id === firstId);
  const secondRow = keys.data.keys.find((row) => row.id === secondId);
  assert.equal(firstRow.successCount, 1);
  assert.equal(secondRow.successCount, 1);
  for (const id of [firstId, secondId]) await request("/api/ai", { action: "keys.delete", id });
  console.log(JSON.stringify({ ok: true, suite: "ai-limits-e2e", checks: 7, firstKeyUsed: firstId, fallbackKeyUsed: secondId, firstRpmLimit: firstRow.rpmLimit, secondSuccessCount: secondRow.successCount }, null, 2));
})().catch((error) => { console.error(error.stack || error); process.exit(1); });
