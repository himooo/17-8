#!/usr/bin/env node
// One-shot documentation organizer (2026-08-17):
//   docs/active/     <- current authoritative documentation
//   docs/historical/ <- past audit rounds, session logs, artifacts
//   backups/         <- source archives
//   scripts/         <- one-off audit/fix scripts that used to sit in root
// Safe: only moves files; never deletes. public/slides docs stay in place (runtime assets).
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const ACTIVE = new Set([
  'BISALASA-COMPLETE-DOCUMENTATION-AR.md',
  'DOCUMENTATION-INDEX-AR.md',
  'CHANGES.md',
  'bisalasa_final_test_report_ar.md',
  'PERFORMANCE-OPTIMIZATION-REPORT.md',
  'MOODLE-INTEGRATION-REPORT.md',
  'MOODLE-INTEGRATION-DESIGN.md',
  'MOODLE-REGRESSION-RESULTS.md',
  'AI-REPORTS-DATA-GUIDE-AR.md',
  'AI-EXTERNAL-API-RESEARCH-AR.md',
  'moodle-browser-findings-v2.md',
  'CURRICULUM-FACTORY-IMPLEMENTATION-AR.md',
  'FAIRNESS-V10-IMPLEMENTATION-AR.md',
  'WHITEBOARD-GAMES-V10-IMPLEMENTATION-AR.md',
  'SETTINGS-AI-V10-IMPLEMENTATION-AR.md',
  'REPORTS-TELEGRAM-COMPONENTS-V10-IMPLEMENTATION-AR.md',
  'REWARDS-AUDIO-VISUAL-V13-IMPLEMENTATION-AR.md',
  'REWARDS-AUDIO-VISUAL-V13-BRIEF-AR.md',
  'V10-COMPLETE-TEST-SUITE-RESULT-AR.md',
  'V10-SUITE-GAP-MATRIX-AR.md',
]);
// Root code/config that must stay in place
const KEEP = new Set([
  'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml',
  'tsconfig.json', 'next.config.ts', 'tailwind.config.ts', 'postcss.config.mjs',
  'eslint.config.mjs', 'components.json', 'next-env.d.ts', 'Caddyfile',
  '.env', '.env.example',
]);
// Historical artifact extensions in root
const ARTIFACT_EXT = new Set(['.txt', '.json', '.jsonl', '.webp', '.log']);

const HISTORICAL_FOLDERS = ['qa', 'release_v6_pdf', 'updated_prompts_package'];
const ROOT_SCRIPTS = [
  'api_smoke_matrix.sh', 'cleanup_test_records.sh',
  'audit_manifests.py', 'cleanup_orphan_audit_data.py', 'game_logic_audit.py',
  'panel_logic_audit.py', 'replace-stage2.py', 'tsx_brace_audit.py',
  'tsx_token_debug.js', 'verify_final_db.py',
];

const moved = { active: [], historical: [], backups: [], scripts: [], folders: [] };
function moveTo(rel, destDir, list) {
  const src = path.join(root, rel);
  if (!fs.existsSync(src)) return;
  const dstDir = path.join(root, destDir);
  fs.mkdirSync(dstDir, { recursive: true });
  const dst = path.join(dstDir, path.basename(rel));
  if (fs.existsSync(dst)) throw new Error(`destination exists: ${dst}`);
  fs.renameSync(src, dst);
  list.push(`${rel} -> ${destDir}/${path.basename(rel)}`);
}

for (const f of ROOT_SCRIPTS) moveTo(f, 'scripts', moved.scripts);
for (const f of HISTORICAL_FOLDERS) {
  const src = path.join(root, f);
  if (!fs.existsSync(src)) continue;
  fs.mkdirSync(path.join(root, 'docs', 'historical'), { recursive: true });
  fs.renameSync(src, path.join(root, 'docs', 'historical', f));
  moved.folders.push(`${f}/ -> docs/historical/${f}/`);
}
for (const f of fs.readdirSync(root)) {
  const full = path.join(root, f);
  const st = fs.statSync(full);
  if (!st.isFile()) continue;
  const ext = path.extname(f).toLowerCase();
  if (f.endsWith('.tar.gz')) { moveTo(f, 'backups', moved.backups); continue; }
  if (KEEP.has(f) || ACTIVE.has(f)) continue;
  if (ext === '.md') { moveTo(f, 'docs/historical', moved.historical); continue; }
  if (ARTIFACT_EXT.has(ext)) { moveTo(f, 'docs/historical', moved.historical); continue; }
}
// Active docs last (after artifacts are cleared out)
for (const f of ACTIVE) moveTo(f, 'docs/active', moved.active);

const summary = {
  active: moved.active.length,
  historical: moved.historical.length + moved.folders.length,
  backups: moved.backups.length,
  scripts: moved.scripts.length,
};
console.log(JSON.stringify(summary, null, 2));
console.log('--- moved.scripts ---'); console.log(moved.scripts.join('\n'));
console.log('--- moved.folders ---'); console.log(moved.folders.join('\n'));
