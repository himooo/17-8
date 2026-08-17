#!/usr/bin/env node
// Find references in docs/active/*.md that point to files that moved to docs/historical/ (or elsewhere)
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const activeDir = path.join(root, 'docs', 'active');
const refRe = /`([^`]+\.(?:md|txt|json|jsonl|sh|py|cjs|ts))`/g;
for (const f of fs.readdirSync(activeDir)) {
  if (!f.endsWith('.md')) continue;
  const text = fs.readFileSync(path.join(activeDir, f), 'utf8');
  let m;
  const seen = new Set();
  while ((m = refRe.exec(text))) {
    const ref = m[1].replace(/^\.\//, '');
    if (ref.includes('://') || ref.startsWith('src/') || ref.startsWith('scripts/') || ref.startsWith('public/') || ref.startsWith('prisma/') || ref.startsWith('data/')) continue;
    if (seen.has(ref)) continue;
    seen.add(ref);
    const inActive = fs.existsSync(path.join(activeDir, ref));
    const inRoot = fs.existsSync(path.join(root, ref));
    const inHist = fs.existsSync(path.join(root, 'docs', 'historical', ref));
    if (!inActive && !inRoot) {
      console.log(`${f}: ${ref} -> ${inHist ? 'docs/historical/' + ref : 'MISSING'}`);
    }
  }
}
