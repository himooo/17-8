"use client";
/* معاينة أصول الكتاب قد تستخدم روابط محلية أو خارجية؛ نستخدم img عمداً داخل المصنع. */
/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowDown, ArrowUp, BarChart3, Check, CheckSquare, Copy, Download, Eye, FileJson, FilePlus2, FlaskConical, GitCompare, GripVertical, ImagePlus, Library, Loader2, Plus, RotateCcw, Save, Search, Settings2, Sparkles, Square, Table2, Trash2, Upload, WandSparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { aiClient, localDb, type AiDiscoveredModel, type AiKeySummary, type AiProvider, type CurriculumDraftVersion, type CurriculumFactoryDraft, type CurriculumPromptTemplate, type LessonTemplate, type QuestionTemplate } from "@/lib/local-db";
import type { LessonSlide, SlideAsset, SlideIdea, SlideManifest, SlideStep } from "@/lib/slide-schema";
import { toast } from "sonner";

type QuestionType = "mcq" | "true-false" | "essay" | "cloze" | "drag-drop";
type AiSettings = { provider: AiProvider; model: string; temperature: number; maxOutputTokens: number; keyId?: string };
type QuestionQuality = { score: number; errors: string[]; warnings: string[] };
type QuestionUsage = "presentation" | "moodle-interactive" | "moodle-homework" | "game";
type FactoryAsset = SlideAsset & { filename?: string; mimeType?: string; size?: number; crop?: { x: number; y: number; width: number; height: number } };
type StageMode = "ai" | "external" | "manual" | "skipped";

type FactoryQuestion = {
  id: string;
  type: QuestionType;
  text: string;
  correctAnswer: string;
  options: string[];
  difficulty: "easy" | "medium" | "hard";
  rewardPoints: number;
  solutionSteps: string[];
  solutionScript: string;
  ideaId: string;
  ideaTitle?: string;
  stepNumber: number;
  tags: string[];
  gameReady: boolean;
  images: Array<{ url: string; alt: string; type: string }>;
  imageRefs: string[];
  usage: QuestionUsage[];
  quality?: QuestionQuality;
};

type FactoryState = {
  id?: string;
  title: string;
  grade: string;
  subject: string;
  academicYear: string;
  curriculumKey: string;
  lessonKey: string;
  sourceText: string;
  sourceImages: string[];
  assets: FactoryAsset[];
  stage: number;
  status: string;
  skippedStages: number[];
  stageModes: Record<string, StageMode>;
  stageOutputs: Record<string, string>;
  importMode: "new" | "update";
  manifest: SlideManifest;
  questions: FactoryQuestion[];
  ai: { structure: AiSettings; questions: AiSettings; improve: AiSettings };
};

type Validation = { errors: string[]; warnings: string[]; score: number; questionResults: Array<{ id: string; quality: QuestionQuality }> };

const defaultAiSettings = (): { structure: AiSettings; questions: AiSettings; improve: AiSettings } => ({
  structure: { provider: "google", model: "", temperature: 0.25, maxOutputTokens: 5000 },
  questions: { provider: "google", model: "", temperature: 0.2, maxOutputTokens: 3200 },
  improve: { provider: "google", model: "", temperature: 0.45, maxOutputTokens: 1800 },
});

const blankManifest = (title = "درس جديد"): SlideManifest => ({
  lessonId: `lesson-${Date.now()}`,
  title,
  subtitle: "",
  contentType: "html",
  currentStep: 1,
  totalSteps: 0,
  ideas: [],
  aspectRatio: "16:9",
  targetAge: "primary-upper",
  assets: [],
  virtualComments: [],
});

const emptyFactory = (): FactoryState => ({
  title: "درس جديد",
  grade: "الصف الرابع الابتدائي",
  subject: "الرياضيات",
  academicYear: "",
  curriculumKey: "math4",
  lessonKey: `lesson-${Date.now()}`,
  sourceText: "",
  sourceImages: [],
  assets: [],
  stage: 1,
  status: "draft",
  skippedStages: [],
  stageModes: { "1": "manual", "2": "ai", "3": "ai", "4": "manual", "5": "manual" },
  stageOutputs: {},
  importMode: "new",
  manifest: blankManifest(),
  questions: [],
  ai: defaultAiSettings(),
});

function parseJson<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
    if (fenced) {
      try { return JSON.parse(fenced) as T; } catch { return fallback; }
    }
    return fallback;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[character] ?? character));
}

function toMoodleMath(value: string): string {
  return value.replace(/\$\$([\s\S]+?)\$\$/g, "\\[$1\\]").replace(/\$([^$]+)\$/g, "\\($1\\)");
}

function validateLatex(value: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const display = [...value.matchAll(/\$\$([\s\S]*?)(?:\$\$|$)/g)];
  const inline = [...value.matchAll(/(?<!\$)\$([^$\n]+?)(?:\$|$)/g)];
  for (const match of [...display, ...inline]) {
    const formula = String(match[1] ?? "").trim();
    if (!formula) errors.push("صيغة LaTeX فارغة.");
    if (/[{}()[\]]/.test(formula) && ((formula.match(/\{/g) || []).length !== (formula.match(/\}/g) || []).length)) errors.push(`أقواس LaTeX غير متوازنة: ${formula.slice(0, 80)}`);
    if (/\\[a-zA-Z]+$/.test(formula)) errors.push(`أمر LaTeX غير مكتمل: ${formula.slice(0, 80)}`);
  }
  return { valid: errors.length === 0, errors };
}

function calculateSimilarity(left: string, right: string): number {
  const wordsLeft = new Set(left.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean));
  const wordsRight = new Set(right.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean));
  const union = new Set([...wordsLeft, ...wordsRight]).size;
  if (!union) return 0;
  const intersection = [...wordsLeft].filter((word) => wordsRight.has(word)).length;
  return intersection / union;
}

function detectDuplicates(questions: FactoryQuestion[]) {
  const result: Array<{ id1: string; id2: string; similarity: number }> = [];
  for (let index = 0; index < questions.length; index += 1) for (let next = index + 1; next < questions.length; next += 1) {
    const similarity = calculateSimilarity(questions[index].text, questions[next].text);
    if (similarity >= 0.8) result.push({ id1: questions[index].id, id2: questions[next].id, similarity });
  }
  return result;
}

function applyPromptVariables(template: string, state: FactoryState): string {
  const compact = (value: unknown, limit = 80_000) => {
    const raw = typeof value === "string" ? value : JSON.stringify(value ?? "", null, 2);
    return raw.length > limit ? `${raw.slice(0, limit)}\n...[تم الاختصار]` : raw;
  };
  const values: Record<string, string> = {
    subject: state.subject,
    grade: state.grade,
    academicYear: state.academicYear,
    curriculumKey: state.curriculumKey,
    lessonKey: state.lessonKey,
    title: state.title,
    sourceText: state.sourceText,
    sourceImages: compact(state.sourceImages),
    assets: compact(state.assets),
    ideas: compact(state.manifest.ideas ?? []),
    manifest: compact(state.manifest),
    questions: compact(state.questions),
    questionsCount: String(state.questions.length),
    previousStageOutput: compact(state.stageOutputs[String(Math.max(1, state.stage - 1))] ?? ""),
    stageOutputs: compact(state.stageOutputs),
    outputContract: "أخرج نتيجة قابلة للاستيراد، واحتفظ بالـIDs والروابط. ضع needsReview للعناصر غير المؤكدة ولا تخترع بيانات خارج المصدر.",
  };
  return template.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (full, key: string) => values[key] ?? full);
}

function validateMoodleXml(xml: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!xml.trim().startsWith("<?xml")) errors.push("رأس XML مفقود.");
  if (!/<quiz[ >]/.test(xml) || !/<\/quiz>/.test(xml)) errors.push("جذر quiz غير موجود.");
  if (!/<question type=/.test(xml)) errors.push("لا توجد أسئلة في XML.");
  if (typeof DOMParser !== "undefined") {
    const parser = new DOMParser();
    const document = parser.parseFromString(xml, "application/xml");
    if (document.querySelector("parsererror")) errors.push("فشل تحليل XML.");
  }
  return { valid: errors.length === 0, errors };
}

function validateQuestionStrict(question: FactoryQuestion): QuestionQuality {
  const errors: string[] = [];
  const warnings: string[] = [];
  const normalizedOptions = question.options.map((option) => option.trim()).filter(Boolean);
  const uniqueOptions = new Set(normalizedOptions);
  const optionQuestion = question.type === "mcq" || question.type === "true-false";
  if (optionQuestion && normalizedOptions.length < 2) errors.push("السؤال يحتاج خيارين على الأقل.");
  if (optionQuestion && !question.correctAnswer.trim()) errors.push("الإجابة الصحيحة مطلوبة.");
  if (optionQuestion && question.correctAnswer.trim() && !normalizedOptions.includes(question.correctAnswer.trim())) errors.push("الإجابة الصحيحة غير موجودة في الخيارات.");
  if (uniqueOptions.size !== normalizedOptions.length) warnings.push("يوجد خيارات مكررة.");
  if (optionQuestion && normalizedOptions.filter((option) => option === question.correctAnswer.trim()).length > 1) errors.push("يوجد أكثر من خيار مطابق للإجابة الصحيحة.");
  if (question.text.trim().length < 10) warnings.push("نص السؤال قصير جداً.");
  if (!question.solutionSteps.length && !question.solutionScript.trim()) warnings.push("لا توجد خطوات حل أو تغذية راجعة.");
  if (question.type === "essay" && question.gameReady) warnings.push("السؤال المقالي لن يدخل ألعاب الاختيار المتعدد؛ تم تعطيل gameReady تلقائياً عند الخَبز.");
  if (question.type === "cloze" && !/\[\[.+?\]\]|\{.+?\}/.test(question.text)) warnings.push("سؤال Cloze يفضل أن يحتوي موضع فراغ واضحاً مثل [[الإجابة]].");
  if (question.type === "drag-drop" && normalizedOptions.length < 2) warnings.push("سؤال السحب والإفلات يحتاج عناصر سحب متعددة.");
  const latex = validateLatex([question.text, ...question.solutionSteps, question.solutionScript].join("\n"));
  if (!latex.valid) errors.push(...latex.errors);
  for (const image of question.images ?? []) if (!/^https?:\/\//i.test(image.url) && !image.url.startsWith("/manus-storage/")) warnings.push(`رابط صورة غير آمن: ${image.url.slice(0, 80)}`);
  return { errors, warnings, score: Math.max(0, 100 - errors.length * 25 - warnings.length * 5) };
}

function normalizeSlide(raw: Partial<LessonSlide>, stepIndex: number, slideIndex: number): LessonSlide {
  return {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : `step-${stepIndex + 1}-slide-${slideIndex + 1}`,
    title: typeof raw.title === "string" ? raw.title.trim() : "",
    type: raw.type,
    body: typeof raw.body === "string" ? raw.body : "",
    script: Array.isArray(raw.script) ? raw.script.filter(Boolean).map(String) : String(raw.script ?? ""),
    notes: typeof raw.notes === "string" ? raw.notes : "",
    assetRefs: Array.isArray(raw.assetRefs) ? raw.assetRefs.filter((value): value is string => typeof value === "string" && value.trim().length > 0).slice(0, 30) : [],
    questionRefs: Array.isArray(raw.questionRefs) ? raw.questionRefs.filter((value): value is string => typeof value === "string" && value.trim().length > 0).slice(0, 30) : [],
    virtualCommentIds: Array.isArray(raw.virtualCommentIds) ? raw.virtualCommentIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0).slice(0, 30) : [],
    whiteboardPlan: typeof raw.whiteboardPlan === "string" ? raw.whiteboardPlan : "",
    autoSlideMs: Number.isFinite(Number(raw.autoSlideMs)) ? Math.max(0, Math.min(600_000, Number(raw.autoSlideMs))) : undefined,
  };
}

function normalizeStep(raw: Partial<SlideStep>, index: number): SlideStep {
  const normalizedSlides = Array.isArray(raw.slides) ? raw.slides.map((slide, slideIndex) => normalizeSlide(slide as Partial<LessonSlide>, index, slideIndex)) : [];
  const slides = normalizedSlides.length ? normalizedSlides : [normalizeSlide({ id: `step-${index + 1}-slide-1`, title: raw.title, type: raw.type === "question" ? "question" : "content", script: raw.script, notes: raw.notes }, index, 0)];
  return {
    step: index + 1,
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : `step-${index + 1}`,
    title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : `خطوة ${index + 1}`,
    type: raw.type === "question" ? "question" : raw.type === "virtual-comment" ? "virtual-comment" : "content",
    script: Array.isArray(raw.script) ? raw.script.filter(Boolean).map(String) : String(raw.script ?? ""),
    notes: String(raw.notes ?? ""),
    slides,
    assetRefs: Array.isArray(raw.assetRefs) ? raw.assetRefs.filter((value): value is string => typeof value === "string" && value.trim().length > 0).slice(0, 30) : [],
    questionRefs: Array.isArray(raw.questionRefs) ? raw.questionRefs.filter((value): value is string => typeof value === "string" && value.trim().length > 0).slice(0, 30) : [],
    question: raw.question,
  };
}

function normalizeAsset(raw: Partial<SlideAsset>, index: number): FactoryAsset {
  const source = raw.source === "teacher-upload" || raw.source === "book-crop" || raw.source === "ai-generated" || raw.source === "external" ? raw.source : "unknown";
  const type = raw.type === "geometric-figure" || raw.type === "illustration" || raw.type === "photo" || raw.type === "chart" || raw.type === "icon" ? raw.type : "illustration";
  return {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : `asset-${index + 1}`,
    description: typeof raw.description === "string" ? raw.description.trim() : "",
    type,
    status: raw.status === "final" ? "final" : "placeholder",
    url: typeof raw.url === "string" ? raw.url.trim() : undefined,
    alt: typeof raw.alt === "string" ? raw.alt.trim() : undefined,
    source,
    checksum: typeof raw.checksum === "string" ? raw.checksum : undefined,
    originalAssetId: typeof raw.originalAssetId === "string" ? raw.originalAssetId : undefined,
    width: Number.isFinite(Number(raw.width)) ? Number(raw.width) : undefined,
    height: Number.isFinite(Number(raw.height)) ? Number(raw.height) : undefined,
  };
}

function normalizeManifest(raw: Partial<SlideManifest>, fallbackTitle: string): SlideManifest {
  const ideas = Array.isArray(raw.ideas) ? raw.ideas.map((idea, ideaIndex) => ({
    id: typeof idea.id === "string" && idea.id.trim() ? idea.id.trim() : `idea-${ideaIndex + 1}`,
    title: typeof idea.title === "string" && idea.title.trim() ? idea.title.trim() : `الفكرة ${ideaIndex + 1}`,
    description: String(idea.description ?? ""),
    color: idea.color,
    steps: Array.isArray(idea.steps) ? idea.steps.map((step, stepIndex) => normalizeStep(step, stepIndex)) : [],
  })) : [];
  const steps = Array.isArray(raw.steps) ? raw.steps.map((step, index) => normalizeStep(step, index)) : undefined;
  const totalSteps = ideas.length ? ideas.reduce((sum, idea) => sum + idea.steps.length, 0) : steps?.length ?? 0;
  return {
    lessonId: typeof raw.lessonId === "string" && raw.lessonId.trim() ? raw.lessonId.trim() : `lesson-${Date.now()}`,
    title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : fallbackTitle,
    subtitle: typeof raw.subtitle === "string" ? raw.subtitle : "",
    contentType: raw.contentType === "react" ? "react" : "html",
    currentStep: 1,
    totalSteps,
    ideas: ideas.length ? ideas : undefined,
    steps: ideas.length ? undefined : steps,
    aspectRatio: raw.aspectRatio,
    targetAge: raw.targetAge,
    assets: Array.isArray(raw.assets) ? raw.assets.map((asset, assetIndex) => normalizeAsset(asset, assetIndex)) : [],
    virtualComments: Array.isArray(raw.virtualComments) ? raw.virtualComments : [],
  };
}

