"use client";

// ====================================================================
//  game-utils.ts — v2 (2025-AUG)
//
//  Shared helpers that enforce the app's philosophy across all games.
//  Centralizing these rules here means we can fix them in ONE place and
//  every game benefits.
// ====================================================================

import { useShellStore } from "./shell-store";
import { localDb } from "./local-db";
import type { Student } from "./slide-schema";

// ---------- 1. Smart celebration ----------
// Philosophy: "مايبقاش احتفال لو كله خسران".
//   - If at least one player has a positive score → celebrate the winner(s).
//   - If all players have 0 (or negative) → no celebration, just a soft
//     "تعادل / لا فائز" message.
//   - On a tie (multiple players share the top score) → soft celebration
//     but NOT "champion" — we set celebrationType to null so the banner
//     doesn't say "البطل!".

export interface PlayerScore {
  id: string;
  name: string;
  score: number;
}

export interface SmartCelebrationResult {
  /** Single winner — full "champion" celebration */
  winner: PlayerScore | null;
  /** Multiple winners tied — soft celebration */
  tied: PlayerScore[];
  /** All players lost (everyone has 0 or negative) — no celebration */
  allLost: boolean;
  /** Should we trigger confetti? */
  shouldCelebrate: boolean;
  /** What celebrationType to set (null = no banner) */
  celebrationType: string | null;
}

export function computeSmartCelebration(
  players: PlayerScore[],
  opts: { minScoreToWin?: number } = {}
): SmartCelebrationResult {
  const minScore = opts.minScoreToWin ?? 1;
  if (players.length === 0) {
    return { winner: null, tied: [], allLost: true, shouldCelebrate: false, celebrationType: null };
  }

  const maxScore = Math.max(...players.map((p) => p.score));
  // All-lost: nobody reached the min winning score
  if (maxScore < minScore) {
    return { winner: null, tied: [], allLost: true, shouldCelebrate: false, celebrationType: null };
  }

  const topPlayers = players.filter((p) => p.score === maxScore);
  if (topPlayers.length === 1) {
    // Single winner — full champion celebration
    return {
      winner: topPlayers[0],
      tied: [],
      allLost: false,
      shouldCelebrate: true,
      celebrationType: "champion",
    };
  }
  // Tie — soft celebration (confetti but no "champion" banner)
  return {
    winner: null,
    tied: topPlayers,
    allLost: false,
    shouldCelebrate: true,
    celebrationType: null, // no banner — UI shows "تعادل!"
  };
}

// ---------- 2. Award helpers (single source of truth) ----------
// Philosophy:
//   - awardCorrect: ONLY for answering a question correctly (adds +1 to
//     correctAnswers stat). Do NOT use for game-completion bonuses.
//   - awardPoints: for any other points (game bonus, gift catch, etc.).
//   - awardWrong: ONLY for answering a question incorrectly.
//   - After awardCorrect/awardWrong, do NOT call recordStudentActivity with
//     the same type — it creates a duplicate badge + duplicate StudentActivity
//     log entry.

export function awardCorrectAnswer(studentId: string, points: number): void {
  // This single call:
  //   - increments points
  //   - increments correctAnswers + attempts
  //   - creates a "correct" badge
  //   - logs a StudentActivity of type "correct"
  // No need for any other call.
  useShellStore.getState().awardCorrect(studentId, points);
}

export function awardWrongAnswer(studentId: string): void {
  // This single call:
  //   - increments wrongAnswers + attempts
  //   - creates a "wrong" badge
  //   - logs a StudentActivity of type "wrong"
  // No need for any other call.
  useShellStore.getState().awardWrong(studentId);
}

export function awardGameBonus(studentId: string, points: number, description: string): void {
  // For non-question points (game completion, gift catch, etc.).
  // Uses awardPoints (no correctAnswers inflation) + records a StudentActivity
  // so the activity log shows the game bonus.
  useShellStore.getState().awardPoints(studentId, points);
  if (description) {
    useShellStore.getState().recordStudentActivity(studentId, {
      type: "points",
      description,
      points: 0, // points already added by awardPoints — passing 0 avoids double-count
    });
  }
}

// ---------- 3. Unified fairness gate ----------
// Every source that selects a student must pass this gate. It is intentionally
// a synchronous store operation so a rapid double click cannot read stale
// fairness counters between selection and recording.
export type SelectionSource =
  | "quickfire" | "mathchallenge" | "questionchallenge" | "quizshow"
  | "wheel" | "luckywheel" | "manual" | "teleprompter" | "moodle" | "hotpotato"
  | "dice" | "reaction" | "memory" | "mystery-box";

export interface FairnessContext {
  ideaId?: string | null;
  source: SelectionSource;
  manualStudentId?: string;
  excludeStudentIds?: string[];
  enforceNoRepeat?: boolean;
}

function notify(type: "info" | "warning" | "error", message: string): void {
  import("sonner").then(({ toast }) => toast[type](message));
}

function currentIdea(ctx: FairnessContext): string {
  return ctx.ideaId || useShellStore.getState().currentIdeaId || "general";
}

