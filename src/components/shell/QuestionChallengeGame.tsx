"use client";

import { useMemo, useCallback, useState, useEffect, useRef } from "react";
import { useShellStore } from "@/lib/shell-store";
import { useGameQuestions, useGameStudentPicker, type GameQuestion, useGameGroupPicker } from "@/lib/useGameStudentPicker";
import { Brain, Check, XCircle, Trophy, Users, User, Shuffle, Crown, BookOpen, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { MathText } from "./MathText";
import { QuestionMedia } from "./QuestionMedia";
// 🟢 v2 fix: unified pre-game question config (count + source)
import { GameQuestionConfigView, useGameQuestionConfig } from "./GameQuestionConfig";
// 🟢 v2 fix: smart celebration + manual picker + present-students filter
import { computeSmartCelebration, pickStudentManual, filterPresentStudents } from "@/lib/game-utils";
import { addGroupPoints } from "@/lib/data-store";
import { localDb } from "@/lib/local-db";

import { useGameActivity } from "@/lib/game-activity-context";
type Phase = "setup" | "showing-question" | "reveal" | "done";
type Mode = "individual" | "duel" | "group";

/**
 * QuestionChallengeGame v6.1 — Redesigned + QuestionProvider wired + store students auto-load + award winner.
 */
export function QuestionChallengeGame({ onClose }: { onClose: () => void }) {
  const playSound = useShellStore((s) => s.playSound);
  const triggerConfetti = useShellStore((s) => s.triggerConfetti);
  const triggerRedFlash = useShellStore((s) => s.triggerRedFlash);
  const triggerGreenFlash = useShellStore((s) => s.triggerGreenFlash);
  const setCelebrationType = useShellStore((s) => s.setCelebrationType);
  const awardCorrect = useShellStore((s) => s.awardCorrect);
  const awardWrong = useShellStore((s) => s.awardWrong);
  const recordStudentActivity = useShellStore((s) => s.recordStudentActivity);
  const students = useShellStore((s) => s.students);
  const activeClassId = useShellStore((s) => s.activeClassId);
  const currentSessionId = useShellStore((s) => s.currentSessionId);
  const currentIdeaId = useShellStore((s) => s.currentIdeaId);
  const hydratedLessonQuestions = useShellStore((s) => s.lessonQuestions);
  const picker = useGameStudentPicker("questionchallenge");
  const groupPicker = useGameGroupPicker();
  // 🟢 v2 fix: configurable question count + source (was hard-coded 15).
  const cfg = useGameQuestionConfig(10);
  const { questions: lessonQuestions, loading: questionsLoading, markAsked } = useGameQuestions(
    cfg.questionSource,
    cfg.limit || 10,
    { ideaId: cfg.manualIdeaIdForHook ?? undefined },
  );

  const [phase, setPhase] = useState<Phase>("setup");
  const [mode, setMode] = useState<Mode>("individual");
  const [questions, setQuestions] = useState<GameQuestion[]>([])  // P0-5 fix: GameQuestion has correctIdx;
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [correctCount, setCorrectCount] = useState<Record<string, number>>({});
  const [wrongCount, setWrongCount] = useState<Record<string, number>>({});
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [participants, setParticipants] = useState<{ id: string; name: string }[]>([]);
  const [participantInput, setParticipantInput] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const answerLockRef = useRef(false);

  // Live game-result persistence. The result is created only after the first
  // answer, so opening/closing the setup screen never pollutes reports.
  const gameResultPromiseRef = useRef<Promise<Record<string, unknown> | null> | null>(null);
  const gameResultIdRef = useRef<string | null>(null);
  const recordedAnswersRef = useRef<Array<{ questionId?: string; lessonId?: string; ideaId?: string; stepNumber?: number; questionText: string; studentId?: string; studentAnswer?: string; isCorrect: boolean; pointsEarned: number }>>([]);
  const gameStartedAtRef = useRef<number | null>(null);
  const gameFinalizedRef = useRef(false);

  // Live ref — setTimeout callbacks run after setScores and would otherwise
  // see a stale closure over `scores` (H1 fix). Ref updated in effect to satisfy react-hooks/refs.
  const scoresRef = useRef(scores);
  const correctCountRef = useRef(correctCount);
  const wrongCountRef = useRef(wrongCount);

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
  const isGameActive = phase === "showing-question" || phase === "reveal";
  useEffect(() => {
    setGameActive(isGameActive);
  }, [isGameActive, setGameActive]);
  useEffect(() => { scoresRef.current = scores; }, [scores]);
  useEffect(() => { correctCountRef.current = correctCount; }, [correctCount]);
  useEffect(() => { wrongCountRef.current = wrongCount; }, [wrongCount]);

  // C35 (P2 fix): clear all tracked timeouts on unmount.
  useEffect(() => () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current.clear();
  }, []);

  // ===== QuestionProvider: load questions from the active lesson =====
  // P2 fix: only sync questions during setup phase.
  useEffect(() => {
    if (phase !== "setup") return;
    const timer = window.setTimeout(() => setQuestions(lessonQuestions), 0);
    return () => window.clearTimeout(timer);
  }, [lessonQuestions, phase]);

  const currentQ = questions[currentIdx];

  // Load class students — مصدر موحّد: متجر Zustand بعد فلترته على الصف النشط
  // (hydrateFromDb/setStudents تتكفل بالفلترة؛ لا ندعو getStudentsByClass هنا)
  // 🟢 v2 fix: filter out absent students — they shouldn't appear in the manual grid.
  const classStudents = useMemo(
    () => filterPresentStudents(students).map((s) => ({ id: s.id, name: s.name })),
    [students],
  );
  const presentStudentIds = useMemo(
    () => new Set(filterPresentStudents(students).map((student) => student.id)),
    [students],
  );
  // Shuffle questions
  const startGame = (selectedMode: Mode, selectedParticipants: { id: string; name: string }[]) => {
    if (questions.length === 0 || selectedParticipants.length === 0) return;
    answerLockRef.current = false;
    const shuffled = [...questions].sort(() => Math.random() - 0.5);
    setQuestions(shuffled);
    setMode(selectedMode);
    setParticipants(selectedParticipants);
    setCurrentIdx(0);
    setSelectedAnswer(null);
    setCurrentPlayer(0);
    const initScores: Record<string, number> = {};
    const initCorrect: Record<string, number> = {};
    const initWrong: Record<string, number> = {};
    selectedParticipants.forEach((p) => {
      initScores[p.id] = 0;
      initCorrect[p.id] = 0;
      initWrong[p.id] = 0;
    });
    setScores(initScores);
    setCorrectCount(initCorrect);
    setWrongCount(initWrong);
    gameStartedAtRef.current = Date.now();
    gameResultPromiseRef.current = null;
    gameResultIdRef.current = null;
    recordedAnswersRef.current = [];
    gameFinalizedRef.current = false;
    setPhase("showing-question");
    playSound("celebrate-fanfare-short");
  };

  const resolvePersistedQuestionId = useCallback((question: GameQuestion) => {
    if (question.id) return question.id;
    const row = hydratedLessonQuestions.find((candidate) => (
      candidate.text === question.text
      && (candidate.ideaId ?? null) === (question.ideaId ?? null)
      && (candidate.stepNumber ?? candidate.step ?? null) === (question.stepNumber ?? null)
      && typeof candidate.id === "string"
    ));
    return row?.id;
  }, [hydratedLessonQuestions]);

  const ensureGameResult = useCallback(() => {
    if (gameResultPromiseRef.current) return gameResultPromiseRef.current;
    const startedAt = gameStartedAtRef.current ?? Date.now();
    const promise = localDb.gameResults.create({
      sessionId: currentSessionId ?? undefined,
      gameType: "question-challenge",
      gameMode: mode,
      ideaId: currentIdeaId ?? undefined,
      questionCount: questions.length,
      startedAt: new Date(startedAt).toISOString(),
      configJson: JSON.stringify({
        source: cfg.questionSource,
        lessonId: questions[0]?.lessonId ?? undefined,
        ideaId: currentIdeaId ?? questions[0]?.ideaId ?? undefined,
        curriculumOnly: cfg.questionSource !== "ai-generated",
      }),
    }).then((row) => {
      const id = typeof row?.id === "string" ? row.id : null;
      gameResultIdRef.current = id;
      return row;
    }).catch((error) => {
      console.warn("[QuestionChallengeGame] failed to create game result", error);
      return null;
    });
    gameResultPromiseRef.current = promise;
    return promise;
  }, [cfg.questionSource, currentIdeaId, currentSessionId, mode, questions]);

  const persistCompletedGame = useCallback(async () => {
    if (gameFinalizedRef.current) return;
    gameFinalizedRef.current = true;
    const row = gameResultIdRef.current ? { id: gameResultIdRef.current } : await gameResultPromiseRef.current;
    const gameResultId = typeof row?.id === "string" ? row.id : null;
    if (!gameResultId) return;

    const lessonIds = [...new Set(recordedAnswersRef.current.map((row) => row.lessonId).filter((id): id is string => Boolean(id)))];
    const persistedQuestions: Array<Record<string, unknown>> = [];
    for (const lessonId of lessonIds) {
      try {
        persistedQuestions.push(...await localDb.questions.listByLesson(lessonId));
      } catch (error) {
        console.warn("[QuestionChallengeGame] failed to load persisted question ids", error);
      }
    }
    for (const answerRow of recordedAnswersRef.current) {
      const matched = answerRow.questionId
        ? null
        : persistedQuestions.find((row) => (
          row.text === answerRow.questionText
          && (row.ideaId ?? null) === (answerRow.ideaId ?? null)
          && (Number(row.stepNumber) || null) === (answerRow.stepNumber ?? null)
        ));
      await localDb.gameResults.addQuestion({
        gameResultId,
        ...answerRow,
        questionId: answerRow.questionId ?? (typeof matched?.id === "string" ? matched.id : undefined),
      });
    }

    // C30 fix (2026-AUG): save participants for BOTH individual AND group modes.
    // Previously group mode skipped addParticipant entirely, making group games
    // invisible in reports. Now we save groups as participants too.
    const winnerId = participants.reduce<string | null>((winner, participant) => {
      if (!winner || (scoresRef.current[participant.id] ?? 0) > (scoresRef.current[winner] ?? 0)) return participant.id;
      return winner;
    }, null);
    for (const participant of participants) {
      await localDb.gameResults.addParticipant({
        gameResultId,
        studentId: participant.id,
        studentName: participant.name,
        pointsEarned: scoresRef.current[participant.id] ?? 0,
        correctCount: correctCountRef.current[participant.id] ?? 0,
        wrongCount: wrongCountRef.current[participant.id] ?? 0,
        isWinner: participant.id === winnerId,
      });
    }

    await localDb.gameResults.complete({
      id: gameResultId,
      endedAt: new Date().toISOString(),
      durationMs: Math.max(0, Date.now() - (gameStartedAtRef.current ?? Date.now())),
    });
  }, [participants]);

  // Pick 2 random students for duel (uses unified fair picker)
  const pickTwoRandom = () => {
    if (picker.present.length < 2) return [];
    const excludeIds: string[] = [];
    const first = picker.pickRandom(excludeIds);
    if (!first) return [];
    excludeIds.push(first.id);
    const second = picker.pickRandom(excludeIds);
    if (!second) return [first];
    // 🟢 v2 fix: removed recordStudentActivity(type:"star", points:0) calls — picker.pickRandom
    // already marks calledInSession; an extra star activity was creating badges
    // without justification.
    return [first, second];
  };

  // Pick 2 random groups
  const [classGroups, setClassGroups] = useState<{ id: string; name: string; color: string; studentIds: string[] }[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  useEffect(() => {
    if (activeClassId) {
      import("@/lib/data-store").then((m) => {
        m.getAllGroups(activeClassId).then((groups) => {
          setClassGroups(groups.map((g) => ({ id: g.id, name: g.name, color: g.color, studentIds: g.studentIds })));
        });
      });
    }
  }, [activeClassId]);

  const playableGroups = useMemo(
    () => classGroups.filter((group) => group.studentIds.some((studentId) => presentStudentIds.has(studentId))),
    [classGroups, presentStudentIds],
  );

  const answer = (answerIdx: number) => {
    if (answerLockRef.current || selectedAnswer !== null || phase !== "showing-question" || !currentQ) return;
    answerLockRef.current = true;
    setSelectedAnswer(answerIdx);
    setPhase("reveal");
    const isCorrect = answerIdx === currentQ.correctIdx;  // P0-5 fix: GameQuestion has correctIdx, not correctAnswer

    const player = participants[currentPlayer];
    void ensureGameResult();
    recordedAnswersRef.current.push({
      questionId: resolvePersistedQuestionId(currentQ),
      lessonId: currentQ.lessonId,
      ideaId: currentQ.ideaId,
      stepNumber: currentQ.stepNumber,
      questionText: currentQ.text,
      studentId: mode === "group" ? undefined : player.id,
      studentAnswer: currentQ.options[answerIdx],
      isCorrect,
      pointsEarned: isCorrect ? (currentQ.rewardPoints || 5) : 0,
    });
    if (isCorrect) {
      setScores((s) => ({ ...s, [player.id]: s[player.id] + (currentQ.rewardPoints || 5) }));
      setCorrectCount((c) => ({ ...c, [player.id]: c[player.id] + 1 }));
      playSound("celebrate-tada");
      triggerGreenFlash();
      setCelebrationType("confetti");
      triggerConfetti();
      if (mode === "group") {
        void addGroupPoints(player.id, currentQ.rewardPoints || 5);
      } else if (player.id && students.find((s) => s.id === player.id)) {
        awardCorrect(player.id, currentQ.rewardPoints || 5);
        // 🟢 v2 fix (CRITICAL): removed recordStudentActivity("correct") — awardCorrect already
        // creates the badge + logs the activity. Was double-badge.
      }
    } else {
      setWrongCount((w) => ({ ...w, [player.id]: w[player.id] + 1 }));
      playSound("celebrate-buzz");
      triggerRedFlash();
      if (player.id && students.find((s) => s.id === player.id)) {
        awardWrong(player.id);
        // 🟢 v2 fix (CRITICAL): removed recordStudentActivity("wrong") — awardWrong already
        // creates the badge + logs the activity. Was double-badge.
      }
    }
    // 🟢 v2 fix: mark this question as asked so the next game won't repeat it.
    if (currentQ?._stableId) markAsked(currentQ._stableId);

    safeTimeout(() => {
      if (mode === "duel" || mode === "group") {
        setCurrentPlayer((p) => (p + 1) % participants.length);
      }
      if (currentIdx + 1 >= questions.length) {
        setPhase("done");
        // 🟢 v2 fix: smart celebration — only fire confetti + champion banner if
        // at least one participant scored > 0. Was unconditional before.
        const players = participants.map((p) => ({
          id: p.id,
          name: p.name,
          score: scoresRef.current[p.id] || 0,
        }));
        const result = computeSmartCelebration(players);
        void persistCompletedGame();
        if (result.shouldCelebrate) {
          playSound("celebrate-applause-big");
          if (result.celebrationType) setCelebrationType(result.celebrationType);
          triggerConfetti();
        } else {
          // All lost or tie at 0 — soft tone, no confetti
          playSound("celebrate-buzz");
        }
        // 🟢 v2 fix: removed recordStudentActivity(winnerObj, star) — smart celebration
        // already handles the winner; an extra star activity was creating a badge
        // without justification.
      } else {
        setCurrentIdx((i) => i + 1);
        setSelectedAnswer(null);
        answerLockRef.current = false;
        setPhase("showing-question");
      }
    }, 2000);
  };

  const reset = () => {
    setPhase("setup");
    answerLockRef.current = false;
    gameResultPromiseRef.current = null;
    gameResultIdRef.current = null;
    recordedAnswersRef.current = [];
    gameFinalizedRef.current = false;
    setParticipants([]);
    setParticipantInput("");
  };

  const addParticipant = () => {
    if (!participantInput.trim()) return;
    setParticipants([...participants, { id: `p_${Date.now()}`, name: participantInput.trim() }]);
    setParticipantInput("");
  };

  const winner = phase === "done" ? participants.reduce((max, p) => (scores[p.id] > (scores[max?.id || ""] || 0) ? p : max), participants[0]) : null;

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
              <div className="font-bold text-blue-400 mb-1">1. النمط</div>
              اختر نمط اللعب: فردي (طالب واحد)، فردين (اثنان يتنافسان)، أو مجموعات (مجموعتان).
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-blue-500/30">
              <div className="font-bold text-blue-400 mb-1">2. الأسئلة</div>
              تُسحب الأسئلة من الدرس النشط عبر QuestionProvider.
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-blue-500/30">
              <div className="font-bold text-blue-400 mb-1">3. الجواب</div>
              اضغط على الإجابة الصحيحة. في الأنماط التنافسية، يتبادل اللاعبون الأدوار.
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-blue-500/30">
              <div className="font-bold text-blue-400 mb-1">4. المكافأة</div>
              كل إجابة صحيحة تمنح الطالب نقاطاً (من المنهج أو 5 افتراضياً) + يتوَّج الفائز في النهاية.
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
              <h2 className="text-base font-bold text-white">تحدي الأسئلة</h2>
              <div className="text-[9px] text-blue-400/80">من المنهج النشط</div>
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
          <div className="flex-1 space-y-3">
            {/* 🟢 v2 fix: unified pre-game question config (count + source) */}
            <div className="bg-white/5 rounded-md p-2.5 border border-white/10">
              <GameQuestionConfigView state={cfg} actions={cfg} compact />
            </div>

            {/* Mode selection */}
            <div>
              <label className="text-[11px] text-white/60 mb-1.5 block">اختر نوع التحدي</label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => setMode("individual")}
                  className={cn(
                    "px-2 py-2 rounded-xl text-[10px] font-bold flex flex-col items-center gap-1 transition border-2",
                    mode === "individual"
                      ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-blue-400 shadow-lg shadow-blue-500/30"
                      : "bg-white/5 text-white/60 border-white/10"
                  )}
                >
                  <User className="w-4 h-4" />
                  فردي
                </button>
                <button
                  onClick={() => setMode("duel")}
                  className={cn(
                    "px-2 py-2 rounded-xl text-[10px] font-bold flex flex-col items-center gap-1 transition border-2",
                    mode === "duel"
                      ? "bg-gradient-to-r from-red-500 to-rose-500 text-white border-red-400 shadow-lg shadow-red-500/30"
                      : "bg-white/5 text-white/60 border-white/10"
                  )}
                >
                  <Users className="w-4 h-4" />
                  فردين
                </button>
                <button
                  onClick={() => setMode("group")}
                  className={cn(
                    "px-2 py-2 rounded-xl text-[10px] font-bold flex flex-col items-center gap-1 transition border-2",
                    mode === "group"
                      ? "bg-gradient-to-r from-emerald-500 to-green-500 text-white border-emerald-400 shadow-lg shadow-emerald-500/30"
                      : "bg-white/5 text-white/60 border-white/10"
                  )}
                >
                  <Users className="w-4 h-4" />
                  مجموعات
                </button>
              </div>
            </div>

            {/* Questions count */}
            <div className="text-center text-[11px] text-white/60 bg-white/5 rounded-md py-1.5 border border-white/10">
              {questionsLoading
                ? "جاري تحميل الأسئلة..."
                : questions.length > 0
                ? `${questions.length} سؤال متاح من المنهج`
                : "لا توجد أسئلة في المنهج الحالي"}
            </div>

            {/* Individual mode */}
            {mode === "individual" && (
              <div className="space-y-2">
                <label className="text-[11px] text-white/60">المشارك</label>
                {classStudents.length > 0 ? (
                  <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto">
                    {classStudents.map((s) => (
                      <button
                        key={s.id}
                        // 🟢 v2 fix: use pickStudentManual so calledInSession is updated
                        // (was setParticipants([s]) direct, which skipped the fairness rotation).
                        onClick={() => {
                          const st = pickStudentManual(s.id);
                          if (st) setParticipants([{ id: st.id, name: st.name }]);
                        }}
                        className={cn(
                          "px-2 py-1.5 rounded text-[10px] transition border",
                          participants[0]?.id === s.id
                            ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-blue-400"
                            : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10"
                        )}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input
                    value={participantInput}
                    onChange={(e) => setParticipantInput(e.target.value)}
                    placeholder="اسم الطالب"
                    className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500/50"
                  />
                )}
                {classStudents.length === 0 && participantInput && (
                  <button onClick={addParticipant} className="bg-blue-500 text-white px-3 py-1 rounded text-xs">إضافة</button>
                )}
                <button
                  onClick={() => participants.length === 1 && startGame("individual", participants)}
                  disabled={participants.length !== 1 || questions.length === 0}
                  className="w-full bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 disabled:opacity-30 text-white font-bold py-2 rounded-lg text-xs transition shadow-lg shadow-emerald-500/30"
                >
                  ابدأ التحدي
                </button>
              </div>
            )}

            {/* Duel mode */}
            {mode === "duel" && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  {participants.map((p, i) => (
                    <div key={p.id} className="flex-1 bg-white/5 rounded-lg p-2 text-center border-2 border-white/10">
                      <div className="text-[10px] text-white/40">لاعب {i + 1}</div>
                      <div className="text-xs text-white font-bold">{p.name}</div>
                    </div>
                  ))}
                  {participants.length < 2 && (
                    <div className="flex-1 bg-white/5 rounded-lg p-2 text-center border-2 border-dashed border-white/20">
                      <div className="text-[10px] text-white/40">لاعب {participants.length + 1}</div>
                      <div className="text-xs text-white/40">?</div>
                    </div>
                  )}
                </div>
                {picker.present.length >= 2 && (
                  <button
                    onClick={() => setParticipants(pickTwoRandom())}
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition shadow-lg shadow-purple-500/30"
                  >
                    <Shuffle className="w-3.5 h-3.5" /> اختر 2 عشوائياً (عادل)
                  </button>
                )}
                {classStudents.length > 0 && participants.length < 2 && (
                  <div className="grid grid-cols-2 gap-1 max-h-28 overflow-y-auto">
                    {classStudents.filter((s) => !participants.find((p) => p.id === s.id)).map((s) => (
                      <button
                        key={s.id}
                        // 🟢 v2 fix: use pickStudentManual so calledInSession is updated
                        // (was setParticipants([...participants, s]) direct, which skipped the fairness rotation).
                        onClick={() => {
                          if (participants.length >= 2) return;
                          const st = pickStudentManual(s.id);
                          if (st) setParticipants([...participants, { id: st.id, name: st.name }]);
                        }}
                        className="px-2 py-1 rounded text-[10px] bg-white/5 text-white/60 hover:bg-white/10 border border-white/10"
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => participants.length === 2 && startGame("duel", participants)}
                  disabled={participants.length !== 2 || questions.length === 0}
                  className="w-full bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 disabled:opacity-30 text-white font-bold py-2 rounded-lg text-xs transition shadow-lg shadow-emerald-500/30"
                >
                  ابدأ التحدي
                </button>
              </div>
            )}

            {/* Group mode */}
            {mode === "group" && (
              <div className="space-y-2">
                {playableGroups.length >= 2 ? (
                  <>
                    <div className="flex gap-2">
                      {(selectedGroups.length === 2
                        ? selectedGroups.map((gid) => playableGroups.find((g) => g.id === gid)!).filter(Boolean)
                        : playableGroups.slice(0, 2)
                      ).map((g) => (
                        <div key={g.id} className="flex-1 rounded-lg p-2 text-center border-2" style={{ backgroundColor: g.color + "30", borderColor: g.color }}>
                          <div className="text-xs text-white font-bold">{g.name}</div>
                          <div className="text-[10px] text-white/40">{g.studentIds.length} أعضاء</div>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        const pool = playableGroups.map((g) => ({ id: g.id, name: g.name, color: g.color, studentIds: g.studentIds }));
                        const two = groupPicker.pickTwoGroups(pool);
                        if (two && two.length === 2) {
                          setSelectedGroups(two.map((g) => g.id));
                        }
                      }}
                      className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition shadow-lg shadow-purple-500/30"
                    >
                      <Shuffle className="w-3.5 h-3.5" /> اختر مجموعتين عشوائياً (عادل)
                    </button>
                    <button
                      onClick={() => {
                        let twoGroups: { id: string; name: string }[] = selectedGroups.length === 2
                          ? selectedGroups.map((gid) => playableGroups.find((g) => g.id === gid)!).filter(Boolean)
                          : [];
                        if (twoGroups.length !== 2) {
                          const pool = playableGroups.map((g) => ({ id: g.id, name: g.name, color: g.color, studentIds: g.studentIds }));
                          twoGroups = groupPicker.pickTwoGroups(pool) || playableGroups.slice(0, 2);
                        }
                        startGame("group", twoGroups.map((g) => ({ id: g.id, name: g.name })));
                      }}
                      disabled={questions.length === 0}
                      className="w-full bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 disabled:opacity-30 text-white font-bold py-2 rounded-lg text-xs transition shadow-lg shadow-emerald-500/30"
                    >
                      ابدأ تحدي المجموعات
                    </button>
                  </>
                ) : (
                  <div className="text-center text-white/40 text-xs py-4">
                    يجب إنشاء مجموعتين على الأقل من لوحة المجموعات
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {(phase === "showing-question" || phase === "reveal") && currentQ && (
          <div className="flex-1 flex flex-col">
            {/* Scores */}
            <div className="flex gap-2 mb-3">
              {participants.map((p, i) => (
                <div
                  key={p.id}
                  className={cn(
                    "flex-1 rounded-lg p-2 text-center border-2 transition",
                    currentPlayer === i && phase === "showing-question"
                      ? "border-[#FFD700] bg-[#FFD700]/10"
                      : "border-white/10 bg-white/5"
                  )}
                >
                  <div className="text-[10px] text-white/40 truncate">{p.name}</div>
                  <div className="text-lg font-bold text-[#FFD700]">{scores[p.id]}</div>
                  <div className="text-[9px] text-white/40">{correctCount[p.id]}✓ {wrongCount[p.id]}✗</div>
                </div>
              ))}
            </div>

            {/* Question */}
            <div className="rounded-2xl p-4 mb-4 text-center border-2 border-blue-500/30" style={{ background: "linear-gradient(135deg, rgba(1,66,160,0.3), rgba(1,66,160,0.1))" }}>
              {currentQ.ideaTitle && (
                <div className="text-[10px] text-emerald-400 mb-1">{currentQ.ideaTitle}</div>
              )}
              <div className="text-sm text-white font-bold"><QuestionMedia text={currentQ.text} images={currentQ.images} /></div>
            </div>

            {/* Options */}
            {currentQ.options && currentQ.options.length > 0 ? (
              <div className="grid grid-cols-1 gap-2">
                {currentQ.options.map((opt, i) => {
                  const isCorrect = phase === "reveal" && i === currentQ.correctIdx;  // P0-5 fix
                  const isSelected = selectedAnswer === i;
                  const isWrong = phase === "reveal" && isSelected && !isCorrect;
                  return (
                    <button
                      key={i}
                      onClick={() => phase === "showing-question" && answer(i)}
                      disabled={phase === "reveal"}
                      className={cn(
                        "p-3 rounded-xl text-white font-bold text-xs transition border-2",
                        isCorrect
                          ? "bg-gradient-to-r from-emerald-500 to-green-500 border-emerald-400 shadow-lg shadow-emerald-500/30"
                          : isWrong
                          ? "bg-gradient-to-r from-red-500 to-rose-500 border-red-400 shadow-lg shadow-red-500/30"
                          : "bg-white/5 border-white/10 hover:bg-white/10"
                      )}
                    >
                      {opt}
                      {isCorrect && <Check className="w-4 h-4 inline mr-2" />}
                      {isWrong && <XCircle className="w-4 h-4 inline mr-2" />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-white/60 text-xs py-4">
                {phase === "showing-question" && "اضغط على الإجابة الصحيحة في الكانفاس أو استخدم الأزرار"}
                {phase === "reveal" && (
                  <div>
                    <div className="text-white/60 text-[10px]">الإجابة الصحيحة:</div>
                    <div className="text-emerald-400 text-base font-bold mt-1">{currentQ.options[currentQ.correctIdx]}</div>
                  </div>
                )}
              </div>
            )}

            {/* Question counter */}
            <div className="text-center text-[10px] text-white/40 mt-3">
              سؤال {currentIdx + 1} من {questions.length}
              {mode !== "individual" && ` • دور: ${participants[currentPlayer]?.name}`}
            </div>
          </div>
        )}

        {phase === "done" && winner && (
          <div className="text-center py-4 flex-1 flex flex-col justify-center items-center">
            <div className="text-7xl mb-3 animate-bounce">🏆</div>
            <div className="text-base text-white/70 mb-1">الفائز!</div>
            <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-3 flex items-center gap-2">
              <Award className="w-5 h-5 text-[#FFD700]" />
              {winner.name}
            </div>
            <div className="inline-block bg-emerald-500/20 text-emerald-400 px-4 py-1.5 rounded-full text-xs font-bold mb-3 border border-emerald-500/40">
              النتيجة: {scores[winner.id]} نقطة
            </div>
            <div className="text-[11px] text-white/60 mb-4">
              {correctCount[winner.id]} إجابات صحيحة • {wrongCount[winner.id]} خاطئة
            </div>
            {participants.filter((p) => p.id !== winner.id).map((p) => (
              <div key={p.id} className="text-[11px] text-white/40 mb-1">
                {p.name}: {scores[p.id]} نقطة ({correctCount[p.id]}✓ {wrongCount[p.id]}✗)
              </div>
            ))}
            <button
              onClick={reset}
              className="mt-4 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-bold py-2 px-5 rounded-lg text-xs flex items-center gap-2 transition shadow-lg shadow-red-500/30"
            >
              تحدي جديد
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
