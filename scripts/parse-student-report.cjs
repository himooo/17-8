const ts = require('typescript');
const fs = require('fs');
const file = process.argv[2];
const source = fs.readFileSync(file, 'utf8');
const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
for (const diagnostic of sf.parseDiagnostics) {
  const start = diagnostic.start ?? 0;
  const line = sf.getLineAndCharacterOfPosition(start);
  console.log(JSON.stringify({ code: diagnostic.code, message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'), line: line.line + 1, column: line.character + 1, snippet: source.slice(Math.max(0, start - 80), start + 120) }, null, 2));
}
console.log(JSON.stringify({ diagnostics: sf.parseDiagnostics.length }, null, 2));
