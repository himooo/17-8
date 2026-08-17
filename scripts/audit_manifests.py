import json
import re
from pathlib import Path
from bs4 import BeautifulSoup

ROOT = Path('/home/ubuntu/bisalasa-full-audit/public/slides')
issues = []
summary = []
for path in sorted(ROOT.glob('*.html')):
    html = path.read_text(encoding='utf-8', errors='replace')
    soup = BeautifulSoup(html, 'html.parser')
    manifest_el = soup.find('script', id='slide-manifest')
    file_issues = []
    if not manifest_el:
        file_issues.append('missing-manifest')
        manifest = None
    else:
        try:
            manifest = json.loads(manifest_el.get_text(strip=True))
        except Exception as exc:
            manifest = None
            file_issues.append(f'invalid-manifest:{type(exc).__name__}')
    html_tag = soup.find('html')
    if not html_tag or html_tag.get('lang') != 'ar' or html_tag.get('dir') != 'rtl':
        file_issues.append('not-arabic-rtl')
    if not re.search(r'Cairo', html, re.I):
        file_issues.append('missing-cairo-reference')
    if not re.search(r'window\.parent\.postMessage', html):
        file_issues.append('missing-postmessage-controller')
    q_count = 0
    if manifest:
        if not manifest.get('lessonId'):
            file_issues.append('missing-lessonId')
        if not manifest.get('title'):
            file_issues.append('missing-title')
        containers = []
        for idea in manifest.get('ideas') or []:
            steps = idea.get('steps') or []
            numbers = [s.get('step') for s in steps]
            if len(numbers) != len(set(numbers)):
                file_issues.append(f'duplicate-idea-step:{idea.get("id")}')
            for s in steps:
                containers.append((idea.get('id'), s))
        for s in manifest.get('steps') or []:
            containers.append(('flat', s))
        for idea_id, step in containers:
            q = step.get('question') if isinstance(step, dict) else None
            if step.get('type') == 'question' or q:
                q_count += 1
                if not q or not q.get('text'):
                    file_issues.append(f'question-without-text:{idea_id}:{step.get("step")}')
                options = q.get('options') if q else None
                correct = q.get('correctAnswer') if q else None
                if options is not None and len(options) < 2:
                    file_issues.append(f'question-too-few-options:{idea_id}:{step.get("step")}')
                if options and correct is not None and str(correct) not in {str(x) for x in options}:
                    file_issues.append(f'correct-answer-not-in-options:{idea_id}:{step.get("step")}')
                if step.get('autoSlideMs', 0) not in (0, None):
                    file_issues.append(f'question-autoslide-enabled:{idea_id}:{step.get("step")}')
        if not manifest.get('steps') and not manifest.get('ideas'):
            file_issues.append('manifest-has-no-steps-or-ideas')
    if file_issues:
        issues.append({'file': path.name, 'issues': file_issues})
    summary.append((path.name, q_count, len(file_issues)))

print(f'files={len(summary)}')
print(f'files_with_issues={len(issues)}')
print(f'total_questions={sum(q for _, q, _ in summary)}')
for name, q_count, issue_count in summary:
    print(f'{name}\tquestions={q_count}\tissues={issue_count}')
print('ISSUES')
for item in issues:
    print(json.dumps(item, ensure_ascii=False))
if issues:
    raise SystemExit(1)
