#!/usr/bin/env python3
import json
from pathlib import Path
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
SLIDES = ROOT / "public" / "slides"
results = []

def issue(code, message, path, step=None):
    return {"code": code, "message": message, "path": str(path.relative_to(ROOT)), "step": step}

for path in sorted(SLIDES.glob("*.html")):
    html = path.read_text(encoding="utf-8", errors="replace")
    soup = BeautifulSoup(html, "html.parser")
    manifest_node = soup.find("script", id="slide-manifest")
    issues = []
    manifest = None
    if manifest_node is None:
        issues.append(issue("missing-manifest", "لا يوجد script#slide-manifest", path))
    else:
        try:
            manifest = json.loads(manifest_node.string or manifest_node.get_text())
        except Exception as exc:
            issues.append(issue("invalid-json", f"JSON غير صالح: {exc}", path))
    if isinstance(manifest, dict):
        for key in ("lessonId", "title", "currentStep"):
            if key not in manifest:
                issues.append(issue("missing-field", f"الحقل الإلزامي مفقود: {key}", path))
        steps = []
        if isinstance(manifest.get("steps"), list):
            steps.extend((None, step) for step in manifest["steps"])
        if isinstance(manifest.get("ideas"), list):
            for idea in manifest["ideas"]:
                if not isinstance(idea, dict) or not isinstance(idea.get("steps"), list):
                    issues.append(issue("invalid-idea", "فكرة بلا steps صالحة", path))
                    continue
                for step in idea["steps"]:
                    steps.append((idea.get("id"), step))
        if not steps:
            issues.append(issue("no-steps", "لا توجد steps أو ideas.steps", path))
        declared_total = manifest.get("totalSteps")
        if declared_total is not None and isinstance(declared_total, int) and declared_total != len(steps) and not manifest.get("ideas"):
            issues.append(issue("total-mismatch", f"totalSteps={declared_total} بينما عدد الخطوات={len(steps)}", path))
        seen = set()
        for idea_id, step in steps:
            if not isinstance(step, dict):
                issues.append(issue("invalid-step", "خطوة ليست كائناً", path))
                continue
            number = step.get("step")
            key = (idea_id, number)
            if number is None:
                issues.append(issue("missing-step-number", "الخطوة بلا step", path))
            elif key in seen:
                issues.append(issue("duplicate-step", f"تكرار الخطوة {number}", path, number))
            seen.add(key)
            if step.get("type") == "question" or step.get("question") is not None:
                question = step.get("question")
                if not isinstance(question, dict):
                    issues.append(issue("invalid-question", "السؤال ليس كائناً", path, number))
                else:
                    options = question.get("options")
                    answer = question.get("correctAnswer")
                    if not isinstance(options, list) or len(options) < 2:
                        issues.append(issue("question-options", "السؤال يحتاج خيارين على الأقل", path, number))
                    elif answer not in options:
                        issues.append(issue("answer-not-option", "correctAnswer غير موجود داخل options", path, number))
                    if not isinstance(question.get("text"), str) or not question.get("text", "").strip():
                        issues.append(issue("question-text", "نص السؤال فارغ", path, number))
            if step.get("script") is None:
                issues.append(issue("missing-script", "الخطوة بلا script للمدرس", path, number))
        if isinstance(manifest.get("virtualComments"), list):
            for comment in manifest["virtualComments"]:
                if not isinstance(comment, dict) or not isinstance(comment.get("text"), str) or not comment.get("text", "").strip():
                    issues.append(issue("invalid-comment", "تعليق افتراضي بلا نص", path))
                if comment.get("tone") not in {"confident", "confused", "excited", "curious", "neutral", None}:
                    issues.append(issue("invalid-comment-tone", "نبرة تعليق غير معروفة", path))
    results.append({"file": str(path.relative_to(ROOT)), "ok": not issues, "issues": issues})

summary = {
    "files": len(results),
    "passed": sum(1 for item in results if item["ok"]),
    "failed": sum(1 for item in results if not item["ok"]),
    "issues": sum(len(item["issues"]) for item in results),
}
output = {"summary": summary, "results": results}
print(json.dumps(output, ensure_ascii=False, indent=2))
(ROOT / "manifest_audit_v4.json").write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
