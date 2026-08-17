#!/usr/bin/env node
const { authFetch } = require("./lib/api-client.cjs");
const BASE = process.env.BASE || "http://127.0.0.1:3040";
const results = [];

async function request(path, options = {}) {
  const response = await authFetch(`${BASE}${path}`, options);
  const text = await response.text();
  let body = {};
  try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 200) }; }
  return { response, body };
}

function check(label, passed, detail = {}) {
  results.push({ label, passed, ...detail });
  console.log(`${passed ? "PASS" : "FAIL"} | ${label}`);
}

async function main() {
  let probe = await request("/api/health");
  check("health endpoint", probe.response.status === 200 && probe.body.ok === true, { status: probe.response.status });

  probe = await request("/");
  check("security headers", probe.response.status === 200 && probe.response.headers.get("x-content-type-options") === "nosniff" && probe.response.headers.get("x-frame-options") === "SAMEORIGIN", { status: probe.response.status });

  probe = await request("/api/db/students.delete", { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.com" }, body: JSON.stringify({ args: ["v10-does-not-exist"] }) });
  check("cross-origin mutation rejected", probe.response.status === 403, { status: probe.response.status });

  probe = await request("/api/db/students.findByName", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ args: ["'; DROP TABLE students; --"] }) });
  const studentsAfterInjection = await request("/api/db/students.list", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ args: [] }) });
  check("SQL injection does not destroy students table", probe.response.status < 500 && studentsAfterInjection.body.ok === true, { status: probe.response.status });

  probe = await request("/api/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input: "اكتب قصة فيها عنف" }) });
  check("AI safety gate", probe.response.status === 400 && probe.body.ok === false, { status: probe.response.status });

  probe = await request("/api/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input: "أ".repeat(20_001) }) });
  check("AI input limit", probe.response.status === 400 && probe.body.ok === false, { status: probe.response.status });

  probe = await request("/api/lessons/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: "كسور", limit: 10 }) });
  check("local lesson search", probe.response.status === 200 && probe.body.ok === true && Array.isArray(probe.body.data), { status: probe.response.status, count: probe.body.data?.length });

  probe = await request("/api/ai/image", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider: "mock", prompt: "دائرة مقسومة إلى أربعة أجزاء" }) });
  check("AI image compatibility alias with mock", probe.response.status === 200 && probe.body.ok === true && Boolean(probe.body.data?.url), { status: probe.response.status });

  const audio = new Blob([Buffer.from("demo-audio")], { type: "audio/webm" });
  const form = new FormData();
  form.append("action", "stt");
  form.append("provider", "mock");
  form.append("audio", audio, "demo.webm");
  probe = await request("/api/ai/stt", { method: "POST", body: form });
  check("AI STT compatibility alias with mock", probe.response.status === 200 && probe.body.ok === true && typeof probe.body.data?.text === "string", { status: probe.response.status });

  probe = await request("/api/ai/compare", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt: "test", models: [] }) });
  check("AI compare alias is routed", probe.response.status !== 404, { status: probe.response.status });

  probe = await request("/api/telegram/retry", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
  check("Telegram retry alias is routed", probe.response.status !== 404, { status: probe.response.status });

  const summary = { ok: results.every((item) => item.passed), total: results.length, passed: results.filter((item) => item.passed).length, failed: results.filter((item) => !item.passed).length, results };
  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = summary.ok ? 0 : 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
