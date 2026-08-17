"use client";

import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { useShellStore } from "@/lib/shell-store";
import { useGameQuestions, useGameStudentPicker, type GameQuestion } from "@/lib/useGameStudentPicker";
import { Zap, Check, XCircle, Crown, Shuffle, User, BookOpen, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { MathText } from "./MathText";
import { QuestionMedia } from "./QuestionMedia";
// 🟢 v2 fix: unified pre-game question config (count + source)
import { GameQuestionConfigView, useGameQuestionConfig } from "./GameQuestionConfig";
// 🟢 v2 fix: smart celebration + manual picker + present-students filter
import { computeSmartCelebration, pickStudentManual, filterPresentStudents } from "@/lib/game-utils";

import { useGameActivity } from "@/lib/game-activity-context";
import { localDb } from "@/lib/local-db";
/**
 * QuickFireGame v6.1 — Redesigned + QuestionProvider wired + store students + award at end.
 */
export function QuickFireGame({ onClose }: { onClose: () => void }) {
  const playSound = useShellStore((s) => s.playSound);
  const triggerConfetti = useShellStore((s) => s.triggerConfetti);
  const triggerRedFlash = useShellStore((s) => s.triggerRedFlash);
  const setCelebrationType = useShellStore((s) => s.setCelebrationType);
  const awardCorrect = useShellStore((s) => s.awardCorrect);
  const awardWrong = useShellStore((s) => s.awardWrong);
  const students = useShellStore((s) => s.students);
  const currentSessionId = useShellStore((s) => s.currentSessionId);
  const picker = useGameStudentPicker("quickfire");
  // 🟢 v2 fix: configurable question count + source (was hard-coded 15).
  const cfg = useGameQuestionConfig(10);
  const { questions: lessonQuestions, loading: questionsLoading, markAsked } = useGameQuestions(
    cfg.questionSource,
    cfg.limit || 10,
    { ideaId: cfg.manualIdeaIdForHook ?? undefined },
  );

  const [phase, setPhase] = useState<"setup" | "playing" | "done">("setup");
  const [participant, setParticipant] = useState<{ id: string; name: string } | null>(null);
  // P0-5 fix: state type must be GameQuestion[] (has correctIdx), not LessonQuestion[] (has correctAnswer).
  // TypeScript's structural compatibility hid the runtime mismatch.
  const [questions, setQuestions] = useState<GameQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [timeLeft, setTimeLeft] = useState(10);
  const [streak, setStreak] = useState(0);
  const [showHelp, setShowHelp] = useState(false);


  // Live-updating ref so setTimeout callbacks read the current score (H1 fix).
  // Moved into useEffect to satisfy react-hooks/refs (no ref mutation in render body).
  const scoreRef = useRef(0);
  const correctPointsRef = useRef<number[]>([]);
  useEffect(() => { scoreRef.current = score; }, [score]);
  // Track the per-question reveal timeout so handleTimeout can cancel it (double-advance fix).
  const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track whether the current question has already been answered/timed-out (prevents double-advance).
  const questionClosedRef = useRef(false);

  // C35 (P2 fix): track setTimeout IDs for unmount cleanup
  const timeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const safeTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timeoutsRef.current.delete(id);
      fn();
    }, ms);
    timeoutsRef.current.add(id);
    return id;
  }, []);

  // Mark this game as active/inactive for mid-game exit confirmation.
  const setGameActive = useGameActivity();

  // Mark the game as "active" while in mid-play so the wrapping GameOverlay
  // asks for confirmation before closing (prevents accidental loss of progress).
  const isGameActive = phase === "playing";
  useEffect(() => {
    setGameActive(isGameActive);
  }, [isGameActive, setGameActive]);

  // ===== QuestionProvider =====
  // P2 fix: only sync questions during setup phase. Without this guard, navigating
  // steps during a game overwrites the questions array mid-round, breaking currentIdx.
  useEffect(() => {
    if (phase !== "setup") return;
    const timer = window.setTimeout(() => setQuestions(lessonQuestions), 0);
    return () => window.clearTimeout(timer);
  }, [lessonQuestions, phase]);

  // مصدر موحّد للطلاب: متجر Zustand بعد فلترته على الصف النشط.
  // الطلاب الغائبون لا يدخلون شبكة الاختيار اليدوي أو العادل.
  const classStudents = useMemo(
    () => filterPresentStudents(students).map((s) => ({ id: s.id, name: s.name })),
    [students],
  );

  const currentQ = questions[currentIdx];

  const gameResultPromiseRef = useRef<Promise<Record<string, unknown> | null> | null>(null);
  const gameResultIdRef = useRef<string | null>(null);
  const recordedAnswersRef = useRef<Array<{ questionId?: string; lessonId?: string; ideaId?: string; stepNumber?: number; questionText: string; studentId: string; studentAnswer?: string; isCorrect: boolean; pointsEarned: number }>>([]);
  const gameStartedAtRef = useRef<number | null>(null);
  const gameFinalizedRef = useRef(false);
  const correctCountRef = useRef(0);
  const wrongCountRef = useRef(0);
  useEffect(() => { correctCountRef.current = correct; }, [correct]);
  useEffect(() => { wrongCountRef.current = wrong; }, [wrong]);

  const ensureGameResult = useCallback(() => {
    if (gameResultPromiseRef.current) return gameResultPromiseRef.current;
    const promise = localDb.gameResults.create({
      sessionId: currentSessionId ?? undefined,
      gameType: "quick-fire",
      gameMode: "individual",
      ideaId: currentQ?.ideaId ?? undefined,
      questionCount: questions.length,
      startedAt: new Date(gameStartedAtRef.current ?? Date.now()).toISOString(),
      configJson: JSON.stringify({ source: cfg.questionSource, lessonId: currentQ?.lessonId, curriculumOnly: cfg.questionSource !== "ai-generated" }),
    }).then((row) => {
      gameResultIdRef.current = typeof row?.id === "string" ? row.id : null;
      return row;
    }).catch((error) => {
      console.warn("[QuickFireGame] failed to create game result", error);
      return null;
    });
    gameResultPromiseRef.current = promise;
    return promise;
  }, [cfg.questionSource, currentQ?.ideaId, currentQ?.lessonId, currentSessionId, questions.length]);

  const recordAnswer = (question: GameQuestion, isCorrect: boolean, studentAnswer?: string) => {
    if (!participant) return;
    void ensureGameResult();
    recordedAnswersRef.current.push({
      questionId: question.id,
      lessonId: question.lessonId,
      ideaId: question.ideaId,
      stepNumber: question.stepNumber,
      questionText: question.text,
      studentId: participant.id,
      studentAnswer,
      isCorrect,
      pointsEarned: isCorrect ? (question.rewardPoints || 5) : 0,
    });
  };

  const persistCompletedGame = useCallback(async () => {
    if (gameFinalizedRef.current) return;
    gameFinalizedRef.current = true;
    const row = gameResultIdRef.current ? { id: gameResultIdRef.current } : await gameResultPromiseRef.current;
    const gameResultId = typeof row?.id === "string" ? row.id : null;
    if (!gameResultId || !participant) return;
    const lessonIds = [...new Set(recordedAnswersRef.current.map((answer) => answer.lessonId).filter((id): id is string => Boolean(id)))];
    const persistedQuestions: Array<Record<string, unknown>> = [];
    for (const lessonId of lessonIds) {
      try { persistedQuestions.push(...await localDb.questions.listByLesson(lessonId)); } catch (error) { console.warn("[QuickFireGame] question id lookup failed", error); }
    }
    for (const answer of recordedAnswersRef.current) {
      const matched = answer.questionId ? null : persistedQuestions.find((row) => row.text === answer.questionText && (row.ideaId ?? null) === (answer.ideaId ?? null) && (Number(row.stepNumber) || null) === (answer.stepNumber ?? null));
      await localDb.gameResults.addQuestion({ gameResultId, ...answer, questionId: answer.questionId ?? (typeof matched?.id === "string" ? matched.id : undefined) });
    }
    await localDb.gameResults.addParticipant({ gameResultId, studentId: participant.id, studentName: participant.name, pointsEarned: scoreRef.current, correctCount: correctCountRef.current, wrongCount: wrongCountRef.current, isWinner: true });
    await localDb.gameResults.complete({ id: gameResultId, endedAt: new Date().toISOString(), durationMs: Math.max(0, Date.now() - (gameStartedAtRef.current ?? Date.now())) });
  }, [participant]);

  function nextQuestion() {
    if (currentIdx + 1 >= questions.length) {
      setPhase("done");
      void persistCompletedGame();
      const finalScore = scoreRef.current;
      const result = computeSmartCelebration([
        { id: participant?.id || "", name: participant?.name || "", score: finalScore },
      ]);
      if (result.shouldCelebrate) {
        playSound("celebrate-applause-big");
        if (result.celebrationType) setCelebrationType(result.celebrationType);
        triggerConfetti();
      } else {
        playSound("celebrate-buzz");
      }
      if (participant?.id && students.find((s) => s.id === participant.id)) {
        // Apply each correct answer once so the student's correctAnswers stat
        // matches the round, while preserving the exact streak-adjusted points.
        correctPointsRef.current.forEach((points) => awardCorrect(participant.id, points));
      }
    } else {
      setCurrentIdx((i) => i + 1);
      setSelectedAnswer(null);
      setTimeLeft(10);
      questionClosedRef.current = false;
    }
  }

  function handleTimeout() {
    if (questionClosedRef.current || !currentQ) return;
    questionClosedRef.current = true;
    recordAnswer(currentQ, false);
    setWrong((w) => w + 1);
    setStreak(0);
    playSound("celebrate-buzz");
    triggerRedFlash();
    if (participant?.id && students.some((student) => student.id === participant.id)) {
      awardWrong(participant.id);
    }
    if (currentQ._stableId) markAsked(currentQ._stableId);
    nextQuestion();
  }

  // Timer
  useEffect(() => {
    if (phase !== "playing") return;
    if (timeLeft <= 0) {
      // Only fire timeout if the question hasn't been answered/closed yet.
      // This prevents the double-advance bug: when the user answers late (timeLeft=1),
      // the reveal setTimeout(1500ms) is pending; without this guard, the timer would
      // also fire nextQuestion() → one question skipped + potential double-award.
      if (!questionClosedRef.current) {
        handleTimeout();
      }
      return;
    }
    const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, timeLeft]);

  // Cleanup reveal timeout on unmount.
  useEffect(() => {
    return () => {
      if (revealTimeoutRef.current !== null) {
        clearTimeout(revealTimeoutRef.current);
        revealTimeoutRef.current = null;
      }
    };
  }, []);

  // C35 (P2 fix): clear all tracked timeouts on unmount.
  useEffect(() => () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current.clear();
  }, []);

  const startGame = () => {
    if (!participant || questions.length === 0) return;
    const shuffled = [...questions].sort(() => Math.random() - 0.5);
    setQuestions(shuffled);
    setScore(0);
    setCorrect(0);
    setWrong(0);
    correctPointsRef.current = [];
    correctCountRef.current = 0;
    wrongCountRef.current = 0;
    gameStartedAtRef.current = Date.now();
    gameResultPromiseRef.current = null;
    gameResultIdRef.current = null;
    recordedAnswersRef.current = [];
    gameFinalizedRef.current = false;
    setStreak(0);
    setCurrentIdx(0);
    setSelectedAnswer(null);
    setTimeLeft(10);
    questionClosedRef.current = false;
    setPhase("playing");
    playSound("celebrate-fanfare-big");
  };

  const pickRandom = () => {
    if (picker.present.length === 0) return;
    const picked = picker.pickRandom(participant ? [participant.id] : []);
    if (picked) {
      setParticipant({ id: picked.id, name: picked.name });
      // 🟢 v2 fix: removed recordStudentActivity(type:"star", points:0) — picker.pickRandom
      // already marks calledInSession; an extra star activity was creating badges
      // without justification.
      playSound("celebrate-spin");
    }
  };

  const answer = (idx: number) => {
    if (selectedAnswer !== null || questionClosedRef.current || !currentQ) return;
    // Mark question as closed so the timer's handleTimeout won't double-advance.
    questionClosedRef.current = true;
    setSelectedAnswer(idx);
    // P0-5 fix: useGameQuestions returns GameQuestion (which has correctIdx),
    // NOT LessonQuestion (which has correctAnswer). The old code read
    // currentQ.correctAnswer which is undefined on GameQuestion → indexOf("undefined")
    // → -1 → isCorrect was ALWAYS false → game never awarded any points.
    const isCorrect = idx === currentQ.correctIdx;
    recordAnswer(currentQ, isCorrect, currentQ.options[idx]);
    if (isCorrect) {
      // Compute new streak FIRST so the bonus checks use the post-increment value.
      const newStreak = streak + 1;
      const points = (currentQ.rewardPoints || 5) + (newStreak - 1) * 2;
      setScore((s) => s + points);
      setCorrect((c) => c + 1);
      correctPointsRef.current.push(points);
      setStreak(newStreak);
      playSound("celebrate-correct-fast");
      setCelebrationType(newStreak >= 3 ? "stars" : "confetti");
      triggerConfetti();
      if (newStreak >= 4) {
        setCelebrationType("mega");
        triggerConfetti();
        playSound("celebrate-fanfare-big");
      }
    } else {
      setWrong((w) => w + 1);
      setStreak(0);
      playSound("celebrate-buzz");
      triggerRedFlash();
      if (participant?.id && students.find((s) => s.id === participant.id)) {
        awardWrong(participant.id);
        // 🟢 v2 fix: removed recordStudentActivity("wrong") — awardWrong already
        // creates the badge + logs the activity. Was double-badge.
      }
    }
    // 🟢 v2 fix: mark this question as asked so the next game won't repeat it.
    if (currentQ?._stableId) markAsked(currentQ._stableId);
    // Schedule next-question reveal. Track the timeout so handleTimeout/unmount can cancel it.
    if (revealTimeoutRef.current !== null) clearTimeout(revealTimeoutRef.current);
    revealTimeoutRef.current = safeTimeout(() => {
      revealTimeoutRef.current = null;
      nextQuestion();
    }, 1500);
  };

  // ===== Help modal =====
  if (showHelp) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-amber-950 via-zinc-900 to-zinc-950 overflow-y-auto p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white">طريقة اللعب</h2>
          </div>
          <div className="space-y-3 text-xs text-white/80 leading-relaxed">
            <div className="bg-white/5 rounded-lg p-3 border border-amber-500/30">
              <div className="font-bold text-amber-400 mb-1">1. الطالب</div>
              اختر طالباً (يُحمَّل تلقائياً). يمكن اختياره عشوائياً.
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-amber-500/30">
              <div className="font-bold text-amber-400 mb-1">2. الأسئلة السريعة</div>
              تُسحب أسئلة من المنهج. كل سؤال له <span className="text-amber-300 font-bold">10 ثوانٍ</span> فقط!
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-amber-500/30">
              <div className="font-bold text-amber-400 mb-1">3. المتواليات</div>
              كل إجابة صحيحة متتالية تضاعف النقاط. 4 متواليات = احتفال ضخم.
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-amber-500/30">
              <div className="font-bold text-amber-400 mb-1">4. المكافأة</div>
              عند النهاية، تُحوَّل نقاطك إلى نقاط طالب (حتى 30) + احتفال بطل.
            </div>
          </div>
          <button
            onClick={() => setShowHelp(false)}
            className="mt-4 w-full bg-amber-500 hover:bg-amber-600 text-white py-2 rounded-lg text-sm font-bold transition"
          >
            فهمت! العب الآن
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-amber-950 via-zinc-900 to-zinc-950 overflow-y-auto">
      <div className="p-3 flex flex-col h-full">
        {/* Title bar */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/50">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">أسئلة سريعة</h2>
              <div className="text-[9px] text-amber-400/80">10 ثوانٍ لكل سؤال!</div>
            </div>
          </div>
          <button
            onClick={() => setShowHelp(true)}
            className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 p-1.5 rounded-lg transition"
            title="طريقة اللعب"
          >
            <BookOpen className="w-4 h-4" />
          </button>
        </div>

        {phase === "setup" && (
          <div className="flex-1 space-y-3">
            {/* 🟢 v2 fix: unified pre-game question config (count + source) */}
            <div className="bg-white/5 rounded-md p-2.5 border border-white/10">
              <GameQuestionConfigView state={cfg} actions={cfg} compact />
            </div>
            <div className="text-center text-[11px] text-white/60 bg-white/5 rounded-md py-1.5 border border-white/10">
              {questionsLoading
                ? "جاري تحميل الأسئلة..."
                : questions.length > 0
                ? `${questions.length} سؤال متاح • 10 ثواني لكل سؤال`
                : "لا توجد أسئلة في المنهج"}
            </div>
            {participant ? (
              <div className="bg-amber-500/20 rounded-lg p-3 text-center border-2 border-amber-500/50">
                <User className="w-6 h-6 text-amber-400 mx-auto mb-1" />
                <div className="font-bold text-white">{participant.name}</div>
              </div>
            ) : (
              <div className="text-center text-white/40 text-xs py-2">اختر طالباً</div>
            )}
            {classStudents.length > 0 && (
              <button
                onClick={pickRandom}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition shadow-lg shadow-purple-500/30"
              >
                <Shuffle className="w-3.5 h-3.5" /> اختر عشوائياً (عادل)
              </button>
            )}
            {classStudents.length > 0 && (
              <div className="grid grid-cols-3 gap-1 max-h-28 overflow-y-auto">
                {classStudents.map((s) => (
                  <button
                    key={s.id}
                    // 🟢 v2 fix: use pickStudentManual so calledInSession is updated
                    // (was setParticipant(s) direct, which skipped the fairness rotation).
                    onClick={() => {
                      const st = pickStudentManual(s.id);
                      if (st) setParticipant({ id: st.id, name: st.name });
                    }}
                    className={cn(
                      "px-2 py-1 rounded text-[10px] transition border",
                      participant?.id === s.id
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                        : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10"
                    )}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={startGame}
              disabled={!participant || questions.length === 0}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-30 text-black font-bold py-2 rounded-lg text-xs transition shadow-lg shadow-amber-500/30"
            >
              ابدأ الأسئلة السريعة!
            </button>
          </div>
        )}

        {phase === "playing" && currentQ && (
          <div className="flex-1 flex flex-col">
            {/* HUD */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-white/5 rounded-lg px-3 py-1.5 border border-white/10 text-center">
                <div className="text-[10px] text-white/40">النقاط</div>
                <div className="text-base font-bold text-[#FFD700]">{score}</div>
              </div>
              <div className="bg-white/5 rounded-lg px-3 py-1.5 border border-white/10 text-center">
                <div className="text-[10px] text-white/40">المتواليات</div>
                <div className="text-base font-bold text-emerald-400">{streak}🔥</div>
              </div>
              <div className={cn(
                "bg-white/5 rounded-lg px-3 py-1.5 border text-center",
                timeLeft <= 3 ? "bg-red-500/20 border-red-500/40 animate-pulse" : "border-white/10"
              )}>
                <div className="text-[10px] text-white/40">الوقت</div>
                <div className={cn("text-base font-bold", timeLeft <= 3 ? "text-red-400" : "text-white")}>{timeLeft}s</div>
              </div>
            </div>

            {/* Timer bar */}
            <div className="w-full bg-white/5 rounded-full h-2 mb-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 h-2 rounded-full transition-all"
                style={{ width: `${(timeLeft / 10) * 100}%` }}
              />
            </div>

            {/* Question */}
            <div className="rounded-2xl p-4 mb-4 text-center border-2 border-amber-500/30" style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.05))" }}>
              {currentQ.ideaTitle && <div className="text-[10px] text-emerald-400 mb-1">{currentQ.ideaTitle}</div>}
              <div className="text-sm text-white font-bold"><QuestionMedia text={currentQ.text} images={currentQ.images} /></div>
            </div>

            {/* Options */}
            {currentQ.options && (
              <div className="grid grid-cols-1 gap-2">
                {currentQ.options.map((opt, i) => {
                  // P0-5 fix: highlight the correct option via correctIdx (not correctAnswer)
                  const isCorrect = selectedAnswer !== null && i === currentQ.correctIdx;
                  const isSelected = selectedAnswer === i;
                  const isWrong = selectedAnswer !== null && isSelected && !isCorrect;
                  return (
                    <button
                      key={i}
                      onClick={() => selectedAnswer === null && answer(i)}
                      disabled={selectedAnswer !== null}
                      className={cn(
                        "p-3 rounded-xl text-white font-bold text-xs transition border-2",
                        isCorrect
                          ? "bg-gradient-to-r from-emerald-500 to-green-500 border-emerald-400 shadow-lg shadow-emerald-500/30"
                          : isWrong
                          ? "bg-gradient-to-r from-red-500 to-rose-500 border-red-400 shadow-lg shadow-red-500/30"
                          : "bg-white/5 border-white/10 hover:bg-white/10"
                      )}
                    >
                      {opt} {isCorrect && <Check className="w-4 h-4 inline mr-2" />} {isWrong && <XCircle className="w-4 h-4 inline mr-2" />}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="text-center text-[10px] text-white/40 mt-3">سؤال {currentIdx + 1} من {questions.length}</div>
          </div>
        )}

        {phase === "done" && (
          <div className="text-center py-4 flex-1 flex flex-col justify-center items-center">
            <div className="text-7xl mb-3 animate-bounce">🏆</div>
            <div className="text-base text-white/70 mb-1 flex items-center gap-2">
              <Award className="w-5 h-5 text-[#FFD700]" />
              {participant?.name}
            </div>
            <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-3">
              {score} نقطة
            </div>
            <div className="inline-block bg-emerald-500/20 text-emerald-400 px-4 py-1.5 rounded-full text-xs font-bold mb-4 border border-emerald-500/40">
              مُضافة لطالبك
            </div>
            <div className="flex gap-6 justify-center text-[11px] text-white/60 mb-4">
              <div><span className="text-emerald-400 font-bold">{correct}</span> صحيح</div>
              <div><span className="text-red-400 font-bold">{wrong}</span> خطأ</div>
            </div>
            <button
              onClick={() => setPhase("setup")}
              className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-bold py-2 px-5 rounded-lg text-xs flex items-center gap-2 transition shadow-lg shadow-amber-500/30"
            >
              جولة جديدة
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
