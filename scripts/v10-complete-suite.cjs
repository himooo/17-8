#!/usr/bin/env node
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const { spawnSync: resolveSpawnSync } = require("node:child_process");

// Windows compatibility: resolve a working python launcher (python3 → python → py)
// and probe bash usability (C:\Windows\System32\bash.exe exists even without WSL).
function resolvePython() {
  for (const candidate of ["python3", "python", "py"]) {
    const probe = resolveSpawnSync(candidate, ["--version"], { encoding: "utf8" });
    if (probe.status === 0) return candidate;
  }
  return null;
}
function bashWorks() {
  const probe = resolveSpawnSync("bash", ["-c", "echo ok"], { encoding: "utf8" });
  return probe.status === 0 && (probe.stdout || "").includes("ok");
}
const pythonBin = resolvePython();
const useBash = bashWorks();
const skipped = [];
// npx is a .cmd shim on Windows — spawnSync can't execute it directly since the
// CVE-2024-27980 mitigations; route through cmd /c instead.
const isWin = process.platform === "win32";
const npxCommand = isWin ? "cmd" : "npx";
const npxArgs = (args) => (isWin ? ["/c", "npx", ...args] : args);
const configuredDatabaseUrl = process.env.DATABASE_URL || `file:${path.join(root, "data", "custom.db")}`;
const baseDatabasePath = configuredDatabaseUrl.startsWith("file:")
  ? path.resolve(root, configuredDatabaseUrl.slice(5))
  : null;
const databaseUrl = baseDatabasePath ? `file:${baseDatabasePath}` : configuredDatabaseUrl;
const mockMoodle = process.env.MOCK_MOODLE || "http://127.0.0.1:3021/moodle";
const telegramBase = process.env.TELEGRAM_API_BASE_URL || "http://127.0.0.1:3021";
const portBase = Number(process.env.SUITE_PORT_BASE || 3050);
const timeoutMs = Number(process.env.SUITE_TIMEOUT_MS || 300_000);
const results = [];
const staticLabels = new Set([
  "master-plan-static-audit", "math", "question-contract", "smart-context", "fairness",
  "whiteboard-games", "settings-ai", "reports-telegram", "rewards-assets", "moodle-security",
]);

const commands = [
  ["master-plan-static-audit", "bash", ["scripts/master_plan_audit.sh"]],
  ["v10-contract-probes", "node", ["scripts/v10-contract-probes.cjs"]],
  ["v10-operational-suite", "node", ["scripts/v10-operational-suite.cjs"]],
  ["math", "node", ["--experimental-strip-types", "scripts/math-engine-smoke.ts"]],
  ["question-contract", "node", ["--experimental-strip-types", "scripts/question-contract-smoke.ts"]],
  ["smart-context", "node", ["--experimental-strip-types", "scripts/smart-context-smoke.ts"]],
  ["ai-mock-e2e", "node", ["scripts/ai-mock-e2e.cjs"]],
  ["ai-limits-e2e", "node", ["scripts/ai-limits-e2e.cjs"]],
  ["integrations-demo-e2e", "node", ["scripts/integrations-demo-e2e.cjs"]],
  ["db-relational-concurrency", "node", ["scripts/db-relational-concurrency-e2e.cjs"]],
  ["student-class-group-e2e", "node", ["scripts/student-class-group-e2e.cjs"]],
  ["fairness", npxCommand, npxArgs(["--yes", "tsx", "scripts/fairness-v10-smoke.ts"])],
  ["whiteboard-games", "node", ["--experimental-strip-types", "scripts/whiteboard-games-v10-smoke.ts"]],
  ["settings-ai", "node", ["--experimental-strip-types", "scripts/settings-ai-v10-smoke.ts"]],
  ["reports-telegram", "node", ["--experimental-strip-types", "scripts/reports-telegram-v10-smoke.ts"]],
  ["rewards-assets", "node", ["scripts/rewards-assets-v13-smoke.cjs"]],
  ["curriculum-factory", "node", ["scripts/curriculum-factory-smoke.cjs"]],
  ["moodle-security", "node", ["--experimental-strip-types", "scripts/moodle-security-smoke.ts"]],
  ["scenario-matrix-25000", "python3", ["scripts/qa_scenario_matrix_extended.py"]],
  ["db-deep-checks", "node", ["scripts/db_deep_checks.cjs"]],
  ["whiteboard-sync", "node", ["scripts/whiteboard-sync-smoke.cjs"]],
  ["live-sync", "node", ["scripts/live-sync-smoke.cjs"]],
  ["live-sync-concurrency", "node", ["scripts/live-sync-concurrency-smoke.cjs"]],
  ["reports-unified", "node", ["scripts/reports-unified-smoke.cjs"]],
  ["reports-large-class", "node", ["scripts/reports-large-class-smoke.cjs"]],
  ["performance-smoke", "node", ["scripts/performance-smoke.cjs"]],
  ["moodle-advanced", "node", ["scripts/moodle-advanced-integration-smoke.cjs"]],
  ["moodle-mapping", "node", ["scripts/moodle-mapping-e2e.cjs"]],
  ["moodle-live", "node", ["scripts/moodle-live-sync-e2e.cjs"]],
  ["moodle-homework", "node", ["scripts/moodle-homework-results-e2e.cjs"]],
  ["settings-ai-api", "node", ["scripts/settings-ai-v10-api-smoke.cjs"]],
  ["reports-telegram-api", "node", ["scripts/reports-telegram-v10-api-smoke.cjs"]],
  ["whiteboard-games-api", "node", ["scripts/whiteboard-games-v10-api-smoke.cjs"]],
];

