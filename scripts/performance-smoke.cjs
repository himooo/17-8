(async () => {
const { authFetch } = require('./lib/api-client.cjs');
const base = process.env.BASE || "http://127.0.0.1:3032";
const samples = Number(process.env.SAMPLES || 10);
const reportClassId = process.env.CLASS_ID || "demo_grade4_math_a";
const results = [];

async function measure(name, url, options = {}) {
  const times = [];
  let lastStatus = 0;
  for (let i = 0; i < samples; i += 1) {
    const started = performance.now();
    const response = await authFetch(url, options);
    await response.arrayBuffer();
    lastStatus = response.status;
    times.push(performance.now() - started);
  }
  times.sort((a, b) => a - b);
  const p50 = times[Math.floor(times.length * 0.5)];
  const p95 = times[Math.min(times.length - 1, Math.ceil(times.length * 0.95) - 1)];
  const avg = times.reduce((sum, value) => sum + value, 0) / times.length;
  const result = { name, status: lastStatus, minMs: Number(times[0].toFixed(2)), p50Ms: Number(p50.toFixed(2)), p95Ms: Number(p95.toFixed(2)), avgMs: Number(avg.toFixed(2)) };
  results.push(result);
  return result;
}

await measure("teacher-shell", `${base}/`);
await measure("student-shell", `${base}/?view=student`);
await measure("grades-all", `${base}/grades`);
await measure("grades-class", `${base}/grades?classId=${encodeURIComponent(reportClassId)}`);
await measure("classes-api", `${base}/api/db/classes.list`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ args: [] }) });
await measure("report-class-api", `${base}/api/db/reports.class`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ args: [{ classId: reportClassId }] }) });

const limits = {
  "teacher-shell": 1500,
  "student-shell": 1000,
  "grades-all": 1500,
  "grades-class": 1500,
  "classes-api": 500,
  "report-class-api": 1000,
};
const failures = results.filter((result) => result.status !== 200 || result.p95Ms > limits[result.name]);
const summary = { ok: failures.length === 0, base, samples, results, limits, failures };
console.log(JSON.stringify(summary, null, 2));
process.exit(summary.ok ? 0 : 1);
})();
