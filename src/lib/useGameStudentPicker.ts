// ====================================================================
//  useGameStudentPicker.ts v7.0 — Unified hook for ALL games
//
//  Core requirements:
//    1. Fair random selection (excludes absent + already-called)
//    2. Once a student is called, they are NOT called again until ALL
//       present students have been called (fair rotation)
//    3. When all present students are called, reset calledInSession
//       and start a new round
//    4. Manual selection also marks the student as called
//    5. Returns available/present/absent lists for UI
//    6. Records activity on student profile (badge + calledInSession)
//
//  Used by: ALL games that pick students (individual/duel/group)
// =================================================================///
"use client";

import { useState, useCallback, useEffect } from "react";
import { useShellStore } from "./shell-store";
import { pickStudentFair, pickStudentFairDeferred, type SelectionSource } from "./game-utils";
import type { Student } from "./slide-schema";

export interface PickerResult {
  /** Pick a fair random student (excludes absent + already-called) */
  pickRandom: (excludeIds?: string[]) => Student | null;
  /** C28/C35 fix: deferred pick — returns winner + commit() function.
   *  Call commit() only when the pick is finalized (e.g., after animation). */
  pickRandomDeferred: (excludeIds?: string[]) => { student: Student; commit: () => void } | null;
  /** Manually select a student */
  pickManual: (studentId: string) => Student | null;
  /** The currently selected student */
  selected: Student | null;
  /** Clear selection */
  clear: () => void;
  /** Available students (present + not-yet-called) */
  available: Student[];
  /** All present students */
  present: Student[];
  /** All absent students */
  absent: Student[];
  /** All students */
  all: Student[];
  /** Reset all calledInSession (new round) */
  resetRound: () => void;
  /** How many have been called this round */
  calledCount: number;
}

export function useGameStudentPicker(source: SelectionSource = "manual"): PickerResult {
  const students = useShellStore((s) => s.students);
  const setState = useShellStore.setState;
  const [selected, setSelected] = useState<Student | null>(null);

  const present = students.filter((s) => !s.isAbsent);
  const absent = students.filter((s) => s.isAbsent);
  const available = present.filter((s) => !s.calledInSession);
  const calledCount = present.filter((s) => s.calledInSession).length;

  const pickRandom = useCallback((excludeIds: string[] = []): Student | null => {
    const picked = pickStudentFair({
      source,
      ideaId: useShellStore.getState().currentIdeaId || "general",
      excludeStudentIds: excludeIds,
    });
    if (picked) setSelected(picked);
    return picked;
  }, [source]);

  const pickRandomDeferred = useCallback((excludeIds: string[] = []): { student: Student; commit: () => void } | null => {
    const result = pickStudentFairDeferred({
      source,
      ideaId: useShellStore.getState().currentIdeaId || "general",
      excludeStudentIds: excludeIds,
    });
    if (result) {
      setSelected(result.student);
      return result;
    }
    return null;
  }, [source]);

  const pickManual = useCallback((studentId: string): Student | null => {
    const picked = pickStudentFair({
      source: "manual",
      ideaId: useShellStore.getState().currentIdeaId || "general",
      manualStudentId: studentId,
    });
    if (picked) setSelected(picked);
    return picked;
  }, []);

  const clear = useCallback(() => setSelected(null), []);

  const resetRound = useCallback(() => {
    setState((state: any) => ({
      students: state.students.map((st: Student) => ({ ...st, calledInSession: false })),
      ideaSelectionHistory: {},
    }));
    setSelected(null);
  }, [setState]);

  return {
    pickRandom,
    pickRandomDeferred,
    pickManual,
    selected,
    clear,
    available,
    present,
    absent,
    all: students,
    resetRound,
    calledCount,
  };
}

// ====================================================================
//  useGameQuestions — Pull questions from lesson with source selection
//
//  DEFAULT: "current-idea" (the idea currently displayed)
//  Option:  "all-ideas" (the whole lesson — teacher explicitly chooses)
//
//  🟢 v2 (2025-AUG):
//    - `limit` is now configurable per-game (was hard-coded to 15).
//    - Questions are annotated with `_stableId` so games can mark them as
//      asked via `markQuestionAsked(stableId)` after a question is resolved.
//    - The hook itself marks questions as asked when the game unmounts
//      IF the game used the new `markAllAsked()` helper.
//    - excludeAsked defaults to true → questions already asked in this
//      session are excluded, so the teacher can run multiple games on the
//      same idea without repeating questions.
// =================================================================///

export type QuestionSource = "current-idea" | "all-ideas" | "manual" | "ai-generated";

export interface GameQuestion {
  /** SQLite LessonQuestion id when available; absent for manifest-only or AI drafts. */
  id?: string;
  text: string;
  options: string[];
  correctIdx: number;
  rewardPoints?: number;
  lessonId?: string;
  ideaId?: string;
  stepNumber?: number;
  ideaTitle?: string;
  images?: Array<{ url: string; alt?: string; type?: string }>;
  imageRefs?: string[];
  usage?: Array<"presentation" | "moodle-interactive" | "moodle-homework" | "game">;
  /** 🟢 v2: stable id — games should call markQuestionAsked(stableId) after
   *  the question is fully resolved (answered, timed out, skipped). */
  _stableId?: string;
}