function childEnv(base, suiteDatabaseUrl) {
  return {
    ...process.env,
    BASE: base,
    TEST_BASE: base,
    DATABASE_URL: suiteDatabaseUrl,
    MOCK_MOODLE: mockMoodle,
    TELEGRAM_API_BASE_URL: telegramBase,
    NODE_ENV: process.env.NODE_ENV || "test",
  };
}

async function waitForHealth(base, timeout = 20_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return true;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return false;
}

async function startQa(port, suiteDatabaseUrl) {
  const server = spawn(process.execPath, [path.join(root, ".next/standalone/server.js")], {
    cwd: root,
    env: { ...process.env, PORT: String(port), NODE_ENV: "test", DATABASE_URL: suiteDatabaseUrl, TELEGRAM_API_BASE_URL: telegramBase },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  server.stdout.on("data", (chunk) => { logs += chunk.toString(); });
  server.stderr.on("data", (chunk) => { logs += chunk.toString(); });
  const base = `http://127.0.0.1:${port}`;
  const ready = await waitForHealth(base);
  if (!ready) {
    server.kill("SIGTERM");
    throw new Error(`QA server failed to start on ${base}: ${logs.slice(-2000)}`);
  }
  return { server, base };
}

async function stopQa(server) {
  if (!server || server.killed) return;
  server.kill("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 100));
  if (!server.killed) server.kill("SIGKILL");
}

async function run(label, command, args, index) {
  const startedAt = Date.now();
  if ((command === "python3" || command === "bash") && !pythonBin && command === "python3") {
    // no python launcher at all — report honestly as skipped
    const result = { label, command: `${command} ${args.join(" ")}`, passed: false, skipped: true, status: null, timedOut: false, durationMs: 0, error: "python not available" };
    skipped.push(label);
    results.push(result);
    console.log(`SKIP | ${label} | python not available`);
    return;
  }
  if (command === "python3" && pythonBin) command = pythonBin;
  if (command === "bash" && !useBash) {
    const result = { label, command: `${command} ${args.join(" ")}`, passed: false, skipped: true, status: null, timedOut: false, durationMs: 0, error: "bash not available (WSL not installed)" };
    skipped.push(label);
    results.push(result);
    console.log(`SKIP | ${label} | bash not available (WSL not installed)`);
    return;
  }
  // SQLite WAL sidecars (-wal/-shm) surviving a previous run would be replayed
  // over the fresh DB copy, resurrecting stale rows across suites/runs.
  const removeDbTree = (filePath) => {
    for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(`${filePath}${suffix}`, { force: true });
  };
  let qa = null;
  let suiteDatabaseUrl = databaseUrl;
  const suiteDatabasePath = baseDatabasePath ? `${baseDatabasePath}.suite-${index}` : null;
  try {
    if (suiteDatabasePath && fs.existsSync(baseDatabasePath)) {
      removeDbTree(suiteDatabasePath);
      fs.copyFileSync(baseDatabasePath, suiteDatabasePath);
      suiteDatabaseUrl = `file:${suiteDatabasePath}`;
    }
    if (!staticLabels.has(label)) qa = await startQa(portBase + index, suiteDatabaseUrl);
    const base = qa?.base || process.env.BASE || "http://127.0.0.1:3040";
    const child = spawnSync(command, args, {
      cwd: root,
      env: childEnv(base, suiteDatabaseUrl),
      encoding: "utf8",
      timeout: timeoutMs,
      maxBuffer: 8 * 1024 * 1024,
    });
    const timedOut = child.error && child.error.code === "ETIMEDOUT";
    const output = `${child.stdout || ""}${child.stderr || ""}`.slice(-20_000);
    const passed = !timedOut && child.status === 0;
    const result = { label, command: `${command} ${args.join(" ")}`, passed, status: child.status, timedOut: Boolean(timedOut), durationMs: Date.now() - startedAt, base, output };
    results.push(result);
    console.log(`${passed ? "PASS" : "FAIL"} | ${label} | ${result.durationMs}ms`);
    if (!passed) console.log(output.slice(-2_500));
  } catch (error) {
    const result = { label, command: `${command} ${args.join(" ")}`, passed: false, status: null, timedOut: false, durationMs: Date.now() - startedAt, error: error instanceof Error ? error.message : String(error) };
    results.push(result);
    console.log(`FAIL | ${label} | ${result.durationMs}ms`);
    console.log(result.error);
  } finally {
    await stopQa(qa?.server);
    if (suiteDatabasePath) removeDbTree(suiteDatabasePath);
  }
}

async function main() {
  for (let index = 0; index < commands.length; index += 1) {
    const [label, command, args] = commands[index];
    await run(label, command, args, index);
  }
  const summary = { ok: results.filter((item) => !item.skipped).every((item) => item.passed), total: results.length, passed: results.filter((item) => item.passed).length, skipped: skipped.length, skippedSuites: skipped, failed: results.filter((item) => !item.passed && !item.skipped).length, results };
  const outputPath = process.env.SUITE_OUTPUT || path.join(root, "v10-complete-suite-result.json");
  fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ ok: summary.ok, total: summary.total, passed: summary.passed, failed: summary.failed, outputPath }, null, 2));
  process.exitCode = summary.ok ? 0 : 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
