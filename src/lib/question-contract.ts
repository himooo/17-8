// ====================================================================
// question-contract.ts — deterministic validation for curriculum/game questions
// Keeps imported and AI-generated questions inside the same safe contract.
// ====================================================================

export type QuestionDifficulty = "easy" | "medium" | "hard";
export type QuestionType = "mcq" | "true-false" | "essay" | "cloze" | "drag-drop";

export interface NormalizedQuestionInput {
  lessonId: string;
  text: string;
  correctAnswer: string | null;
  optionsJson: string;
  questionType: QuestionType;
  solutionStepsJson: string;
  solutionScript: string;
  imageJson: string;
  rewardPoints: number;
  difficulty: QuestionDifficulty;
  tags: string;
  gameReady: boolean;
  ideaId?: string | null;
  ideaTitle?: string | null;
  stepNumber?: number | null;
  externalRefId?: string | null;
}

export interface QuestionValidationResult {
  ok: boolean;
  value?: NormalizedQuestionInput;
  errors: string[];
}

const MAX_TEXT_LENGTH = 2000;
const MAX_OPTION_LENGTH = 500;
const MAX_OPTIONS = 12;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 80;

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function arrayInput(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeOptions(value: unknown): string[] {
  const input = arrayInput(value);
  if (!input.length) return [];
  const seen = new Set<string>();
  const options: string[] = [];
  for (const item of input) {
    const option = cleanText(item, MAX_OPTION_LENGTH);
    if (!option || seen.has(option)) continue;
    seen.add(option);
    options.push(option);
    if (options.length >= MAX_OPTIONS) break;
  }
  return options;
}

function normalizeTags(value: unknown): string[] {
  const input = arrayInput(value);
  if (!input.length) return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const item of input) {
    const tag = cleanText(item, MAX_TAG_LENGTH);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
    if (tags.length >= MAX_TAGS) break;
  }
  return tags;
}

function normalizeAnswer(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string") {
    const answer = value.trim().slice(0, MAX_OPTION_LENGTH);
    return answer || null;
  }
  return null;
}

function normalizeLongArray(value: unknown, maxItems: number, maxLength: number): string[] {
  return arrayInput(value).filter((item): item is string => typeof item === "string").map((item) => item.trim().slice(0, maxLength)).filter(Boolean).slice(0, maxItems);
}

function normalizeImages(value: unknown): Array<{ url: string; alt: string; type: string }> {
  const input = arrayInput(value);
  return input.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object")).map((item) => ({ url: cleanText(item.url, 1000), alt: cleanText(item.alt, 240), type: cleanText(item.type, 80) || "image" })).filter((item) => /^https?:\/\//i.test(item.url) || item.url.startsWith("/manus-storage/")).slice(0, 8);
}

function normalizePoints(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 3;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeStep(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 10000) return null;
  return n;
}

export function validateQuestionInput(raw: Record<string, unknown>): QuestionValidationResult {
  const errors: string[] = [];
  const lessonId = cleanText(raw.lessonId, 300);
  const text = cleanText(raw.text, MAX_TEXT_LENGTH);
  const options = normalizeOptions(raw.options ?? raw.optionsJson);
  const correctAnswer = normalizeAnswer(raw.correctAnswer);
  const questionType: QuestionType = raw.questionType === "true-false" || raw.questionType === "essay" || raw.questionType === "cloze" || raw.questionType === "drag-drop" ? raw.questionType : raw.type === "true-false" || raw.type === "essay" || raw.type === "cloze" || raw.type === "drag-drop" ? raw.type : "mcq";
  const difficulty: QuestionDifficulty = raw.difficulty === "easy" || raw.difficulty === "hard" ? raw.difficulty : "medium";
  const tags = normalizeTags(raw.tags ?? []);
  const gameReady = raw.gameReady !== false && questionType !== "essay" && questionType !== "cloze" && questionType !== "drag-drop";

  if (!lessonId) errors.push("lessonId مطلوب");
  if (!text) errors.push("نص السؤال مطلوب");
  if (gameReady && options.length < 2) errors.push("السؤال القابل للعب يحتاج خيارين على الأقل");
  if (gameReady && !correctAnswer) errors.push("السؤال القابل للعب يحتاج إجابة صحيحة");
  if (correctAnswer && options.length > 0 && !options.some((option) => option === correctAnswer)) {
    errors.push("correctAnswer يجب أن تكون إحدى options");
  }
  if (raw.optionsJson !== undefined && !Array.isArray(raw.options) && typeof raw.optionsJson !== "string") {
    errors.push("optionsJson يجب أن يكون JSON أو مصفوفة options");
  }
  if (raw.tags !== undefined && !Array.isArray(raw.tags) && typeof raw.tags !== "string") {
    errors.push("tags يجب أن تكون مصفوفة");
  }

  const stepNumber = normalizeStep(raw.stepNumber);
  if (raw.stepNumber !== undefined && raw.stepNumber !== null && raw.stepNumber !== "" && stepNumber === null) {
    errors.push("stepNumber غير صالح");
  }

  const value: NormalizedQuestionInput = {
    lessonId,
    text,
    correctAnswer,
    optionsJson: JSON.stringify(options),
    questionType,
    solutionStepsJson: JSON.stringify(normalizeLongArray(raw.solutionSteps ?? raw.solutionStepsJson, 20, 1000)),
    solutionScript: cleanText(raw.solutionScript ?? raw.explanation, 4000),
    imageJson: JSON.stringify(normalizeImages(raw.images ?? raw.imageJson)),
    rewardPoints: normalizePoints(raw.rewardPoints),
    difficulty,
    tags: JSON.stringify(tags),
    gameReady,
    ideaId: raw.ideaId == null ? null : cleanText(raw.ideaId, 300) || null,
    ideaTitle: raw.ideaTitle == null ? null : cleanText(raw.ideaTitle, 500) || null,
    stepNumber,
    externalRefId: raw.externalRefId == null ? null : cleanText(raw.externalRefId, 300) || null,
  };

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value, errors: [] };
}

export function parseQuestionOptions(optionsJson: string | null | undefined): string[] {
  if (!optionsJson) return [];
  try {
    const parsed = JSON.parse(optionsJson);
    return normalizeOptions(parsed);
  } catch {
    return [];
  }
}
