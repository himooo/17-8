"use client";

import { useState, useRef, useEffect } from "react";
import { useShellStore } from "@/lib/shell-store";
import { useGameStudentPicker } from "@/lib/useGameStudentPicker";
import { Zap, Clock, Trophy, BookOpen, RotateCcw, Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";
// 🟢 v2 fix: أضفنا student picker + awardGameBonus عند كسر أفضل رقم.
import { awardGameBonus, pickStudentManual, filterPresentStudents } from "@/lib/game-utils";

import { useGameActivity } from "@/lib/game-activity-context";
import { useGameResultRecorder } from "@/lib/game-result-recorder";
type Phase = "idle" | "waiting" | "ready" | "result" | "tooSoon";

/**
 * ReactionTimeGame v6.1 — Redesigned to match HotPotatoGame aesthetic.
 *
 * How to play:
 * 1. Click the panel to start
 * 2. Panel turns red — wait for green
 * 3. As soon as it turns green, click as fast as possible
 * 4. Your reaction time is recorded; beat your best time!
 */
export function ReactionTimeGame({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [reactionMs, setReactionMs] = useState<number | null>(null);
  const [attempts, setAttempts] = useState<number[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  // 🟢 v2 fix: state for selected student (was missing — game didn't know who plays).
  const [studentId, setStudentId] = useState<string>("");
  const [studentName, setStudentName] = useState<string>("");

  const startTimeRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptClosedRef = useRef(false);

  const reactionBestMs = useShellStore((s) => s.reactionBestMs);
  const setReactionBestMs = useShellStore((s) => s.setReactionBestMs);
  const playSound = useShellStore((s) => s.playSound);
  const triggerConfetti = useShellStore((s) => s.triggerConfetti);
  const setCelebrationType = useShellStore((s) => s.setCelebrationType);
  const students = useShellStore((s) => s.students);
  const currentSessionId = useShellStore((s) => s.currentSessionId);
  // 🟢 v2 fix: unified picker for fair random selection.
  const picker = useGameStudentPicker("reaction");

  // ===== GameResult persistence (shared recorder — one record per attempt) =====
  const recorder = useGameResultRecorder();

  // Mark this game as active/inactive for mid-game exit confirmation.
  const setGameActive = useGameActivity();

  // Mark the game as "active" while in mid-play so the wrapping GameOverlay
  // asks for confirmation before closing (prevents accidental loss of progress).
  const isGameActive = phase === "waiting" || phase === "ready";
  useEffect(() => {
    setGameActive(isGameActive);
  }, [isGameActive, setGameActive]);

  // 🟢 v2 fix: auto-load first uncalled present student so the game has a
  // player pre-selected (consistent with other games).
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
  const selectedPresentStudent = students.some((student) => student.id === studentId && !student.isAbsent);
  const canPlay = students.length === 0 || selectedPresentStudent;

  const startGame = () => {
    if (!canPlay) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    attemptClosedRef.current = false;
    setPhase("waiting");
    setReactionMs(null);
    const delay = 1500 + Math.random() * 3000;
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      setPhase("ready");
      startTimeRef.current = performance.now();
      playSound("celebrate-bell");
    }, delay);
  };

  const handleClick = () => {
    if (phase === "idle" || phase === "result" || phase === "tooSoon") {
      startGame();
    } else if (phase === "waiting") {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      attemptClosedRef.current = true;
      setPhase("tooSoon");
      playSound("celebrate-buzz");
    } else if (phase === "ready") {
      if (attemptClosedRef.current) return;
      attemptClosedRef.current = true;
      const ms = Math.round(performance.now() - startTimeRef.current);
      const isPersonalBest = reactionBestMs === null || ms < reactionBestMs;
      setReactionMs(ms);
      setAttempts((a) => [ms, ...a].slice(0, 5));
      setPhase("result");
      if (isPersonalBest) {
        setReactionBestMs(ms);
        playSound("celebrate-tada");
        triggerConfetti();
        setCelebrationType("stars");
        // 🟢 v2 fix: النص يعد بـ +5 نقاط عند كسر أفضل رقم — طبّقنا الوعد فعلياً.
        // awardGameBonus يضيف النقاط بدون أن يُسجّل كـ "إجابة صحيحة".
        if (studentId && students.some((s) => s.id === studentId && !s.isAbsent)) {
          awardGameBonus(studentId, 5, `كسر أفضل رقم في زمن رد الفعل (${ms}ms)`);
        }
      } else {
        playSound("celebrate-clap");
      }
      // Persist the attempt as a GameResult so reports include reaction games.
      if (studentId && students.some((s) => s.id === studentId && !s.isAbsent)) {
        recorder.reset();
        recorder.begin();
        void recorder.ensure({
          sessionId: currentSessionId,
          gameType: "reaction-time",
          gameMode: "individual",
          questionCount: 1,
          configJson: { reactionMs: ms, personalBest: isPersonalBest },
        }).then(() => recorder.finish([{
          studentId,
          studentName,
          pointsEarned: isPersonalBest ? 5 : 0,
          correctCount: 0,
          wrongCount: 0,
          isWinner: isPersonalBest,
        }]));
      }
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    };
  }, []);

  const size = Math.min(360, 360);

  const colors = {
    idle: "#0142A0",
    waiting: "#DA151C",
    ready: "#10b981",
    result: "#0142A0",
    tooSoon: "#92400e",
  };

  const labels = {
    idle: { title: "اضغط للبدء", subtitle: "اختبر سرعة رد فعلك" },
    waiting: { title: "استعد...", subtitle: "انتظر اللون الأخضر" },
    ready: { title: "اضغط الآن!", subtitle: "بسرعة!" },
    result: { title: reactionMs ? `${reactionMs} مللي ثانية` : "", subtitle: "اضغط للمحاولة مرة أخرى" },
    tooSoon: { title: "مبكر جداً!", subtitle: "اضغط للمحاولة مرة أخرى" },
  };

  // ===== Help modal =====
  if (showHelp) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-cyan-950 via-zinc-900 to-zinc-950 overflow-y-auto p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white">طريقة اللعب</h2>
          </div>
          <div className="space-y-3 text-xs text-white/80 leading-relaxed">
            <div className="bg-white/5 rounded-lg p-3 border border-cyan-500/30">
              <div className="font-bold text-cyan-400 mb-1">1. ابدأ</div>
              اضغط على اللوحة لبدء الاختبار.
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-cyan-500/30">
              <div className="font-bold text-cyan-400 mb-1">2. انتظر الأخضر</div>
              تتحول اللوحة حمراء — انتظر حتى تتحول خضراء (1.5-4.5 ثانية عشوائية).
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-cyan-500/30">
              <div className="font-bold text-cyan-400 mb-1">3. اضغط بسرعة</div>
              عند تحولها للأخضر، اضغط في الحال! إذا ضغطت مبكراً تُحتسب محاولة فاشلة.
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-cyan-500/30">
              <div className="font-bold text-cyan-400 mb-1">4. الجائزة</div>
              كل ضربة أسرع من أفضل وقت لك تطلق احتفال نجوم + <span className="text-[#FFD700] font-bold">+5 نقاط</span>.
            </div>
          </div>
          <button
            onClick={() => setShowHelp(false)}
            className="mt-4 w-full bg-cyan-500 hover:bg-cyan-600 text-white py-2 rounded-lg text-sm font-bold transition"
          >
            فهمت! العب الآن
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-cyan-950 via-zinc-900 to-zinc-950 overflow-y-auto">
      <div className="p-3 flex flex-col h-full">
        {/* Title bar */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/50">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">زمن رد الفعل</h2>
              <div className="text-[9px] text-cyan-400/80">اضغط بأسرع ما يمكن</div>
            </div>
          </div>
          <button
            onClick={() => setShowHelp(true)}
            className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 p-1.5 rounded-lg transition"
            title="طريقة اللعب"
          >
            <BookOpen className="w-4 h-4" />
          </button>
        </div>

        {/* 🟢 v2 fix: Student picker (setup only — shown when idle/result/tooSoon) */}
        {phase !== "waiting" && phase !== "ready" && (
          <div className="mb-3">
            <label className="text-[11px] text-white/60 mb-1 block">الطالب</label>
            <input
              value={studentName}
              onChange={(e) => { setStudentName(e.target.value); setStudentId(""); }}
              placeholder="اسم الطالب"
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500/50"
            />
            {students.length > 0 && (
              <>
                <button
                  onClick={() => {
                    // 🟢 v2 fix: picker.pickRandom يعلّم calledInSession داخلياً.
                    const picked = picker.pickRandom(studentId ? [studentId] : []);
                    if (picked) {
                      setStudentName(picked.name);
                      setStudentId(picked.id);
                      playSound("celebrate-spin");
                    }
                  }}
                  className="mt-2 w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition shadow-lg shadow-purple-500/30"
                >
                  <Shuffle className="w-3.5 h-3.5" /> اختر عشوائياً (عادل)
                </button>
                <div className="grid grid-cols-3 gap-1 mt-2 max-h-24 overflow-y-auto">
                  {/* 🟢 v2 fix: فلتر absent */}
                  {filterPresentStudents(students).map((s) => (
                    <button
                      key={s.id}
                      // 🟢 v2 fix: استخدم pickStudentManual لتفعيل calledInSession
                      onClick={() => { const st = pickStudentManual(s.id); if (st) { setStudentName(st.name); setStudentId(st.id); } }}
                      className={cn(
                        "px-2 py-1 rounded text-[10px] transition border",
                        studentId === s.id
                          ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50"
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
        )}

        {/* Best time */}
        {reactionBestMs !== null && (
          <div className="text-white/70 text-[11px] mb-3 flex items-center gap-2 justify-center">
            <Trophy className="w-3.5 h-3.5 text-[#FFD700]" />
            أفضل زمن: <span className="font-bold text-[#FFD700]">{reactionBestMs} مللي ثانية</span>
          </div>
        )}

        {/* Click panel */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <button
            onClick={handleClick}
            className="rounded-3xl flex flex-col items-center justify-center transition-transform active:scale-95 relative overflow-hidden"
            style={{
              width: size,
              height: size,
              backgroundColor: colors[phase],
              cursor: "pointer",
              boxShadow: `0 0 40px ${colors[phase]}80, 0 8px 24px rgba(0,0,0,0.4)`,
            }}
          >
            {phase === "ready" && (
              <div className="absolute inset-0 rounded-3xl border-4 border-white/50 animate-ping" style={{ animationDuration: "0.6s" }} />
            )}
            <div className="text-white text-4xl font-bold mb-2 drop-shadow-lg text-center px-4">
              {labels[phase].title}
            </div>
            <div className="text-white/80 text-base">{labels[phase].subtitle}</div>
            {phase === "ready" && <Clock className="w-12 h-12 text-white mt-4 animate-pulse" />}
          </button>

          {/* Attempts history */}
          {attempts.length > 0 && (
            <div className="mt-4 text-center">
              <div className="text-[10px] text-white/40 mb-1">آخر المحاولات</div>
              <div className="flex gap-1.5 justify-center">
                {attempts.map((a, i) => (
                  <span
                    key={i}
                    className={cn(
                      "px-2 py-1 rounded-md text-[11px] flex items-center gap-1 border",
                      i === 0
                        ? "bg-[#FFD700]/20 text-[#FFD700] border-[#FFD700]/40"
                        : "bg-white/5 text-white/70 border-white/10"
                    )}
                  >
                    <Clock className="w-3 h-3" />
                    {a}ms
                  </span>
                ))}
              </div>
              {attempts.length >= 3 && (
                <div className="text-[10px] text-white/50 mt-2">
                  المتوسط: {Math.round(attempts.reduce((a, b) => a + b, 0) / attempts.length)}ms
                </div>
              )}
            </div>
          )}

          {(phase === "result" || phase === "tooSoon") && (
            <button
              onClick={startGame}
              disabled={!canPlay}
              className="mt-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 disabled:opacity-30 text-white font-bold py-2 px-5 rounded-lg text-xs flex items-center gap-2 transition shadow-lg shadow-cyan-500/30"
            >
              <RotateCcw className="w-3 h-3" /> حاول مرة أخرى
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
