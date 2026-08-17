// ====================================================================
//  question-provider.ts — Bridge between curriculum lessons and games
//
//  Philosophy (v2 — 2025-AUG rewrite):
//    - Slides (HTML lessons) contain ideas; each idea has steps
//    - Some steps are "question" type — these are the game questions
//    - When teacher opens a game, the game asks the QuestionProvider:
//        "give me N questions" with a filter (which idea, all ideas, manual)
//    - QuestionProvider reads from the active lesson's manifest in the
//      Zustand store and returns matching questions
//
//  Selection modes:
//    - "current-idea": questions from the idea currently displayed
//    - "previous-idea": questions from the idea just before current
//    - "all-ideas": all questions from the active lesson
//    - "manual": teacher hand-picks from a dropdown
//
//  🔴 NO FALLBACK TO DEMO QUESTIONS:
//    The previous version fell back to DEMO_QUESTIONS (4 hard-coded
//    arithmetic questions) when no lesson was active. This violates
//    the app's philosophy: "no questions outside the curriculum". Now
//    we return an empty array — the game is responsible for showing
//    a "load a lesson first" message.
//
//  🔴 NO REPEATS BETWEEN GAMES ON THE SAME IDEA:
//    We track asked-question IDs in a session-level Set on the
//    Zustand store (`askedQuestionIds`). When a game requests N
//    questions, we exclude any IDs that have already been asked in
//    this session. If the pool is exhausted, we reset (allow repeats)
//    so the game can still run.
// ====================================================================
"use client";

import { useShellStore } from "./shell-store";
import type { LessonQuestion, SlideManifest, SlideIdea } from "./slide-schema";
import { prioritizeQuestionsByDifficulty } from "./game-v10";

// ---------- Types ----------
export type QuestionSelectionMode =
  | "current-idea"
  | "previous-idea"
  | "all-ideas"
  | "manual"
  | "ai-generated";

export interface QuestionRequest {
  /** How to filter questions */
  mode: QuestionSelectionMode;
  /** For manual mode: the specific idea to pull from */
  ideaId?: string;
  /** Max questions to return (0 = all) */
  limit?: number;
  /** Shuffle the questions before returning */
  shuffle?: boolean;
  /** Optional curriculum difficulty filter; never changes the selected idea/source. */
  difficulty?: "easy" | "medium" | "hard";
  /** 🔴 exclude question IDs already asked in this session (default true).
   *  This is the mechanism that prevents repeats between games on the
   *  same idea. A game can opt out (e.g., a teacher explicitly re-running
   *  the same question) by passing false. */
  excludeAsked?: boolean;
}

// ---------- Helpers ----------
function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function getIdeaById(manifest: SlideManifest, ideaId: string): SlideIdea | undefined {
  return manifest.ideas?.find((i) => i.id === ideaId);
}

function getPreviousIdea(manifest: SlideManifest, currentIdeaId: string | null): SlideIdea | undefined {
  if (!manifest.ideas || !currentIdeaId) return undefined;
  const idx = manifest.ideas.findIndex((i) => i.id === currentIdeaId);
  if (idx <= 0) return undefined;
  return manifest.ideas[idx - 1];
}

// Manifest objects are replaced when a lesson changes, so WeakMap caching is
// safe here and releases old lessons automatically. The cache stores only the
// immutable curriculum pool; asked-question filtering and shuffling remain per
// request so fairness and session rules are never bypassed.
const ideaQuestionCache = new WeakMap<object, LessonQuestion[]>();
const manifestQuestionCache = new WeakMap<object, LessonQuestion[]>();

/**
 * A question is eligible for the multiple-choice games only when it satisfies
 * the same contract used by imports and AI-generated questions. A lesson may
 * legitimately contain an open-answer prompt with no options; keeping it in
 * the lesson is correct, but starting an MCQ game with it would create an
 * unanswerable screen.
 */