function baselineFromSource(state: FactoryState): SlideManifest {
  const paragraphs = state.sourceText.split(/\n\s*\n|\n(?=\d+[.)-])/).map((part) => part.trim()).filter(Boolean);
  const chunks = paragraphs.length ? paragraphs : [state.sourceText.trim() || "أضف نص الدرس في المرحلة الأولى."];
  const ideas: SlideIdea[] = chunks.slice(0, 20).map((text, index) => ({
    id: `idea-${index + 1}`,
    title: `الفكرة ${index + 1}`,
    description: text.slice(0, 180),
    color: (["blue", "green", "amber", "purple", "cyan"] as const)[index % 5],
    steps: [{ step: 1, title: "شرح الفكرة", type: "content", script: text, notes: "راجع المثال وارسم ما يلزم على السبورة." }],
  }));
  return normalizeManifest({ lessonId: state.lessonKey || `lesson-${Date.now()}`, title: state.title, subtitle: `${state.grade} — ${state.subject}`, ideas }, state.title);
}

function buildLessonHtml(manifest: SlideManifest): string {
  const manifestJson = JSON.stringify(manifest).replace(/<\//g, "<\\/");
  const ideas = manifest.ideas ?? [{ id: "flat", title: manifest.title, steps: manifest.steps ?? [] }];
  const body = ideas.flatMap((idea) => idea.steps.map((step) => `<article data-idea-id="${escapeHtml(idea.id)}" data-step="${step.step}"><h2>${escapeHtml(step.title ?? "")}</h2><p>${escapeHtml(Array.isArray(step.script) ? step.script.join(" ") : step.script ?? "")}</p></article>`)).join("\n");
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(manifest.title)}</title></head><body><main>${body}</main><script type="application/json" id="slide-manifest">${manifestJson}</script></body></html>`;
}

function stableShuffle(values: string[], seed: string): string[] {
  return [...values].sort((left, right) => `${seed}:${left}`.localeCompare(`${seed}:${right}`));
}

function buildMoodleXml(state: FactoryState): string {
  const text = (value: string) => escapeHtml(toMoodleMath(value));
  const questions = state.questions.filter((question) => question.usage.includes("moodle-interactive") || question.usage.includes("moodle-homework")).map((question) => {
    const type = question.type === "essay" ? "essay" : question.type === "true-false" ? "truefalse" : question.type === "cloze" ? "cloze" : question.type === "drag-drop" ? "ddwtos" : "multichoice";
    const feedback = text([...question.solutionSteps, question.solutionScript].filter(Boolean).join("\n"));
    const tags = Array.from(new Set([question.tags[0] || `bisalasa:${state.curriculumKey}:${state.lessonKey}:${question.ideaId}`, ...question.usage.filter((usage) => usage === "moodle-interactive" || usage === "moodle-homework").map((usage) => `bisalasa:usage:${usage}`)]));
    const tag = tags.map((value) => `<tag><text>${text(value)}</text></tag>`).join("");
    const imageHtml = question.images.map((image) => `<br/><img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.alt)}" />`).join("");
    const questionText = question.type === "cloze" && !/[{][^}]+[}]/.test(question.text) ? `${question.text} {1:SHORTANSWER:=${question.correctAnswer || ""}}` : question.text;
    const shuffled = stableShuffle(question.type === "true-false" ? ["صح", "خطأ"] : question.options, question.id);
    const options = type === "essay" || type === "cloze" ? "" : type === "ddwtos" ? shuffled.map((option) => `<dragbox><text>${text(option)}</text></dragbox>`).join("") : shuffled.map((option) => `<answer fraction="${option === question.correctAnswer ? "100" : "0"}"><text>${text(option)}</text><feedback><text>${option === question.correctAnswer ? feedback : "راجع خطوات الحل من جديد."}</text></feedback></answer>`).join("");
    const controls = type === "multichoice" ? "<shuffleanswers><text>1</text></shuffleanswers><single>true</single><penalty>0.3333333</penalty>" : type === "truefalse" ? "<penalty>0.3333333</penalty>" : type === "ddwtos" ? "<shuffleanswers><text>1</text></shuffleanswers><penalty>0.0000000</penalty>" : "<penalty>0.0000000</penalty>";
    return `<question type="${type}"><name><text>${text(question.tags[0] || question.id)}</text></name><questiontext format="html"><text>${text(questionText)}${imageHtml}</text></questiontext>${controls}${options}<generalfeedback><text>${feedback}</text></generalfeedback><defaultgrade>${question.rewardPoints || 1}</defaultgrade><tags>${tag}</tags></question>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<quiz>\n${questions}\n</quiz>`;
}

function downloadFile(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function validateFactory(state: FactoryState): Validation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!state.title.trim()) errors.push("عنوان الدرس مطلوب.");
  if (!state.sourceText.trim()) warnings.push("لم تتم إضافة نص خام؛ تأكد أن المحتوى جاء من مصدر آخر.");
  if (!state.manifest.lessonId) errors.push("lessonId مفقود.");
  const ideas = state.manifest.ideas ?? [];
  if (!ideas.length && !(state.manifest.steps?.length)) errors.push("لا توجد أفكار أو خطوات.");
  const ideaIds = new Set(ideas.map((idea) => idea.id));
  if (ideaIds.size !== ideas.length) errors.push("يوجد تكرار في معرفات الأفكار.");
  for (const idea of ideas) if (!idea.steps.length) warnings.push(`الفكرة «${idea.title}» بلا خطوات.`);
  const questionIds = new Set<string>();
  const questionResults = state.questions.map((question) => ({ id: question.id, quality: validateQuestionStrict(question) }));
  for (const question of state.questions) {
    if (questionIds.has(question.id)) errors.push(`تكرار معرف السؤال ${question.id}.`);
    questionIds.add(question.id);
    const quality = questionResults.find((result) => result.id === question.id)?.quality;
    if (quality?.errors.length) errors.push(...quality.errors.map((error) => `${question.id}: ${error}`));
    if (quality?.warnings.length) warnings.push(...quality.warnings.map((warning) => `${question.id}: ${warning}`));
    if (question.ideaId !== "flat" && !ideaIds.has(question.ideaId)) warnings.push(`السؤال ${question.id} يحتاج مراجعة ربط.`);
  }
  const scores = questionResults.map((result) => result.quality.score);
  const score = Math.max(0, Math.round((scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 100) - errors.length * 8 - warnings.length * 2));
  return { errors, warnings, score, questionResults };
}

function normalizeUsage(value: unknown, type: QuestionType): QuestionUsage[] {
  const allowed: QuestionUsage[] = ["presentation", "moodle-interactive", "moodle-homework", "game"];
  const requested = Array.isArray(value) ? value.filter((item): item is QuestionUsage => typeof item === "string" && allowed.includes(item as QuestionUsage)) : [];
  if (requested.length) return Array.from(new Set(requested));
  return type === "essay" ? ["presentation", "moodle-interactive", "moodle-homework"] : [...allowed];
}

function questionFromRaw(raw: Record<string, unknown>, index: number, ideaId: string, ideaTitle: string): FactoryQuestion {
  const type: QuestionType = raw.type === "true-false" || raw.type === "essay" || raw.type === "cloze" || raw.type === "drag-drop" ? raw.type : raw.questionType === "true-false" || raw.questionType === "essay" || raw.questionType === "cloze" || raw.questionType === "drag-drop" ? raw.questionType : "mcq";
  const options = Array.isArray(raw.options) ? raw.options.filter((value): value is string => typeof value === "string").slice(0, 6) : type === "true-false" ? ["صح", "خطأ"] : [];
  const correctAnswer = typeof raw.correctAnswer === "string" ? raw.correctAnswer : type === "true-false" ? options[0] : options[0] ?? "";
  return {
    id: typeof raw.id === "string" ? raw.id : `${ideaId}-q${index + 1}`,
    type,
    text: String(raw.text ?? ""),
    correctAnswer,
    options,
    difficulty: raw.difficulty === "easy" || raw.difficulty === "hard" ? raw.difficulty : "medium",
    rewardPoints: Number.isFinite(Number(raw.rewardPoints)) ? Math.max(1, Math.min(20, Math.round(Number(raw.rewardPoints)))) : 5,
    solutionSteps: Array.isArray(raw.solutionSteps) ? raw.solutionSteps.filter((value): value is string => typeof value === "string") : [],
    solutionScript: String(raw.solutionScript ?? raw.explanation ?? ""),
    ideaId: typeof raw.ideaId === "string" ? raw.ideaId : ideaId,
    ideaTitle,
    stepNumber: Number.isInteger(raw.stepNumber) ? Number(raw.stepNumber) : 1,
    tags: Array.from(new Set([...(Array.isArray(raw.tags) ? raw.tags.filter((value): value is string => typeof value === "string" ) : []), `bisalasa:${ideaId}:${index + 1}`])),
    gameReady: type === "mcq" || type === "true-false" ? raw.gameReady !== false : false,
    images: Array.isArray(raw.images) ? raw.images.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")).map((item) => ({ url: String(item.url ?? "").trim(), alt: String(item.alt ?? "").trim(), type: String(item.type ?? "image") })).filter((item) => item.url) : [],
    imageRefs: Array.isArray(raw.imageRefs) ? raw.imageRefs.filter((value): value is string => typeof value === "string" && value.trim().length > 0).slice(0, 12) : [],
    usage: normalizeUsage(raw.usage, type),
    quality: undefined,
  };
}

function normalizeFactoryQuestion(raw: Record<string, unknown>, index: number): FactoryQuestion {
  const ideaId = typeof raw.ideaId === "string" ? raw.ideaId : "needs-review";
  const ideaTitle = typeof raw.ideaTitle === "string" ? raw.ideaTitle : "يحتاج مراجعة";
  return questionFromRaw({ ...raw, type: raw.type ?? raw.questionType, images: Array.isArray(raw.images) ? raw.images : [] }, index, ideaId, ideaTitle);
}

