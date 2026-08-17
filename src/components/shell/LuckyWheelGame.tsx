"use client";

import { useState, useRef, useEffect } from "react";
import { useShellStore } from "@/lib/shell-store";
import { useGameStudentPicker } from "@/lib/useGameStudentPicker";
import { getAllPrizes, type Prize } from "@/lib/data-store";
import { useGameActivity } from "@/lib/game-activity-context";
import { useGameResultRecorder } from "@/lib/game-result-recorder";
import { RotateCcw, Gift, BookOpen, Sparkles, User, Shuffle } from "lucide-react";

/**
 * LuckyWheelGame v6.1 — Redesigned to match HotPotatoGame aesthetic.
 *
 * How to play:
 * 1. Prize wheel is loaded from store (or built-in defaults)
 * 2. Press "ادور العجلة" — wheel spins for 4 seconds
 * 3. The segment at the top pointer wins
 * 4. A celebration fires matching the prize type
 */
export function LuckyWheelGame({ onClose }: { onClose: () => void }) {
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [highlightIdx, setHighlightIdx] = useState<number | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string; calledInSession: boolean } | null>(null);
  const rafRef = useRef<number | null>(null);

  const luckyWheelResult = useShellStore((s) => s.luckyWheelResult);
  const setLuckyWheelResult = useShellStore((s) => s.setLuckyWheelResult);
  const playSound = useShellStore((s) => s.playSound);
  const triggerConfetti = useShellStore((s) => s.triggerConfetti);
  const setCelebrationType = useShellStore((s) => s.setCelebrationType);
  const recordStudentActivity = useShellStore((s) => s.recordStudentActivity);
  const awardPoints = useShellStore((s) => s.awardPoints);
  const currentSessionId = useShellStore((s) => s.currentSessionId);
  const picker = useGameStudentPicker("luckywheel");

  // ===== GameResult persistence (shared recorder — one record per spin) =====
  const recorder = useGameResultRecorder();

  // Live ref so the rAF tick closure reads the CURRENT student (not the one
  // captured when `spin()` was invoked) — fixes prize being recorded on the
  // wrong student (H2 fix). Ref updated in effect (not render body) to satisfy react-hooks/refs.
  const selectedStudentRef = useRef(selectedStudent);

  // Mark this game as active/inactive for mid-game exit confirmation.
  const setGameActive = useGameActivity();

  // Mark the game as "active" while in mid-play so the wrapping GameOverlay
  // asks for confirmation before closing (prevents accidental loss of progress).
  const isGameActive = spinning;
  useEffect(() => {
    setGameActive(isGameActive);
  }, [isGameActive, setGameActive]);
  useEffect(() => { selectedStudentRef.current = selectedStudent; }, [selectedStudent]);

  useEffect(() => {
    getAllPrizes().then((list) => {
      if (list.length === 0) {
        setPrizes([
          { id: "p1", name: "عبقري", color: "#0142A0", points: 5, type: "title", icon: "🧠", createdAt: new Date().toISOString() },
          { id: "p2", name: "بيتزا", color: "#DA151C", points: 0, type: "gift", icon: "🍕", createdAt: new Date().toISOString() },
          { id: "p3", name: "10 نقاط", color: "#10b981", points: 10, type: "points", icon: "⭐", createdAt: new Date().toISOString() },
          { id: "p4", name: "بطل", color: "#f59e0b", points: 3, type: "title", icon: "🏆", createdAt: new Date().toISOString() },
          { id: "p5", name: "آيس كريم", color: "#a855f7", points: 0, type: "gift", icon: "🍦", createdAt: new Date().toISOString() },
          { id: "p6", name: "حظ أوفر", color: "#ec4899", points: 0, type: "nothing", icon: "🎲", createdAt: new Date().toISOString() },
        ]);
      } else {
        setPrizes(list);
      }
    });
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const segmentAngle = 360 / Math.max(prizes.length, 1);

  const spin = () => {
    if (spinning || prizes.length === 0) return;
    setSpinning(true);
    setLuckyWheelResult(null);
    playSound("celebrate-spin");

    // C35 fix: use deferred fair pick — commit only when the spin completes.
    const deferredResult = picker.pickRandomDeferred([]);
    let commitPick: (() => void) | null = null;
    if (deferredResult) {
      const studentObj = { id: deferredResult.student.id, name: deferredResult.student.name, calledInSession: true };
      setSelectedStudent(studentObj);
      // Update ref IMMEDIATELY so the tick callback below (deferred via rAF)
      // sees this student, not whatever `selectedStudent` was before.
      selectedStudentRef.current = studentObj;
      commitPick = deferredResult.commit;
    }

    const targetIdx = Math.floor(Math.random() * prizes.length);
    const targetAngle = 360 * 7 + (360 - targetIdx * segmentAngle - segmentAngle / 2);
    const start = performance.now();
    const duration = 4000;
    const startRot = rotation;

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const currentRot = startRot + (targetAngle - (startRot % 360)) * eased;
      setRotation(currentRot);
      const idxAtTop = Math.floor(((360 - (currentRot % 360)) % 360) / segmentAngle);
      setHighlightIdx(idxAtTop);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setSpinning(false);
        const winner = prizes[targetIdx];
        setLuckyWheelResult({ prizeId: winner.id, name: winner.name, color: winner.color, icon: winner.icon });
        // C35 fix: NOW commit the fair pick (records calledInSession + activity).
        // If the user closed the modal before this line, commitPick was never
        // called, so the student is NOT counted as called.
        if (commitPick) commitPick();
        // Record the prize activity on the CURRENT selected student (read from ref — H2 fix)
        const winningStudent = selectedStudentRef.current;
        if (winningStudent?.id) {
          const prizeDesc = `حصل على جائزة من عجلة الحظ: ${winner.name}`;
          // H3 fix: actually award the points (not just log the activity) when
          // the prize type is "points" — previously these points were never
          // credited to the student.
          if (winner.type === "points" && (winner.points || 0) > 0) {
            awardPoints(winningStudent.id, winner.points);
          }
          recordStudentActivity(winningStudent.id, {
            type: winner.type === "gift" ? "helper" : "star",
            description: prizeDesc,
            // awardPoints above is the only points mutation for wheel rewards.
            points: 0,
          });
          // Persist the spin as a luck-game GameResult (participant-only).
          recorder.reset();
          recorder.begin();
          void recorder.ensure({
            sessionId: currentSessionId,
            gameType: "lucky-wheel",
            gameMode: "individual",
            questionCount: 1,
            configJson: { prizeId: winner.id, prizeName: winner.name, prizeType: winner.type },
          }).then(() => recorder.finish([{
            studentId: winningStudent.id,
            studentName: winningStudent.name,
            pointsEarned: winner.type === "points" ? (winner.points || 0) : 0,
            correctCount: 0,
            wrongCount: 0,
            isWinner: winner.type !== "nothing",
          }]));
        }
        if (winner.type === "nothing") {
          playSound("celebrate-lose");
        } else if (winner.type === "gift") {
          playSound("celebrate-gift");
          setCelebrationType("gift-rain");
          triggerConfetti();
        } else if (winner.type === "points") {
          playSound("celebrate-coin-drop");
          setCelebrationType("money");
          triggerConfetti();
        } else {
          playSound("celebrate-tada");
          setCelebrationType("title-parade");
          triggerConfetti();
        }
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  // Responsive size based on parent (no window access at SSR)
  const size = 320;

  // ===== Help modal =====
  if (showHelp) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-purple-950 via-zinc-900 to-zinc-950 overflow-y-auto p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-purple-400" />
            <h2 className="text-base font-bold text-white">طريقة اللعب</h2>
          </div>
          <div className="space-y-3 text-xs text-white/80 leading-relaxed">
            <div className="bg-white/5 rounded-lg p-3 border border-purple-500/30">
              <div className="font-bold text-purple-400 mb-1">1. الجوائز</div>
              تُحمَّل الجوائز تلقائياً من المتجر (أو جوائز افتراضية إذا لم توجد).
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-purple-500/30">
              <div className="font-bold text-purple-400 mb-1">2. دوران العجلة</div>
              اضغط على زر &quot;ادور العجلة&quot; — تدور العجلة لمدة 4 ثوانٍ ثم تتوقف.
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-purple-500/30">
              <div className="font-bold text-purple-400 mb-1">3. الفائز</div>
              القطعة التي يقف عليها المؤشر العلوي هي الجائزة المربوحة.
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-purple-500/30">
              <div className="font-bold text-purple-400 mb-1">4. الاحتفال</div>
              يحصل الفائز على احتفال يناسب نوع الجائزة (هدايا / نقاط / لقب).
            </div>
          </div>
          <button
            onClick={() => setShowHelp(false)}
            className="mt-4 w-full bg-purple-500 hover:bg-purple-600 text-white py-2 rounded-lg text-sm font-bold transition"
          >
            فهمت! العب الآن
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-purple-950 via-zinc-900 to-zinc-950 overflow-y-auto">
      <div className="p-3 flex flex-col h-full">
        {/* Title bar */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/50">
              <Gift className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">عجلة الحظ</h2>
              <div className="text-[9px] text-purple-400/80">دوّر واربح جائزة</div>
            </div>
          </div>
          <button
            onClick={() => setShowHelp(true)}
            className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 p-1.5 rounded-lg transition"
            title="طريقة اللعب"
          >
            <BookOpen className="w-4 h-4" />
          </button>
        </div>

        {/* Selected student + pick button */}
        {picker.present.length > 0 && (
          <div className="mb-3 flex items-center justify-center gap-2">
            {selectedStudent ? (
              <div className="bg-white/5 border border-white/10 rounded-full px-3 py-1.5 flex items-center gap-2">
                <User className="w-4 h-4 text-purple-400" />
                <span className="text-white text-xs font-bold">{selectedStudent.name}</span>
                {selectedStudent.calledInSession && (
                  <span className="bg-emerald-500/20 text-emerald-400 text-[9px] px-1.5 py-0.5 rounded-full font-bold">✓ تم استدعاؤهم</span>
                )}
              </div>
            ) : (
              <span className="text-white/50 text-[10px]">سيتم اختيار طالب عشوائياً عند الدوران</span>
            )}
            <button
              onClick={() => {
                const picked = picker.pickRandom([]);
                if (picked) {
                  setSelectedStudent({ id: picked.id, name: picked.name, calledInSession: true });
                  playSound("celebrate-spin");
                }
              }}
              disabled={spinning}
              className="text-[10px] bg-purple-500/30 hover:bg-purple-500/50 text-purple-200 px-2 py-1 rounded-md flex items-center gap-1 transition disabled:opacity-30"
            >
              <Shuffle className="w-3 h-3" /> اختر طالباً
            </button>
          </div>
        )}

        {/* Wheel */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="relative" style={{ width: size, height: size }}>
            {/* Glow under wheel */}
            <div
              className="absolute inset-0 rounded-full blur-2xl opacity-60 animate-pulse"
              style={{ background: "radial-gradient(circle, rgba(168,85,247,0.6), transparent 70%)" }}
            />
            {/* Pointer */}
            <div className="absolute left-1/2 -translate-x-1/2 -translate-y-2 z-20" style={{ top: -10 }}>
              <div
                className="w-0 h-0"
                style={{
                  borderLeft: "16px solid transparent",
                  borderRight: "16px solid transparent",
                  borderTop: "28px solid #FFD700",
                  filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
                }}
              />
            </div>

            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              className="relative z-10"
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: spinning ? "none" : "transform 0.1s ease-out",
                filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.6))",
              }}
            >
              {prizes.map((p, i) => {
                const startAngle = (i * segmentAngle - 90) * (Math.PI / 180);
                const endAngle = ((i + 1) * segmentAngle - 90) * (Math.PI / 180);
                const r = size / 2 - 4;
                const cx = size / 2;
                const cy = size / 2;
                const x1 = cx + r * Math.cos(startAngle);
                const y1 = cy + r * Math.sin(startAngle);
                const x2 = cx + r * Math.cos(endAngle);
                const y2 = cy + r * Math.sin(endAngle);
                const largeArc = segmentAngle > 180 ? 1 : 0;
                const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
                const midAngle = (startAngle + endAngle) / 2;
                const textR = r * 0.65;
                const tx = cx + textR * Math.cos(midAngle);
                const ty = cy + textR * Math.sin(midAngle);
                const textRotation = i * segmentAngle + segmentAngle / 2;
                return (
                  <g key={p.id}>
                    <path d={path} fill={p.color} stroke="white" strokeWidth={2} opacity={highlightIdx === i && spinning ? 1 : 0.9} />
                    <text x={tx} y={ty - 8} fill="white" fontSize={size / 14} textAnchor="middle" dominantBaseline="middle" transform={`rotate(${textRotation} ${tx} ${ty})`} style={{ pointerEvents: "none" }}>
                      {p.icon || "⭐"}
                    </text>
                    <text x={tx} y={ty + 14} fill="white" fontSize={Math.max(11, size / 38)} fontWeight="bold" textAnchor="middle" dominantBaseline="middle" transform={`rotate(${textRotation} ${tx} ${ty})`} style={{ pointerEvents: "none" }}>
                      {p.name.length > 8 ? p.name.slice(0, 7) + "…" : p.name}
                    </text>
                  </g>
                );
              })}
              <circle cx={size / 2} cy={size / 2} r={size / 12} fill="white" stroke="#FFD700" strokeWidth={3} />
              <text x={size / 2} y={size / 2} fill="#FFD700" fontSize={size / 16} fontWeight="bold" textAnchor="middle" dominantBaseline="middle" style={{ pointerEvents: "none" }}>
                🎁
              </text>
            </svg>
          </div>

          {/* Result */}
          {luckyWheelResult && !spinning && (
            <div className="mt-4 text-center animate-in fade-in zoom-in duration-500">
              <div className="text-white/70 text-xs mb-1">الجائزة</div>
              <div
                className="text-2xl font-bold mb-1 flex items-center gap-2 justify-center"
                style={{ color: luckyWheelResult.color }}
              >
                <span className="text-4xl">{luckyWheelResult.icon || "🎁"}</span>
                {luckyWheelResult.name}
              </div>
            </div>
          )}

          {/* Action button */}
          <button
            onClick={spin}
            disabled={spinning}
            className="mt-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 text-white font-bold py-2 px-6 rounded-lg text-sm flex items-center gap-2 transition shadow-lg shadow-purple-500/30"
          >
            {spinning ? (
              <><Sparkles className="w-4 h-4 animate-pulse" /> جاري الدوران...</>
            ) : (
              <><RotateCcw className="w-4 h-4" /> {luckyWheelResult ? "أعد الحظ" : "ادور العجلة"}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