function isPlayableQuestion(question: NonNullable<SlideIdea["steps"][number]["question"]>): boolean {
  const options = Array.isArray(question.options) ? question.options.filter((option) => typeof option === "string" && option.trim()) : [];
  const correctAnswer = question.correctAnswer == null ? "" : String(question.correctAnswer).trim();
  return question.gameReady !== false && options.length >= 2 && Boolean(correctAnswer) && options.some((option) => option === correctAnswer);
}

function extractQuestionsFromIdea(idea: SlideIdea | undefined): LessonQuestion[] {
  if (!idea) return [];
  const cached = ideaQuestionCache.get(idea);
  if (cached) return cached;
  const lessonId = useShellStore.getState().manifest?.lessonId;
  const questions = idea.steps
    .filter((step) => step.type === "question" && step.question?.text && isPlayableQuestion(step.question))
    .map((step, stepIdx) => ({
      text: step.question!.text!,
      correctAnswer: step.question!.correctAnswer,
      options: step.question!.options,
      rewardPoints: step.question!.rewardPoints ?? 5,
      lessonId,
      ideaTitle: idea.title,
      ideaId: idea.id,
      // 🐛 FIX: use `step.step` if defined, else stepIdx+1 (some manifests
      // omit the step number — we synthesize one so games can display
      // "سؤال 3 من فكرة كذا").
      stepNumber: step.step ?? (stepIdx + 1),
      difficulty: step.question!.difficulty ?? "medium",
      tags: step.question!.tags ?? [],
      gameReady: step.question!.gameReady !== false,
      images: step.question!.images ?? [],
      imageRefs: step.question!.imageRefs ?? [],
      usage: step.question!.usage ?? ["game"],
      slideId: step.question!.id,
    }));
  ideaQuestionCache.set(idea, questions);
  return questions;
}

function extractAllQuestionsFromManifest(manifest: SlideManifest): LessonQuestion[] {
  const cached = manifestQuestionCache.get(manifest);
  if (cached) return cached;
  const out: LessonQuestion[] = [];
  if (manifest.ideas) {
    for (const idea of manifest.ideas) {
      out.push(...extractQuestionsFromIdea(idea));
    }
  }
  if (manifest.steps) {
    manifest.steps.forEach((step, idx) => {
      if (step.type === "question" && step.question?.text && isPlayableQuestion(step.question)) {
        out.push({
          text: step.question.text,
          correctAnswer: step.question.correctAnswer,
          options: step.question.options,
          rewardPoints: step.question.rewardPoints ?? 5,
          lessonId: manifest.lessonId,
          step: step.step,
          ideaId: "flat",
          stepNumber: step.step ?? (idx + 1),
          difficulty: step.question.difficulty ?? "medium",
          tags: step.question.tags ?? [],
          gameReady: true,
          images: step.question.images ?? [],
          imageRefs: step.question.imageRefs ?? [],
          usage: step.question.usage ?? ["game"],
          slideId: step.question.id,
        });
      }
    });
  }
  manifestQuestionCache.set(manifest, out);
  return out;
}

// ---------- Stable question IDs ----------
// A question's identity is its (ideaId + stepNumber + text-hash). We can't
// rely on a DB id because questions are extracted from the manifest at
// runtime. This function produces a stable id so we can track "asked"
// questions across games in the same session.
function questionStableId(q: LessonQuestion): string {
  const idea = q.ideaId || "flat";
  const step = q.stepNumber ?? 0;
  // Use a quick string hash for the text — collisions are acceptable here
  // because (idea, step) already disambiguates most questions.
  const textHash = hashStr(q.text || "");
  return `${idea}#${step}#${textHash}`;
}

function hashStr(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  // unsigned 32-bit
  return (h >>> 0).toString(36);
}

