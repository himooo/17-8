import type { LessonQuestion, SlideManifest, SlideStep, Student } from "./slide-schema";

export interface SmartContextStatus {
  status?: string;
  label?: string;
  updatedAt?: string;
  isCorrect?: boolean;
}

export interface SmartContextInput {
  manifest: SlideManifest | null;
  currentStep: number;
  currentIdeaId?: string | null;
  lessonQuestions?: LessonQuestion[];
  lessonContext?: unknown;
  students?: Array<Pick<Student, "id" | "isAbsent" | "points" | "correctAnswers" | "wrongAnswers" | "attempts">>;
  liveStatuses?: Record<string, SmartContextStatus>;
  sessionStats?: Record<string, unknown>;
  moodle?: unknown;
  teacherNotesAllowed?: boolean;
  studentDataAllowed?: boolean;
  maxChars?: number;
}

export interface SmartContextResult {
  text: string;
  payload: Record<string, unknown>;
  truncated: boolean;
  chars: number;
}

function stepText(step: SlideStep): string {
  const script = Array.isArray(step.script) ? step.script.join(" ") : step.script ?? "";
  return [
    `step=${step.step}`,
    `title=${step.title ?? ""}`,
    `type=${step.type ?? "content"}`,
    `script=${script}`,
    `question=${step.question?.text ?? ""}`,
    `tags=${step.question?.tags?.join(",") ?? ""}`,
  ].join(" | ");
}

function extractLessonContext(context: unknown): Record<string, unknown> {
  if (!context || typeof context !== "object" || Array.isArray(context)) return {};
  const record = context as Record<string, unknown>;
  const allowed = ["summary", "objectives", "learningObjectives", "keyConcepts", "commonMistakes", "prerequisites", "savedAt"];
  return Object.fromEntries(allowed.filter((key) => key in record).map((key) => [key, record[key]]));
}

function sanitizeAggregated(value: unknown, depth = 0): unknown {
  if (depth > 2 || value === null || value === undefined) return undefined;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return value.length <= 120 && !/(name|student|user|code|token|secret|email|phone|id)/i.test(value) ? value : undefined;
  if (Array.isArray(value)) return { count: value.length };
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (/(name|student|user|code|token|secret|email|phone|id)/i.test(key)) continue;
      const safe = sanitizeAggregated(item, depth + 1);
      if (safe !== undefined) output[key] = safe;
    }
    return output;
  }
  return undefined;
}

function anonymizedStudentStats(
  students: SmartContextInput["students"],
  statuses: Record<string, SmartContextStatus> | undefined,
): Record<string, unknown> {
  const rows = students ?? [];
  const present = rows.filter((student) => !student.isAbsent);
  const statusValues = Object.values(statuses ?? {});
  const correct = statusValues.filter((status) => status.isCorrect === true).length;
  const answered = statusValues.filter((status) => typeof status.isCorrect === "boolean").length;
  return {
    rosterCount: rows.length,
    presentCount: present.length,
    absentCount: rows.length - present.length,
    totalPoints: rows.reduce((sum, student) => sum + (Number(student.points) || 0), 0),
    totalCorrect: rows.reduce((sum, student) => sum + (Number(student.correctAnswers) || 0), 0),
    totalWrong: rows.reduce((sum, student) => sum + (Number(student.wrongAnswers) || 0), 0),
    totalAttempts: rows.reduce((sum, student) => sum + (Number(student.attempts) || 0), 0),
    currentIdeaAnswered: answered,
    currentIdeaCorrect: correct,
    currentIdeaAccuracy: answered ? Math.round((correct / answered) * 10000) / 100 : null,
  };
}

