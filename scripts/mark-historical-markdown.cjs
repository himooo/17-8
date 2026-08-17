const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = process.cwd();
const output = execFileSync('find', ['.', '-type', 'f', '-name', '*.md', '-not', '-path', './node_modules/*', '-not', '-path', './.next/*'], { encoding: 'utf8' });
const current = new Set([
  './BISALASA-COMPLETE-DOCUMENTATION-AR.md',
  './CHANGES.md',
  './CHANGES_V3.md',
  './PERFORMANCE-OPTIMIZATION-REPORT.md',
  './MOODLE-INTEGRATION-REPORT.md',
  './MOODLE-INTEGRATION-DESIGN.md',
  './MOODLE-REGRESSION-RESULTS.md',
  './moodle-browser-findings-v2.md',
  './bisalasa_final_test_report_ar.md',
  './public/slides/USER_GUIDE.md',
  './public/slides/QUICKSTART.md',
  './public/slides/VIBE_CODING_CONTRACT.md',
  './public/slides/SLIDE_SCHEMA.md',
  './public/slides/SLIDE_CONFIGURATION.md',
]);
function isHistorical(relative) {
  if (current.has(relative)) return false;
  return /\/(?:qa|release_v6_pdf\/audit_logs|qa-artifacts|updated_prompts_package)\//.test(relative)
    || /(?:AUDIT_FINDINGS|FINAL_|FULL_|REPORT_|qa-|PHASE|DEEP_AUDIT|FEATURE_RISK|TECHNICAL_REPORT|bisalasa-v5|bisalasa-final-delivery|bisalasa-ai-telegram|MATH_|external-api-notes|google_gemini|component_inventory|browser_test_log|deep_browser_findings|pasted_content)/i.test(path.basename(relative));
}
const banner = '> **حالة الوثيقة:** سجل تاريخي/مرجع مساند من جولة سابقة. المرجع الحالي للمنصة هو `BISALASA-COMPLETE-DOCUMENTATION-AR.md`. قد تحتوي هذه الوثيقة على أرقام أو منافذ أو عدد اختبارات يخص تاريخها؛ لا تستخدمها بديلاً عن `PERFORMANCE-OPTIMIZATION-REPORT.md` أو `MOODLE-INTEGRATION-REPORT.md` عند قراءة الحالة الحالية.\n>\n';
let changed = 0;
for (const relative of output.trim().split('\n').filter(Boolean)) {
  if (!isHistorical(relative)) continue;
  const file = path.join(root, relative);
  const text = fs.readFileSync(file, 'utf8');
  if (text.includes('حالة الوثيقة:')) continue;
  fs.writeFileSync(file, `${banner}\n${text}`);
  changed += 1;
}
console.log(JSON.stringify({ changed }, null, 2));