// ---------- Main API ----------
export function getQuestions(request: QuestionRequest): LessonQuestion[] {
  const manifest = useShellStore.getState().manifest;
  const currentIdeaId = useShellStore.getState().currentIdeaId;
  // 🟢 v2: askedQuestionIds lives in the store so games can share it.
  // If the store doesn't have it yet (older store version), fall back to
  // an empty Set.
  const storeState = useShellStore.getState();
  const askedIds: Set<string> = storeState.askedQuestionIds ?? new Set();
  // Imported lessons can keep their question bank in SQLite separately from
  // the slide manifest. The shell hydrates that bank into lessonQuestions;
  // use it only as a curriculum-local fallback when the manifest has no
  // playable embedded questions. This never mixes in AI or demo questions.
  const hydratedQuestions = storeState.lessonQuestions ?? [];
  const selectHydrated = (ideaId?: string): LessonQuestion[] => hydratedQuestions.filter((question) => {
    if (ideaId && question.ideaId && question.ideaId !== ideaId) return false;
    const options = Array.isArray(question.options) ? question.options.filter((option) => typeof option === "string" && option.trim()) : [];
    const correct = question.correctAnswer == null ? "" : String(question.correctAnswer).trim();
    return question.gameReady !== false && options.length >= 2 && Boolean(correct) && options.some((option) => option === correct);
  });

  let questions: LessonQuestion[] = [];

  const aiPool = useShellStore.getState().aiQuestionPool ?? [];
  if (!manifest && request.mode !== "ai-generated") {
    // 🔴 v2: NO demo questions fallback. The app philosophy mandates that
    // games use ONLY curriculum questions unless the teacher explicitly chose
    // the separate AI-generated source.
    return [];
  }
  // Non-AI branches have returned above when no curriculum exists. The cast
  // keeps the switch exhaustive while ai-generated intentionally ignores it.
  const curriculumManifest = manifest as SlideManifest;

  switch (request.mode) {
    case "current-idea": {
      const requestedCurrentIdeaId = request.ideaId ?? currentIdeaId;
      if (requestedCurrentIdeaId) {
        const idea = getIdeaById(curriculumManifest, requestedCurrentIdeaId);
        questions = extractQuestionsFromIdea(idea);
        if (questions.length === 0) questions = selectHydrated(requestedCurrentIdeaId);
        } else if (curriculumManifest.ideas && curriculumManifest.ideas.length > 0) {
        // For nested lessons, current-idea means the active idea only. Never
        // silently leak questions from another idea into the teacher's game.
          questions = extractQuestionsFromIdea(curriculumManifest.ideas[0]);
          if (questions.length === 0) questions = selectHydrated(curriculumManifest.ideas[0].id);
      } else {
        questions = extractAllQuestionsFromManifest(curriculumManifest);
        if (questions.length === 0) questions = selectHydrated();
      }
      break;
    }
    case "previous-idea": {
      const prevIdea = getPreviousIdea(curriculumManifest, currentIdeaId);
      questions = extractQuestionsFromIdea(prevIdea);
      if (questions.length === 0) questions = selectHydrated(prevIdea?.id);
      break;
    }
    case "all-ideas": {
      questions = extractAllQuestionsFromManifest(curriculumManifest);
      if (questions.length === 0) questions = selectHydrated();
      break;
    }
    case "manual": {
      // Manual mode must have an explicit idea. An empty selection is not an
      // invitation to silently use the whole lesson.
      questions = request.ideaId === "flat" && (!curriculumManifest.ideas || curriculumManifest.ideas.length === 0)
        ? extractAllQuestionsFromManifest(curriculumManifest)
        : request.ideaId
        ? extractQuestionsFromIdea(getIdeaById(curriculumManifest, request.ideaId))
        : [];
      if (questions.length === 0) questions = selectHydrated(request.ideaId === "flat" ? undefined : request.ideaId);
      break;
    }
    case "ai-generated": {
      // Explicit teacher-selected pool only; never mix with curriculum silently.
      questions = aiPool.map((question) => ({ ...question }));
      break;
    }
  }

  // Adaptive difficulty reorders only within the already-selected source/idea.
  // This keeps the curriculum boundary intact and avoids an empty game when a
  // teacher has only a few questions at the exact target level.
  if (request.difficulty) {
    questions = prioritizeQuestionsByDifficulty(questions, request.difficulty);
  }

  // Exclude already-asked questions (prevents repeats between games on
  // the same idea). If filtering eliminates everything, keep the source
  // empty: the teacher must explicitly choose another source or start a new
  // session. Repeating silently undermines the live-class contract.
  if (request.excludeAsked !== false && askedIds.size > 0) {
    questions = questions.filter((q) => !askedIds.has(questionStableId(q)));
  }

  // Shuffle if requested
  if (request.shuffle) {
    questions = shuffleArray(questions);
  }

  // Apply limit
  if (request.limit && request.limit > 0) {
    questions = questions.slice(0, request.limit);
  }

  // Annotate each question with its stableId so games can mark it as asked
  // without recomputing the hash.
  return questions.map((q) => ({ ...q, _stableId: questionStableId(q) } as LessonQuestion & { _stableId: string }));
}

