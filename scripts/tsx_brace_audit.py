from pathlib import Path
import re
p=Path('src/components/shell/StudentReportPanel.tsx')
s=p.read_text()
stack=[]
i=0; line=1; col=0; mode='code'; quote=''
while i < len(s):
    ch=s[i]; nxt=s[i+1] if i+1<len(s) else ''
    if ch=='\n': line+=1; col=0
    else: col+=1
    if mode=='line':
        if ch=='\n': mode='code'
        i+=1; continue
    if mode=='block':
        if ch=='*' and nxt=='/': mode='code'; i+=2; col+=1; continue
        i+=1; continue
    if mode=='string':
        if ch=='\\': i+=2; col+=1; continue
        if ch==quote: mode='code'
        i+=1; continue
    if ch=='/' and nxt=='/': mode='line'; i+=2; col+=1; continue
    if ch=='/' and nxt=='*': mode='block'; i+=2; col+=1; continue
    if ch in "'\"`": mode='string'; quote=ch; i+=1; continue
    if ch in '({[':
        stack.append((ch,line,col,s[max(0,i-30):i+30].replace('\n',' ')))
    elif ch in ')}]':
        expected={')':'(', '}':'{', ']':'['}[ch]
        if not stack or stack[-1][0]!=expected:
            print('MISMATCH', ch, 'at', line, col, 'top', stack[-1] if stack else None)
        else: stack.pop()
    i+=1
print('UNMATCHED', len(stack))
for item in stack[-20:]: print(item)
