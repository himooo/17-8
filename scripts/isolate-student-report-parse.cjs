const ts = require('typescript');
const fs = require('fs');
const file = process.argv[2];
const source = fs.readFileSync(file, 'utf8');
const cases = {
  baseNew: [
    ['  const latestHomework = moodleSummary?.snapshots?.[0] ?? null;', '  // removed latest homework block'],
    ['  const moodlePdfSections: Array<{ heading: string; rows: string[][] }> = [];', '  const moodlePdfSections: Array<{ heading: string; rows: string[][] }> = [];'],
    ['      moodle: latestHomework ? { homework: latestHomework, byIdea: homeworkByIdea, interactionCount: moodleSummary?.interactions.length ?? 0, activityAttemptCount: moodleSummary?.attempts.length ?? 0 } : null,', ''],
    ['        {latestHomework ? <div className="px-4 py-3 border-b border-white/10 bg-emerald-950/20">واجب Moodle: {latestHomework.completionPct}%</div> : null}', ''],
  ],
  noHomeworkHooks: [
    ['  const latestHomework = moodleSummary?.snapshots?.[0] ?? null;', '  const latestHomework = null;'],
    ['  const homeworkByIdea = useMemo(() => {', '  const homeworkByIdea = [];'],
  ],
};
for (const [name, edits] of Object.entries(cases)) {
  let text = source;
  for (const [find, replace] of edits) text = text.split(find).join(replace);
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const diagnostics = sf.parseDiagnostics;
  console.log(name, diagnostics.length ? diagnostics.map((d) => `${d.code}:${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`).join(' | ') : 'PASS');
}
