"use client";
// ====================================================================
//  game-result-recorder.ts — Shared GameResult persistence hook
//
//  Implements the proven QuickFire/QuestionChallenge/QuizShow contract
//  (ensureGameResult → recordAnswer → persistCompletedGame) as one reusable
//  hook so every game writes GameResult + questions + participants + complete,
//  keeping games visible in reports and analytics.
//
//  Usage:
//    const recorder = useGameResultRecorder();
//    recorder.begin();                          // on game start (captures startedAt)
//    recorder.ensure({ gameType, gameMode, ... }); // lazily before/at first answer
//    recorder.answer({ questionText, studentId, isCorrect, pointsEarned, ... });
//    await recorder.finish([{ studentId, studentName, pointsEarned, correctCount, wrongCount, isWinner }]);
//    recorder.reset();                          // when the player restarts a new round
// ====================================================================
import { useCallback, useMemo, useRef } from "react";
import { localDb } from "./local-db";

export type GameAnswerDraft = {
  questionId?: string;
  lessonId?: string;
  ideaId?: string;
  stepNumber?: number;
  questionText: string;
  studentId: string;
  studentAnswer?: string;
  isCorrect: boolean;
  pointsEarned: number;
};

export type GameParticipantDraft = {
  studentId: string;
  studentName: string;
  pointsEarned: number;
  correctCount: number;
  wrongCount: number;
  isWinner: boolean;
};

export type GameRecorderEnsure = {
  sessionId?: string | null;
  gameType: string;
  gameMode: string;
  ideaId?: string | null;
  questionCount: number;
  configJson?: unknown;
};

export function useGameResultRecorder() {
  const gameResultPromiseRef = useRef<Promise<Record<string, unknown> | null> | null>(null);
  const gameResultIdRef = useRef<string | null>(null);
  const answersRef = useRef<GameAnswerDraft[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const finalizedRef = useRef(false);

  const begin = useCallback((startedAt?: number) => {
    startedAtRef.current = startedAt ?? Date.now();
  }, []);

  const ensure = useCallback((meta: GameRecorderEnsure) => {
    if (gameResultPromiseRef.current) return gameResultPromiseRef.current;
    const promise = localDb.gameResults.create({
      sessionId: meta.sessionId ?? undefined,
      gameType: meta.gameType,
      gameMode: meta.gameMode,
      ideaId: meta.ideaId ?? undefined,
      questionCount: meta.questionCount,
      startedAt: new Date(startedAtRef.current ?? Date.now()).toISOString(),
      configJson: meta.configJson === undefined ? undefined : JSON.stringify(meta.configJson),
    }).then((row) => {
      gameResultIdRef.current = typeof row?.id === "string" ? row.id : null;
      return row;
    }).catch((error) => {
      console.warn("[game-result-recorder] failed to create game result", error);
      return null;
    });
    gameResultPromiseRef.current = promise;
    return promise;
  }, []);

  const answer = useCallback((draft: GameAnswerDraft) => {
    answersRef.current.push(draft);
  }, []);

  const finish = useCallback(async (participants: GameParticipantDraft[]) => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    const row = gameResultIdRef.current ? { id: gameResultIdRef.current } : await gameResultPromiseRef.current;
    const gameResultId = typeof row?.id === "string" ? row.id : null;
    if (!gameResultId) return;
    // Match buffered question texts to persisted LessonQuestion rows when the
    // draft has no stable DB id (manifest-extracted questions) — same lookup
    // strategy as QuickFireGame so report joins keep working.
    const lessonIds = [...new Set(answersRef.current.map((a) => a.lessonId).filter((id): id is string => Boolean(id)))];
    const persistedQuestions: Array<Record<string, unknown>> = [];
    for (const lessonId of lessonIds) {
      try { persistedQuestions.push(...await localDb.questions.listByLesson(lessonId)); } catch (error) { console.warn("[game-result-recorder] question id lookup failed", error); }
    }
    for (const a of answersRef.current) {
      const matched = a.questionId ? null : persistedQuestions.find((q) => q.text === a.questionText && (q.ideaId ?? null) === (a.ideaId ?? null) && (Number(q.stepNumber) || null) === (a.stepNumber ?? null));
      await localDb.gameResults.addQuestion({ gameResultId, ...a, questionId: a.questionId ?? (typeof matched?.id === "string" ? matched.id : undefined) });
    }
    for (const p of participants) {
      await localDb.gameResults.addParticipant({ gameResultId, ...p });
    }
    await localDb.gameResults.complete({ id: gameResultId, endedAt: new Date().toISOString(), durationMs: Math.max(0, Date.now() - (startedAtRef.current ?? Date.now())) });
  }, []);

  const reset = useCallback(() => {
    gameResultPromiseRef.current = null;
    gameResultIdRef.current = null;
    answersRef.current = [];
    startedAtRef.current = null;
    finalizedRef.current = false;
  }, []);

  // Stable container so consumers can safely list `recorder` in hook deps.
  return useMemo(() => ({ begin, ensure, answer, finish, reset }), [begin, ensure, answer, finish, reset]);
}
