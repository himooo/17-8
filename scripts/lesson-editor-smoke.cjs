const assert = require("node:assert/strict");
const BASE = process.env.BASE || "http://127.0.0.1:3012";
async function post(operation, args = []) {
  const response = await fetch(`${BASE}/api/db/${operation}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ args }) });
  const payload = await response.json();
  assert.equal(payload.ok, true, `${operation}: ${JSON.stringify(payload)}`);
  return payload.data;
}
(async () => {
  const lessonId = `editor-smoke-${Date.now()}`;
  const manifest = {
    lessonId,
    title: "درس محرر QA",
    subtitle: "نسخة قابلة للتعديل",
    currentStep: 1,
    totalSteps: 2,
    currentIdeaId: "fractions",
    ideas: [{ id: "fractions", title: "الكسور", description: "فكرة اختبار", color: "blue", steps: [
      { step: 1, title: "تعريف الكسر المعدل", type: "content", script: "اشرح البسط والمقام", notes: "ملاحظة مدرسية", question: { text: "ما البسط؟", options: ["الأعلى", "الأسفل"], correctAnswer: "الأعلى", difficulty: "easy", tags: ["idea:fractions"], gameReady: true } },
      { step: 2, title: "تطبيق", type: "question", script: "حل مثالاً", notes: "تحقق من الفهم" },
    ] }],
  };
  const created = await post("lessons.upsert", [{ id: lessonId, lessonId, fileName: `${lessonId}.json`, title: manifest.title, subtitle: manifest.subtitle, content: "<main>QA</main>", manifestJson: JSON.stringify(manifest) }]);
  const list = await post("lessons.list");
  const row = list.find((item) => item.lessonId === lessonId);
  assert.ok(row, "saved lesson must be listed");
  const parsed = JSON.parse(row.manifestJson);
  assert.equal(parsed.ideas[0].steps[0].title, "تعريف الكسر المعدل");
  assert.equal(parsed.ideas[0].steps[0].question.correctAnswer, "الأعلى");
  assert.equal(parsed.ideas[0].steps.length, 2);
  await post("lessons.delete", [created.id]);
  console.log(JSON.stringify({ ok: true, suite: "lesson-editor-smoke", checks: 7, persisted: true, reloaded: true, deleted: true }, null, 2));
})().catch((error) => { console.error(error.stack || error); process.exit(1); });