function recordFairPick(student: Student, ctx: FairnessContext, score: number): void {
  const ideaId = currentIdea(ctx);
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const mode = useShellStore.getState().settings.fairnessMode || "soft";
  useShellStore.setState((s) => ({
    students: s.students.map((item) => item.id === student.id ? { ...item, calledInSession: true, lastCalled: nowIso } : item),
    ideaSelectionHistory: {
      ...s.ideaSelectionHistory,
      [ideaId]: [...(s.ideaSelectionHistory[ideaId] || []), student.id],
    },
    lessonAttemptsByStudent: {
      ...s.lessonAttemptsByStudent,
      [student.id]: (s.lessonAttemptsByStudent[student.id] || 0) + 1,
    },
    lastAskedAtByStudent: { ...s.lastAskedAtByStudent, [student.id]: now },
    fairnessLog: [
      ...s.fairnessLog.slice(-199),
      { studentId: student.id, ideaId, source: ctx.source, timestamp: now, manual: Boolean(ctx.manualStudentId), score, mode },
    ],
  }));
  void localDb.studentActivities.create({
    studentId: student.id,
    sessionId: useShellStore.getState().currentSessionId,
    type: "fair-pick",
    pointsDelta: 0,
    description: ctx.manualStudentId ? "اختيار يدوي مرّ عبر بوابة العدالة" : `اختيار عادل من ${ctx.source}`,
    metadataJson: JSON.stringify({ ideaId, source: ctx.source, score, mode }),
  }).catch((error) => console.warn("[fairness] activity sync failed", error));
  void import("./db-sync").then((dbSync) => dbSync.syncStudentUpdate(student.id, { lastCalled: nowIso }));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("bisalasa:fair-pick", { detail: { studentId: student.id, ideaId, source: ctx.source, timestamp: now, score, mode } }));
  }
}

function rankStudentsByFairness(present: Student[], ctx: FairnessContext): Array<{ student: Student; score: number }> {
  const state = useShellStore.getState();
  const ideaId = currentIdea(ctx);
  const history = state.ideaSelectionHistory[ideaId] || [];
  const notAsked = new Set(present.filter((student) => !history.includes(student.id)).map((student) => student.id));
  const mode = state.settings.fairnessMode || "soft";
  const tieBreak = new Map(present.map((student) => [student.id, Math.random()]));
  return present.map((student) => {
    if (mode === "off") return { student, score: 0 };
    const fairnessScore = state.getLessonFairnessScore(student.id, ideaId);
    const strugglingBonus = state.isStrugglingInIdea(student.id, ideaId) ? 100000 : 0;
    const ideaFreshnessBonus = notAsked.has(student.id) ? 1000 : 0;
    const sessionRotationBonus = student.calledInSession ? 0 : 20;
    return { student, score: fairnessScore + strugglingBonus + ideaFreshnessBonus + sessionRotationBonus };
  }).sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return (tieBreak.get(a.student.id) || 0) - (tieBreak.get(b.student.id) || 0);
  });
}

export function pickStudentFair(ctx: FairnessContext): Student | null {
  const state = useShellStore.getState();
  const ideaId = currentIdea(ctx);
  const excluded = new Set(ctx.excludeStudentIds || []);
  const present = state.students.filter((student) => !student.isAbsent && !excluded.has(student.id));
  if (present.length === 0) {
    notify("error", "لا يوجد طالب حاضر ومتاح للاختيار");
    return null;
  }

  const mode = state.settings.fairnessMode || "soft";
  const manual = ctx.manualStudentId ? present.find((student) => student.id === ctx.manualStudentId) : undefined;
  const ranked = rankStudentsByFairness(present, ctx);
  const top = ranked[0];
  if (!top) return null;

  if (manual && mode === "strict" && manual.id !== top.student.id) {
    const minAttempts = Math.min(...present.map((student) => state.lessonAttemptsByStudent[student.id] || 0));
    const manualAttempts = state.lessonAttemptsByStudent[manual.id] || 0;
    const manualStruggling = state.isStrugglingInIdea(manual.id, ideaId);
    if (manualAttempts > minAttempts + 1 && !manualStruggling && present.length > 2) {
      notify("error", `تم رفض التكرار في الوضع الصارم — الأولوية حالياً لـ${top.student.name}`);
      return null;
    }
  }

  let winner = manual || top.student;
  let winnerScore = manual ? state.getLessonFairnessScore(manual.id, ideaId) : top.score;
  if (!manual && mode === "strict" && ctx.enforceNoRepeat !== false) {
    const minAttempts = Math.min(...present.map((student) => state.lessonAttemptsByStudent[student.id] || 0));
    const winnerAttempts = state.lessonAttemptsByStudent[winner.id] || 0;
    const winnerStruggling = state.isStrugglingInIdea(winner.id, ideaId);
    if (!winnerStruggling && winnerAttempts > minAttempts + 1 && present.length > 2) {
      const balanced = ranked.find(({ student }) => (state.lessonAttemptsByStudent[student.id] || 0) <= minAttempts + 1);
      if (balanced) {
        winner = balanced.student;
        winnerScore = balanced.score;
        notify("info", `تم تأجيل التكرار تلقائياً لصالح ${winner.name}`);
      }
    }
  }

  recordFairPick(winner, { ...ctx, ideaId }, winnerScore);
  if (mode === "soft") {
    const attempts = state.lessonAttemptsByStudent[winner.id] || 0;
    const average = present.reduce((sum, student) => sum + (state.lessonAttemptsByStudent[student.id] || 0), 0) / present.length;
    if (ctx.manualStudentId && attempts > average * 1.5 && attempts >= 3) {
      notify("warning", `${winner.name} اتسأل كثيراً مقارنة بمتوسط الفصل`);
    }
  }
  return winner;
}

