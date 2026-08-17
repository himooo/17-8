"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useShellStore } from "@/lib/shell-store";
import { useGameQuestions, useGameStudentPicker, type GameQuestion } from "@/lib/useGameStudentPicker";
import { Brain, Check, Crown, RotateCcw, Users, X, Plus, BookOpen, Award, Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGameActivity } from "@/lib/game-activity-context";
import { localDb } from "@/lib/local-db";
import { MathText } from "./MathText";
import { QuestionMedia } from "./QuestionMedia";
// 🟢 v2 fix: unified pre-game question config (count + source)
import { GameQuestionConfigView, useGameQuestionConfig } from "./GameQuestionConfig";
// 🟢 v2 fix: smart celebration — only fire confetti when at least one player scored > 0.
import { computeSmartCelebration } from "@/lib/game-utils";

/**
 * QuizShowGame v7.0 — Redesigned + QuestionProvider wired + students auto-load.
 * Questions come exclusively from the loaded lesson's curriculum (via
 * useGameQuestions) — no generic/unrelated fallback question bank.
 */
export function QuizShowGame({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<"setup" | "question" | "reveal" | "done">("setup");
  // 🟢 v2 fix: use GameQuestion (has _stableId + rewardPoints) instead of plain Question.
  const [questions, setQuestions] = useState<GameQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [participants, setParticipants] = useState<string[]>([""]);
  const [showHelp, setShowHelp] = useState(false);
  const answerLockRef = useRef(false);
  const advanceLockRef = useRef(false);

  const playSound = useShellStore((s) => s.playSound);
  const triggerConfetti = useShellStore((s) => s.triggerConfetti);
  const triggerRedFlash = useShellStore((s) => s.triggerRedFlash);
  const students = useShellStore((s) => s.students);
  const awardCorrect = useShellStore((s) => s.awardCorrect);
  const setCelebrationType = useShellStore((s) => s.setCelebrationType);
  const currentSessionId = useShellStore((s) => s.currentSessionId);
  const currentIdeaId = useShellStore((s) => s.currentIdeaId);
  const activeLessonId = useShellStore((s) => s.activeLessonId);

  const picker = useGameStudentPicker("quizshow");
  const presentStudents = useMemo(() => students.filter((student) => !student.isAbsent), [students]);
  const finalConfettiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 🟢 v2 fix: configurable question count + source (was hard-coded to 15).
  const cfg = useGameQuestionConfig(10);
  const { questions: lessonQuestions, loading: questionsLoading, markAsked } = useGameQuestions(
    cfg.questionSource,
    cfg.limit || 10,
    { ideaId: cfg.manualIdeaIdForHook ?? undefined },
  );

  // Mark this game as active/inactive for mid-game exit confirmation.
  const setGameActive = useGameActivity();

  // Mark the game as "active" while in mid-play so the wrapping GameOverlay
  // asks for confirmation before closing (prevents accidental loss of progress).
  const isGameActive = phase === "question" || phase === "reveal";
  useEffect(() => {
    setGameActive(isGameActive);
  }, [isGameActive, setGameActive]);

  // ===== Auto-load participants from store students (fair rotation) =====
  // 🟢 v2 fix: filter absent students from the auto-loaded batch.
  useEffect(() => {
    if (presentStudents.length < 2 || participants.length !== 1 || participants[0]) return;
    const timer = window.setTimeout(() => {
      const picked: Array<{ id: string; name: string }> = [];
      for (let index = 0; index < Math.min(4, presentStudents.length); index += 1) {
        const next = picker.pickRandom(picked.map((student) => student.id));
        if (!next) break;
        picked.push(next);
      }
      setParticipants(picked.map((student) => student.name));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [participants, picker, presentStudents.length]);

  useEffect(() => () => {
    if (finalConfettiTimeoutRef.current !== null) {
      clearTimeout(finalConfettiTimeoutRef.current);
      finalConfettiTimeoutRef.current = null;
    }
  }, []);

  // ===== QuestionProvider: pull questions from the active lesson =====
  // 🟢 v2 fix: keep _stableId + rewardPoints so we can mark questions as asked
  // and reward based on per-question rewardPoints (not hard-coded 5).
  useEffect(() => {
    if (phase !== "setup") return;
    const converted: GameQuestion[] = lessonQuestions.map((lq) => ({
      text: lq.text,
      options: lq.options.length >= 2 ? lq.options : ["-", "-", "-", "-"],
      correctIdx: lq.correctIdx >= 0 ? lq.correctIdx : 0,
      rewardPoints: lq.rewardPoints,
      lessonId: lq.lessonId,
      ideaId: lq.ideaId,
      stepNumber: lq.stepNumber,
      ideaTitle: lq.ideaTitle,
      images: lq.images ?? [],
      imageRefs: lq.imageRefs ?? [],
      usage: lq.usage ?? ["game"],
      _stableId: lq._stableId,
    }));
    const timer = window.setTimeout(() => setQuestions(converted), 0);
    return () => window.clearTimeout(timer);
  }, [lessonQuestions, phase]);

  const currentQ = questions[currentIdx];
  const scoresRef = useRef(scores);
  useEffect(() => { scoresRef.current = scores; }, [scores]);
  const gameResultPromiseRef = useRef<Promise<Record<string, unknown> | null> | null>(null);
  const gameResultIdRef = useRef<string | null>(null);
  const recordedAnswersRef = useRef<Array<{ questionId?: string; lessonId?: string; ideaId?: string; stepNumber?: number; questionText: string; studentId?: string; studentAnswer?: string; isCorrect: boolean; pointsEarned: number }>>([]);
  const gameStartedAtRef = useRef<number | null>(null);
  const gameFinalizedRef = useRef(false);

  const ensureGameResult = useCallback(() => {
    if (gameResultPromiseRef.current) return gameResultPromiseRef.current;
    const promise = localDb.gameResults.create({
      sessionId: currentSessionId ?? undefined,
      gameType: "quiz-show",
      gameMode: "multi",
      ideaId: currentIdeaId ?? currentQ?.ideaId ?? undefined,
      questionCount: questions.length,
      startedAt: new Date(gameStartedAtRef.current ?? Date.now()).toISOString(),
      configJson: JSON.stringify({ source: cfg.questionSource, lessonId: currentQ?.lessonId, curriculumOnly: cfg.questionSource !== "ai-generated" }),
    }).then((row) => {
      gameResultIdRef.current = typeof row?.id === "string" ? row.id : null;
      return row;
    }).catch((error) => {
      console.warn("[QuizShowGame] failed to create game result", error);
      return null;
    });
    gameResultPromiseRef.current = promise;
    return promise;
  }, [cfg.questionSource, currentIdeaId, currentQ?.ideaId, currentQ?.lessonId, currentSessionId, questions.length]);

  const persistCompletedGame = useCallback(async () => {
    if (gameFinalizedRef.current) return;
    gameFinalizedRef.current = true;
    const row = gameResultIdRef.current ? { id: gameResultIdRef.current } : await gameResultPromiseRef.current;
    const gameResultId = typeof row?.id === "string" ? row.id : null;
    if (!gameResultId) return;
    const lessonIds = [...new Set([activeLessonId, ...recordedAnswersRef.current.map((answer) => answer.lessonId)].filter((id): id is string => Boolean(id)))];
    const persistedQuestions: Array<Record<string, unknown>> = [];
    for (const lessonId of lessonIds) {
      try { persistedQuestions.push(...await localDb.questions.listByLesson(lessonId)); } catch (error) { console.warn("[QuizShowGame] question id lookup failed", error); }
    }
    for (const answer of recordedAnswersRef.current) {
      const matched = answer.questionId ? null : persistedQuestions.find((row) => row.text === answer.questionText && (row.ideaId ?? null) === (answer.ideaId ?? null) && (Number(row.stepNumber) || null) === (answer.stepNumber ?? null));
      await localDb.gameResults.addQuestion({ gameResultId, ...answer, questionId: answer.questionId ?? (typeof matched?.id === "string" ? matched.id : undefined) });
    }
    const participantRows = new Map<string, { correct: number; wrong: number; points: number }>();
    for (const answer of recordedAnswersRef.current) {
      if (!answer.studentId) continue;
      const current = participantRows.get(answer.studentId) ?? { correct: 0, wrong: 0, points: 0 };
      current.correct += answer.isCorrect ? 1 : 0;
      current.wrong += answer.isCorrect ? 0 : 1;
      current.points += answer.pointsEarned;
      participantRows.set(answer.studentId, current);
    }
    // C29 fix (2026-AUG): compute the actual winner from points (highest score).
    // Ties are broken by correctCount, then by fewer wrong answers.
    let winnerId: string | null = null;
    if (participantRows.size > 0) {
      const sorted = [...participantRows.entries()].sort(([,a], [,b]) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.correct !== a.correct) return b.correct - a.correct;
        return a.wrong - b.wrong;
      });
      winnerId = sorted[0]?.[0] ?? null;
    }
    for (const [studentId, stats] of participantRows) {
      const student = students.find((candidate) => candidate.id === studentId);
      await localDb.gameResults.addParticipant({ gameResultId, studentId, studentName: student?.name ?? studentId, pointsEarned: stats.points, correctCount: stats.correct, wrongCount: stats.wrong, isWinner: studentId === winnerId });
    }
    await localDb.gameResults.complete({ id: gameResultId, endedAt: new Date().toISOString(), durationMs: Math.max(0, Date.now() - (gameStartedAtRef.current ?? Date.now())) });
  }, [activeLessonId, students]);

  // Pick a fair random student and add as participant (uses unified picker)
  const addRandomParticipant = () => {
    const picked = picker.pickRandom(participants
      .map((name) => students.find((s) => s.name === name)?.id)
      .filter((id): id is string => !!id)
    );
    if (picked && !participants.includes(picked.name)) {
      // Replace the first empty slot, or append
      const firstEmpty = participants.findIndex((p) => !p.trim());
      if (firstEmpty >= 0) {
        const next = [...participants];
        next[firstEmpty] = picked.name;
        setParticipants(next);
      } else if (participants.length < 4) {
        setParticipants([...participants, picked.name]);
      }
      // 🟢 v2 fix: removed recordStudentActivity(type:"star", points:0) — picker.pickRandom
      // already marks calledInSession; an extra star activity was creating badges
      // without justification.
      playSound("celebrate-spin");
    }
  };

  const addParticipant = () => setParticipants([...participants, ""]);
  const updateParticipant = (i: number, name: string) => {
    const next = [...participants];
    next[i] = name;
    setParticipants(next);
  };
  const removeParticipant = (i: number) => setParticipants(participants.filter((_, j) => j !== i));

  const startQuiz = () => {
    const normalized = participants.map((p) => p.trim()).filter(Boolean);
    const valid = [...new Set(normalized)];
    if (students.length > 0) {
      const presentNames = new Set(presentStudents.map((student) => student.name.trim().toLowerCase()));
      if (valid.some((name) => !presentNames.has(name.toLowerCase()))) return;
    }
    if (valid.length < 2 || questions.length === 0) return;
    const initial: Record<string, number> = {};
    valid.forEach((p) => (initial[p] = 0));
    setParticipants(valid);
    setScores(initial);
    gameStartedAtRef.current = Date.now();
    gameResultPromiseRef.current = null;
    gameResultIdRef.current = null;
    recordedAnswersRef.current = [];
    gameFinalizedRef.current = false;
    setPhase("question");
    playSound("celebrate-fanfare-short");
  };

  const revealAnswer = (idx: number) => {
    if (phase !== "question" || answerLockRef.current) return;
    answerLockRef.current = true;
    advanceLockRef.current = false;
    setSelectedIdx(idx);
    setPhase("reveal");
    const correct = idx === questions[currentIdx].correctIdx;
    if (correct) {
      playSound("celebrate-tada");
      triggerConfetti();
    } else {
      playSound("celebrate-buzz");
      triggerRedFlash();
    }
  };

  // 🟢 v2 fix: respect per-question rewardPoints (was hard-coded 5).
  const awardAndNext = (participantName: string, points: number) => {
    if (phase !== "reveal" || advanceLockRef.current) return;
    const nextScores = { ...scores, [participantName]: (scores[participantName] || 0) + points };
    setScores(nextScores);
    const answerQuestion = questions[currentIdx];
    if (answerQuestion) {
      const student = students.find((candidate) => candidate.name === participantName);
      void ensureGameResult();
      recordedAnswersRef.current.push({
        questionId: answerQuestion.id,
        lessonId: answerQuestion.lessonId,
        ideaId: answerQuestion.ideaId,
        stepNumber: answerQuestion.stepNumber,
        questionText: answerQuestion.text,
        studentId: student?.id,
        studentAnswer: selectedIdx == null ? undefined : answerQuestion.options[selectedIdx],
        isCorrect: selectedIdx === answerQuestion.correctIdx,
        pointsEarned: points,
      });
    }
    playSound("celebrate-coin-drop");
    const student = students.find((s) => s.name === participantName);
    if (student) {
      awardCorrect(student.id, points);
      // 🟢 v2 fix: removed recordStudentActivity("correct") — awardCorrect already
      // creates the badge + logs the activity. Was double-badge.
    }
    nextQuestion(nextScores);
  };

  const nextQuestion = (scoreSnapshot: Record<string, number> = scores) => {
    if (advanceLockRef.current) return;
    advanceLockRef.current = true;
    if (currentQ?._stableId) markAsked(currentQ._stableId);
    if (currentIdx + 1 >= questions.length) {
      setPhase("done");
      void persistCompletedGame();
      // 🟢 v2 fix: smart celebration — only fire confetti + champion banner if
      // at least one participant scored > 0. Was unconditional before.
      const players = Object.entries(scoreSnapshot).map(([name, score]) => {
        const st = students.find((s) => s.name === name);
        return { id: st?.id || name, name, score };
      });
      const result = computeSmartCelebration(players);
      if (result.shouldCelebrate) {
        playSound("celebrate-applause-big");
        if (result.celebrationType) setCelebrationType(result.celebrationType);
        triggerConfetti();
        finalConfettiTimeoutRef.current = setTimeout(() => {
          finalConfettiTimeoutRef.current = null;
          triggerConfetti();
        }, 800);
      } else {
        // All lost or tie at 0 — soft tone, no confetti
        playSound("celebrate-buzz");
      }
    } else {
      setCurrentIdx(currentIdx + 1);
      setSelectedIdx(null);
      setPhase("question");
      answerLockRef.current = false;
      advanceLockRef.current = false;
    }
  };

  const reset = () => {
    answerLockRef.current = false;
    advanceLockRef.current = false;
    setPhase("setup");
    setCurrentIdx(0);
    setSelectedIdx(null);
    setScores({});
    setParticipants([""]);
  };

  // ===== Help modal =====
  if (showHelp) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-blue-950 via-zinc-900 to-zinc-950 overflow-y-auto p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-bold text-white">طريقة اللعب</h2>
          </div>
          <div className="space-y-3 text-xs text-white/80 leading-relaxed">
            <div className="bg-white/5 rounded-lg p-3 border border-blue-500/30">
              <div className="font-bold text-blue-400 mb-1">1. المشاركون</div>
              أضف لاعبين (2 على الأقل). يتم تحميل الطلاب تلقائياً إذا كان لديك طلاب مسجلون.
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-blue-500/30">
              <div className="font-bold text-blue-400 mb-1">2. الأسئلة</div>
              تُسحب الأسئلة من الدرس النشط. اختر عددها ومصدرها من إعدادات ما قبل اللعبة.
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-blue-500/30">
              <div className="font-bold text-blue-400 mb-1">3. الإجابة</div>
              اضغط على خيار لكشف الإجابة الصحيحة، ثم اضغط على اسم من أجاب بشكل صحيح لمنحه نقطة.
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-blue-500/30">
              <div className="font-bold text-blue-400 mb-1">4. الفائز</div>
              بعد آخر سؤال، يُتوَّج اللاعب صاحب أعلى نقاط. <span className="text-[#FFD700] font-bold">احترام نقاط كل سؤال من المنهج.</span>
            </div>
          </div>
          <button
            onClick={() => setShowHelp(false)}
            className="mt-4 w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg text-sm font-bold transition"
          >
            فهمت! العب الآن
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-blue-950 via-zinc-900 to-zinc-950 overflow-y-auto">
      <div className="p-3 flex flex-col h-full">
        {/* Title bar */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/50">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">مسابقة الأسئلة</h2>
              <div className="text-[9px] text-blue-400/80">تنافس وجواب</div>
            </div>
          </div>
          <button
            onClick={() => setShowHelp(true)}
            className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 p-1.5 rounded-lg transition"
            title="طريقة اللعب"
          >
            <BookOpen className="w-4 h-4" />
          </button>
        </div>

        {phase === "setup" && (
          <div className="flex-1 space-y-2">
            {/* 🟢 v2 fix: unified pre-game question config (count + source) */}
            <div className="bg-white/5 rounded-md p-2 border border-white/10">
              <GameQuestionConfigView state={cfg} actions={cfg} compact />
            </div>
            <div className="text-[11px] text-white/70 flex items-center gap-1 mb-1">
              <Users className="w-3 h-3" />
              المشاركون (2 على الأقل)
              {students.length >= 2 && (
                <span className="text-blue-400">· تم تحميل الطلاب تلقائياً</span>
              )}
            </div>
            <div className="space-y-1 max-h-[40vh] overflow-y-auto pr-1">
              {participants.map((p, i) => (
                <div key={i} className="flex gap-1">
                  <input
                    value={p}
                    onChange={(e) => updateParticipant(i, e.target.value)}
                    placeholder={`المشارك ${i + 1}`}
                    className="flex-1 bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500/50"
                  />
                  {participants.length > 1 && (
                    <button
                      onClick={() => removeParticipant(i)}
                      className="text-red-400 hover:bg-red-500/20 px-2 rounded transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={addParticipant}
                className="text-[10px] text-blue-500 hover:text-blue-400 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> إضافة مشارك
              </button>
              {picker.present.length > 0 && (
                <button
                  onClick={addRandomParticipant}
                  className="text-[10px] text-purple-400 hover:text-purple-300 hover:underline flex items-center gap-1"
                >
                  <Shuffle className="w-3 h-3" /> اختر عشوائياً
                </button>
              )}
            </div>
            <div className="text-[10px] text-white/50 flex items-center gap-1">
              {questionsLoading
                ? "جاري تحميل الأسئلة..."
                : questions.length > 0
                  ? `${questions.length} سؤال متاح من المنهج`
                  : "⚠️ لا توجد أسئلة في المنهج — حمّل درساً بأسئلة أو غيّر مصدر الأسئلة"}
            </div>
            <button
              onClick={startQuiz}
              disabled={participants.filter((p) => p.trim()).length < 2 || questionsLoading || questions.length === 0}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold py-2 rounded-lg text-xs transition shadow-lg shadow-blue-500/30"
            >
              🧠 {questionsLoading ? "جاري التحميل..." : "ابدأ المسابقة"}
            </button>
          </div>
        )}

        {(phase === "question" || phase === "reveal") && (
          <div className="flex-1 flex flex-col">
            {/* Scores */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {Object.entries(scores).map(([name, score]) => (
                <span
                  key={name}
                  className="bg-white/5 text-white px-2 py-1 rounded-md text-[10px] flex items-center gap-1 border border-white/10"
                >
                  {name}: <span className="font-bold text-[#FFD700]">{score}</span>
                </span>
              ))}
            </div>

            {/* Question counter */}
            <div className="text-[10px] text-white/40 mb-2 text-center">
              سؤال {currentIdx + 1} من {questions.length}
            </div>

            {/* Question */}
            <div
              className="rounded-2xl p-4 mb-4 text-center border-2 border-blue-500/30"
              style={{ background: "linear-gradient(135deg, rgba(1,66,160,0.3), rgba(1,66,160,0.1))" }}
            >
              <div className="text-white text-base font-bold">
                <QuestionMedia text={currentQ.text} images={currentQ.images} />
              </div>
            </div>

            {/* Options */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              {currentQ.options.map((opt, i) => {
                const isCorrect = phase === "reveal" && i === currentQ.correctIdx;
                const isSelected = phase === "reveal" && i === selectedIdx && i !== currentQ.correctIdx;
                return (
                  <button
                    key={i}
                    onClick={() => phase === "question" && revealAnswer(i)}
                    disabled={phase === "reveal"}
                    className={`p-3 rounded-xl text-white font-bold text-sm transition border-2 ${
                      isCorrect
                        ? "bg-gradient-to-r from-emerald-500 to-green-500 border-emerald-400 shadow-lg shadow-emerald-500/30"
                        : isSelected
                        ? "bg-gradient-to-r from-red-500 to-rose-500 border-red-400 shadow-lg shadow-red-500/30"
                        : "bg-white/5 border-white/10 hover:bg-white/10"
                    }`}
                  >
                    {opt}
                    {isCorrect && <Check className="w-4 h-4 inline mr-2" />}
                  </button>
                );
              })}
            </div>

            {/* Award buttons */}
            {phase === "reveal" && (
              <div className="mt-auto space-y-2">
                <div className="text-white/70 text-[11px] text-center">من أجاب بشكل صحيح؟ اضغط على اسمه لمنحه نقطة</div>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {Object.entries(scores).map(([name]) => {
                    // 🟢 v2 fix: respect per-question rewardPoints (was hard-coded 5).
                    const pts = currentQ?.rewardPoints || 5;
                    return (
                    <button
                      key={name}
                      onClick={() => awardAndNext(name, pts)}
                      className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold transition shadow-lg shadow-emerald-500/30"
                    >
                      {name} (+{pts})
                    </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => nextQuestion()}
                  className="w-full border border-white/20 text-white/70 hover:bg-white/5 py-1.5 rounded-lg text-[11px] transition"
                >
                  التالي بدون نقطة
                </button>
              </div>
            )}
          </div>
        )}

        {phase === "done" && (
          <div className="text-center py-4 flex-1 flex flex-col justify-center items-center">
            {(() => {
              const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
              const winner = sorted[0];
              return (
                <>
                  <div className="text-7xl mb-3 animate-bounce">🏆</div>
                  <div className="text-base text-white/70 mb-2">انتهت المسابقة! الفائز</div>
                  <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-3 flex items-center gap-2">
                    <Award className="w-5 h-5 text-[#FFD700]" />
                    {winner[0]}
                  </div>
                  <div className="inline-block bg-emerald-500/20 text-emerald-400 px-4 py-1.5 rounded-full text-xs font-bold mb-4 border border-emerald-500/40">
                    فاز بـ {winner[1]} نقطة
                  </div>
                </>
              );
            })()}
            <button
              onClick={reset}
              className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-bold py-2 px-5 rounded-lg text-xs flex items-center gap-2 transition shadow-lg shadow-red-500/30"
            >
              <RotateCcw className="w-3 h-3" /> مسابقة جديدة
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
