#!/usr/bin/env node
// Rewrite bare backticked file references in docs/active/*.md to their real
// locations after the docs reorganization (docs/historical/, scripts/, src/lib/).
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const activeDir = path.join(root, 'docs', 'active');
const histDir = path.join(root, 'docs', 'historical');
const scriptsDir = path.join(root, 'scripts');
const libDir = path.join(root, 'src', 'lib');

const histFiles = new Set(fs.readdirSync(histDir).filter((f) => fs.statSync(path.join(histDir, f)).isFile()));
const scriptFiles = new Set(fs.readdirSync(scriptsDir).filter((f) => fs.statSync(path.join(scriptsDir, f)).isFile()));
const SRC_LIB_MAP = new Map([
  ['ai-key-crypto.ts', 'src/lib/ai-key-crypto.ts'],
  ['report-contract.ts', 'src/lib/report-contract.ts'],
  ['report-aggregator.ts', 'src/lib/report-aggregator.ts'],
  ['reports-telegram-v10.ts', 'src/lib/reports-telegram-v10.ts'],
  ['settings-ai-v10.ts', 'src/lib/settings-ai-v10.ts'],
]);
const EXACT_MAP = new Map([
  ['qa-artifacts/v10-official-final-result.json', 'docs/historical/v10-complete-suite-result.json'],
  ['/api/tts/route.ts', 'src/app/api/tts/route.ts'],
]);

let totalChanges = 0;
for (const f of fs.readdirSync(activeDir)) {
  if (!f.endsWith('.md')) continue;
  const file = path.join(activeDir, f);
  let text = fs.readFileSync(file, 'utf8');
  text = text.replace(/`([^`\n]+)`/g, (whole, ref) => {
    if (EXACT_MAP.has(ref)) { totalChanges++; return `\`${EXACT_MAP.get(ref)}\``; }
    if (ref.includes('/') || ref.includes('://')) return whole; // already a path or URL
    if (SRC_LIB_MAP.has(ref)) { totalChanges++; return `\`${SRC_LIB_MAP.get(ref)}\``; }
    if (histFiles.has(ref)) { totalChanges++; return `\`docs/historical/${ref}\``; }
    if (scriptFiles.has(ref)) { totalChanges++; return `\`scripts/${ref}\``; }
    return whole;
  });
  fs.writeFileSync(file, text);
}
console.log(JSON.stringify({ filesScanned: fs.readdirSync(activeDir).filter((f) => f.endsWith('.md')).length, refsRewritten: totalChanges }));