export function buildSmartContext(input: SmartContextInput): SmartContextResult {
  const maxChars = Math.max(2000, Math.min(input.maxChars ?? 16000, 24000));
  const manifest = input.manifest;
  const allSteps = manifest?.ideas?.length
    ? manifest.ideas.flatMap((idea) => idea.steps.map((step) => ({ ideaId: idea.id, ideaTitle: idea.title, step })))
    : (manifest?.steps ?? []).map((step) => ({ ideaId: undefined, ideaTitle: undefined, step }));
  const currentIndex = Math.max(0, allSteps.findIndex((item) => item.ideaId === (input.currentIdeaId ?? undefined) && item.step.step === input.currentStep));
  const current = currentIndex >= 0 ? allSteps[currentIndex] : allSteps.find((item) => item.step.step === input.currentStep);
  const previous = (currentIndex >= 0 ? allSteps.slice(0, currentIndex) : allSteps.filter((item) => item.step.step < input.currentStep)).slice(-8);
  const currentIdea = manifest?.ideas?.find((idea) => idea.id === input.currentIdeaId);
  const lessonId = manifest?.lessonId;
  const rawLessonContext = lessonId && input.lessonContext && typeof input.lessonContext === "object" && !Array.isArray(input.lessonContext) && lessonId in (input.lessonContext as Record<string, unknown>)
    ? (input.lessonContext as Record<string, unknown>)[lessonId]
    : input.lessonContext;
  const contextPayload = extractLessonContext(rawLessonContext);
  const safeSteps = allSteps.map((item) => stepText(item.step));
  const payload: Record<string, unknown> = {
    lesson: {
      lessonId: manifest?.lessonId ?? null,
      title: manifest?.title ?? null,
      subtitle: manifest?.subtitle ?? null,
      targetAge: manifest?.targetAge ?? null,
      aspectRatio: manifest?.aspectRatio ?? null,
      summary: contextPayload.summary ?? null,
      objectives: contextPayload.objectives ?? contextPayload.learningObjectives ?? [],
      keyConcepts: contextPayload.keyConcepts ?? [],
      commonMistakes: contextPayload.commonMistakes ?? [],
    },
    navigation: {
      currentStepNumber: input.currentStep,
      currentIdeaId: input.currentIdeaId ?? null,
      currentIdeaTitle: currentIdea?.title ?? current?.ideaTitle ?? null,
      totalSteps: allSteps.length,
      previousSteps: previous.map((item) => stepText(item.step)),
      currentStep: current ? stepText(current.step) : null,
      allStepIndex: currentIndex >= 0 ? currentIndex : null,
    },
    questionCoverage: {
      total: input.lessonQuestions?.length ?? 0,
      currentIdea: input.lessonQuestions?.filter((question) => question.ideaId === (input.currentIdeaId ?? "flat")).length ?? 0,
      difficulties: (input.lessonQuestions ?? []).reduce<Record<string, number>>((result, question) => {
        const difficulty = question.difficulty ?? "medium";
        result[difficulty] = (result[difficulty] ?? 0) + 1;
        return result;
      }, {}),
    },
    class: anonymizedStudentStats(input.students, input.liveStatuses),
    session: input.sessionStats ?? {},
  };
  if (input.teacherNotesAllowed) {
    payload.teacherNotes = allSteps.map((item) => ({ step: item.step.step, ideaId: item.ideaId ?? null, notes: item.step.notes ?? "" })).filter((item) => item.notes);
  }
  if (input.studentDataAllowed && input.moodle !== undefined) payload.moodle = input.moodle;
  else if (input.moodle !== undefined) payload.moodle = { available: true, privacy: "aggregated-only", summary: sanitizeAggregated(input.moodle) };

  let text = `سياق Smart Context — لا أسماء ولا معرفات طلاب:\n${JSON.stringify(payload, null, 2)}`;
  let truncated = false;
  if (text.length > maxChars) {
    truncated = true;
    const compactPayload = { ...payload, navigation: { ...payload.navigation as Record<string, unknown>, allSteps: safeSteps.slice(0, 16) } };
    text = `سياق Smart Context مختصر — لا أسماء ولا معرفات طلاب:\n${JSON.stringify(compactPayload, null, 2)}`.slice(0, maxChars);
  }
  return { text, payload, truncated, chars: text.length };
}