// ---------- Asked-question tracking ----------
// Games call markQuestionAsked(stableId) after a question is fully resolved
// (answered, time-out, skipped). This excludes it from future getQuestions
// calls in the same session.
export function markQuestionAsked(stableId: string): void {
  const s = useShellStore.getState();
  if (!s.askedQuestionIds) {
    useShellStore.setState({ askedQuestionIds: new Set([stableId]) });
    return;
  }
  if (s.askedQuestionIds.has(stableId)) return;
  const next = new Set(s.askedQuestionIds);
  next.add(stableId);
  useShellStore.setState({ askedQuestionIds: next });
}

export function clearAskedQuestions(): void {
  useShellStore.setState({ askedQuestionIds: new Set() });
}

export function getQuestionStableId(q: LessonQuestion): string {
  return questionStableId(q);
}

// ---------- Hook: list available ideas (for manual selection UI) ----------
export function useAvailableIdeas(): { id: string; title: string; questionCount: number }[] {
  const manifest = useShellStore((s) => s.manifest);
  if (!manifest) return [];
  if (manifest.ideas && manifest.ideas.length > 0) {
    return manifest.ideas.map((idea) => ({
      id: idea.id,
      title: idea.title,
      questionCount: extractQuestionsFromIdea(idea).length,
    }));
  }
  const flatQuestionCount = extractAllQuestionsFromManifest(manifest).length;
  return [{ id: "flat", title: manifest.title || "كل خطوات الدرس", questionCount: flatQuestionCount }];
}

// ---------- Hook: current idea info ----------
export function useCurrentIdeaInfo(): { id: string | null; title: string | null; questionCount: number } {
  const manifest = useShellStore((s) => s.manifest);
  const currentIdeaId = useShellStore((s) => s.currentIdeaId);
  if (!manifest) return { id: null, title: null, questionCount: 0 };
  if (!manifest.ideas || manifest.ideas.length === 0) {
    return { id: "flat", title: manifest.title, questionCount: extractAllQuestionsFromManifest(manifest).length };
  }
  const idea = getIdeaById(manifest, currentIdeaId || manifest.ideas[0].id);
  if (!idea) return { id: null, title: null, questionCount: 0 };
  return { id: idea.id, title: idea.title, questionCount: extractQuestionsFromIdea(idea).length };
}

// ---------- Hook: previous idea info ----------
export function usePreviousIdeaInfo(): { id: string | null; title: string | null; questionCount: number } {
  const manifest = useShellStore((s) => s.manifest);
  const currentIdeaId = useShellStore((s) => s.currentIdeaId);
  if (!manifest || !currentIdeaId) {
    return { id: null, title: null, questionCount: 0 };
  }
  const prevIdea = getPreviousIdea(manifest, currentIdeaId);
  if (!prevIdea) return { id: null, title: null, questionCount: 0 };
  return {
    id: prevIdea.id,
    title: prevIdea.title,
    questionCount: extractQuestionsFromIdea(prevIdea).length,
  };
}

// ---------- Hook: total asked count (for UI display) ----------
export function useAskedQuestionsCount(): number {
  const asked = useShellStore((s) => s.askedQuestionIds);
  return asked?.size ?? 0;
}

