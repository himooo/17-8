const ts = require('typescript');
const fs = require('fs');
const file = 'src/components/shell/StudentReportPanel.tsx';
const text = fs.readFileSync(file, 'utf8');
const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
for (const d of sf.parseDiagnostics) {
  const start=d.start||0; const lc=sf.getLineAndCharacterOfPosition(start);
  console.log(d.code, d.messageText, 'line', lc.line+1, 'col', lc.character+1, JSON.stringify(text.slice(Math.max(0,start-160), start+160)));
}
let scanner=ts.createScanner(ts.ScriptTarget.Latest,true,ts.LanguageVariant.JSX,text);
let tok; let n=0; while((tok=scanner.scan())!==ts.SyntaxKind.EndOfFileToken && n<4000){ const pos=scanner.getTokenPos(); const lc=sf.getLineAndCharacterOfPosition(pos); if(lc.line>=345&&lc.line<=378) console.log('TOKEN',ts.SyntaxKind[tok],lc.line+1,lc.character+1,JSON.stringify(scanner.getTokenText())); n++; }
