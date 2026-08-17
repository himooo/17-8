"use client";

import { useState, useRef, useEffect } from "react";
import { useShellStore } from "@/lib/shell-store";
import { useGameStudentPicker } from "@/lib/useGameStudentPicker";
import { useGameActivity } from "@/lib/game-activity-context";
import { useGameResultRecorder } from "@/lib/game-result-recorder";
import { Dices, RotateCcw, BookOpen, Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";
// 🟢 v2 fix: أضفنا student picker + احتفال "ثعبان العين" مع bonus.
import { awardGameBonus, pickStudentManual, filterPresentStudents } from "@/lib/game-utils";

const DICE_FACES = [
  [{ dx: 50, dy: 50 }],
  [{ dx: 25, dy: 25 }, { dx: 75, dy: 75 }],
  [{ dx: 25, dy: 25 }, { dx: 50, dy: 50 }, { dx: 75, dy: 75 }],
  [{ dx: 25, dy: 25 }, { dx: 75, dy: 25 }, { dx: 25, dy: 75 }, { dx: 75, dy: 75 }],
  [{ dx: 25, dy: 25 }, { dx: 75, dy: 25 }, { dx: 50, dy: 50 }, { dx: 25, dy: 75 }, { dx: 75, dy: 75 }],
  [{ dx: 25, dy: 25 }, { dx: 75, dy: 25 }, { dx: 25, dy: 50 }, { dx: 75, dy: 50 }, { dx: 25, dy: 75 }, { dx: 75, dy: 75 }],
];

/**
 * DiceRollGame v6.1 — Redesigned to match HotPotatoGame aesthetic.
 *
 * How to play:
 * 1. Choose 1-4 dice
 * 2. Press "ارمِ" — dice tumble for 1.5s then settle
 * 3. Total is shown + added to history
 * 4. Doubles (all 6s) trigger a celebration
 */
export function DiceRollGame({ onClose }: { onClose: () => void }) {
  const [rolling, setRolling] = useState(false);
  const [values, setValues] = useState<number[]>([1, 1]);
  // Per-dice rotation while rolling — avoids calling Math.random in render.
  const [rollRotations, setRollRotations] = useState<number[]>([0, 0]);
  const [diceCount, setDiceCount] = useState(2);
  const [history, setHistory] = useState<number[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  // 🟢 v2 fix: state for selected student (was missing — game didn't know who rolls).
  const [studentId, setStudentId] = useState<string>("");
  const [studentName, setStudentName] = useState<string>("");

  const rafRef = useRef<number | null>(null);
  const rollingRef = useRef(false);

  const diceResult = useShellStore((s) => s.diceResult);
  const setDiceResult = useShellStore((s) => s.setDiceResult);
  const playSound = useShellStore((s) => s.playSound);
  // 🟢 v2 fix: effect imports for snake-eyes celebration.
  const triggerConfetti = useShellStore((s) => s.triggerConfetti);
  const setCelebrationType = useShellStore((s) => s.setCelebrationType);
  const students = useShellStore((s) => s.students);
  const currentSessionId = useShellStore((s) => s.currentSessionId);
  // 🟢 v2 fix: unified picker for fair random selection.
  const picker = useGameStudentPicker("dice");

  // ===== GameResult persistence (shared recorder — one record per roll) =====
  const recorder = useGameResultRecorder();

  // Mark this game as active/inactive for mid-game exit confirmation.
  const setGameActive = useGameActivity();

  // Mark the game as "active" while in mid-play so the wrapping GameOverlay
  // asks for confirmation before closing (prevents accidental loss of progress).
  const isGameActive = rolling;
  useEffect(() => {
    setGameActive(isGameActive);
  }, [isGameActive, setGameActive]);

  // 🟢 v2 fix: auto-load first uncalled present student so the game has a
  // roller pre-selected (consistent with other games).
  useEffect(() => {
    if (students.length < 1 || studentName.trim()) return;
    const uncalled = students.find((s) => !s.calledInSession && !s.isAbsent);
    const first = uncalled || students.find((s) => !s.isAbsent);
    if (!first) return;
    const timer = window.setTimeout(() => {
      setStudentName(first.name);
      setStudentId(first.id);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [studentName, students]);
  const selectedPresentStudent = students.some((student) => student.id === studentId && !student.isAbsent);
  const canRoll = students.length === 0 || selectedPresentStudent;

  const roll = () => {
    if (!canRoll || rolling || rollingRef.current) return;
    rollingRef.current = true;
    setRolling(true);
    playSound("celebrate-spin");

    const start = performance.now();
    const duration = 1500;
    const finalValues = Array.from({ length: diceCount }, () => Math.floor(Math.random() * 6) + 1);

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      if (t < 1) {
        setValues(Array.from({ length: diceCount }, () => Math.floor(Math.random() * 6) + 1));
        // Update roll rotations alongside values so the visual wobble is driven
        // by state (not by Math.random in the JSX render body).
        setRollRotations(Array.from({ length: diceCount }, () => Math.random() * 360));
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setValues(finalValues);
        setRollRotations(Array.from({ length: diceCount }, () => 0));
        rollingRef.current = false;
        setRolling(false);
        const total = finalValues.reduce((a, b) => a + b, 0);
        setDiceResult({ value: total, rolledAt: new Date().toISOString() });
        setHistory((h) => [total, ...h].slice(0, 5));
        if (total === diceCount * 6) {
          // 🟢 v2 fix: "ثعبان العين" — النص يعد باحتفال خاص لكن لم يكن موجوداً.
          // اطلقنا triggerConfetti + setCelebrationType("stars") + sound + bonus.
          playSound("celebrate-tada");
          triggerConfetti();
          setCelebrationType("stars");
          if (studentId && students.some((s) => s.id === studentId && !s.isAbsent)) {
            awardGameBonus(studentId, 5, "ثعبان العين في زهر النرد");
          }
        } else {
          playSound("celebrate-bell");
        }
        // Persist the roll as a luck-game GameResult (participant-only).
        if (studentId && students.some((s) => s.id === studentId && !s.isAbsent)) {
          recorder.reset();
          recorder.begin();
          void recorder.ensure({
            sessionId: currentSessionId,
            gameType: "dice-roll",
            gameMode: "individual",
            questionCount: 1,
            configJson: { diceCount, values: finalValues, total },
          }).then(() => recorder.finish([{
            studentId,
            studentName,
            pointsEarned: total === diceCount * 6 ? 5 : 0,
            correctCount: 0,
            wrongCount: 0,
            isWinner: total === diceCount * 6,
          }]));
        }
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rollingRef.current = false;
    };
  }, [diceCount]);

  const diceSize = 90;

  // ===== Help modal =====
  if (showHelp) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-emerald-950 via-zinc-900 to-zinc-950 overflow-y-auto p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">طريقة اللعب</h2>
          </div>
          <div className="space-y-3 text-xs text-white/80 leading-relaxed">
            <div className="bg-white/5 rounded-lg p-3 border border-emerald-500/30">
              <div className="font-bold text-emerald-400 mb-1">1. عدد الأحجار</div>
              اختر من 1 إلى 4 أحجار نرد.
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-emerald-500/30">
              <div className="font-bold text-emerald-400 mb-1">2. ارمِ</div>
              اضغط على &quot;ارمِ&quot; — تتقلب الأحجار لمدة 1.5 ثانية ثم تستقر.
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-emerald-500/30">
              <div className="font-bold text-emerald-400 mb-1">3. النتيجة</div>
              يظهر مجموع الأحجار ويُحفظ في آخر النتائج (آخر 5 محاولات).
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-emerald-500/30">
              <div className="font-bold text-emerald-400 mb-1">4. احتفال</div>
              إذا كانت كل الأحجار على الوجه 6 (ثعبان العين) يطلق احتفال خاص.
            </div>
          </div>
          <button
            onClick={() => setShowHelp(false)}
            className="mt-4 w-full bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-lg text-sm font-bold transition"
          >
            فهمت! العب الآن
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-emerald-950 via-zinc-900 to-zinc-950 overflow-y-auto">
      <div className="p-3 flex flex-col h-full">
        {/* Title bar */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-600 flex items-center justify-center shadow-lg shadow-emerald-500/50">
              <Dices className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">زهر النرد</h2>
              <div className="text-[9px] text-emerald-400/80">ارمِ واحسب</div>
            </div>
          </div>
          <button
            onClick={() => setShowHelp(true)}
            className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 p-1.5 rounded-lg transition"
            title="طريقة اللعب"
          >
            <BookOpen className="w-4 h-4" />
          </button>
        </div>

        {/* 🟢 v2 fix: Student picker (setup only — shown when not rolling) */}
        {!rolling && (
          <div className="mb-3">
            <label className="text-[11px] text-white/60 mb-1 block">الطالب الرامي</label>
            <input
              value={studentName}
              onChange={(e) => { setStudentName(e.target.value); setStudentId(""); }}
              placeholder="اسم الطالب"
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500/50"
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
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
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

        {/* Dice count selector */}
        <div className="text-[11px] text-white/60 mb-1 text-center">عدد الأحجار</div>
        <div className="flex gap-1.5 mb-4 justify-center">
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              onClick={() => {
                setDiceCount(n);
                setValues(Array.from({ length: n }, () => 1));
                setRollRotations(Array.from({ length: n }, () => 0));
              }}
              disabled={rolling}
              className={`w-9 h-9 rounded-md font-bold text-xs transition ${
                diceCount === n
                  ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/30"
                  : "bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        {/* Dice display */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="flex gap-3 mb-4 flex-wrap justify-center">
            {values.map((v, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl flex items-center justify-center relative shadow-2xl"
                style={{
                  width: diceSize,
                  height: diceSize,
                  transform: rolling ? `rotate(${rollRotations[i] ?? 0}deg) scale(0.95)` : "rotate(0deg)",
                  transition: "transform 0.1s",
                  boxShadow: "0 8px 24px rgba(16,185,129,0.4), 0 0 30px rgba(16,185,129,0.2)",
                }}
              >
                <svg width={diceSize * 0.85} height={diceSize * 0.85} viewBox="0 0 100 100">
                  {DICE_FACES[v - 1].map((dot, j) => (
                    <circle key={j} cx={dot.dx} cy={dot.dy} r={8} fill="#0142A0" />
                  ))}
                </svg>
              </div>
            ))}
          </div>

          {/* Total */}
          {!rolling && diceResult && (
            <div className="text-center mb-3">
              <div className="text-white/60 text-xs">المجموع</div>
              <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 drop-shadow-lg">
                {diceResult.value}
              </div>
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div className="mb-4">
              <div className="text-[10px] text-white/40 mb-1 text-center">آخر النتائج</div>
              <div className="flex gap-1.5 justify-center">
                {history.map((h, i) => (
                  <span
                    key={i}
                    className="bg-white/10 text-white/80 px-2 py-1 rounded-md text-[11px] border border-white/10"
                  >
                    {h}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Roll button */}
          <button
            onClick={roll}
            disabled={rolling || !canRoll}
            className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-lg text-sm flex items-center gap-2 transition shadow-lg shadow-emerald-500/30"
          >
            {rolling ? (
              <><RotateCcw className="w-4 h-4 animate-spin" /> جاري الرمي...</>
            ) : (
              <><RotateCcw className="w-4 h-4" /> ارمِ</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