export default function CurriculumFactoryPage() {
  const [state, setState] = useState<FactoryState>(() => emptyFactory());
  const [drafts, setDrafts] = useState<CurriculumFactoryDraft[]>([]);
  const [prompts, setPrompts] = useState<CurriculumPromptTemplate[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [lastSaved, setLastSaved] = useState("");
  const [aiKeys, setAiKeys] = useState<AiKeySummary[]>([]);
  const [discoveredModels, setDiscoveredModels] = useState<AiDiscoveredModel[]>([]);
  const [versions, setVersions] = useState<CurriculumDraftVersion[]>([]);
  const [previewEnabled, setPreviewEnabled] = useState(true);
  const [questionConfig, setQuestionConfig] = useState<{ ideaId: string; type: QuestionType; difficulty: FactoryQuestion["difficulty"]; count: number }>({ ideaId: "all", type: "mcq", difficulty: "medium", count: 4 });
  const [search, setSearch] = useState("");
  const [filterIdea, setFilterIdea] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterDifficulty, setFilterDifficulty] = useState("all");
  const [filterScore, setFilterScore] = useState("all");
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [dragQuestionId, setDragQuestionId] = useState<string | null>(null);
  const [previewQuestion, setPreviewQuestion] = useState<FactoryQuestion | null>(null);
  const [questionTemplates, setQuestionTemplates] = useState<QuestionTemplate[]>([]);
  const [lessonTemplates, setLessonTemplates] = useState<LessonTemplate[]>([]);
  const [showQuestionTemplates, setShowQuestionTemplates] = useState(false);
  const [showLessonTemplates, setShowLessonTemplates] = useState(false);
  const [diffFrom, setDiffFrom] = useState("");
  const [diffTo, setDiffTo] = useState("");
  const [promptTestResult, setPromptTestResult] = useState<{ text: string; usage?: { totalTokens: number; estimatedCostUsd: number } } | null>(null);
  const [streamText, setStreamText] = useState("");
  const [lastAiUsage, setLastAiUsage] = useState<{ inputTokens: number; outputTokens: number; totalTokens: number; estimatedCostUsd: number } | null>(null);
  const [comparisonResults, setComparisonResults] = useState<Array<{ text: string; model: string; provider: AiProvider; usage?: { totalTokens: number; estimatedCostUsd: number } }>>([]);
  const [assetTargets, setAssetTargets] = useState<Record<string, string>>({});
  const router = useRouter();

  const ideas = useMemo(() => state.manifest.ideas ?? [], [state.manifest.ideas]);
  const assetTargetOptions = useMemo(() => ideas.length
    ? ideas.flatMap((idea) => idea.steps.flatMap((step) => (step.slides ?? []).map((slide) => ({ value: `${idea.id}::${step.step}::${slide.id}`, label: `${idea.title} / خطوة ${step.step} / ${slide.title || slide.id}` }))))
    : (state.manifest.steps ?? []).flatMap((step) => (step.slides ?? []).map((slide) => ({ value: `flat::${step.step}::${slide.id}`, label: `الدرس / خطوة ${step.step} / ${slide.title || slide.id}` }))), [ideas, state.manifest.steps]);
  const selectedTemplate = prompts.find((prompt) => prompt.key === selectedPrompt);
  const questionByIdea = useMemo(() => ideas.map((idea) => ({ idea, count: state.questions.filter((question) => question.ideaId === idea.id).length })), [ideas, state.questions]);
  const tagSuggestions = useMemo(() => Array.from(new Set(state.questions.flatMap((question) => question.tags))).sort(), [state.questions]);
  const filteredQuestions = useMemo(() => state.questions.filter((question) => {
    const quality = question.quality ?? validateQuestionStrict({ ...question, images: question.images ?? [] });
    const haystack = `${question.text} ${question.correctAnswer} ${question.tags.join(" ")}`.toLocaleLowerCase();
    if (search.trim() && !haystack.includes(search.trim().toLocaleLowerCase())) return false;
    if (filterIdea !== "all" && question.ideaId !== filterIdea) return false;
    if (filterType !== "all" && question.type !== filterType) return false;
    if (filterDifficulty !== "all" && question.difficulty !== filterDifficulty) return false;
    if (filterScore === "low" && quality.score >= 50) return false;
    if (filterScore === "medium" && (quality.score < 50 || quality.score >= 80)) return false;
    if (filterScore === "high" && quality.score < 80) return false;
    return true;
  }), [state.questions, search, filterIdea, filterType, filterDifficulty, filterScore]);
  const duplicates = useMemo(() => detectDuplicates(state.questions), [state.questions]);
  const difficultyCounts = useMemo(() => ({ easy: state.questions.filter((question) => question.difficulty === "easy").length, medium: state.questions.filter((question) => question.difficulty === "medium").length, hard: state.questions.filter((question) => question.difficulty === "hard").length }), [state.questions]);
  const stageLabels = ["الإدخال الخام", "الهيكلة والسكريبت", "بنك الأسئلة", "التوزيع والربط", "الخبز والتصدير"];
  const currentStageMode = state.stageModes[String(state.stage)] ?? "manual";
  const currentStageSkipped = state.skippedStages.includes(state.stage);

  useEffect(() => {
    void (async () => {
      try {
        await Promise.all([localDb.curriculumFactory.seedPrompts(), localDb.curriculumFactory.seedQuestionTemplates()]);
        const [loadedDrafts, loadedPrompts, keyState, loadedQuestionTemplates, loadedLessonTemplates] = await Promise.all([localDb.curriculumFactory.listDrafts(), localDb.curriculumFactory.listPrompts(), aiClient.listKeys().catch(() => ({ keys: [], envConfigured: false })), localDb.curriculumFactory.listQuestionTemplates().catch(() => []), localDb.curriculumFactory.listLessonTemplates().catch(() => [])]);
        setDrafts(loadedDrafts);
        setPrompts(loadedPrompts);
        setAiKeys(keyState.keys);
        setQuestionTemplates(loadedQuestionTemplates);
        setLessonTemplates(loadedLessonTemplates);
        if (loadedDrafts.length === 0 && typeof window !== "undefined") {
          try {
            const backup = window.localStorage.getItem("bisalasa-factory-backup-last");
            if (backup) {
              const parsed = parseJson<Partial<FactoryState>>(backup, {});
              if (parsed.manifest && window.confirm("توجد نسخة محلية احتياطية لمصنع المناهج. هل تريد استعادتها؟")) setState({ ...emptyFactory(), ...parsed, ai: parsed.ai ?? defaultAiSettings(), manifest: normalizeManifest(parsed.manifest as Partial<SlideManifest>, String(parsed.title || "درس مستعاد")), questions: Array.isArray(parsed.questions) ? (parsed.questions as Array<Record<string, unknown>>).map(normalizeFactoryQuestion) : [] });
            }
          } catch { /* local recovery remains best effort */ }
        }
      } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر تحميل مسودات المصنع"); }
    })();
  }, []);

  const patch = (next: Partial<FactoryState>) => setState((current) => {
    const merged = { ...current, ...next };
    if (!next.questions || !merged.manifest.ideas?.length) return merged;
    const questions = merged.questions;
    const ideas = merged.manifest.ideas.map((idea) => ({
      ...idea,
      steps: idea.steps.map((step) => {
        const refs = questions.filter((question) => question.ideaId === idea.id && question.stepNumber === step.step).map((question) => question.id);
        const nextRefs = Array.from(new Set([...(step.questionRefs ?? []).filter((id) => questions.some((question) => question.id === id)), ...refs]));
        const slides = (step.slides ?? []).map((slide) => (step.slides ?? []).length === 1 && refs.length ? { ...slide, questionRefs: Array.from(new Set([...(slide.questionRefs ?? []), ...refs])) } : slide);
        return { ...step, questionRefs: nextRefs, slides };
      }),
    }));
    return { ...merged, manifest: normalizeManifest({ ...merged.manifest, ideas }, merged.title) };
  });

  const assignAssetToSlide = (assetId: string, ideaId: string, stepNumber: number, slideId: string) => {
    const addRef = (refs: string[] | undefined) => Array.from(new Set([...(refs ?? []), assetId])).slice(0, 30);
    const manifest = { ...state.manifest };
    if (manifest.ideas?.length) {
      manifest.ideas = manifest.ideas.map((idea) => idea.id !== ideaId ? idea : {
        ...idea,
        steps: idea.steps.map((step) => step.step !== stepNumber ? step : {
          ...step,
          assetRefs: addRef(step.assetRefs),
          slides: (step.slides ?? []).map((slide) => slide.id === slideId ? { ...slide, assetRefs: addRef(slide.assetRefs) } : slide),
        }),
      });
    } else if (manifest.steps?.length) {
      manifest.steps = manifest.steps.map((step) => step.step !== stepNumber ? step : {
        ...step,
        assetRefs: addRef(step.assetRefs),
        slides: (step.slides ?? []).map((slide) => slide.id === slideId ? { ...slide, assetRefs: addRef(slide.assetRefs) } : slide),
      });
    }
    patch({ manifest: normalizeManifest(manifest, state.title), assets: state.assets.map((asset) => asset.id === assetId ? { ...asset, status: "final" } : asset) });
    toast.success("تم ربط أصل الكتاب بالـSlide المحددة.");
  };

  const updateManifestStep = (ideaId: string, stepNumber: number, change: Partial<SlideStep>) => {
    const manifest = { ...state.manifest };
    if (manifest.ideas?.length) {
      manifest.ideas = manifest.ideas.map((idea) => idea.id !== ideaId ? idea : { ...idea, steps: idea.steps.map((step) => step.step === stepNumber ? { ...step, ...change } : step) });
    } else if (manifest.steps?.length) {
      manifest.steps = manifest.steps.map((step) => step.step === stepNumber ? { ...step, ...change } : step);
    }
    patch({ manifest: normalizeManifest(manifest, state.title) });
  };
  const addManifestSlide = (ideaId: string, step: SlideStep) => {
    const slides = [...(step.slides ?? []), normalizeSlide({ id: `${step.id || `step-${step.step}`}-slide-${(step.slides?.length ?? 0) + 1}`, title: `Slide ${(step.slides?.length ?? 0) + 1}`, type: "content", script: step.script, notes: step.notes }, step.step - 1, step.slides?.length ?? 0)];
    updateManifestStep(ideaId, step.step, { slides });
    toast.success("أضيفت Slide جديدة داخل الخطوة.");
  };

  const nextRunnableStage = (stage: number, skipped = state.skippedStages) => {
    let next = Math.min(5, Math.max(1, stage));
    while (next < 5 && skipped.includes(next)) next += 1;
    return next;
  };

  const skipStage = (stage = state.stage) => {
    const skippedStages = Array.from(new Set([...state.skippedStages, stage])).sort((left, right) => left - right);
    const stageModes = { ...state.stageModes, [String(stage)]: "skipped" as StageMode };
    const next = nextRunnableStage(stage + 1, skippedStages);
    patch({ skippedStages, stageModes, stage: next, status: "review" });
    toast.success(`تم تخطي المرحلة ${stage} والانتقال إلى المرحلة ${next}. يمكنك الرجوع إليها لاحقاً.`);
  };

  const restoreStage = (stage: number) => {
    patch({ skippedStages: state.skippedStages.filter((item) => item !== stage), stageModes: { ...state.stageModes, [String(stage)]: "manual" } });
    toast.success(`تمت إعادة تفعيل المرحلة ${stage}.`);
  };

  const saveDraft = async (status = state.status) => {
    setBusy(true);
    try {
      const manifestForSave = normalizeManifest({ ...state.manifest, assets: state.assets.length ? state.assets : state.manifest.assets }, state.title);
      const saved = await localDb.curriculumFactory.upsertDraft({ id: state.id, ...state, status, stage: state.stage, manifestJson: JSON.stringify(manifestForSave), questionsJson: JSON.stringify(state.questions), sourceImagesJson: JSON.stringify(state.sourceImages), metadataJson: JSON.stringify({ validation: validation ?? validateFactory({ ...state, manifest: manifestForSave }), ai: state.ai, assets: state.assets, skippedStages: state.skippedStages, stageModes: state.stageModes, stageOutputs: state.stageOutputs, importMode: state.importMode, savedFrom: "curriculum-factory" }) });
      setState((current) => ({ ...current, id: saved.id, status: saved.status, stage: saved.stage }));
      setDrafts((current) => [saved, ...current.filter((draft) => draft.id !== saved.id)]);
      const savedVersions = await localDb.curriculumFactory.listVersions(saved.id).catch(() => []);
      setVersions(savedVersions);
      setLastSaved(new Date().toLocaleTimeString("ar-EG"));
      return saved;
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر حفظ المسودة"); throw error; } finally { setBusy(false); }
  };

  const updateAiSettings = (lane: "structure" | "questions" | "improve", change: Partial<AiSettings>) => patch({ ai: { ...state.ai, [lane]: { ...state.ai[lane], ...change } } });

  const loadModels = async (lane: "structure" | "questions" | "improve") => {
    const settings = state.ai[lane];
    try {
      const result = await aiClient.listModels({ provider: settings.provider, keyId: settings.keyId });
      setDiscoveredModels(result);
      if (!settings.model && result[0]?.id) updateAiSettings(lane, { model: result[0].id });
      toast.success(`تم سحب ${result.length} موديل للمزود ${settings.provider}`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر سحب الموديلات"); }
  };

  const structureWithAi = async () => {
    if (!state.sourceText.trim()) return toast.error("أضف النص الخام أولاً.");
    setBusy(true);
    try {
      const promptTemplate = prompts.find((item) => item.key === "structure-lesson");
      const prompt = applyPromptVariables(promptTemplate?.content ?? "حوّل النص إلى JSON لدرس تفاعلي.", state);
      const examples = promptTemplate ? parseJson<Array<{ input: string; output: string }>>(promptTemplate.examplesJson, []) : [];
      const examplesText = examples.length ? `\nأمثلة إرشادية:\n${examples.map((example, index) => `مثال ${index + 1}:\nالمدخل: ${example.input}\nالمخرج: ${example.output}`).join("\n")}` : "";
      const ai = state.ai.structure;
      const result = await aiClient.generate({ operation: "curriculum-factory-structure", model: ai.model || undefined, keyId: ai.keyId, temperature: ai.temperature, maxOutputTokens: ai.maxOutputTokens, systemInstruction: `${prompt}${examplesText}\nأخرج JSON فقط بالشكل {lessonId,title,subtitle,ideas:[{id,title,description,steps:[{step,id,title,type,script,notes,slides:[{id,title,type,body,script,notes,assetRefs,questionRefs}]}]}]}. لا تخترع معلومات خارج المصدر.`, input: `البيانات: ${state.title} — ${state.grade} — ${state.subject}\nالنص الخام:\n${state.sourceText}` });
      setLastAiUsage(result.usage ?? null);
      const manifest = normalizeManifest(parseJson<Partial<SlideManifest>>(result.text, {}), state.title);
      patch({ manifest, stage: 2, status: "review", stageOutputs: { ...state.stageOutputs, "2": result.text }, stageModes: { ...state.stageModes, "2": "ai" }, skippedStages: state.skippedStages.filter((stage) => stage !== 2) });
      toast.success("تمت الهيكلة كمسودة؛ راجع كل فكرة وخطوة قبل الاعتماد.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر هيكلة الدرس بالـAI"); }
    finally { setBusy(false); }
  };

  const structureWithoutAi = () => { const manifest = baselineFromSource(state); patch({ manifest, stage: 2, status: "review", stageOutputs: { ...state.stageOutputs, "2": JSON.stringify(manifest) }, stageModes: { ...state.stageModes, "2": "manual" }, skippedStages: state.skippedStages.filter((stage) => stage !== 2) }); toast.success("تم إنشاء هيكل أولي من الفقرات؛ راجعه يدوياً."); };

  const generateQuestions = async (config = questionConfig) => {
    if (!ideas.length) return toast.error("أنشئ الأفكار أولاً.");
    const targets = config.ideaId === "all" ? ideas.slice(0, 12) : ideas.filter((idea) => idea.id === config.ideaId);
    if (!targets.length) return toast.error("اختر فكرة صالحة أولاً.");
    setBusy(true);
    try {
      const generated: FactoryQuestion[] = [];
      const ai = state.ai.questions;
      for (const idea of targets) {
        const context = idea.steps.map((step) => `${step.title}: ${Array.isArray(step.script) ? step.script.join(" ") : step.script ?? ""}`).join("\n");
        const typeInstruction = config.type === "mcq" ? "MCQ بأربعة خيارات" : config.type === "true-false" ? "صح أو خطأ بخيارين: صح وخطأ" : "سؤال مقالي بإجابة نصية، options فارغة وgameReady=false";
        const promptTemplate = prompts.find((item) => item.key === "generate-questions");
        const basePrompt = applyPromptVariables(promptTemplate?.content ?? "ولّد أسئلة من السياق فقط.", { ...state, questions: state.questions });
        const examples = promptTemplate ? parseJson<Array<{ input: string; output: string }>>(promptTemplate.examplesJson, []) : [];
        const examplesText = examples.length ? `\nأمثلة إرشادية:\n${examples.map((example, index) => `مثال ${index + 1}:\nالمدخل: ${example.input}\nالمخرج: ${example.output}`).join("\n")}` : "";
        const result = await aiClient.generate({ operation: "curriculum-factory-question-batch", model: ai.model || undefined, keyId: ai.keyId, temperature: ai.temperature, maxOutputTokens: ai.maxOutputTokens, systemInstruction: `${basePrompt}${examplesText}\nأخرج JSON فقط بالشكل {questions:[{type,text,correctAnswer,options,rewardPoints,difficulty,tags,solutionSteps,solutionScript,gameReady}]}. ولّد ${config.count} ${typeInstruction} بدرجة ${config.difficulty} من السياق فقط. لا تخترع معلومات خارج النص.`, input: `الدرس: ${state.title}\nالفكرة: ${idea.title}\nالسياق:\n${context}` });
        setLastAiUsage(result.usage ?? null);
        const parsed = parseJson<{ questions?: Array<Record<string, unknown>> }>(result.text, {});
        (parsed.questions ?? []).slice(0, config.count).forEach((raw, index) => generated.push(questionFromRaw({ ...raw, type: config.type, difficulty: config.difficulty }, index, idea.id, idea.title)));
      }
      const targetIds = new Set(targets.map((idea) => idea.id));
      patch({ questions: [...state.questions.filter((question) => !targetIds.has(question.ideaId)), ...generated], stage: 3, status: "review", stageOutputs: { ...state.stageOutputs, "3": JSON.stringify(generated) }, stageModes: { ...state.stageModes, "3": "ai" }, skippedStages: state.skippedStages.filter((stage) => stage !== 3) });
      toast.success(`تم تجهيز ${generated.length} سؤالاً للمراجعة قبل الاعتماد.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر توليد الأسئلة"); }
    finally { setBusy(false); }
  };

  const extractQuestionsFromText = async () => {
    if (!state.sourceText.trim()) return toast.error("أضف النص الخام أولاً.");
    setBusy(true);
    try {
      const ai = state.ai.questions;
      const result = await aiClient.generate({ operation: "curriculum-factory-extract-questions", model: ai.model || undefined, keyId: ai.keyId, temperature: 0.15, maxOutputTokens: Math.min(5000, ai.maxOutputTokens), systemInstruction: "استخرج الأسئلة الموجودة حرفياً أو شبه حرفياً في النص. أخرج JSON فقط بالشكل {questions:[{type,text,correctAnswer,options,difficulty,tags,solutionSteps,solutionScript}]}. لا تخترع سؤالاً غير موجود، وإذا لم توجد إجابة معلومة اترك correctAnswer فارغاً.", input: state.sourceText });
      const parsed = parseJson<{ questions?: Array<Record<string, unknown>> }>(result.text, {});
      const extracted = (parsed.questions ?? []).map((raw, index) => questionFromRaw({ ...raw, type: raw.type ?? "mcq", gameReady: raw.type !== "essay" }, index, "needs-review", "استخراج من النص"));
      patch({ questions: [...state.questions, ...extracted], stage: 3, status: "review", stageOutputs: { ...state.stageOutputs, "3": JSON.stringify(extracted) }, stageModes: { ...state.stageModes, "3": "manual" }, skippedStages: state.skippedStages.filter((stage) => stage !== 3) });
      toast.success(`تم استخراج ${extracted.length} سؤالاً للمراجعة، دون اعتماد تلقائي.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر استخراج الأسئلة"); }
    finally { setBusy(false); }
  };

  const improveQuestion = async (question: FactoryQuestion) => {
    setBusy(true);
    try {
      const ai = state.ai.improve;
      const result = await aiClient.generate({ operation: "curriculum-factory-improve-question", model: ai.model || undefined, keyId: ai.keyId, temperature: ai.temperature, maxOutputTokens: ai.maxOutputTokens, systemInstruction: "أخرج JSON فقط بالشكل {text,correctAnswer,options,solutionSteps,solutionScript}. حسّن الوضوح دون تغيير المعنى أو اختراع معلومة خارج السؤال.", input: `السؤال الحالي: ${question.text}\nالإجابة: ${question.correctAnswer}\nالخيارات: ${question.options.join(" | ")}\nالسياق المرجعي: ${state.sourceText}` });
      const improved = parseJson<Record<string, unknown>>(result.text, {});
      updateQuestion(question.id, { text: typeof improved.text === "string" ? improved.text : question.text, correctAnswer: typeof improved.correctAnswer === "string" ? improved.correctAnswer : question.correctAnswer, options: Array.isArray(improved.options) ? improved.options.filter((value): value is string => typeof value === "string") : question.options, solutionSteps: Array.isArray(improved.solutionSteps) ? improved.solutionSteps.filter((value): value is string => typeof value === "string") : question.solutionSteps, solutionScript: typeof improved.solutionScript === "string" ? improved.solutionScript : question.solutionScript });
      toast.success("تم تحسين السؤال كاقتراح؛ راجعه قبل الحفظ.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر تحسين السؤال"); }
    finally { setBusy(false); }
  };

  const generateDistractors = async (question: FactoryQuestion) => {
    if (question.type !== "mcq") return toast.error("البدائل الخاطئة متاحة لأسئلة MCQ فقط.");
    setBusy(true);
    try {
      const ai = state.ai.improve;
      const result = await aiClient.generate({ operation: "curriculum-factory-distractors", model: ai.model || undefined, keyId: ai.keyId, temperature: 0.6, maxOutputTokens: 1000, systemInstruction: "أخرج JSON فقط بالشكل {options:[string,string,string]}. البدائل خاطئة لكنها معقولة، ولا تكرر الإجابة الصحيحة أو بعضها.", input: `السؤال: ${question.text}\nالإجابة الصحيحة: ${question.correctAnswer}\nالسياق: ${state.sourceText}` });
      const generated = parseJson<{ options?: string[] }>(result.text, {});
      const options = Array.from(new Set([question.correctAnswer, ...(generated.options ?? []).filter((value) => typeof value === "string")])).slice(0, 6);
      updateQuestion(question.id, { options });
      toast.success("تم إنشاء بدائل للمراجعة.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر توليد البدائل"); }
    finally { setBusy(false); }
  };

  const autoMap = () => {
    const known = new Set(ideas.map((idea) => idea.id));
    const mapped = state.questions.map((question) => {
      const tagIdea = question.tags.find((tag) => /idea[-_:]?[a-z0-9-]+/i.test(tag))?.match(/idea[-_:]?([a-z0-9-]+)/i)?.[1];
      const candidate = question.ideaId && known.has(question.ideaId) ? question.ideaId : tagIdea && known.has(`idea-${tagIdea}`) ? `idea-${tagIdea}` : question.ideaId;
      return { ...question, ideaId: candidate || "needs-review" };
    });
    patch({ questions: mapped, stage: 4, status: "review", stageOutputs: { ...state.stageOutputs, "4": JSON.stringify(mapped) }, stageModes: { ...state.stageModes, "4": "manual" }, skippedStages: state.skippedStages.filter((stage) => stage !== 4) });
    setValidation(validateFactory({ ...state, questions: mapped }));
    toast.success("تمت المطابقة بالـideaId والوسوم، مع إبقاء العناصر غير المؤكدة للمراجعة.");
  };

  const bake = async () => {
    const result = validateFactory(state);
    setValidation(result);
    if (result.errors.length) return toast.error("لا يمكن خبز الدرس قبل إصلاح أخطاء التحقق.");
    try {
      const saved = await saveDraft("review");
      setBusy(true);
      const baked = await localDb.curriculumFactory.bakeDraft(saved.id, buildLessonHtml(state.manifest));
      setState((current) => ({ ...current, id: baked.draft.id, stage: 5, status: "baked" }));
      setDrafts((current) => current.map((draft) => draft.id === baked.draft.id ? baked.draft : draft));
      toast.success(`تم خبز الدرس وإضافته إلى المنهج مع ${baked.questionsCount} سؤالاً.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر خبز الدرس"); }
    finally { setBusy(false); }
  };

  const loadDraft = async (draft: CurriculumFactoryDraft) => {
    const metadata = parseJson<Partial<Pick<FactoryState, "ai" | "assets" | "skippedStages" | "stageModes" | "stageOutputs" | "importMode">>>(draft.metadataJson, {});
    setState({ id: draft.id, title: draft.title, grade: draft.grade, subject: draft.subject, academicYear: draft.academicYear, curriculumKey: draft.curriculumKey, lessonKey: draft.lessonKey, sourceText: draft.sourceText, sourceImages: parseJson<string[]>(draft.sourceImagesJson, []), assets: Array.isArray(metadata.assets) ? metadata.assets : [], stage: draft.stage, status: draft.status, importMode: metadata.importMode === "update" ? "update" : "new", skippedStages: Array.isArray(metadata.skippedStages) ? metadata.skippedStages : [], stageModes: metadata.stageModes ?? emptyFactory().stageModes, stageOutputs: metadata.stageOutputs ?? {}, manifest: normalizeManifest(parseJson<Partial<SlideManifest>>(draft.manifestJson, {}), draft.title), questions: parseJson<Array<Record<string, unknown>>>(draft.questionsJson, []).map(normalizeFactoryQuestion), ai: metadata.ai ?? defaultAiSettings() });
    setVersions(await localDb.curriculumFactory.listVersions(draft.id).catch(() => []));
    setValidation(null);
  };

  const restoreVersion = async (version: CurriculumDraftVersion) => {
    if (!state.id) return;
    setBusy(true);
    try {
      const restored = await localDb.curriculumFactory.restoreVersion(state.id, version.id);
      await loadDraft(restored);
      toast.success(`تمت استعادة الإصدار ${version.version} كمسودة مراجعة جديدة.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر استعادة الإصدار"); }
    finally { setBusy(false); }
  };

  const importPack = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      void (async () => {
        const pack = parseJson<Partial<FactoryState>>(String(reader.result), {});
        if (!pack.manifest) return toast.error("حزمة غير صالحة: manifest مفقود.");
        const lessonKey = String(pack.lessonKey || (pack.manifest as Partial<SlideManifest>).lessonId || "").trim();
        let importMode: "new" | "update" = "new";
        let finalLessonKey = lessonKey || `lesson-${Date.now()}`;
        try {
          const lessons = await localDb.lessons.list();
          const existing = lessons.find((lesson) => lesson.lessonId === lessonKey);
          if (existing) {
            importMode = window.confirm(`يوجد درس بنفس المعرف «${lessonKey}». اضغط موافق لتحديثه، أو إلغاء لاستيراده كدرس جديد.`) ? "update" : "new";
            if (importMode === "new") finalLessonKey = `${lessonKey}-copy-${Date.now()}`;
          }
        } catch { /* الاستيراد المحلي يظل متاحاً حتى لو تعذر فحص الدروس */ }
        const importedManifest = normalizeManifest({ ...(pack.manifest as Partial<SlideManifest>), lessonId: finalLessonKey }, String(pack.title || "درس مستورد"));
        setState({ ...emptyFactory(), ...pack, lessonKey: finalLessonKey, assets: Array.isArray(pack.assets) ? pack.assets as FactoryAsset[] : [], skippedStages: Array.isArray(pack.skippedStages) ? pack.skippedStages as number[] : [], stageModes: pack.stageModes ?? emptyFactory().stageModes, stageOutputs: pack.stageOutputs ?? {}, importMode, ai: pack.ai ?? defaultAiSettings(), manifest: importedManifest, questions: Array.isArray(pack.questions) ? (pack.questions as Array<Record<string, unknown>>).map(normalizeFactoryQuestion) : [], status: "review", stage: 1 });
        toast.success(importMode === "update" ? "تم تحميل الحزمة للتحديث بعد مراجعتها." : "تم استيراد الحزمة كدرس جديد قابل للمراجعة.");
      })();
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const updateQuestion = (id: string, change: Partial<FactoryQuestion>) => patch({ questions: state.questions.map((question) => question.id === id ? { ...question, ...change, images: change.images ?? question.images ?? [] } : question) });
  const bulkImprove = async () => { if (!selectedQuestionIds.length) return toast.error("حدد أسئلة أولاً."); setBusy(true); try { for (const id of selectedQuestionIds) { const question = state.questions.find((item) => item.id === id); if (!question) continue; const ai = state.ai.improve; const result = await aiClient.generate({ operation: "curriculum-factory-bulk-improve", model: ai.model || undefined, keyId: ai.keyId, temperature: ai.temperature, maxOutputTokens: ai.maxOutputTokens, systemInstruction: "أخرج JSON فقط بالشكل {text,correctAnswer,options,solutionSteps,solutionScript}. حسّن الوضوح دون تغيير المعنى.", input: `السؤال: ${question.text}\nالسياق: ${state.sourceText}` }); const improved = parseJson<Record<string, unknown>>(result.text, {}); updateQuestion(id, { text: typeof improved.text === "string" ? improved.text : question.text, correctAnswer: typeof improved.correctAnswer === "string" ? improved.correctAnswer : question.correctAnswer, options: Array.isArray(improved.options) ? improved.options.filter((value): value is string => typeof value === "string") : question.options, solutionSteps: Array.isArray(improved.solutionSteps) ? improved.solutionSteps.filter((value): value is string => typeof value === "string") : question.solutionSteps, solutionScript: typeof improved.solutionScript === "string" ? improved.solutionScript : question.solutionScript }); } setSelectedQuestionIds([]); toast.success("تم تحسين الأسئلة المحددة كمسودات."); } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر التحسين الجماعي"); } finally { setBusy(false); } };
  const bulkGenerateDistractors = async () => { if (!selectedQuestionIds.length) return toast.error("حدد أسئلة أولاً."); setBusy(true); try { for (const id of selectedQuestionIds) { const question = state.questions.find((item) => item.id === id); if (!question || question.type !== "mcq") continue; const ai = state.ai.improve; const result = await aiClient.generate({ operation: "curriculum-factory-bulk-distractors", model: ai.model || undefined, keyId: ai.keyId, temperature: 0.6, maxOutputTokens: 800, systemInstruction: "أخرج JSON فقط بالشكل {options:[string,string,string]}. لا تكرر الإجابة الصحيحة.", input: `السؤال: ${question.text}\nالإجابة الصحيحة: ${question.correctAnswer}` }); const generated = parseJson<{ options?: string[] }>(result.text, {}); updateQuestion(id, { options: Array.from(new Set([question.correctAnswer, ...(generated.options ?? []).filter((value) => typeof value === "string")])).slice(0, 6) }); } setSelectedQuestionIds([]); toast.success("تم توليد البدائل للأسئلة MCQ المحددة."); } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر توليد البدائل جماعياً"); } finally { setBusy(false); } };
  const runModelComparison = async () => { const candidates = Array.from(new Map([state.ai.structure, state.ai.questions, state.ai.improve].filter((settings) => settings.model).map((settings) => [`${settings.provider}:${settings.model}`, { model: settings.model, keyId: settings.keyId }])).values()).slice(0, 4); if (candidates.length < 2) return toast.error("حدد موديلين على الأقل في إعدادات AI أولاً."); setBusy(true); try { const result = await aiClient.compareModels({ input: state.sourceText || "اكتب ملخصاً تربوياً قصيراً.", systemInstruction: "أجب باختصار وبشكل تربوي.", models: candidates, temperature: 0.25, maxOutputTokens: 900 }); setComparisonResults(result.map((item) => ({ text: item.text, model: item.model, provider: item.provider, usage: item.usage ? { totalTokens: item.usage.totalTokens, estimatedCostUsd: item.usage.estimatedCostUsd } : undefined }))); toast.success("اكتملت مقارنة النماذج كاقتراح مستقل."); } catch (error) { toast.error(error instanceof Error ? error.message : "تعذرت مقارنة النماذج"); } finally { setBusy(false); } };
  const uploadQuestionImage = async (question: FactoryQuestion, event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    setBusy(true);
    try {
      const uploaded: Array<{ image: { url: string; alt: string; type: string }; asset: FactoryAsset }> = [];
      for (const file of files.slice(0, 8)) {
        const form = new FormData();
        form.append("file", file);
        const response = await fetch("/api/curriculum-factory/assets", { method: "POST", body: form });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ok) throw new Error(payload.error || "تعذر رفع الصورة");
        const assetId = `asset-${crypto.randomUUID()}`;
        const alt = file.name.replace(/\.[^.]+$/, "");
        uploaded.push({ image: { url: String(payload.data.url), alt, type: file.type }, asset: { id: assetId, description: alt, type: file.type.includes("svg") ? "geometric-figure" : "illustration", status: "final", url: String(payload.data.url), alt, source: "book-crop", mimeType: file.type, filename: file.name, size: file.size } });
      }
      patch({ assets: [...state.assets, ...uploaded.map((item) => item.asset)], questions: state.questions.map((item) => item.id === question.id ? { ...item, images: [...(item.images ?? []), ...uploaded.map((item) => item.image)], imageRefs: [...(item.imageRefs ?? []), ...uploaded.map((item) => item.asset.id)] } : item) });
      toast.success(`تم رفع ${uploaded.length} صورة وربطها بالسؤال دون حذف الصور السابقة.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر رفع الصور"); }
    finally { setBusy(false); }
  };
  const runOcrUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("language", "ara+eng");
      const response = await fetch("/api/curriculum-factory/ocr", { method: "POST", body: form });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.data) throw new Error(payload.error || "تعذر استخراج النص");
      const asset = normalizeAsset(payload.data.asset as Partial<FactoryAsset>, state.assets.length);
      const extracted = String(payload.data.text || "").trim();
      const sourceText = [state.sourceText.trim(), extracted].filter(Boolean).join("\n\n");
      const assets = [...state.assets, asset];
      patch({ sourceText, sourceImages: [...state.sourceImages, asset.url || ""].filter(Boolean), assets, manifest: normalizeManifest({ ...state.manifest, assets }, state.title) });
      toast.success(extracted ? `تم استخراج ${payload.data.wordCount || 0} كلمة وإضافة صورة المصدر.` : "أضيفت صورة المصدر، لكن لم يُعثر على نص واضح.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر تشغيل OCR"); }
    finally { setBusy(false); }
  };
  const uploadFactoryAssets = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    setBusy(true);
    try {
      const uploaded: FactoryAsset[] = [];
      for (const file of files.slice(0, 12)) {
        const form = new FormData();
        form.append("file", file);
        const response = await fetch("/api/curriculum-factory/assets", { method: "POST", body: form });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.data?.url) throw new Error(payload.error || "تعذر رفع أصل");
        const alt = file.name.replace(/\.[^.]+$/, "");
        uploaded.push({ id: `asset-${crypto.randomUUID()}`, description: alt, type: file.type.includes("svg") ? "geometric-figure" : "illustration", status: "final", url: String(payload.data.url), alt, source: "book-crop", mimeType: file.type, filename: file.name, size: file.size });
      }
      patch({ assets: [...state.assets, ...uploaded], manifest: normalizeManifest({ ...state.manifest, assets: [...state.assets, ...uploaded] }, state.title) });
      toast.success(`تمت إضافة ${uploaded.length} أصل إلى مكتبة الكتاب.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر رفع أصول الكتاب"); }
    finally { setBusy(false); }
  };
  const updateAsset = (assetId: string, change: Partial<FactoryAsset>) => {
    const assets = state.assets.map((asset) => asset.id === assetId ? { ...asset, ...change } : asset);
    patch({ assets, manifest: normalizeManifest({ ...state.manifest, assets }, state.title) });
  };
  const updateSelectedQuestions = (change: Partial<FactoryQuestion>) => { if (!selectedQuestionIds.length) return toast.error("حدد أسئلة أولاً."); patch({ questions: state.questions.map((question) => selectedQuestionIds.includes(question.id) ? { ...question, ...change, images: change.images ?? question.images ?? [] } : question) }); toast.success(`تم تحديث ${selectedQuestionIds.length} سؤالاً كمسودة.`); };
  const deleteSelectedQuestions = () => { if (!selectedQuestionIds.length) return toast.error("حدد أسئلة أولاً."); patch({ questions: state.questions.filter((question) => !selectedQuestionIds.includes(question.id)) }); setSelectedQuestionIds([]); toast.success("تم حذف الأسئلة المحددة من المسودة."); };
  const toggleAllVisible = () => { const visibleIds = filteredQuestions.map((question) => question.id); const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedQuestionIds.includes(id)); setSelectedQuestionIds(allSelected ? selectedQuestionIds.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...selectedQuestionIds, ...visibleIds]))); };
  const moveQuestion = (fromId: string, toId: string) => { if (fromId === toId) return; const next = [...state.questions]; const from = next.findIndex((question) => question.id === fromId); const to = next.findIndex((question) => question.id === toId); if (from < 0 || to < 0) return; const [moved] = next.splice(from, 1); next.splice(to, 0, moved); patch({ questions: next.map((question, index) => ({ ...question, stepNumber: index + 1 })) }); };
  const applyQuestionTemplate = (template: QuestionTemplate) => { const options = parseJson<string[]>(template.optionsTemplateJson, []); const solutionSteps = parseJson<string[]>(template.solutionStepsJson, []); const question = questionFromRaw({ type: template.questionType, text: template.textTemplate, options, correctAnswer: template.correctAnswerTemplate, difficulty: template.difficulty, solutionSteps, solutionScript: template.solutionScript, tags: parseJson<string[]>(template.tagsJson, []) }, state.questions.length, state.manifest.ideas?.[0]?.id ?? "needs-review", state.manifest.ideas?.[0]?.title ?? "يحتاج مراجعة"); patch({ questions: [...state.questions, question], stage: 3, status: "review" }); setShowQuestionTemplates(false); toast.success("أضيف سؤال من القالب كمسودة للمراجعة."); };
  const applyLessonTemplate = (template: LessonTemplate) => { const manifest = normalizeManifest(parseJson<Partial<SlideManifest>>(template.manifestJson, {}), template.title); const questions = parseJson<Array<Record<string, unknown>>>(template.questionsJson, []).map((question, index) => questionFromRaw(question, index, typeof question.ideaId === "string" ? question.ideaId : "needs-review", typeof question.ideaTitle === "string" ? question.ideaTitle : "يحتاج مراجعة")); patch({ title: template.title, subject: template.subject, grade: template.grade, manifest, questions, stage: 2, status: "review" }); setShowLessonTemplates(false); toast.success("تم تحميل قالب الدرس كمسودة قابلة للتعديل."); };
  const saveAsQuestionTemplate = async (question: FactoryQuestion) => { try { const saved = await localDb.curriculumFactory.saveQuestionTemplate({ title: `قالب: ${question.text.slice(0, 80)}`, subject: state.subject, grade: state.grade, questionType: question.type, difficulty: question.difficulty, textTemplate: question.text, optionsTemplate: question.options, correctAnswerTemplate: question.correctAnswer, solutionSteps: question.solutionSteps, solutionScript: question.solutionScript, tags: question.tags }); setQuestionTemplates((current) => [saved, ...current]); toast.success("تم حفظ السؤال كقالب."); } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر حفظ القالب"); } };
  const buildExternalPrompt = () => {
    if (!selectedTemplate) return "";
    return `${applyPromptVariables(selectedTemplate.content, state)}\n\nالمدخل الحالي:\n${state.sourceText}\n\nنتائج المراحل السابقة:\n${applyPromptVariables("{stageOutputs}", state)}\n\nالأصول المتاحة:\n${applyPromptVariables("{assets}", state)}\n\nعقد الإخراج الإلزامي:\n${applyPromptVariables("{outputContract}", state)}\nأعد JSON أو HTML منظماً فقط، مع الحفاظ على lessonId وideaId وstepId وslideId وquestionId وassetId. لا تستبدل صور الكتاب ولا تنشئ أصولاً جديدة إلا إذا طلبت ذلك صراحة.`;
  };

  const copyExternalPrompt = async () => {
    const prompt = buildExternalPrompt();
    if (!prompt) return toast.error("اختر قالباً أولاً.");
    try { await navigator.clipboard.writeText(prompt); toast.success("تم نسخ Prompt المرحلة الحالية مع مدخلاتها."); } catch { downloadFile(`${state.lessonKey}-stage-${state.stage}-prompt.txt`, prompt, "text/plain;charset=utf-8"); toast.success("تعذر النسخ المباشر؛ تم تنزيل Prompt كملف نصي."); }
  };

  const downloadExternalPrompt = () => {
    const prompt = buildExternalPrompt();
    if (!prompt) return toast.error("اختر قالباً أولاً.");
    downloadFile(`${state.lessonKey}-stage-${state.stage}-prompt.txt`, prompt, "text/plain;charset=utf-8");
    toast.success("تم تنزيل Prompt خارجي كامل للمرحلة الحالية.");
  };

  const runPromptTest = async () => { if (!selectedTemplate) return toast.error("اختر قالباً أولاً."); setBusy(true); try { const result = await aiClient.testPrompt({ prompt: applyPromptVariables(selectedTemplate.content, state), sampleInput: state.sourceText || "مثال قصير عن الدرس", model: state.ai.structure.model || undefined, keyId: state.ai.structure.keyId, temperature: state.ai.structure.temperature, maxOutputTokens: 1200 }); setPromptTestResult({ text: result.text, usage: result.usage ? { totalTokens: result.usage.totalTokens, estimatedCostUsd: result.usage.estimatedCostUsd } : undefined }); toast.success("اكتمل اختبار القالب دون تطبيق الناتج على المسودة."); } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر اختبار القالب"); } finally { setBusy(false); } };
  const runStreamingDemo = async () => { if (!state.sourceText.trim()) return toast.error("أضف نصاً خاماً أولاً."); setStreamText(""); setBusy(true); try { await aiClient.stream({ input: state.sourceText, systemInstruction: applyPromptVariables(prompts.find((item) => item.key === "structure-lesson")?.content ?? "لخص النص", state), model: state.ai.structure.model || undefined, keyId: state.ai.structure.keyId, temperature: state.ai.structure.temperature, maxOutputTokens: state.ai.structure.maxOutputTokens, operation: "curriculum-factory-stream", onChunk: (chunk) => setStreamText((current) => current + chunk) }); toast.success("اكتمل العرض التدريجي كاقتراح فقط."); } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر تشغيل العرض التدريجي"); } finally { setBusy(false); } };
  const exportMoodleXml = () => { const xml = buildMoodleXml(state); const check = validateMoodleXml(xml); if (!check.valid) return toast.error(`XML غير صالح: ${check.errors.join("؛ ")}`); downloadFile(`${state.lessonKey}.xml`, xml, "application/xml;charset=utf-8"); toast.success("تم التحقق من XML قبل التصدير."); };

  const exportFactoryPackage = async () => {
    setBusy(true);
    try {
      const manifest = normalizeManifest({ ...state.manifest, assets: state.assets.length ? state.assets : state.manifest.assets }, state.title);
      const pack = { packageType: "bisalasa-curriculum", packageVersion: 1, exportedAt: new Date().toISOString(), title: state.title, grade: state.grade, subject: state.subject, academicYear: state.academicYear, curriculumKey: state.curriculumKey, lessonKey: state.lessonKey, sourceText: state.sourceText, sourceImages: state.sourceImages, assets: state.assets, stage: state.stage, status: state.status, skippedStages: state.skippedStages, stageModes: state.stageModes, stageOutputs: state.stageOutputs, manifest, questions: state.questions, ai: state.ai };
      downloadFile(`${state.lessonKey || "lesson"}.bisalasa-curriculum.json`, JSON.stringify(pack, null, 2), "application/json;charset=utf-8");
      toast.success("تم تصدير حزمة المنهج؛ الصور وروابط الأسئلة والقنوات مضمنة.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر تصدير حزمة المنهج"); }
    finally { setBusy(false); }
  };

  useEffect(() => { if (typeof window === "undefined") return; try { window.localStorage.setItem("bisalasa-factory-backup-last", JSON.stringify(state)); } catch { /* local backup is best effort */ } }, [state]);


  return <main className="min-h-screen bg-slate-950 text-slate-100" dir="rtl">
    <div className="mx-auto flex min-h-screen max-w-[1500px] flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-900/90 px-5 py-4 backdrop-blur">
        <div><div className="flex items-center gap-2 text-lg font-black"><Sparkles className="h-5 w-5 text-cyan-300" /> مصنع مناهج بسلاسة</div><p className="mt-1 text-xs text-slate-400">مساحة إعداد خاصة بالمدرس — لا تظهر للطلاب ولا تغيّر Moodle.</p></div>
        <div className="flex flex-wrap gap-2"><label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-white/15 px-3 py-2 text-xs hover:bg-white/10"><Upload className="h-3.5 w-3.5" />استيراد حزمة<input type="file" accept="application/json,.json" className="hidden" onChange={importPack} /></label><Button variant="outline" className="border-cyan-400/20 bg-transparent text-xs text-cyan-100 hover:bg-cyan-400/10" onClick={() => void exportFactoryPackage()} disabled={busy}><Download className="ml-1 h-3.5 w-3.5" />تصدير الحزمة</Button><Button variant="outline" className="border-white/15 bg-transparent text-xs text-white hover:bg-white/10" onClick={() => { setState(emptyFactory()); setValidation(null); }}><FilePlus2 className="ml-1 h-3.5 w-3.5" />مسودة جديدة</Button><Button className="text-xs" onClick={() => void saveDraft()} disabled={busy}><Save className="ml-1 h-3.5 w-3.5" />حفظ {lastSaved && <span className="text-[10px] opacity-70">{lastSaved}</span>}</Button></div>
      </header>
      <div className="grid flex-1 gap-4 p-4 grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_280px]">
        <aside className="rounded-xl border border-white/10 bg-slate-900 p-3"><div className="mb-3 text-xs font-bold text-slate-300">مسار المصنع</div>{stageLabels.map((label, index) => { const stageNumber = index + 1; const skipped = state.skippedStages.includes(stageNumber); const mode = state.stageModes[String(stageNumber)] ?? "manual"; return <button type="button" key={label} onClick={() => setState((current) => ({ ...current, stage: stageNumber }))} className={`mb-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-xs transition ${state.stage === stageNumber ? "bg-cyan-500/20 text-cyan-200" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}><span className={`grid h-6 w-6 place-items-center rounded-full border border-current text-[10px] ${skipped ? "opacity-50 line-through" : ""}`}>{stageNumber}</span><span className="min-w-0 flex-1 truncate">{label}</span><span className="text-[9px] opacity-60">{skipped ? "متخطاة" : mode === "ai" ? "AI" : mode === "external" ? "خارجي" : "يدوي"}</span></button>; })}<div className="mt-5 border-t border-white/10 pt-3"><div className="mb-2 text-[10px] font-bold text-slate-400">مسودات محفوظة</div>{drafts.slice(0, 8).map((draft) => <button key={draft.id} onClick={() => loadDraft(draft)} className={`mb-1 block w-full truncate rounded px-2 py-1.5 text-right text-[10px] ${draft.id === state.id ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5"}`}>{draft.title || "مسودة بلا عنوان"}<span className="mr-1 text-[9px] opacity-60">({draft.status})</span></button>)}</div></aside>
        <section className="min-w-0 rounded-xl border border-white/10 bg-slate-900 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><div className="text-xl font-bold">{stageLabels[state.stage - 1]}</div><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400"><span>المرحلة {state.stage} من 5 — الوضع: {currentStageSkipped ? "متخطاة" : currentStageMode === "ai" ? "ذكاء اصطناعي" : currentStageMode === "external" ? "Prompt خارجي" : "يدوي"} — كل AI ينتج مسودة ولا يطبّق شيئاً دون اعتمادك.</span><select aria-label="طريقة تنفيذ المرحلة" value={currentStageMode} onChange={(event) => patch({ stageModes: { ...state.stageModes, [String(state.stage)]: event.target.value as StageMode } })} className="h-7 rounded border border-white/10 bg-slate-950 px-2 text-[10px] text-slate-200"><option value="manual">يدوي / استيراد</option><option value="ai">AI داخلي</option><option value="external">Prompt خارجي</option><option value="skipped">متخطاة</option></select></div></div><div className="flex flex-wrap gap-2"><Button variant="outline" className="border-white/15 bg-transparent text-xs text-white hover:bg-white/10" onClick={() => setValidation(validateFactory(state))}><FlaskConical className="ml-1 h-3.5 w-3.5" />فحص الجودة</Button><Button variant="outline" className="border-white/15 bg-transparent text-xs text-white hover:bg-white/10" onClick={() => setPreviewEnabled((current) => !current)}>{previewEnabled ? "إخفاء المعاينة" : "المعاينة الحية"}</Button>{currentStageSkipped ? <Button size="sm" variant="outline" className="border-emerald-400/30 bg-transparent text-xs text-emerald-200 hover:bg-emerald-400/10" onClick={() => restoreStage(state.stage)}>إعادة المرحلة</Button> : <Button size="sm" variant="outline" className="border-amber-400/30 bg-transparent text-xs text-amber-200 hover:bg-amber-400/10" onClick={() => skipStage(state.stage)}>تخطي المرحلة</Button>}{busy && <Loader2 className="mt-2 h-4 w-4 animate-spin text-cyan-300" />}</div></div>
          {state.stage === 1 && <div className="space-y-4"><div className="grid gap-3 md:grid-cols-3"><label className="text-xs">عنوان الدرس<input value={state.title} onChange={(event) => patch({ title: event.target.value, manifest: { ...state.manifest, title: event.target.value } })} className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm" /></label><label className="text-xs">الصف<input value={state.grade} onChange={(event) => patch({ grade: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm" /></label><label className="text-xs">المادة<input value={state.subject} onChange={(event) => patch({ subject: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm" /></label><label className="text-xs">السنة الدراسية<input value={state.academicYear} onChange={(event) => patch({ academicYear: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm" /></label><label className="text-xs">curriculumKey<input value={state.curriculumKey} onChange={(event) => patch({ curriculumKey: event.target.value })} className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm" /></label><label className="text-xs">lessonKey<input value={state.lessonKey} onChange={(event) => patch({ lessonKey: event.target.value, manifest: { ...state.manifest, lessonId: event.target.value } })} className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-slate-950 px-3 text-sm" /></label></div><label className="block text-xs">النص الخام من الكتاب<textarea value={state.sourceText} onChange={(event) => patch({ sourceText: event.target.value })} className="mt-1 min-h-[280px] w-full rounded-xl border border-white/10 bg-slate-950 p-4 text-sm leading-7" placeholder="الصق هنا نص الدرس أو التعريفات والأمثلة..." /></label><div className="flex flex-wrap gap-2"><label className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 text-xs text-emerald-100 hover:bg-emerald-400/20"><FilePlus2 className="h-4 w-4" />OCR عربي/إنجليزي<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/tiff,image/bmp" className="hidden" onChange={(event) => void runOcrUpload(event)} /></label><Button onClick={() => void structureWithAi()} disabled={busy || !state.sourceText.trim()}><WandSparkles className="ml-1 h-4 w-4" />هيكلة بالذكاء الاصطناعي</Button><Button variant="outline" className="border-white/15 bg-transparent text-white hover:bg-white/10" onClick={structureWithoutAi} disabled={!state.sourceText.trim()}><FilePlus2 className="ml-1 h-4 w-4" />هيكلة أولية بدون AI</Button></div><div className="space-y-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><div className="text-xs font-bold text-amber-100">مكتبة أصول الكتاب</div><div className="mt-1 text-[10px] leading-5 text-slate-400">الصور المرفوعة من الكتاب هي المصدر المفضل. ارفعها هنا ثم اربطها يدوياً بالـSlide المناسبة؛ لا يستبدلها AI تلقائياً.</div></div><label className="inline-flex h-8 cursor-pointer items-center gap-1 rounded border border-amber-400/30 bg-amber-400/10 px-3 text-[10px] text-amber-100 hover:bg-amber-400/20"><Upload className="h-3.5 w-3.5" />رفع أصول متعددة<input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" className="hidden" onChange={(event) => void uploadFactoryAssets(event)} /></label></div>{state.assets.length > 0 ? <div className="grid gap-2 md:grid-cols-2">{state.assets.map((asset) => <div key={asset.id} className="rounded-lg border border-white/10 bg-slate-950/70 p-2"><div className="flex items-start gap-2"><img src={asset.url} alt={asset.alt || asset.description} className="h-14 w-16 rounded border border-white/10 object-contain" /><div className="min-w-0 flex-1 space-y-1"><input value={asset.description} onChange={(event) => updateAsset(asset.id, { description: event.target.value })} className="h-7 w-full rounded border border-white/10 bg-slate-900 px-2 text-[10px]" placeholder="وصف الأصل" /><select value={assetTargets[asset.id] ?? ""} onChange={(event) => setAssetTargets((current) => ({ ...current, [asset.id]: event.target.value }))} className="h-7 w-full rounded border border-white/10 bg-slate-900 px-2 text-[10px]"><option value="">اختر Slide للربط اليدوي</option>{assetTargetOptions.map((target) => <option key={target.value} value={target.value}>{target.label}</option>)}</select></div><button type="button" title="حذف الأصل من مكتبة الكتاب" className="text-red-300" onClick={() => { const assets = state.assets.filter((item) => item.id !== asset.id); patch({ assets, manifest: normalizeManifest({ ...state.manifest, assets }, state.title) }); }}><Trash2 className="h-3.5 w-3.5" /></button></div><div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[9px] text-slate-500"><span>{asset.filename || asset.id} · {asset.source === "book-crop" ? "قصاصة من الكتاب" : asset.source || "مصدر غير محدد"}</span><Button size="sm" variant="outline" className="h-7 border-cyan-400/20 bg-transparent px-2 text-[10px] text-cyan-100 hover:bg-cyan-400/10" disabled={!assetTargets[asset.id]} onClick={() => { const [ideaId, stepRaw, slideId] = (assetTargets[asset.id] || "").split("::"); if (ideaId && stepRaw && slideId) assignAssetToSlide(asset.id, ideaId, Number(stepRaw), slideId); }}>ربط بالـSlide</Button></div></div>)}</div> : <div className="rounded border border-dashed border-white/10 p-4 text-center text-[10px] text-slate-500">لم تُرفع أصول بعد. يمكنك رفع صور الكتاب هنا، أو ربط صور السؤال مباشرة في المرحلة الثالثة.</div>}</div></div>}
          {state.stage === 2 && <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void structureWithAi()} disabled={busy}><WandSparkles className="ml-1 h-4 w-4" />إعادة الهيكلة</Button>
              <Button variant="outline" className="border-white/15 bg-transparent text-white hover:bg-white/10" onClick={structureWithoutAi}>إعادة بناء من النص</Button>
            </div>
            {ideas.map((idea) => <div key={idea.id} className="rounded-xl border border-white/10 bg-slate-950/70 p-3">
              <div className="flex items-center gap-2">
                <input value={idea.title} onChange={(event) => patch({ manifest: { ...state.manifest, ideas: ideas.map((entry) => entry.id === idea.id ? { ...entry, title: event.target.value } : entry) } })} className="h-9 flex-1 rounded-lg border border-white/10 bg-slate-900 px-3 text-sm font-bold" />
                <span className="rounded bg-cyan-500/10 px-2 py-1 text-[10px] text-cyan-200">{idea.id}</span>
              </div>
              <textarea value={idea.description ?? ""} onChange={(event) => patch({ manifest: { ...state.manifest, ideas: ideas.map((entry) => entry.id === idea.id ? { ...entry, description: event.target.value } : entry) } })} className="mt-2 min-h-16 w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-xs" placeholder="وصف الفكرة" />
              {idea.steps.map((step, index) => <div key={`${idea.id}-${step.step}`} className="mt-2 grid gap-2 rounded-lg border border-white/5 bg-slate-900 p-2 md:grid-cols-[80px_1fr]">
                <div className="text-[10px] text-slate-500">خطوة {index + 1}</div>
                <div className="space-y-2">
                  <input value={step.title ?? ""} onChange={(event) => patch({ manifest: { ...state.manifest, ideas: ideas.map((entry) => entry.id === idea.id ? { ...entry, steps: entry.steps.map((item) => item.step === step.step ? { ...item, title: event.target.value } : item) } : entry) } })} className="h-8 w-full rounded border border-white/10 bg-slate-950 px-2 text-xs" />
                  <textarea value={Array.isArray(step.script) ? step.script.join("\n") : step.script ?? ""} onChange={(event) => patch({ manifest: { ...state.manifest, ideas: ideas.map((entry) => entry.id === idea.id ? { ...entry, steps: entry.steps.map((item) => item.step === step.step ? { ...item, script: event.target.value } : item) } : entry) } })} className="min-h-20 w-full rounded border border-white/10 bg-slate-950 p-2 text-xs leading-5" placeholder="سكريبت الشرح" />
                  <textarea value={step.notes ?? ""} onChange={(event) => patch({ manifest: { ...state.manifest, ideas: ideas.map((entry) => entry.id === idea.id ? { ...entry, steps: entry.steps.map((item) => item.step === step.step ? { ...item, notes: event.target.value } : item) } : entry) } })} className="min-h-14 w-full rounded border border-white/10 bg-slate-950 p-2 text-xs leading-5" placeholder="Notes خاصة بالمدرس" />
                </div>
              </div>)}
            </div>)}
            <div className="space-y-3 rounded-xl border border-purple-400/20 bg-purple-400/5 p-3">
              <div className="text-xs font-bold text-purple-100">محرر Slides داخل الخطوات</div>
              <div className="text-[10px] leading-5 text-slate-400">كل خطوة تملك Slide واحدة افتراضياً، ويمكن تقسيمها إلى عدة Slides مع الحفاظ على سكريبت المعلم والنوتس وخطة السبورة وروابط الصور.</div>
              {ideas.flatMap((idea) => idea.steps.map((step) => ({ idea, step }))).map(({ idea, step }) => <div key={`slide-editor-${idea.id}-${step.step}`} className="rounded-lg border border-white/10 bg-slate-950/70 p-2">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-cyan-200">{idea.title} · خطوة {step.step}: {step.title}</span>
                  <Button size="sm" variant="outline" className="h-7 border-purple-400/20 bg-transparent px-2 text-[10px] text-purple-100 hover:bg-purple-400/10" onClick={() => addManifestSlide(idea.id, step)}><Plus className="ml-1 h-3.5 w-3.5" />Slide جديدة</Button>
                </div>
                {(step.slides ?? []).map((slide, slideIndex) => <div key={slide.id} className="mb-2 grid gap-2 rounded border border-white/10 bg-slate-900 p-2 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-[9px] text-slate-500">Slide {slideIndex + 1} · {slide.id}</div>
                    <input value={slide.title ?? ""} onChange={(event) => updateManifestStep(idea.id, step.step, { slides: (step.slides ?? []).map((item) => item.id === slide.id ? { ...item, title: event.target.value } : item) })} className="h-8 w-full rounded border border-white/10 bg-slate-950 px-2 text-[10px]" placeholder="عنوان الـSlide" />
                    <textarea value={slide.body ?? ""} onChange={(event) => updateManifestStep(idea.id, step.step, { slides: (step.slides ?? []).map((item) => item.id === slide.id ? { ...item, body: event.target.value } : item) })} className="min-h-16 w-full rounded border border-white/10 bg-slate-950 p-2 text-[10px]" placeholder="محتوى الشرح الظاهر" />
                    <textarea value={Array.isArray(slide.script) ? slide.script.join("\n") : slide.script ?? ""} onChange={(event) => updateManifestStep(idea.id, step.step, { slides: (step.slides ?? []).map((item) => item.id === slide.id ? { ...item, script: event.target.value } : item) })} className="min-h-16 w-full rounded border border-white/10 bg-slate-950 p-2 text-[10px]" placeholder="سكريبت المعلم" />
                  </div>
                  <div className="space-y-2">
                    <textarea value={slide.notes ?? ""} onChange={(event) => updateManifestStep(idea.id, step.step, { slides: (step.slides ?? []).map((item) => item.id === slide.id ? { ...item, notes: event.target.value } : item) })} className="min-h-16 w-full rounded border border-white/10 bg-slate-950 p-2 text-[10px]" placeholder="نوتس المعلم — لا تظهر للطلاب" />
                    <textarea value={slide.whiteboardPlan ?? ""} onChange={(event) => updateManifestStep(idea.id, step.step, { slides: (step.slides ?? []).map((item) => item.id === slide.id ? { ...item, whiteboardPlan: event.target.value } : item) })} className="min-h-16 w-full rounded border border-white/10 bg-slate-950 p-2 text-[10px]" placeholder="خطة السبورة والمعادلات" />
                    <input value={(slide.assetRefs ?? []).join(", ")} onChange={(event) => updateManifestStep(idea.id, step.step, { slides: (step.slides ?? []).map((item) => item.id === slide.id ? { ...item, assetRefs: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) } : item) })} className="h-8 w-full rounded border border-white/10 bg-slate-950 px-2 text-[10px]" placeholder="معرفات أصول الكتاب مفصولة بفواصل" />
                  </div>
                </div>)}
              </div>)}
            </div>
                    </div>}
          {state.stage === 3 && <div className="space-y-3">
            <datalist id="factory-tags">{tagSuggestions.map((tag) => <option key={tag} value={tag} />)}</datalist>
            <div className="space-y-3 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><div className="text-xs text-slate-300">{filteredQuestions.length} من {state.questions.length} سؤال — كل سؤال يمر ببوابة جودة قبل الخَبز.</div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" className="border-white/15 bg-transparent text-white hover:bg-white/10 text-xs" onClick={() => setShowQuestionTemplates(true)}><Library className="ml-1 h-3.5 w-3.5" />قوالب الأسئلة</Button><Button size="sm" variant="outline" className="border-white/15 bg-transparent text-white hover:bg-white/10 text-xs" onClick={() => setShowLessonTemplates(true)}><FilePlus2 className="ml-1 h-3.5 w-3.5" />قوالب الدروس</Button><Button size="sm" variant="outline" className="border-white/15 bg-transparent text-white hover:bg-white/10 text-xs" onClick={() => void extractQuestionsFromText()} disabled={busy || !state.sourceText.trim()}><FilePlus2 className="ml-1 h-3.5 w-3.5" />استخرج من النص</Button></div></div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5"><label className="relative text-[10px] text-slate-400"><Search className="absolute right-2 top-7 h-3.5 w-3.5" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="بحث في النص والوسوم" className="mt-1 h-9 w-full rounded border border-white/10 bg-slate-900 pr-7 pl-2 text-[10px]" /></label><select value={filterIdea} onChange={(event) => setFilterIdea(event.target.value)} className="h-9 rounded border border-white/10 bg-slate-900 px-2 text-[10px]"><option value="all">كل الأفكار</option>{ideas.map((idea) => <option key={idea.id} value={idea.id}>{idea.title}</option>)}</select><select value={filterType} onChange={(event) => setFilterType(event.target.value)} className="h-9 rounded border border-white/10 bg-slate-900 px-2 text-[10px]"><option value="all">كل الأنواع</option><option value="mcq">MCQ</option><option value="true-false">صح/خطأ</option><option value="essay">مقالي</option><option value="cloze">Cloze</option><option value="drag-drop">سحب وإفلات</option></select><select value={filterDifficulty} onChange={(event) => setFilterDifficulty(event.target.value)} className="h-9 rounded border border-white/10 bg-slate-900 px-2 text-[10px]"><option value="all">كل الصعوبات</option><option value="easy">سهل</option><option value="medium">متوسط</option><option value="hard">صعب</option></select><select value={filterScore} onChange={(event) => setFilterScore(event.target.value)} className="h-9 rounded border border-white/10 bg-slate-900 px-2 text-[10px]"><option value="all">كل الدرجات</option><option value="low">أقل من 50</option><option value="medium">50–79</option><option value="high">80 فأعلى</option></select></div>
              <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-2"><button onClick={toggleAllVisible} className="inline-flex items-center gap-1 rounded border border-white/15 px-2 py-1 text-[10px] text-slate-200 hover:bg-white/10">{filteredQuestions.length && filteredQuestions.every((question) => selectedQuestionIds.includes(question.id)) ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />} تحديد الظاهر</button><span className="text-[10px] text-slate-500">محدد: {selectedQuestionIds.length}</span><select defaultValue="" onChange={(event) => { if (event.target.value) updateSelectedQuestions({ difficulty: event.target.value as FactoryQuestion["difficulty"] }); event.currentTarget.value = ""; }} className="h-7 rounded border border-white/10 bg-slate-900 px-2 text-[10px]"><option value="">تعديل جماعي للصعوبة</option><option value="easy">اجعلها سهلة</option><option value="medium">اجعلها متوسطة</option><option value="hard">اجعلها صعبة</option></select><select defaultValue="" onChange={(event) => { if (event.target.value) updateSelectedQuestions({ ideaId: event.target.value }); event.currentTarget.value = ""; }} className="h-7 rounded border border-white/10 bg-slate-900 px-2 text-[10px]"><option value="">نقل الفكرة</option>{ideas.map((idea) => <option key={idea.id} value={idea.id}>{idea.title}</option>)}</select><Button size="sm" variant="outline" className="border-cyan-400/20 bg-transparent px-2 text-[10px] text-cyan-100 hover:bg-cyan-400/10" onClick={() => void bulkImprove()} disabled={busy}>تحسين الكل</Button><Button size="sm" variant="outline" className="border-violet-400/20 bg-transparent px-2 text-[10px] text-violet-100 hover:bg-violet-400/10" onClick={() => void bulkGenerateDistractors()} disabled={busy}>بدائل الكل</Button><Button size="sm" variant="outline" className="border-red-400/20 bg-transparent px-2 text-[10px] text-red-200 hover:bg-red-500/10" onClick={deleteSelectedQuestions}><Trash2 className="ml-1 h-3.5 w-3.5" />حذف المحدد</Button></div>
              <div className="grid gap-2 md:grid-cols-5"><select value={questionConfig.ideaId} onChange={(event) => setQuestionConfig((current) => ({ ...current, ideaId: event.target.value }))} className="h-9 rounded border border-white/10 bg-slate-900 px-2 text-[10px]"><option value="all">كل الأفكار</option>{ideas.map((idea) => <option key={idea.id} value={idea.id}>{idea.title}</option>)}</select><select value={questionConfig.type} onChange={(event) => setQuestionConfig((current) => ({ ...current, type: event.target.value as QuestionType }))} className="h-9 rounded border border-white/10 bg-slate-900 px-2 text-[10px]"><option value="mcq">اختيار من متعدد</option><option value="true-false">صح أو خطأ</option><option value="essay">مقالي</option><option value="cloze">Cloze</option><option value="drag-drop">سحب وإفلات</option></select><select value={questionConfig.difficulty} onChange={(event) => setQuestionConfig((current) => ({ ...current, difficulty: event.target.value as FactoryQuestion["difficulty"] }))} className="h-9 rounded border border-white/10 bg-slate-900 px-2 text-[10px]"><option value="easy">سهل</option><option value="medium">متوسط</option><option value="hard">صعب</option></select><input type="number" min={1} max={8} value={questionConfig.count} onChange={(event) => setQuestionConfig((current) => ({ ...current, count: Math.max(1, Math.min(8, Number(event.target.value) || 1)) }))} className="h-9 rounded border border-white/10 bg-slate-900 px-2 text-[10px]" /><Button onClick={() => void generateQuestions()} disabled={busy || !ideas.length} className="text-xs"><Sparkles className="ml-1 h-3.5 w-3.5" />توليد حسب الاختيار</Button></div>
            </div>
            {duplicates.length > 0 && <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-[10px] text-amber-100"><div className="mb-1 flex items-center gap-1 font-bold"><Copy className="h-3.5 w-3.5" />تكرارات محتملة: {duplicates.length}</div>{duplicates.slice(0, 5).map((duplicate) => <div key={`${duplicate.id1}-${duplicate.id2}`}>تشابه {Math.round(duplicate.similarity * 100)}% بين {duplicate.id1} و{duplicate.id2}</div>)}</div>}
            {filteredQuestions.map((question) => { const quality = question.quality ?? validateQuestionStrict({ ...question, images: question.images ?? [] }); return <div key={question.id} draggable onDragStart={() => setDragQuestionId(question.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragQuestionId) moveQuestion(dragQuestionId, question.id); setDragQuestionId(null); }} className={`rounded-xl border bg-slate-950/70 p-3 ${selectedQuestionIds.includes(question.id) ? "border-cyan-400/50" : "border-white/10"}`}><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div className="flex min-w-0 flex-1 items-center gap-2"><button title="اسحب لإعادة الترتيب" className="cursor-grab text-slate-500"><GripVertical className="h-4 w-4" /></button><input type="checkbox" checked={selectedQuestionIds.includes(question.id)} onChange={() => setSelectedQuestionIds((current) => current.includes(question.id) ? current.filter((id) => id !== question.id) : [...current, question.id])} /><span className={`rounded px-2 py-1 text-[10px] font-bold ${quality.score < 50 ? "bg-red-500/20 text-red-200" : quality.score < 80 ? "bg-amber-500/15 text-amber-200" : "bg-emerald-500/15 text-emerald-200"}`}>{quality.score}/100</span><select value={question.type ?? "mcq"} onChange={(event) => updateQuestion(question.id, { type: event.target.value as QuestionType, gameReady: event.target.value === "mcq" || event.target.value === "true-false" })} className="h-7 rounded border border-white/10 bg-slate-900 px-2 text-[10px]"><option value="mcq">MCQ</option><option value="true-false">صح/خطأ</option><option value="essay">مقالي</option><option value="cloze">Cloze</option><option value="drag-drop">سحب/إفلات</option></select><input value={question.text} onChange={(event) => updateQuestion(question.id, { text: event.target.value })} className="h-9 min-w-0 flex-1 rounded border border-white/10 bg-slate-900 px-2 text-xs" /></div><div className="flex items-center gap-1"><button onClick={() => setPreviewQuestion(question)} className="rounded border border-emerald-400/20 px-2 py-1 text-[10px] text-emerald-200"><Eye className="ml-1 inline h-3.5 w-3.5" />معاينة</button><button onClick={() => void saveAsQuestionTemplate(question)} className="rounded border border-white/15 px-2 py-1 text-[10px] text-slate-200"><Library className="ml-1 inline h-3.5 w-3.5" />قالب</button><button onClick={() => void improveQuestion(question)} className="rounded border border-cyan-400/20 px-2 py-1 text-[10px] text-cyan-200">تحسين</button><button onClick={() => void generateDistractors(question)} disabled={question.type !== "mcq"} className="rounded border border-violet-400/20 px-2 py-1 text-[10px] text-violet-200">بدائل</button><button onClick={() => patch({ questions: state.questions.filter((item) => item.id !== question.id) })} className="text-red-300" title="حذف السؤال"><Trash2 className="h-4 w-4" /></button></div></div><div className="grid gap-2 md:grid-cols-4"><select value={question.ideaId} onChange={(event) => updateQuestion(question.id, { ideaId: event.target.value })} className="h-8 rounded border border-white/10 bg-slate-900 px-2 text-[10px]"><option value="needs-review">يحتاج مراجعة</option>{ideas.map((idea) => <option key={idea.id} value={idea.id}>{idea.title}</option>)}</select><input value={question.correctAnswer} onChange={(event) => updateQuestion(question.id, { correctAnswer: event.target.value })} className="h-8 rounded border border-white/10 bg-slate-900 px-2 text-[10px]" placeholder="الإجابة الصحيحة" /><input value={question.options.join("، ")} onChange={(event) => updateQuestion(question.id, { options: event.target.value.split(/[،,]/).map((item) => item.trim()).filter(Boolean) })} className="h-8 rounded border border-white/10 bg-slate-900 px-2 text-[10px] md:col-span-2" placeholder="الخيارات أو عناصر السحب" /></div><div className="mt-2 grid gap-2 md:grid-cols-3"><select value={question.difficulty} onChange={(event) => updateQuestion(question.id, { difficulty: event.target.value as FactoryQuestion["difficulty"] })} className="h-8 rounded border border-white/10 bg-slate-900 px-2 text-[10px]"><option value="easy">سهل</option><option value="medium">متوسط</option><option value="hard">صعب</option></select><input list="factory-tags" value={question.tags.join(", ")} onChange={(event) => updateQuestion(question.id, { tags: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} className="h-8 rounded border border-white/10 bg-slate-900 px-2 text-[10px] md:col-span-2" placeholder="وسوم — اقتراحات تلقائية" /></div><textarea value={question.solutionSteps.join("\n")} onChange={(event) => updateQuestion(question.id, { solutionSteps: event.target.value.split("\n").filter(Boolean) })} className="mt-2 min-h-16 w-full rounded border border-white/10 bg-slate-900 p-2 text-[10px]" placeholder="خطوات الحل — يمكن أن تتضمن LaTeX" /><textarea value={question.solutionScript} onChange={(event) => updateQuestion(question.id, { solutionScript: event.target.value })} className="mt-2 min-h-14 w-full rounded border border-white/10 bg-slate-900 p-2 text-[10px]" placeholder="سكريبت الحل والتغذية الراجعة" /><div className="mt-2 space-y-2 rounded-lg border border-white/10 bg-slate-900/60 p-2"><div className="flex flex-wrap items-center gap-2"><label className="flex h-8 cursor-pointer items-center justify-center gap-1 rounded border border-cyan-400/20 bg-cyan-400/5 px-2 text-[10px] text-cyan-100 hover:bg-cyan-400/10"><ImagePlus className="h-3.5 w-3.5" />رفع صور الكتاب<input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" className="hidden" onChange={(event) => void uploadQuestionImage(question, event)} /></label><span className="text-[10px] text-slate-500">{question.images.length} صورة مرتبطة · الأصل محفوظ</span></div><div className="grid gap-2 sm:grid-cols-2">{question.images.map((image, imageIndex) => <div key={`${question.id}-image-${imageIndex}`} className="flex items-center gap-2 rounded border border-white/10 bg-slate-950 p-1.5"><img src={image.url} alt={image.alt} className="h-10 w-12 rounded object-contain" /><div className="min-w-0 flex-1 space-y-1"><input value={image.url} onChange={(event) => updateQuestion(question.id, { images: question.images.map((item, index) => index === imageIndex ? { ...item, url: event.target.value } : item) })} className="h-7 w-full rounded border border-white/10 bg-slate-900 px-2 text-[9px]" placeholder="رابط الصورة" /><input value={image.alt} onChange={(event) => updateQuestion(question.id, { images: question.images.map((item, index) => index === imageIndex ? { ...item, alt: event.target.value } : item) })} className="h-7 w-full rounded border border-white/10 bg-slate-900 px-2 text-[9px]" placeholder="وصف الصورة" /></div><button type="button" className="text-red-300" title="إزالة الصورة" onClick={() => updateQuestion(question.id, { images: question.images.filter((_, index) => index !== imageIndex), imageRefs: question.imageRefs.filter((_, index) => index !== imageIndex) })}><Trash2 className="h-3.5 w-3.5" /></button></div>)}{question.images.length === 0 && <div className="text-[10px] text-slate-500">لا توجد صورة؛ سيظهر السؤال بدون صورة في Moodle والألعاب.</div>}</div><div className="flex flex-wrap gap-2 border-t border-white/10 pt-2"><span className="text-[10px] text-slate-500">الاستخدام:</span>{([{ value: "presentation", label: "شرح" }, { value: "moodle-interactive", label: "Moodle حصة" }, { value: "moodle-homework", label: "Moodle واجب" }, { value: "game", label: "ألعاب" }] as const).map((channel) => <label key={channel.value} className="inline-flex items-center gap-1 text-[10px] text-slate-300"><input type="checkbox" checked={question.usage.includes(channel.value)} onChange={(event) => updateQuestion(question.id, { usage: event.target.checked ? Array.from(new Set([...question.usage, channel.value])) : question.usage.filter((value) => value !== channel.value) })} />{channel.label}</label>)}</div></div></div>; })}
            {filteredQuestions.length === 0 && <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-xs text-slate-400">لا توجد أسئلة مطابقة للفلاتر الحالية.</div>}
            {previewQuestion && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setPreviewQuestion(null)}><div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-900 p-5" onClick={(event) => event.stopPropagation()}><div className="mb-3 flex items-center justify-between"><h3 className="font-bold">معاينة السؤال في اللعبة</h3><button onClick={() => setPreviewQuestion(null)} className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></button></div><div className="grid gap-4 md:grid-cols-2"><div className="rounded-xl border border-cyan-400/20 bg-slate-950 p-4"><div className="mb-2 text-[10px] text-cyan-200">QuickFire</div><p className="text-sm leading-7">{previewQuestion.text}</p><div className="mt-3 grid grid-cols-2 gap-2">{previewQuestion.options.map((option) => <button key={option} className="rounded border border-white/10 p-2 text-xs hover:bg-cyan-400/10">{option}</button>)}</div></div><div className="rounded-xl border border-purple-400/20 bg-slate-950 p-4"><div className="mb-2 text-[10px] text-purple-200">QuizShow</div><p className="text-sm leading-7">{previewQuestion.text}</p><div className="mt-3 text-xs text-slate-400">الفكرة: {previewQuestion.ideaTitle || previewQuestion.ideaId} · الصعوبة: {previewQuestion.difficulty}</div></div></div></div></div>}
            {showQuestionTemplates && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setShowQuestionTemplates(false)}><div className="w-full max-w-xl rounded-2xl border border-white/10 bg-slate-900 p-5" onClick={(event) => event.stopPropagation()}><div className="mb-3 flex items-center justify-between"><h3 className="font-bold">مكتبة قوالب الأسئلة</h3><button onClick={() => setShowQuestionTemplates(false)} className="text-slate-400"><X className="h-5 w-5" /></button></div><div className="max-h-96 space-y-2 overflow-auto">{questionTemplates.map((template) => <button key={template.id} onClick={() => applyQuestionTemplate(template)} className="block w-full rounded-lg border border-white/10 bg-slate-950 p-3 text-right hover:border-cyan-400/40"><div className="text-xs font-bold">{template.title}</div><div className="mt-1 text-[10px] text-slate-400">{template.questionType} · {template.difficulty} · {template.subject}</div><div className="mt-1 text-[10px] text-slate-300">{template.textTemplate}</div></button>)}{questionTemplates.length === 0 && <div className="p-4 text-center text-xs text-slate-400">لا توجد قوالب بعد.</div>}</div></div></div>}
            {showLessonTemplates && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setShowLessonTemplates(false)}><div className="w-full max-w-xl rounded-2xl border border-white/10 bg-slate-900 p-5" onClick={(event) => event.stopPropagation()}><div className="mb-3 flex items-center justify-between"><h3 className="font-bold">مكتبة قوالب الدروس</h3><button onClick={() => setShowLessonTemplates(false)} className="text-slate-400"><X className="h-5 w-5" /></button></div><div className="max-h-96 space-y-2 overflow-auto">{lessonTemplates.map((template) => <button key={template.id} onClick={() => applyLessonTemplate(template)} className="block w-full rounded-lg border border-white/10 bg-slate-950 p-3 text-right hover:border-cyan-400/40"><div className="text-xs font-bold">{template.title}</div><div className="mt-1 text-[10px] text-slate-400">{template.grade} · {template.subject}</div><div className="mt-1 text-[10px] text-slate-300">{template.description}</div></button>)}{lessonTemplates.length === 0 && <div className="p-4 text-center text-xs text-slate-400">لا توجد قوالب دروس بعد.</div>}</div></div></div>}
          </div>}
          {state.stage === 4 && <div className="space-y-4"><div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4 text-sm leading-7">المطابقة تعتمد على <code>ideaId</code> أولاً ثم الوسوم، ولا تُخفي السؤال غير المؤكد. راجع القائمة قبل الخَبز حتى يظهر كل سؤال في فكرته الصحيحة فقط.</div><Button onClick={autoMap}><Check className="ml-1 h-4 w-4" />مطابقة تلقائية وفحصها</Button><div className="grid gap-2 sm:grid-cols-2">{questionByIdea.map(({ idea, count }) => <div key={idea.id} className="rounded-lg border border-white/10 bg-slate-950 p-3 text-xs"><div className="font-bold">{idea.title}</div><div className="mt-1 text-slate-400">{count} سؤال مرتبط</div></div>)}<div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-xs">غير مرتبط: {state.questions.filter((question) => question.ideaId === "needs-review").length}</div></div><div className="rounded-xl border border-white/10 bg-slate-950 p-3"><div className="mb-3 flex items-center gap-2 text-xs font-bold"><Table2 className="h-4 w-4 text-cyan-300" />مصفوفة تغطية الأفكار</div><div className="overflow-auto"><table className="w-full min-w-[640px] text-[10px]"><thead><tr className="border-b border-white/10 text-slate-400"><th className="p-2 text-right">الفكرة</th><th>MCQ</th><th>صح/خطأ</th><th>مقالي</th><th>Cloze</th><th>سحب</th><th>سهل</th><th>متوسط</th><th>صعب</th><th>التغطية</th></tr></thead><tbody>{ideas.map((idea) => { const qs = state.questions.filter((question) => question.ideaId === idea.id); const total = qs.length; return <tr key={idea.id} className="border-b border-white/5"><td className="p-2 text-right">{idea.title}</td><td className="text-center">{qs.filter((q) => q.type === "mcq").length}</td><td className="text-center">{qs.filter((q) => q.type === "true-false").length}</td><td className="text-center">{qs.filter((q) => q.type === "essay").length}</td><td className="text-center">{qs.filter((q) => q.type === "cloze").length}</td><td className="text-center">{qs.filter((q) => q.type === "drag-drop").length}</td><td className="text-center">{qs.filter((q) => q.difficulty === "easy").length}</td><td className="text-center">{qs.filter((q) => q.difficulty === "medium").length}</td><td className="text-center">{qs.filter((q) => q.difficulty === "hard").length}</td><td className={`text-center font-bold ${total >= 5 ? "text-emerald-300" : total >= 3 ? "text-amber-300" : "text-red-300"}`}>{total >= 5 ? "جيد" : total >= 3 ? "متوسط" : "ناقص"}</td></tr>; })}</tbody></table></div></div><div className="rounded-xl border border-white/10 bg-slate-950 p-3"><div className="mb-2 flex items-center gap-2 text-xs font-bold"><BarChart3 className="h-4 w-4 text-cyan-300" />توزيع الصعوبة</div><div className="flex h-7 overflow-hidden rounded bg-slate-900"><div className="bg-emerald-500" style={{ width: `${(difficultyCounts.easy / Math.max(1, state.questions.length)) * 100}%` }} /><div className="bg-amber-500" style={{ width: `${(difficultyCounts.medium / Math.max(1, state.questions.length)) * 100}%` }} /><div className="bg-red-500" style={{ width: `${(difficultyCounts.hard / Math.max(1, state.questions.length)) * 100}%` }} /></div><div className="mt-2 flex justify-between text-[10px]"><span className="text-emerald-300">سهل: {difficultyCounts.easy}</span><span className="text-amber-300">متوسط: {difficultyCounts.medium}</span><span className="text-red-300">صعب: {difficultyCounts.hard}</span></div>{difficultyCounts.easy === 0 || difficultyCounts.hard === 0 ? <div className="mt-2 text-[10px] text-amber-300">يوصى بمراجعة التوازن بين المستويات.</div> : null}</div></div>}
          {state.stage === 5 && <div className="space-y-4"><div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4"><div className="text-lg font-bold">الدرس جاهز للمراجعة النهائية</div><p className="mt-1 text-xs leading-6 text-slate-300">الخبز يكتب Manifest وHTML والأسئلة والحلول والصور إلى SQLite داخل ImportedLesson في معاملة واحدة. لن يتم التصدير أو الخَبز إذا فشل Quality Gate.</p><div className="mt-3 flex flex-wrap gap-2"><Button onClick={() => void bake()} disabled={busy}><Check className="ml-1 h-4 w-4" />اخبز وأضف للمنهج</Button><Button variant="outline" className="border-white/15 bg-transparent text-white hover:bg-white/10" onClick={exportMoodleXml}><Download className="ml-1 h-4 w-4" />تحقق وصدّر Moodle XML</Button><Button variant="outline" className="border-white/15 bg-transparent text-white hover:bg-white/10" onClick={() => downloadFile(`${state.lessonKey}-pack.json`, JSON.stringify({ ...state, manifest: state.manifest, exportedAt: new Date().toISOString(), exportVersion: 2 }, null, 2), "application/json;charset=utf-8")}><FileJson className="ml-1 h-4 w-4" />حزمة JSON</Button></div></div><pre className="max-h-80 overflow-auto rounded-xl border border-white/10 bg-slate-950 p-4 text-[10px] leading-5 text-slate-300">{JSON.stringify(state.manifest, null, 2)}</pre></div>}
        </section>
        <aside className="space-y-3"><section className="rounded-xl border border-violet-400/20 bg-slate-900 p-3"><div className="mb-2 flex items-center gap-2 text-xs font-bold"><FlaskConical className="h-4 w-4 text-violet-300" />اختبار أدوات AI</div><div className="mb-2 flex flex-wrap gap-2"><Button size="sm" variant="outline" className="border-amber-400/20 bg-transparent text-[10px] text-amber-100 hover:bg-amber-400/10" onClick={() => void runModelComparison()} disabled={busy}>مقارنة النماذج</Button>{lastAiUsage && <span className="self-center text-[10px] text-slate-500">آخر استهلاك: {lastAiUsage.totalTokens} tokens · ${lastAiUsage.estimatedCostUsd.toFixed(6)}</span>}</div>{comparisonResults.length > 0 && <div className="mb-2 grid gap-2 md:grid-cols-2">{comparisonResults.map((result) => <div key={`${result.provider}:${result.model}`} className="rounded border border-amber-400/20 bg-slate-950 p-2 text-[10px]"><div className="mb-1 font-bold text-amber-200">{result.provider} · {result.model}</div><pre className="max-h-24 overflow-auto whitespace-pre-wrap text-slate-300">{result.text}</pre>{result.usage && <div className="mt-1 text-slate-500">{result.usage.totalTokens} tokens · ${result.usage.estimatedCostUsd.toFixed(6)}</div>}</div>)}</div>}<p className="mb-2 text-[10px] leading-5 text-slate-400">المتغيرات مثل {"{subject}"} و{"{grade}"} تُستبدل قبل التجربة، والأمثلة تساعد المدرس على ضبط النتيجة. لا يُطبق الاختبار على المسودة تلقائياً.</p><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" className="border-violet-400/20 bg-transparent text-[10px] text-violet-100 hover:bg-violet-400/10" onClick={() => void runPromptTest()} disabled={busy || !selectedTemplate}>اختبار القالب</Button><Button size="sm" variant="outline" className="border-emerald-400/20 bg-transparent text-[10px] text-emerald-100 hover:bg-emerald-400/10" onClick={() => void copyExternalPrompt()} disabled={!selectedTemplate}>نسخ Prompt خارجي</Button><Button size="sm" variant="outline" className="border-amber-400/20 bg-transparent text-[10px] text-amber-100 hover:bg-amber-400/10" onClick={downloadExternalPrompt} disabled={!selectedTemplate}>تنزيل Prompt</Button><Button size="sm" variant="outline" className="border-cyan-400/20 bg-transparent text-[10px] text-cyan-100 hover:bg-cyan-400/10" onClick={() => void runStreamingDemo()} disabled={busy || !state.sourceText.trim()}>عرض تدريجي</Button></div>{promptTestResult && <div className="mt-2 rounded border border-white/10 bg-slate-950 p-2 text-[10px]"><div className="mb-1 text-emerald-300">نتيجة اختبار القالب</div><pre className="max-h-28 overflow-auto whitespace-pre-wrap text-slate-300">{promptTestResult.text}</pre>{promptTestResult.usage && <div className="mt-1 text-slate-500">استهلاك تقديري: {promptTestResult.usage.totalTokens} tokens · ${promptTestResult.usage.estimatedCostUsd.toFixed(6)}</div>}</div>}{streamText && <div className="mt-2 rounded border border-white/10 bg-slate-950 p-2 text-[10px]"><div className="mb-1 text-cyan-300">الناتج التدريجي</div><pre className="max-h-32 overflow-auto whitespace-pre-wrap text-slate-300">{streamText}</pre></div>}</section><section className="rounded-xl border border-amber-400/20 bg-slate-900 p-3"><div className="mb-2 flex items-center gap-2 text-xs font-bold"><GitCompare className="h-4 w-4 text-amber-300" />مقارنة إصدارات المسودة</div><div className="grid gap-2"><select value={diffFrom} onChange={(event) => setDiffFrom(event.target.value)} className="h-8 rounded border border-white/10 bg-slate-950 px-2 text-[10px]"><option value="">الإصدار الأقدم</option>{versions.map((version) => <option key={version.id} value={version.id}>v{version.version} · {version.reason}</option>)}</select><select value={diffTo} onChange={(event) => setDiffTo(event.target.value)} className="h-8 rounded border border-white/10 bg-slate-950 px-2 text-[10px]"><option value="">الإصدار الأحدث</option>{versions.map((version) => <option key={version.id} value={version.id}>v{version.version} · {version.reason}</option>)}</select></div>{diffFrom && diffTo && (() => { const from = versions.find((version) => version.id === diffFrom); const to = versions.find((version) => version.id === diffTo); if (!from || !to) return null; const fromQuestions = parseJson<unknown[]>(from.questionsJson, []); const toQuestions = parseJson<unknown[]>(to.questionsJson, []); return <div className="mt-2 grid gap-2 md:grid-cols-2"><div className="rounded border border-white/10 bg-slate-950 p-2"><div className="mb-1 text-[10px] text-slate-400">v{from.version} · {fromQuestions.length} سؤال</div><pre className="max-h-32 overflow-auto whitespace-pre-wrap text-[9px] text-slate-400">{JSON.stringify(parseJson<unknown>(from.manifestJson, {}), null, 2)}</pre></div><div className="rounded border border-cyan-400/20 bg-slate-950 p-2"><div className="mb-1 text-[10px] text-cyan-300">v{to.version} · {toQuestions.length} سؤال</div><pre className="max-h-32 overflow-auto whitespace-pre-wrap text-[9px] text-slate-300">{JSON.stringify(parseJson<unknown>(to.manifestJson, {}), null, 2)}</pre></div></div>; })()}</section>{previewEnabled && state.stage >= 2 && state.stage <= 4 && <section className="rounded-xl border border-cyan-400/20 bg-slate-900 p-3"><div className="mb-2 flex items-center justify-between text-xs font-bold"><span>معاينة حية للطلاب</span><span className="text-[9px] text-slate-500">srcDoc محلي</span></div><iframe title="معاينة الدرس" sandbox="" srcDoc={buildLessonHtml(state.manifest)} className="h-56 w-full rounded-lg border border-white/10 bg-white" /></section>}<section className="rounded-xl border border-cyan-400/20 bg-slate-900 p-3"><div className="mb-2 flex items-center gap-2 text-xs font-bold"><Settings2 className="h-4 w-4 text-cyan-300" />محرك AI المخصص</div><p className="mb-3 text-[10px] leading-5 text-slate-400">الإعداد مستقل لكل عملية. اختيار الموديل لا يرسل المفتاح إلى المتصفح؛ الاستدعاء يمر عبر الخادم وتدوير المفاتيح.</p>{(["structure", "questions", "improve"] as const).map((lane) => { const settings = state.ai[lane]; const label = lane === "structure" ? "الهيكلة" : lane === "questions" ? "الأسئلة" : "التحسين"; return <div key={lane} className="mb-3 rounded-lg border border-white/10 bg-slate-950 p-2"><div className="mb-2 text-[10px] font-bold text-slate-200">{label}</div><div className="grid gap-2"><select value={settings.provider} onChange={(event) => updateAiSettings(lane, { provider: event.target.value as AiProvider, model: "", keyId: undefined })} className="h-8 rounded border border-white/10 bg-slate-900 px-2 text-[10px]"><option value="google">Google</option><option value="groq">Groq</option><option value="openai">OpenAI</option><option value="mistral">Mistral</option><option value="custom">Custom</option></select><select value={settings.keyId ?? ""} onChange={(event) => updateAiSettings(lane, { keyId: event.target.value || undefined })} className="h-8 rounded border border-white/10 bg-slate-900 px-2 text-[10px]"><option value="">تدوير تلقائي حسب الأولوية</option>{aiKeys.filter((key) => key.provider === settings.provider && key.isActive).map((key) => <option key={key.id} value={key.id}>{key.label} · {key.keyHint}</option>)}</select><div className="flex gap-2"><select value={settings.model} onChange={(event) => updateAiSettings(lane, { model: event.target.value })} className="h-8 min-w-0 flex-1 rounded border border-white/10 bg-slate-900 px-2 text-[10px]"><option value="">الموديل الافتراضي</option>{discoveredModels.filter((model) => model.provider === settings.provider).map((model) => <option key={model.id} value={model.id}>{model.displayName || model.id}</option>)}</select><Button size="sm" variant="outline" className="border-white/15 bg-transparent px-2 text-[10px] text-white hover:bg-white/10" onClick={() => void loadModels(lane)}>سحب</Button></div><div className="grid grid-cols-2 gap-2"><label className="text-[9px] text-slate-400">Temperature<input type="number" min={0.1} max={1.5} step={0.05} value={settings.temperature} onChange={(event) => updateAiSettings(lane, { temperature: Math.max(0.1, Math.min(1.5, Number(event.target.value) || 0.1)) })} className="mt-1 h-7 w-full rounded border border-white/10 bg-slate-900 px-2 text-[10px]" /></label><label className="text-[9px] text-slate-400">Max tokens<input type="number" min={256} max={16000} step={256} value={settings.maxOutputTokens} onChange={(event) => updateAiSettings(lane, { maxOutputTokens: Math.max(256, Math.min(16000, Number(event.target.value) || 256)) })} className="mt-1 h-7 w-full rounded border border-white/10 bg-slate-900 px-2 text-[10px]" /></label></div></div></div>; })}</section><section className="rounded-xl border border-white/10 bg-slate-900 p-3"><div className="flex items-center gap-2 text-xs font-bold"><FlaskConical className="h-4 w-4 text-cyan-300" />Quality Gate</div>{validation ? <div className="mt-3 space-y-2 text-[10px]"><div className={`text-2xl font-black ${validation.score >= 80 ? "text-emerald-300" : validation.score >= 50 ? "text-amber-300" : "text-red-300"}`}>{validation.score}/100</div>{validation.errors.map((error) => <div key={error} className="rounded bg-red-500/10 p-2 text-red-200">خطأ: {error}</div>)}{validation.warnings.map((warning) => <div key={warning} className="rounded bg-amber-500/10 p-2 text-amber-200">تنبيه: {warning}</div>)}{validation.questionResults.slice(0, 8).map((result) => <div key={result.id} className={`rounded p-2 ${result.quality.score < 50 ? "bg-red-500/10 text-red-200" : "bg-emerald-500/10 text-emerald-200"}`}>{result.id}: {result.quality.score}/100</div>)}{!validation.errors.length && !validation.warnings.length && <div className="text-emerald-300">لا توجد ملاحظات.</div>}</div> : <p className="mt-2 text-[10px] leading-5 text-slate-400">شغّل الفحص؛ السؤال الأقل من 50 أو الذي يحتوي خطأ لا يدخل Game Pool.</p>}</section>{state.id && <section className="rounded-xl border border-white/10 bg-slate-900 p-3"><div className="mb-2 text-xs font-bold">نسخ المسودة والاستعادة</div>{versions.length ? versions.slice(0, 8).map((version) => <div key={version.id} className="mb-1 flex items-center justify-between gap-2 rounded bg-slate-950 px-2 py-1.5 text-[10px]"><span>v{version.version} · {version.reason}</span><button onClick={() => void restoreVersion(version)} className="text-cyan-200 hover:text-white">استعادة</button></div>) : <p className="text-[10px] text-slate-400">احفظ المسودة لإنشاء أول نسخة.</p>}</section>}<section className="rounded-xl border border-white/10 bg-slate-900 p-3"><div className="flex items-center gap-2 text-xs font-bold"><FileJson className="h-4 w-4 text-cyan-300" />قوالب AI</div><select value={selectedPrompt} onChange={(event) => setSelectedPrompt(event.target.value)} className="mt-2 h-8 w-full rounded border border-white/10 bg-slate-950 px-2 text-[10px]"><option value="">اختر قالباً للتعديل</option>{prompts.map((prompt) => <option key={prompt.key} value={prompt.key}>{prompt.label}</option>)}</select>{selectedTemplate && <div className="mt-2 space-y-2"><input value={selectedTemplate.label} onChange={(event) => setPrompts((current) => current.map((prompt) => prompt.key === selectedTemplate.key ? { ...prompt, label: event.target.value } : prompt))} className="h-8 w-full rounded border border-white/10 bg-slate-950 px-2 text-[10px]" /><textarea value={selectedTemplate.content} onChange={(event) => setPrompts((current) => current.map((prompt) => prompt.key === selectedTemplate.key ? { ...prompt, content: event.target.value } : prompt))} className="min-h-28 w-full rounded border border-white/10 bg-slate-950 p-2 text-[10px] leading-5" placeholder="النص مع المتغيرات {subject} و{grade}" /><textarea value={selectedTemplate.examplesJson} onChange={(event) => setPrompts((current) => current.map((prompt) => prompt.key === selectedTemplate.key ? { ...prompt, examplesJson: event.target.value } : prompt))} className="min-h-16 w-full rounded border border-white/10 bg-slate-950 p-2 text-[10px]" placeholder='أمثلة JSON: [{"input":"...","output":"..."}]' /><textarea value={selectedTemplate.variablesJson} onChange={(event) => setPrompts((current) => current.map((prompt) => prompt.key === selectedTemplate.key ? { ...prompt, variablesJson: event.target.value } : prompt))} className="min-h-12 w-full rounded border border-white/10 bg-slate-950 p-2 text-[10px]" placeholder="متغيرات JSON" /><Button size="sm" className="w-full text-[10px]" onClick={() => { if (selectedTemplate) void localDb.curriculumFactory.savePrompt({ key: selectedTemplate.key, label: selectedTemplate.label, content: selectedTemplate.content, examples: parseJson<Array<{ input: string; output: string }>>(selectedTemplate.examplesJson, []), variables: parseJson<Array<{ name: string; description: string }>>(selectedTemplate.variablesJson, []), isDefault: selectedTemplate.isDefault }).then((saved) => { setPrompts((current) => current.map((prompt) => prompt.key === saved.key ? saved : prompt)); toast.success("تم حفظ قالب AI"); }); }}>حفظ القالب</Button></div>}</section><section className="rounded-xl border border-white/10 bg-slate-900 p-3 text-[10px] leading-5 text-slate-400"><div className="mb-2 flex items-center gap-2 font-bold text-slate-200"><ArrowUp className="h-3 w-3" />قواعد فلسفة بسلاسة</div><p>المدرس يراجع ويعتمد. AI يقترح فقط. لا أسئلة خارج المصدر تدخل الألعاب تلقائياً، ولا يكتب المصنع إلى Moodle؛ التصدير XML منفصل والمدرس يستورده عندما يقرر.</p><p className="mt-2">الـNotes والـAI والـprompts في مساحة المدرس فقط، بينما الناتج المخبوز هو Manifest تعليمي قابل للعرض.</p></section></aside>
      </div>
    </div>
  </main>;
}
