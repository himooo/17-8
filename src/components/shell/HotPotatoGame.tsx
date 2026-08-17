"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { useShellStore } from "@/lib/shell-store";
import { RotateCcw, Bomb, X, Plus, Users, Award, BookOpen, Trophy, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGameStudentPicker } from "@/lib/useGameStudentPicker";

import { useGameActivity } from "@/lib/game-activity-context";
import { useGameResultRecorder } from "@/lib/game-result-recorder";
/**
 * HotPotatoGame v6.1 — Visually attractive redesign + How to Play + canvas-confined
 *
 *  How to play:
 *  1. Add 2+ participants (auto-loaded from store if students exist)
 *  2. Press "ابدأ اللعبة" — a potato appears and starts bouncing between participants
 *  3. A random timer (5-13 seconds) is set; when it hits zero, the potato EXPLODES
 *  4. Whoever holds the potato when it explodes is eliminated
 *  5. Last person standing wins +5 points
 *
 *  Visual improvements:
 *  - Gradient backgrounds with depth
 *  - Animated potato with pulsing/bouncing
 *  - Progress bar with gradient
 *  - Participant chips with status colors
 *  - Winner celebration screen
 *  - How-to-play section
 */
export function HotPotatoGame({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<"setup" | "playing" | "exploded" | "done">("setup");
  const [participants, setParticipants] = useState<{ id: string; name: string }[]>([
    { id: "", name: "" },
    { id: "", name: "" },
  ]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [eliminated, setEliminated] = useState<Set<number>>(new Set());
  const [elapsed, setElapsed] = useState(0);
  const [randomDuration, setRandomDuration] = useState(0);
  const [showHelp, setShowHelp] = useState(false);


  const playSound = useShellStore((s) => s.playSound);
  const triggerRedFlash = useShellStore((s) => s.triggerRedFlash);
  const triggerConfetti = useShellStore((s) => s.triggerConfetti);
  const setCelebrationType = useShellStore((s) => s.setCelebrationType);
  const awardPoints = useShellStore((s) => s.awardPoints);
  const students = useShellStore((s) => s.students);
  const currentSessionId = useShellStore((s) => s.currentSessionId);
  const picker = useGameStudentPicker("hotpotato");
  const pickRandom = picker.pickRandom;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ===== GameResult persistence (shared recorder — luck game, participant rows only) =====
  const recorder = useGameResultRecorder();
  // Track the post-explosion setTimeout so it can be cancelled on unmount.
  const explodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Live refs for values needed inside async callbacks (avoid stale closures).
  const currentIdxRef = useRef(0);
  const explodedRef = useRef(false);

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
  const clearTrackedTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current.clear();
  }, []);

  // Mark this game as active/inactive for mid-game exit confirmation.
  const setGameActive = useGameActivity();

  // Mark the game as "active" while in mid-play so the wrapping GameOverlay
  // asks for confirmation before closing (prevents accidental loss of progress).
  const isGameActive = phase === "playing" || phase === "exploded";
  useEffect(() => {
    setGameActive(isGameActive);
  }, [isGameActive, setGameActive]);
  useEffect(() => { currentIdxRef.current = currentIdx; }, [currentIdx]);
  const eliminatedRef = useRef<Set<number>>(new Set());
  useEffect(() => { eliminatedRef.current = new Set(eliminated); }, [eliminated]);

  const validParticipants = participants.filter((p) => p.name.trim());
  const alive = validParticipants.map((p, i) => ({ ...p, i })).filter((x) => !eliminated.has(x.i));

  // Ref for validParticipants must come after its declaration.
  const validParticipantsRef = useRef<{ id: string; name: string }[]>([]);
  useEffect(() => { validParticipantsRef.current = validParticipants; }, [validParticipants]);

  const explode = useCallback(() => {
    if (explodedRef.current) return;
    explodedRef.current = true;
    setPhase("exploded");
    playSound("error");
    triggerRedFlash();
    if (intervalRef.current) clearInterval(intervalRef.current);
    const elimAtExplosion = new Set(eliminatedRef.current);
    elimAtExplosion.add(currentIdxRef.current);
    setEliminated(elimAtExplosion);
    if (explodeTimeoutRef.current !== null) clearTimeout(explodeTimeoutRef.current);
    explodeTimeoutRef.current = safeTimeout(() => {
      explodeTimeoutRef.current = null;
      const aliveAtExplosion = validParticipantsRef.current
        .map((p, i) => ({ ...p, i }))
        .filter((x) => !elimAtExplosion.has(x.i));
      if (aliveAtExplosion.length <= 1) {
        setPhase("done");
        const winner = aliveAtExplosion[0];
        if (winner && winner.id) {
          awardPoints(winner.id, 5);
          const winnerStudent = useShellStore.getState().students.find((student) => student.id === winner.id);
          if (winnerStudent) useShellStore.setState({ currentlyCalledStudent: winnerStudent });
          triggerConfetti();
          playSound("celebrate");
          setCelebrationType("champion");
        }
        // Persist the elimination round so reports include Hot Potato games.
        // Only students with real ids are recorded (manually typed names have no DB row).
        const recordable = validParticipantsRef.current.filter((p) => p.id);
        if (recordable.length > 0) {
          void recorder.ensure({
            sessionId: currentSessionId,
            gameType: "hot-potato",
            gameMode: "group",
            questionCount: 0,
            configJson: { participants: recordable.length },
          }).then(() => recorder.finish(recordable.map((p) => ({
            studentId: p.id,
            studentName: p.name,
            pointsEarned: winner && winner.id === p.id ? 5 : 0,
            correctCount: 0,
            wrongCount: 0,
            isWinner: Boolean(winner && winner.id === p.id),
          }))));
        }
      } else {
        setCurrentIdx(aliveAtExplosion[0].i);
        explodedRef.current = false;
        setPhase("playing");
        setElapsed(0);
        setRandomDuration(5 + Math.random() * 8);
      }
    }, 1500);
  }, [awardPoints, playSound, setCelebrationType, triggerConfetti, triggerRedFlash, safeTimeout, recorder, currentSessionId]);

  useEffect(() => {
    if (students.length >= 2 && participants.every((p) => !p.name.trim())) {
      const present = students.filter((s) => !s.isAbsent);
      const picked: Array<{ id: string; name: string }> = [];
      for (let index = 0; index < Math.min(6, present.length); index += 1) {
        const next = pickRandom(picked.map((student) => student.id));
        if (!next) break;
        picked.push({ id: next.id, name: next.name });
      }
      const timeoutId = safeTimeout(
        () => setParticipants(picked),
        0,
      );
      const trackedTimeouts = timeoutsRef.current;
      return () => {
        clearTimeout(timeoutId);
        trackedTimeouts.delete(timeoutId);
      };
    }
  }, [participants, pickRandom, safeTimeout, students]);

  useEffect(() => {
    if (phase !== "playing" || randomDuration <= 0) return;
    intervalRef.current = setInterval(() => {
      setElapsed((e) => {
        const newElapsed = e + 0.1;
        if (newElapsed >= randomDuration) {
          // Don't call explode() inside the setElapsed updater (not pure).
          // Schedule it for the next tick to avoid React setState-in-render error.
          safeTimeout(() => explode(), 0);
          return randomDuration;
        }
        return newElapsed;
      });
    }, 100);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [explode, phase, randomDuration, safeTimeout]);

  // Cleanup explode timeout on unmount (prevents setState on unmounted component).
  useEffect(() => {
    return () => {
      if (explodeTimeoutRef.current !== null) {
        clearTimeout(explodeTimeoutRef.current);
        explodeTimeoutRef.current = null;
      }
    };
  }, []);

  // C35 (P2 fix): clear all tracked timeouts on unmount.
  useEffect(() => () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current.clear();
  }, []);

  const startGame = () => {
    if (validParticipants.length < 2) return;
    clearTrackedTimeouts();
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (explodeTimeoutRef.current !== null) {
      clearTimeout(explodeTimeoutRef.current);
      explodeTimeoutRef.current = null;
    }
    explodedRef.current = false;
    recorder.reset();
    recorder.begin();
    setPhase("playing");
    setEliminated(new Set());
    setCurrentIdx(0);
    setElapsed(0);
    setRandomDuration(5 + Math.random() * 8);
    playSound("click");
  };

  const reset = () => {
    clearTrackedTimeouts();
    if (intervalRef.current) clearInterval(intervalRef.current);
    explodedRef.current = false;
    if (explodeTimeoutRef.current !== null) {
      clearTimeout(explodeTimeoutRef.current);
      explodeTimeoutRef.current = null;
    }
    setPhase("setup");
    setEliminated(new Set());
    setCurrentIdx(0);
    setElapsed(0);
  };

  const addParticipant = () => setParticipants([...participants, { id: "", name: "" }]);
  const updateParticipant = (i: number, name: string) => {
    const next = [...participants];
    next[i] = { ...next[i], name };
    setParticipants(next);
  };
  const removeParticipant = (i: number) => setParticipants(participants.filter((_, j) => j !== i));

  // ===== Help modal =====
  if (showHelp) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-orange-950 to-zinc-950 overflow-y-auto p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-orange-400" />
            <h2 className="text-base font-bold text-white">طريقة اللعب</h2>
          </div>
          <div className="space-y-3 text-xs text-white/80 leading-relaxed">
            <div className="bg-white/5 rounded-lg p-3 border border-orange-500/30">
              <div className="font-bold text-orange-400 mb-1">1. المشاركون</div>
              أضف لاعبين (2 على الأقل). يتم تحميل الطلاب تلقائياً إذا كان لديك طلاب مسجلون.
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-orange-500/30">
              <div className="font-bold text-orange-400 mb-1">2. ابدأ اللعبة</div>
              تظهر بطاطس ساخنة وتنتقل عشوائياً بين المشاركين كل 0.5 ثانية.
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-orange-500/30">
              <div className="font-bold text-orange-400 mb-1">3. الانفجار</div>
              مؤقت عشوائي (5-13 ثانية) — عند انتهائه تنفجر البطاطس. من يمسكها وقتها يخرج من اللعبة.
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-orange-500/30">
              <div className="font-bold text-orange-400 mb-1">4. الفائز</div>
              آخر لاعب يبقى يفوز بـ <span className="text-[#FFD700] font-bold">+5 نقاط</span> + احتفال.
            </div>
          </div>
          <button
            onClick={() => setShowHelp(false)}
            className="mt-4 w-full bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg text-sm font-bold transition"
          >
            فهمت! العب الآن
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-orange-950 via-zinc-900 to-zinc-950 overflow-y-auto">
      <div className="p-3 flex flex-col h-full">
        {/* Title bar */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/50">
              <Bomb className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">البطاطس الساخنة</h2>
              <div className="text-[9px] text-orange-400/80">آخر واحد يفوز</div>
            </div>
          </div>
          <button
            onClick={() => setShowHelp(true)}
            className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 p-1.5 rounded-lg transition"
            title="طريقة اللعب"
          >
            <BookOpen className="w-4 h-4" />
          </button>
        </div>

        {phase === "setup" && (
          <div className="space-y-2 flex-1">
            <div className="text-[11px] text-white/70 flex items-center gap-1 mb-1">
              <Users className="w-3 h-3" />
              المشاركون (2 على الأقل)
              {students.length >= 2 && (
                <span className="text-orange-400">· تم تحميل الطلاب تلقائياً</span>
              )}
            </div>
            <div className="space-y-1 max-h-[40vh] overflow-y-auto pr-1">
              {participants.map((p, i) => (
                <div key={i} className="flex gap-1">
                  <input
                    value={p.name}
                    onChange={(e) => updateParticipant(i, e.target.value)}
                    placeholder={`المشارك ${i + 1}`}
                    className="flex-1 bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-white text-xs focus:outline-none focus:border-orange-500/50"
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
            <button onClick={addParticipant} className="text-[10px] text-orange-500 hover:text-orange-400 hover:underline flex items-center gap-1">
              <Plus className="w-3 h-3" /> إضافة مشارك
            </button>
            <button
              onClick={startGame}
              disabled={validParticipants.length < 2}
              className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold py-2 rounded-lg text-xs transition shadow-lg shadow-orange-500/30"
            >
              🔥 ابدأ اللعبة
            </button>
          </div>
        )}

        {(phase === "playing" || phase === "exploded") && (
          <div className="text-center flex-1 flex flex-col justify-center items-center">
            {/* Potato */}
            <div className="relative mb-4">
              <div
                className={cn(
                  "rounded-full flex items-center justify-center text-5xl transition-all",
                  phase === "exploded" ? "animate-pulse scale-125" : "animate-bounce"
                )}
                style={{
                  width: 100,
                  height: 100,
                  background:
                    phase === "exploded"
                      ? "radial-gradient(circle at 30% 30%, #fca5a5, #ef4444 40%, #DA151C 80%)"
                      : "radial-gradient(circle at 30% 30%, #fde047, #fbbf24 40%, #92400e 90%)",
                  boxShadow:
                    phase === "exploded"
                      ? "0 0 40px rgba(220, 38, 38, 0.8), 0 0 80px rgba(220, 38, 38, 0.4)"
                      : "0 0 30px rgba(251, 191, 36, 0.6), 0 8px 16px rgba(0,0,0,0.4)",
                }}
              >
                {phase === "exploded" ? "💥" : "🥔"}
              </div>
              {/* Pulsing ring around potato */}
              {phase === "playing" && (
                <div
                  className="absolute inset-0 rounded-full border-2 border-orange-400/50 animate-ping"
                  style={{ animationDuration: "1.5s" }}
                />
              )}
            </div>

            {/* Current holder */}
            <div className="mb-3 px-4 py-2 rounded-full bg-white/5 border border-white/10">
              <div className="text-[10px] text-white/60">الماسك الآن</div>
              <div
                className={cn(
                  "text-lg font-bold",
                  phase === "exploded" ? "text-red-400" : "text-[#FFD700]"
                )}
              >
                {validParticipants[currentIdx]?.name}
              </div>
              {phase === "exploded" && (
                <div className="text-red-400 text-[10px] mt-1 font-bold animate-pulse">خرج من اللعبة!</div>
              )}
            </div>

            {/* Participants grid */}
            <div className="grid grid-cols-3 gap-1.5 mb-3 w-full max-w-md">
              {validParticipants.map((p, i) => {
                const isCurrent = i === currentIdx && phase === "playing";
                const isEliminated = eliminated.has(i);
                return (
                  <div
                    key={i}
                    className={cn(
                      "px-2 py-1.5 rounded-lg text-[10px] font-bold truncate border-2 transition-all",
                      isEliminated
                        ? "bg-red-500/10 text-red-400/60 line-through border-red-500/20"
                        : isCurrent
                        ? "bg-gradient-to-r from-yellow-400 to-orange-500 text-black border-yellow-300 scale-105 shadow-lg shadow-orange-500/30"
                        : "bg-white/5 text-white/60 border-white/10"
                    )}
                    title={p.name}
                  >
                    {p.name}
                  </div>
                );
              })}
            </div>

            {/* Progress bar */}
            {phase === "playing" && (
              <div className="w-full max-w-md">
                <div className="flex justify-between text-[9px] text-white/40 mb-1">
                  <span>الوقت المنقضي</span>
                  <span>{(randomDuration - elapsed).toFixed(1)} ثانية متبقية</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 h-2.5 rounded-full transition-all"
                    style={{ width: `${(elapsed / randomDuration) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {phase === "done" && (
          <div className="text-center py-4 flex-1 flex flex-col justify-center items-center">
            <div className="text-7xl mb-3 animate-bounce">🏆</div>
            <div className="text-base text-white/70 mb-2">الفائز!</div>
            <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-3 flex items-center gap-2">
              <Award className="w-5 h-5 text-[#FFD700]" />
              {alive[0]?.name}
            </div>
            <div className="inline-block bg-emerald-500/20 text-emerald-400 px-4 py-1.5 rounded-full text-xs font-bold mb-4 border border-emerald-500/40">
              +5 نقاط مُضافة للطالب
            </div>
            <button
              onClick={reset}
              className="bg-gradient-to-r from-[#DA151C] to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold py-2 px-6 rounded-lg text-xs flex items-center gap-2 transition shadow-lg shadow-red-500/30"
            >
              <RotateCcw className="w-3 h-3" /> العب مرة أخرى
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
