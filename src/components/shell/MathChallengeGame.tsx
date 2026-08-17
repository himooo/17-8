"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useShellStore } from "@/lib/shell-store";
import { useGameStudentPicker, useGameQuestions } from "@/lib/useGameStudentPicker";
import { Brain, Check, XCircle, RotateCcw, Trophy, BookOpen, Award, Zap, Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";
// 🟢 v2 fix: unified pre-game question config (count + source) + smart celebration + bonus awarder + manual picker + present-students filter
import { GameQuestionConfigView, useGameQuestionConfig } from "./GameQuestionConfig";
import { computeSmartCelebration, awardGameBonus, pickStudentManual, filterPresentStudents } from "@/lib/game-utils";

import { useGameActivity } from "@/lib/game-activity-context";
import { useGameResultRecorder } from "@/lib/game-result-recorder";
/**
 * MathChallengeGame v7.0 — Redesigned + student auto-load + award at end.
 * v7.0: added a "من المنهج" (from curriculum) mode alongside the classic
 * generated-arithmetic difficulties — pulls numeric-answer questions from
 * the loaded lesson (current idea or the whole lesson, teacher's choice),
 * so this can also be a curriculum quiz sprint, not just arithmetic drilling.
 *
 * How to play:
 * 1. Pick a student (auto-loaded from store)
 * 2. Choose difficulty (easy/medium/hard) or "from curriculum", and duration (30-120s)
 * 3. Solve as many problems as possible before time runs out
 * 4. Streaks give bonus points; score is awarded to the student at end
 */
export function MathChallengeGame({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<"setup" | "playing" | "done">("setup");
  const [question, setQuestion] = useState<{ text: string; answer: number; _stableId?: string; id?: string; lessonId?: string; ideaId?: string; stepNumber?: number }>({ text: "", answer: 0 });
  const [userAnswer, setUserAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [duration, setDuration] = useState(60);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "curriculum">("easy");
  const [studentId, setStudentId] = useState<string>("");
  const [studentName, setStudentName] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [curriculumIdx, setCurriculumIdx] = useState(0);


  const students = useShellStore((s) => s.students);
  const currentSessionId = useShellStore((s) => s.currentSessionId);
  const playSound = useShellStore((s) => s.playSound);
  const triggerConfetti = useShellStore((s) => s.triggerConfetti);
  const triggerRedFlash = useShellStore((s) => s.triggerRedFlash);
  const triggerGreenFlash = useShellStore((s) => s.triggerGreenFlash);
  const setCelebrationType = useShellStore((s) => s.setCelebrationType);
  const awardCorrect = useShellStore((s) => s.awardCorrect);
  const awardWrong = useShellStore((s) => s.awardWrong);
  const recordStudentActivity = useShellStore((s) => s.recordStudentActivity);
  const picker = useGameStudentPicker("mathchallenge");
  // 🟢 v2 fix: configurable question count + source (was hard-coded 30, only used in curriculum mode).
  const cfg = useGameQuestionConfig(15);
  const { questions: lessonQuestions, loading: questionsLoading, markAsked } = useGameQuestions(
    cfg.questionSource,
    cfg.limit || 15,
    { ideaId: cfg.manualIdeaIdForHook ?? undefined },
  );
  // Only questions with a genuinely numeric answer work in this game's
  // "type a number" input — filter out multiple-choice/text ones.
  // 🟢 v2 fix: preserve _stableId so we can mark questions as asked via markAsked.
  const numericCurriculumQuestions = lessonQuestions
    .map((q) => ({ text: q.text, answer: Number(q.options?.[q.correctIdx]), _stableId: q._stableId, id: q.id, lessonId: q.lessonId, ideaId: q.ideaId, stepNumber: q.stepNumber }))
    .filter((q) => !isNaN(q.answer));

  // ===== Auto-load student from store (use first available, not-yet-called student) =====
  // 🟢 v2 fix: filter out absent students before picking the initial student.
  useEffect(() => {
    if (students.length < 1 || studentName.trim()) return;
    const present = filterPresentStudents(students);
    if (present.length === 0) return;
    const uncalled = present.find((s) => !s.calledInSession);
    const first = uncalled || present[0];
    const timer = window.setTimeout(() => {
      setStudentName(first.name);
      setStudentId(first.id);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [studentName, students]);

  const [activeCurriculumQuestions, setActiveCurriculumQuestions] = useState<{ text: string; answer: number; _stableId?: string; id?: string; lessonId?: string; ideaId?: string; stepNumber?: number }[]>([]);

  // ===== GameResult persistence (shared recorder — same contract as QuickFire) =====
  const recorder = useGameResultRecorder();
  const correctCountRef = useRef(0);
  const wrongCountRef = useRef(0);

  const generateQuestion = () => {
    if (difficulty === "curriculum") {
      if (activeCurriculumQuestions.length === 0) return;
      const idx = curriculumIdx % activeCurriculumQuestions.length;
      setCurriculumIdx((i) => i + 1);
      setQuestion(activeCurriculumQuestions[idx]);
      return;
    }
    const ops = difficulty === "easy" ? ["+", "-"] : difficulty === "medium" ? ["+", "-", "×"] : ["+", "-", "×", "÷"];
    const op = ops[Math.floor(Math.random() * ops.length)];
    const max = difficulty === "easy" ? 20 : difficulty === "medium" ? 50 : 100;
    let a = Math.floor(Math.random() * max) + 1;
    let b = Math.floor(Math.random() * max) + 1;
    let answer = 0;
    let text = "";
    if (op === "+") { answer = a + b; text = `${a} + ${b}`; }
    else if (op === "-") { if (b > a) [a, b] = [b, a]; answer = a - b; text = `${a} - ${b}`; }
    else if (op === "×") { a = Math.floor(Math.random() * 12) + 1; b = Math.floor(Math.random() * 12) + 1; answer = a * b; text = `${a} × ${b}`; }
    else if (op === "÷") { b = Math.floor(Math.random() * 11) + 1; answer = Math.floor(Math.random() * 11) + 1; a = b * answer; text = `${a} ÷ ${b}`; }
    setQuestion({ text, answer });
  };

  // Keep the latest score/studentId in refs so the timer callback (created once
  // when phase flips to "playing") never reads stale values. The effect below
  // has [phase] deps only, so without refs it would capture score=0 forever.
  // Refs are updated in effects (not in render body) to satisfy react-hooks/refs.
  const scoreRef = useRef(0);
  useEffect(() => { scoreRef.current = score; }, [score]);
  const studentIdRef = useRef(studentId);
  const finishedRef = useRef(false);
  const answerRevealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mark this game as active/inactive for mid-game exit confirmation.
  const setGameActive = useGameActivity();

  // Mark the game as "active" while in mid-play so the wrapping GameOverlay
  // asks for confirmation before closing (prevents accidental loss of progress).
  const isGameActive = phase === "playing";
  useEffect(() => {
    setGameActive(isGameActive);
  }, [isGameActive, setGameActive]);
  useEffect(() => { studentIdRef.current = studentId; }, [studentId]);

  const finishGame = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setPhase("done");
    const finalScore = scoreRef.current;
    const sid = studentIdRef.current;
    const result = computeSmartCelebration([
      { id: sid, name: studentName, score: finalScore },
    ]);
    if (result.shouldCelebrate) {
      playSound("celebrate-tada");
      if (result.celebrationType) setCelebrationType(result.celebrationType);
      triggerConfetti();
    } else {
      playSound("celebrate-buzz");
    }
    if (sid && finalScore > 0 && students.find((s) => s.id === sid)) {
      awardGameBonus(sid, Math.min(finalScore, 20), "إكمال تحدي رياضيات");
    }
    // Persist the GameResult so reports/analytics include Math Challenge rounds.
    if (sid) {
      void recorder.finish([{
        studentId: sid,
        studentName,
        pointsEarned: finalScore > 0 ? Math.min(finalScore, 20) : 0,
        correctCount: correctCountRef.current,
        wrongCount: wrongCountRef.current,
        isWinner: true, // single-player sprint — the participant is the round's finisher
      }]);
    }
  }, [playSound, setCelebrationType, triggerConfetti, studentName, students, recorder]);

  useEffect(() => {
    if (phase !== "playing") return;
    if (timeLeft <= 0) {
      finishGame();
      return;
    }
    const interval = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(interval);
  }, [finishGame, phase, timeLeft]);

  useEffect(() => () => {
    if (answerRevealTimeoutRef.current !== null) {
      clearTimeout(answerRevealTimeoutRef.current);
      answerRevealTimeoutRef.current = null;
    }
  }, []);

  const startGame = () => {
    if (!studentId || !studentName.trim()) return;
    finishedRef.current = false;
    correctCountRef.current = 0;
    wrongCountRef.current = 0;
    recorder.reset();
    recorder.begin();
    if (difficulty === "curriculum") {
      if (numericCurriculumQuestions.length === 0) return;
      const shuffled = [...numericCurriculumQuestions].sort(() => Math.random() - 0.5);
      setActiveCurriculumQuestions(shuffled);
      setCurriculumIdx(1);
      setQuestion(shuffled[0]);
    } else {
      generateQuestion();
    }
    setPhase("playing");
    setScore(0);
    setStreak(0);
    setTimeLeft(duration);
    playSound("celebrate-referee");
  };

  const submitAnswer = () => {
    if (!userAnswer.trim() || feedback !== null || phase !== "playing") return;
    const ans = Number(userAnswer);
    void recorder.ensure({
      sessionId: currentSessionId,
      gameType: "math-challenge",
      gameMode: "individual",
      ideaId: question.ideaId ?? null,
      questionCount: difficulty === "curriculum" ? activeCurriculumQuestions.length : 0,
      configJson: { difficulty, duration, mode: difficulty },
    });
    if (ans === question.answer) {
      // Compute new streak FIRST so the bonus checks use the post-increment value.
      const newStreak = streak + 1;
      const gained = 10 + (newStreak - 1) * 2;
      correctCountRef.current += 1;
      recorder.answer({
        questionId: question.id,
        lessonId: question.lessonId,
        ideaId: question.ideaId,
        stepNumber: question.stepNumber,
        questionText: question.text,
        studentId,
        studentAnswer: userAnswer.trim(),
        isCorrect: true,
        pointsEarned: gained,
      });
      setScore((s) => s + gained);
      setStreak(newStreak);
      setFeedback("correct");
      playSound("celebrate-coin-drop");
      triggerGreenFlash();
      if (studentId && students.find((s) => s.id === studentId)) {
        // 🟢 v2 fix: this is a soft activity log (no points awarded mid-game —
        // points are deferred to game end via awardGameBonus). kept as-is for
        // activity feed visibility.
        recordStudentActivity(studentId, { type: "correct", description: `إجابة صحيحة في تحدي الرياضيات (+${gained})`, points: 0 });  // P1-7: no double-award
      }
      if (newStreak > 0 && newStreak % 5 === 0) {
        setCelebrationType("stars");
        triggerConfetti();
        playSound("celebrate-fanfare-big");
      }
    } else {
      wrongCountRef.current += 1;
      recorder.answer({
        questionId: question.id,
        lessonId: question.lessonId,
        ideaId: question.ideaId,
        stepNumber: question.stepNumber,
        questionText: question.text,
        studentId,
        studentAnswer: userAnswer.trim(),
        isCorrect: false,
        pointsEarned: 0,
      });
      setStreak(0);
      setFeedback("wrong");
      playSound("celebrate-buzz");
      triggerRedFlash();
      if (studentId && students.find((s) => s.id === studentId)) {
        awardWrong(studentId);
        // 🟢 v2 fix: removed recordStudentActivity("wrong") — awardWrong already
        // creates the badge + logs the activity. Was double-badge.
      }
    }
    // 🟢 v2 fix: mark this question as asked in curriculum mode so the next game
    // won't repeat it (only applies to curriculum-mode questions which have _stableId).
    if (question._stableId) markAsked(question._stableId);
    setUserAnswer("");
    if (answerRevealTimeoutRef.current !== null) clearTimeout(answerRevealTimeoutRef.current);
    answerRevealTimeoutRef.current = setTimeout(() => {
      answerRevealTimeoutRef.current = null;
      if (!finishedRef.current) {
        setFeedback(null);
        generateQuestion();
      }
    }, 600);
  };

  const reset = () => {
    setPhase("setup");
    setScore(0);
    setStreak(0);
    setUserAnswer("");
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
              <div className="font-bold text-amber-400 mb-1">1. الطالب والمستوى</div>
              اختر الطالب (يُحمَّل تلقائياً من المتجر)، والمستوى (سهل/متوسط/صعب)، والمدة (30-120 ثانية).
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-amber-500/30">
              <div className="font-bold text-amber-400 mb-1">2. الجواب السريع</div>
              تظهر مسألة رياضية — اكتب الجواب واضغط &quot;تأكيد&quot; أو Enter. كل إجابة صحيحة = 10 نقاط + مكافأة متواليات.
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-amber-500/30">
              <div className="font-bold text-amber-400 mb-1">3. المتواليات</div>
              كل 5 إجابات صحيحة متتالية تطلق احتفال نجوم + مكافأة نقطية مضاعفة.
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-amber-500/30">
              <div className="font-bold text-amber-400 mb-1">4. المكافأة</div>
              عند انتهاء الوقت، تُحوَّل نقاطك إلى نقاط طالب (حتى 20) + احتفال بطل.
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
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">تحدي الرياضيات</h2>
              <div className="text-[9px] text-amber-400/80">أسرع جواب!</div>
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
            <div>
              <label className="text-[11px] text-white/60 mb-1 block">الطالب</label>
              <input
                value={studentName}
                onChange={(e) => {
                  setStudentName(e.target.value);
                  setStudentId("");
                }}
                placeholder="اسم الطالب"
                className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50"
              />
              {students.length > 0 && (
                <>
                  <button
                    onClick={() => {
                      const picked = picker.pickRandom(studentId ? [studentId] : []);
                      if (picked) {
                        setStudentName(picked.name);
                        setStudentId(picked.id);
                        // 🟢 v2 fix: removed recordStudentActivity(type:"star", points:0) — picker.pickRandom
                        // already marks calledInSession; an extra star activity was creating badges
                        // without justification.
                        playSound("celebrate-spin");
                      }
                    }}
                    className="mt-2 w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition shadow-lg shadow-purple-500/30"
                  >
                    <Shuffle className="w-3.5 h-3.5" /> اختر عشوائياً (عادل)
                  </button>
                  <div className="grid grid-cols-3 gap-1 mt-2 max-h-24 overflow-y-auto">
                    {/* 🟢 v2 fix: filter out absent students from the manual grid. */}
                    {filterPresentStudents(students).map((s) => (
                      <button
                        key={s.id}
                        // 🟢 v2 fix: use pickStudentManual so calledInSession is updated
                        // (was setStudentId/setStudentName direct, which skipped the fairness rotation).
                        onClick={() => {
                          const st = pickStudentManual(s.id);
                          if (st) {
                            setStudentName(st.name);
                            setStudentId(st.id);
                          }
                        }}
                        className={cn(
                          "px-2 py-1 rounded text-[10px] transition border",
                          studentId === s.id
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                            : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10"
                        )}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div>
              <label className="text-[11px] text-white/60 mb-1 block">المستوى</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(["easy", "medium", "hard", "curriculum"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className={cn(
                      "px-2 py-2 rounded-md text-[11px] font-bold transition",
                      difficulty === d
                        ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30"
                        : "bg-white/5 text-white/60"
                    )}
                  >
                    {d === "easy" ? "سهل" : d === "medium" ? "متوسط" : d === "hard" ? "صعب" : "من المنهج"}
                  </button>
                ))}
              </div>
              {difficulty === "curriculum" && (
                <div className="mt-2">
                  {/* 🟢 v2 fix: unified pre-game question config (count + source). */}
                  <div className="bg-white/5 rounded-md p-2 border border-white/10">
                    <GameQuestionConfigView state={cfg} actions={cfg} compact />
                  </div>
                  <div className="text-[10px] text-white/40 mt-1">
                    {questionsLoading
                      ? "جاري تحميل الأسئلة..."
                      : numericCurriculumQuestions.length > 0
                        ? `${numericCurriculumQuestions.length} سؤال رقمي متاح`
                        : "⚠️ لا توجد أسئلة رقمية في المنهج المختار"}
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="text-[11px] text-white/60 mb-1 block">المدة (ثانية)</label>
              <div className="grid grid-cols-4 gap-1.5">
                {[30, 60, 90, 120].map((t) => (
                  <button
                    key={t}
                    onClick={() => setDuration(t)}
                    className={cn(
                      "px-3 py-2 rounded-md text-xs font-bold transition",
                      duration === t
                        ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30"
                        : "bg-white/5 text-white/60"
                    )}
                  >
                    {t}s
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={startGame}
              disabled={!studentId || !studentName.trim() || (difficulty === "curriculum" && numericCurriculumQuestions.length === 0)}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-30 text-white font-bold py-2 rounded-lg text-sm transition shadow-lg shadow-amber-500/30"
            >
              ابدأ التحدي
            </button>
          </div>
        )}

        {phase === "playing" && (
          <div className="flex-1 flex flex-col">
            {/* HUD */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-white/5 rounded-lg px-3 py-2 border border-white/10">
                <div className="text-[10px] text-white/60">النقاط</div>
                <div className="text-xl font-bold text-[#FFD700]">{score}</div>
              </div>
              <div className="bg-white/5 rounded-lg px-3 py-2 border border-white/10">
                <div className="text-[10px] text-white/60">المتوالية</div>
                <div className="text-xl font-bold text-emerald-400">{streak}🔥</div>
              </div>
              <div className={cn(
                "bg-white/5 rounded-lg px-3 py-2 border border-white/10",
                timeLeft < 10 && "bg-red-500/20 border-red-500/40 animate-pulse"
              )}>
                <div className="text-[10px] text-white/60">الوقت</div>
                <div className={cn("text-xl font-bold", timeLeft < 10 ? "text-red-400" : "text-white")}>
                  {timeLeft}s
                </div>
              </div>
            </div>

            {/* Timer bar */}
            <div className="w-full bg-white/5 rounded-full h-2 mb-4 overflow-hidden">
              <div
                className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 h-2 rounded-full transition-all"
                style={{ width: `${(timeLeft / duration) * 100}%` }}
              />
            </div>

            {/* Question */}
            <div
              className={cn(
                "text-center py-8 mb-4 rounded-2xl border-2 transition-colors",
                feedback === "correct"
                  ? "bg-emerald-500/20 border-emerald-500/50"
                  : feedback === "wrong"
                  ? "bg-red-500/20 border-red-500/50"
                  : "bg-blue-500/10 border-blue-500/30"
              )}
            >
              <div className="text-5xl font-bold text-white mb-2">{question.text} = ?</div>
              {feedback === "correct" && <Check className="w-8 h-8 text-emerald-400 mx-auto" />}
              {feedback === "wrong" && (
                <div className="text-red-400">
                  <XCircle className="w-6 h-6 mx-auto mb-1" />
                  الإجابة: {question.answer}
                </div>
              )}
            </div>

            {/* Input */}
            <div className="flex gap-2 mt-auto">
              <input
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitAnswer()}
                type="number"
                placeholder="اكتب الإجابة"
                className="flex-1 bg-white/5 border border-white/10 rounded-md text-white text-2xl text-center focus:outline-none focus:border-amber-500/50"
                autoFocus
                disabled={feedback !== null}
              />
              <button
                onClick={submitAnswer}
                className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white px-5 rounded-md font-bold text-sm transition shadow-lg shadow-blue-500/30"
              >
                تأكيد
              </button>
            </div>
          </div>
        )}

        {phase === "done" && (
          <div className="text-center py-4 flex-1 flex flex-col justify-center items-center">
            <div className="text-7xl mb-3 animate-bounce">🏆</div>
            <div className="text-base text-white/70 mb-1">انتهى الوقت!</div>
            {studentName && (
              <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-2 flex items-center gap-2">
                <Award className="w-5 h-5 text-[#FFD700]" />
                {studentName}
              </div>
            )}
            <div className="inline-block bg-emerald-500/20 text-emerald-400 px-4 py-1.5 rounded-full text-xs font-bold mb-4 border border-emerald-500/40">
              النتيجة: {score} نقطة مُضافة للطالب
            </div>
            <button
              onClick={reset}
              className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-bold py-2 px-5 rounded-lg text-xs flex items-center gap-2 transition shadow-lg shadow-red-500/30"
            >
              <RotateCcw className="w-3 h-3" /> تحدي جديد
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