export function useGameQuestions(
  source: QuestionSource = "current-idea",
  limit = 15,
  opts: { excludeAsked?: boolean; ideaId?: string; difficulty?: "easy" | "medium" | "hard" } = {}
): {
  questions: GameQuestion[];
  loading: boolean;
  /** Mark a question as asked by stableId (excludes it from future pulls). */
  markAsked: (stableId: string) => void;
  /** True because question delivery is local and does not require Moodle availability. */
  standalone: boolean;
  sourceLabel: "curriculum-local" | "ai-selected";
} {
  const [questions, setQuestions] = useState<GameQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  const manifest = useShellStore((s) => s.manifest);
  const currentIdeaId = useShellStore((s) => s.currentIdeaId);
  // 🟢 v2: re-pull when the asked-questions set changes so a new game
  // immediately sees a fresh pool.
  const askedVersion = useShellStore((s) => (s.askedQuestionIds ? s.askedQuestionIds.size : 0));
  // SQLite question hydration is asynchronous after the iframe manifest.
  // Re-run the provider when that local curriculum bank arrives.
  const hydratedQuestionCount = useShellStore((s) => s.lessonQuestions?.length ?? 0);
  const requestedIdeaId = opts.ideaId;
  const excludeAsked = opts.excludeAsked ?? true;
  const requestedDifficulty = opts.difficulty;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { getQuestions } = await import("./question-provider");
        const lessonQs = getQuestions({
          mode: source,
          ideaId: requestedIdeaId,
          shuffle: true,
          limit,
          excludeAsked,
          difficulty: requestedDifficulty,
        });
        if (cancelled) return;
        if (lessonQs.length > 0) {
          const converted: GameQuestion[] = lessonQs.map((lq) => {
            const opts = lq.options || [];
            const correctIdx = lq.correctAnswer != null
              ? opts.findIndex((o) => String(o) === String(lq.correctAnswer))
              : -1;
            return {
              id: (lq as any).id,
              text: lq.text,
              options: opts,
              correctIdx: correctIdx >= 0 ? correctIdx : 0,
              rewardPoints: lq.rewardPoints,
              lessonId: lq.lessonId,
              ideaId: lq.ideaId,
              stepNumber: lq.stepNumber,
              ideaTitle: lq.ideaTitle,
              images: lq.images ?? [],
              imageRefs: lq.imageRefs ?? [],
              usage: lq.usage ?? ["game"],
              _stableId: (lq as any)._stableId,
            };
          });
          setQuestions(converted);
        } else {
          // 🟢 v2: no demo fallback — just empty array. The game UI shows
          // "حمّل درساً أولاً" if there's no manifest, or "لا توجد أسئلة
          // في هذه الفكرة" if the manifest has no question-type steps.
          setQuestions([]);
        }
      } catch (e) {
        console.warn("[useGameQuestions] failed:", e);
        setQuestions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [manifest, currentIdeaId, source, limit, askedVersion, hydratedQuestionCount, requestedIdeaId, excludeAsked, requestedDifficulty]);

  const markAsked = useCallback((stableId: string) => {
    if (!stableId) return;
    useShellStore.getState().markQuestionAsked(stableId);
  }, []);

  return { questions, loading, markAsked, standalone: true, sourceLabel: source === "ai-generated" ? "ai-selected" : "curriculum-local" };
}

// ====================================================================
//  useGameGroupPicker — For group-based games
//
//  Core requirements:
//    1. Each round, pick 2 random groups from the selected pool
//    2. A group that was already picked is NOT picked again until ALL
//       groups in the pool have been picked
//    3. When all groups have been picked, reset and start a new round
// =================================================================///
export interface GroupInfo {
  id: string;
  name: string;
  color: string;
  studentIds: string | string[];
}

export interface GroupPickerResult {
  /** Pick 2 random groups (not previously picked this SESSION — shared
   *  globally across all group-based games, not just this component). */
  pickTwoGroups: (pool: GroupInfo[]) => GroupInfo[] | null;
  /** Currently selected groups (local to this game instance) */
  current: GroupInfo[];
  /** Group IDs already picked this session (global, shared across games) */
  called: string[];
  /** Reset the whole session's group rotation (clears the global pool) */
  resetRound: () => void;
  /** How many groups remain available in the current rotation */
  availableCount: number;
}

export function useGameGroupPicker(): GroupPickerResult {
  const [current, setCurrent] = useState<GroupInfo[]>([]);
  const called = useShellStore((s) => s.calledGroupIds);
  const pickFairGroups = useShellStore((s) => s.pickFairGroups);

  const pickTwoGroups = useCallback((pool: GroupInfo[]): GroupInfo[] | null => {
    if (pool.length < 2) return null;
    const picked = pickFairGroups(pool, 2);
    setCurrent(picked);
    return picked.length === 2 ? picked : null;
  }, [pickFairGroups]);

  const resetRound = useCallback(() => {
    useShellStore.setState({ calledGroupIds: [] });
    setCurrent([]);
  }, []);

  return {
    pickTwoGroups,
    current,
    called,
    resetRound,
    availableCount: 0, // computed by caller
  };
}
