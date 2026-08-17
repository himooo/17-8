#!/usr/bin/env node
const assert = require("node:assert/strict");
const { authFetch } = require("./lib/api-client.cjs");
const BASE = process.env.BASE || "http://127.0.0.1:3032";

async function call(operation, args = []) {
  const response = await authFetch(`${BASE}/api/db/${operation}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ args }),
  });
  const payload = await response.json();
  return { response, payload };
}

async function main() {
  const checks = [];
  const record = (name, condition) => { assert.ok(condition, name); checks.push(name); };

  const seeded = await call("curriculumPromptTemplates.seedDefaults");
  record("prompt seed endpoint", seeded.response.ok && seeded.payload.ok === true);
  const prompts = await call("curriculumPromptTemplates.list");
  record("three factory prompt templates available", prompts.response.ok && prompts.payload.data.length >= 3);
  record("prompt variables and examples contract", prompts.response.ok && prompts.payload.data.every((prompt) => typeof prompt.examplesJson === "string" && typeof prompt.variablesJson === "string"));
  const questionSeed = await call("questionTemplates.seedDefaults");
  record("question template seed endpoint", questionSeed.response.ok && questionSeed.payload.ok === true);
  const questionTemplates = await call("questionTemplates.list", [{}]);
  record("question templates available", questionTemplates.response.ok && questionTemplates.payload.data.length >= 2);

  const lessonId = `factory-smoke-${Date.now()}`;
  const draftInput = {
    title: "جمع الكسور — اختبار المصنع",
    grade: "الصف الرابع",
    subject: "الرياضيات",
    academicYear: "2026",
    curriculumKey: "math4",
    lessonKey: lessonId,
    sourceText: "لجمع كسرين لهما المقام نفسه نجمع البسطين ونبقي المقام.",
    stage: 4,
    status: "review",
    manifestJson: JSON.stringify({ lessonId, title: "جمع الكسور — اختبار المصنع", currentStep: 1, totalSteps: 1, ideas: [{ id: "idea-1", title: "جمع كسور متشابهة المقام", steps: [{ step: 1, id: "step-1", title: "القاعدة", type: "content", script: "نجمع البسطين ونبقي المقام.", assetRefs: ["asset-fraction-01"], questionRefs: ["q-1"], slides: [{ id: "step-1-slide-1", title: "قاعدة جمع الكسور", type: "content", body: "نجمع البسطين ونبقي المقام.", script: "اشرح القاعدة ثم اعرض المثال.", notes: "لا تظهر للطلاب", assetRefs: ["asset-fraction-01"], questionRefs: ["q-1"], whiteboardPlan: "اكتب المعادلة" }, { id: "step-1-slide-2", title: "مثال", type: "example", body: "1/4 + 2/4 = 3/4", script: "اطلب من الطلاب الحل.", assetRefs: ["asset-fraction-01"], questionRefs: ["q-1"] }] }] }], virtualComments: [{ step: 1, ideaId: "idea-1", slideId: "step-1-slide-2", text: "هل نجمع المقام؟", tone: "curious", studentHint: { gender: "female" } }] }),
    questionsJson: JSON.stringify([{ id: "q-1", type: "mcq", text: "ما ناتج 1/4 + 2/4؟", correctAnswer: "3/4", options: ["3/4", "3/8", "1/2"], difficulty: "easy", rewardPoints: 5, ideaId: "idea-1", ideaTitle: "جمع كسور متشابهة المقام", stepNumber: 1, tags: ["bisalasa:math4:factory:idea-1:q-1"], gameReady: true, solutionSteps: ["نجمع 1+2"], solutionScript: "ثلاث قطع من أربع.", images: [{ url: "https://example.com/fraction.png", alt: "شكل كسر", type: "image" }], imageRefs: ["asset-fraction-01"], usage: ["presentation", "moodle-interactive", "moodle-homework", "game"] }, { id: "q-2", type: "cloze", text: "أكمل: 1/4 + 2/4 = [[3/4]]", correctAnswer: "3/4", options: [], difficulty: "medium", rewardPoints: 4, ideaId: "idea-1", ideaTitle: "جمع كسور متشابهة المقام", stepNumber: 2, tags: ["cloze"], gameReady: false, solutionSteps: ["نحافظ على المقام"], solutionScript: "الناتج ثلاثة أرباع." }, { id: "q-3", type: "drag-drop", text: "رتب خطوات جمع الكسور", correctAnswer: "نجمع البسطين", options: ["نجمع البسطين", "نبقي المقام", "نكتب الناتج"], difficulty: "hard", rewardPoints: 3, ideaId: "idea-1", ideaTitle: "جمع كسور متشابهة المقام", stepNumber: 3, tags: ["drag-drop"], gameReady: false, solutionSteps: ["رتب الخطوات"], solutionScript: "ترتيب إجرائي." }]),
    sourceImagesJson: "[]",
    metadataJson: "{}",
  };
  const saved = await call("curriculumFactoryDrafts.upsert", [draftInput]);
  record("draft upsert", saved.response.ok && saved.payload.ok === true && saved.payload.data.id);
  const draftId = saved.payload.data.id;

  const versionsAfterFirstSave = await call("curriculumFactoryDrafts.versions", [draftId]);
  record("first version snapshot", versionsAfterFirstSave.response.ok && versionsAfterFirstSave.payload.data.length === 1 && versionsAfterFirstSave.payload.data[0].version === 1);
  const secondSaved = await call("curriculumFactoryDrafts.upsert", [{ ...draftInput, id: draftId, title: "جمع الكسور — نسخة ثانية", manifestJson: draftInput.manifestJson.replace("جمع الكسور — اختبار المصنع", "جمع الكسور — نسخة ثانية") }]);
  record("second save creates version", secondSaved.response.ok && secondSaved.payload.ok === true);
  const versions = await call("curriculumFactoryDrafts.versions", [draftId]);
  record("version history has two snapshots", versions.response.ok && versions.payload.data.length >= 2);
  const restored = await call("curriculumFactoryDrafts.restoreVersion", [{ draftId, versionId: versions.payload.data[versions.payload.data.length - 1].id }]);
  record("restore creates review draft", restored.response.ok && restored.payload.data.status === "review");

  const fetched = await call("curriculumFactoryDrafts.get", [draftId]);
  record("draft round trip after restore", fetched.response.ok && fetched.payload.data.lessonKey === lessonId && fetched.payload.data.stage === 3 && fetched.payload.data.status === "review");

  const baked = await call("curriculumFactoryDrafts.bake", [{ draftId, content: "<!doctype html><html><body><script type=\"application/json\" id=\"slide-manifest\">{}</script></body></html>" }]);
  record("atomic bake", baked.response.ok && baked.payload.ok === true && baked.payload.data.questionsCount === 3);
  const bakedLesson = baked.payload.data.lesson;
  record("bake status is baked", baked.payload.data.draft.status === "baked" && baked.payload.data.draft.stage === 5);
  record("multi-slide manifest persisted", baked.response.ok && bakedLesson.manifestJson.includes("step-1-slide-2") && bakedLesson.manifestJson.includes("asset-fraction-01") && bakedLesson.manifestJson.includes("virtualComments"));
  const bakedQuestions = await call("questions.listByLesson", [bakedLesson.id]);
  record("baked solution steps persisted", bakedQuestions.response.ok && bakedQuestions.payload.data.some((question) => question.solutionStepsJson === JSON.stringify(["نجمع 1+2"])));
  record("baked solution script persisted", bakedQuestions.response.ok && bakedQuestions.payload.data.some((question) => question.solutionScript === "ثلاث قطع من أربع."));
  record("baked question types persisted", bakedQuestions.response.ok && bakedQuestions.payload.data.some((question) => question.questionType === "cloze") && bakedQuestions.payload.data.some((question) => question.questionType === "drag-drop"));
  record("baked image metadata persisted", bakedQuestions.response.ok && bakedQuestions.payload.data.some((question) => question.imageJson.includes("fraction.png")));
  record("baked usage and asset tags persisted", bakedQuestions.response.ok && bakedQuestions.payload.data.some((question) => question.tags.includes("bisalasa:usage:moodle-interactive") && question.tags.includes("bisalasa:usage:moodle-homework") && question.tags.includes("bisalasa:usage:game") && question.tags.includes("bisalasa:asset:asset-fraction-01")));

  const secondBake = await call("curriculumFactoryDrafts.bake", [{ draftId }]);
  record("bake idempotency", secondBake.response.ok && secondBake.payload.data.lesson.id === bakedLesson.id);

  const invalid = await call("curriculumFactoryDrafts.upsert", [{ title: "bad", manifestJson: "{", questionsJson: "[]", sourceImagesJson: "[]", metadataJson: "{}" }]);
  record("invalid JSON rejected", !invalid.response.ok && invalid.payload.ok === false);

  const deletedDraft = await call("curriculumFactoryDrafts.delete", [draftId]);
  record("draft cleanup", deletedDraft.response.ok && deletedDraft.payload.ok === true);
  const versionsAfterDelete = await call("curriculumFactoryDrafts.versions", [draftId]);
  record("version cleanup", versionsAfterDelete.response.ok && versionsAfterDelete.payload.data.length === 0);
  const deletedTemplates = await call("questionTemplates.list", [{ subject: "__missing__" }]);
  record("template filters remain safe", deletedTemplates.response.ok && Array.isArray(deletedTemplates.payload.data));
  const deletedLesson = await call("lessons.delete", [bakedLesson.id]);
  record("baked lesson cleanup", deletedLesson.response.ok && deletedLesson.payload.ok === true);

  console.log(`CURRICULUM_FACTORY_SMOKE PASS ${checks.length} checks`);
}

main().catch((error) => { console.error(`CURRICULUM_FACTORY_SMOKE FAIL: ${error.message}`); process.exit(1); });