/**
 * C28 + C35 + H9 fix (2026-AUG): deferred fair pick.
 *
 * Returns the winner AND a `commit` function. The caller should call `commit()`
 * ONLY when the pick is "finalized" (e.g., after the wheel animation completes
 * and the user hasn't closed the modal). If the user closes mid-animation,
 * the caller simply discards `commit` and the fairness state is NOT mutated.
 *
 * This fixes the bug where the wheel recorded a student as "called" the
 * moment the spin started, so closing the window mid-spin counted the student
 * as asked even though they never answered a question.
 */
export function pickStudentFairDeferred(ctx: FairnessContext): { student: Student; commit: () => void } | null {
  const state = useShellStore.getState();
  const ideaId = currentIdea(ctx);
  const excluded = new Set(ctx.excludeStudentIds || []);
  const present = state.students.filter((student) => !student.isAbsent && !excluded.has(student.id));
  if (present.length === 0) {
    notify("error", "لا يوجد طالب حاضر ومتاح للاختيار");
    return null;
  }

  const mode = state.settings.fairnessMode || "soft";
  const manual = ctx.manualStudentId ? present.find((student) => student.id === ctx.manualStudentId) : undefined;
  const ranked = rankStudentsByFairness(present, ctx);
  const top = ranked[0];
  if (!top) return null;

  if (manual && mode === "strict" && manual.id !== top.student.id) {
    const minAttempts = Math.min(...present.map((student) => state.lessonAttemptsByStudent[student.id] || 0));
    const manualAttempts = state.lessonAttemptsByStudent[manual.id] || 0;
    const manualStruggling = state.isStrugglingInIdea(manual.id, ideaId);
    if (manualAttempts > minAttempts + 1 && !manualStruggling && present.length > 2) {
      notify("error", `تم رفض التكرار في الوضع الصارم — الأولوية حالياً لـ${top.student.name}`);
      return null;
    }
  }

  let winner = manual || top.student;
  let winnerScore = manual ? state.getLessonFairnessScore(manual.id, ideaId) : top.score;
  if (!manual && mode === "strict" && ctx.enforceNoRepeat !== false) {
    const minAttempts = Math.min(...present.map((student) => state.lessonAttemptsByStudent[student.id] || 0));
    const winnerAttempts = state.lessonAttemptsByStudent[winner.id] || 0;
    const winnerStruggling = state.isStrugglingInIdea(winner.id, ideaId);
    if (!winnerStruggling && winnerAttempts > minAttempts + 1 && present.length > 2) {
      const balanced = ranked.find(({ student }) => (state.lessonAttemptsByStudent[student.id] || 0) <= minAttempts + 1);
      if (balanced) {
        winner = balanced.student;
        winnerScore = balanced.score;
        notify("info", `تم تأجيل التكرار تلقائياً لصالح ${winner.name}`);
      }
    }
  }

  // Return winner + deferred commit. commit() must be called to record the pick.
  const deferredCtx = { ...ctx, ideaId };
  let committed = false;
  return {
    student: winner,
    commit: () => {
      if (committed) return;
      committed = true;
      recordFairPick(winner, deferredCtx, winnerScore);
      if (mode === "soft") {
        const attempts = useShellStore.getState().lessonAttemptsByStudent[winner.id] || 0;
        const avg = present.reduce((sum, s) => sum + (useShellStore.getState().lessonAttemptsByStudent[s.id] || 0), 0) / present.length;
        if (ctx.manualStudentId && attempts > avg * 1.5 && attempts >= 3) {
          notify("warning", `${winner.name} اتسأل كثيراً مقارنة بمتوسط الفصل`);
        }
      }
    },
  };
}

// Compatibility wrappers for older callers. They now use the same gate.
export function pickStudentByIdea(ideaId: string, manualStudentId?: string): Student | null {
  return pickStudentFair({ ideaId, source: manualStudentId ? "manual" : "teleprompter", manualStudentId });
}

export function pickStudentManual(studentId: string): Student | null {
  return pickStudentFair({ ideaId: useShellStore.getState().currentIdeaId || "general", source: "manual", manualStudentId: studentId });
}

// ---------- 4. Filter absent students from a list ----------
// Philosophy: absent students should never be auto-loaded or appear in
// the manual-selection grid for games. They can still be picked manually
// by the teacher if explicitly chosen (rare case).

export function filterPresentStudents(students: Student[]): Student[] {
  return students.filter((s) => !s.isAbsent);
}
