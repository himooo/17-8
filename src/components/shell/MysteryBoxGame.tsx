"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useShellStore } from "@/lib/shell-store";
import { useGameStudentPicker } from "@/lib/useGameStudentPicker";
import { Gift, Shuffle, BookOpen, Award } from "lucide-react";
import { cn } from "@/lib/utils";
// 🟢 v2 fix: استخدم pickStudentManual + filterPresentStudents
// بدل setParticipantId المباشر + إظهار الغائبين في الشبكة.
import { pickStudentManual, filterPresentStudents } from "@/lib/game-utils";

import { useGameActivity } from "@/lib/game-activity-context";
import { useGameResultRecorder } from "@/lib/game-result-recorder";
/**
 * MysteryBoxGame v6.1 — Redesigned + store students auto-load + award student for prize points.
 */
const BOXES = [
  { id: 0, color: "#0142A0", icon: "🎁" },
  { id: 1, color: "#DA151C", icon: "📦" },
  { id: 2, color: "#10b981", icon: "🎀" },
  { id: 3, color: "#f59e0b", icon: "✨" },
  { id: 4, color: "#a855f7", icon: "💫" },
  { id: 5, color: "#06b6d4", icon: "🎊" },
];

const PRIZES = [
  { type: "gift", text: "بيتزا! 🍕", points: 0, celebration: "gift-rain" },
  { type: "points", text: "10 نقاط! ⭐", points: 10, celebration: "money" },
  { type: "gift", text: "آيس كريم! 🍦", points: 0, celebration: "balloons" },
  { type: "points", text: "5 نقاط! ✨", points: 5, celebration: "confetti" },
  { type: "title", text: "بطل! 🏆", points: 3, celebration: "title-parade" },
  { type: "nothing", text: "حظ أوفر! 🎲", points: 0, celebration: "none" },
];

export function MysteryBoxGame({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<"setup" | "playing" | "reveal">("setup");
  const [participantName, setParticipantName] = useState<string>("");
  const [participantId, setParticipantId] = useState<string>("");
  const [selectedBox, setSelectedBox] = useState<number | null>(null);
  const [prize, setPrize] = useState<typeof PRIZES[0] | null>(null);
  const [revealedBoxes, setRevealedBoxes] = useState<Set<number>>(new Set());
  const [showHelp, setShowHelp] = useState(false);
  const [revealReady, setRevealReady] = useState(false);

  // C35 (P2 fix): track setTimeout IDs for unmount cleanup
  const timeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const selectionLockRef = useRef(false);
  const safeTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timeoutsRef.current.delete(id);
      fn();
    }, ms);
    timeoutsRef.current.add(id);
    return id;
  }, []);
  useEffect(() => () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current.clear();
  }, []);


  const students = useShellStore((s) => s.students);
  const currentSessionId = useShellStore((s) => s.currentSessionId);
  const playSound = useShellStore((s) => s.playSound);
  const triggerConfetti = useShellStore((s) => s.triggerConfetti);
  const setCelebrationType = useShellStore((s) => s.setCelebrationType);
  const awardPoints = useShellStore((s) => s.awardPoints);
  const recordStudentActivity = useShellStore((s) => s.recordStudentActivity);
  const picker = useGameStudentPicker("mystery-box");

  // ===== GameResult persistence (shared recorder — one record per reveal) =====
  const recorder = useGameResultRecorder();

  // Mark this game as active/inactive for mid-game exit confirmation.
  const setGameActive = useGameActivity();

  // Mark the game as "active" while in mid-play so the wrapping GameOverlay
  // asks for confirmation before closing (prevents accidental loss of progress).
  const isGameActive = phase === "playing" || phase === "reveal";
  useEffect(() => {
    setGameActive(isGameActive);
  }, [isGameActive, setGameActive]);

  // ===== Auto-load student from store (prefer not-yet-called) =====
  useEffect(() => {
    if (students.length < 1 || participantName.trim()) return;
    const present = filterPresentStudents(students);
    if (present.length === 0) return;
    const uncalled = present.find((s) => !s.calledInSession);
    const first = uncalled || present[0];
    const timer = window.setTimeout(() => {
      setParticipantName(first.name);
      setParticipantId(first.id);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [participantName, students]);

  const pickRandom = () => {
    if (picker.present.length === 0) return;
    // 🟢 v2 fix: picker.pickRandom يعلّم calledInSession داخلياً، لا حاجة لـ
    // recordStudentActivity إضافي (كان يُنشئ badge "star" مكرر).
    const picked = picker.pickRandom(participantId ? [participantId] : []);
    if (picked) {
      setParticipantName(picked.name);
      setParticipantId(picked.id);
      playSound("celebrate-spin");
    }
  };

  const selectBox = useCallback((boxId: number) => {
    if (phase !== "playing" || selectionLockRef.current || revealedBoxes.has(boxId)) return;
    selectionLockRef.current = true;
    setSelectedBox(boxId);
    const randomPrize = PRIZES[Math.floor(Math.random() * PRIZES.length)];
    setPrize(randomPrize);
    setPhase("reveal");
    playSound("celebrate-drumroll");
    safeTimeout(() => {
      if (randomPrize.celebration !== "none") {
        setCelebrationType(randomPrize.celebration);
        triggerConfetti();
        playSound(randomPrize.type === "gift" ? "celebrate-gift" : randomPrize.type === "points" ? "celebrate-coin-drop" : "celebrate-tada");
        // Award the student if points prize and student is real + record activity
        if (participantId && students.some((s) => s.id === participantId && !s.isAbsent)) {
          // C48 (P1-7 fix): mystery box prize is NOT a correct answer — use awardPoints (not awardCorrect)
          // so correctAnswers stat isn't inflated. Removed redundant recordStudentActivity — awardPoints already credits points.
          if (randomPrize.points > 0) {
            awardPoints(participantId, randomPrize.points);
          }
        }
      } else {
        playSound("celebrate-buzz");
        if (participantId && students.some((s) => s.id === participantId && !s.isAbsent)) {
          // 🟢 v2 fix: "حظ أوفر" ليس خطأ من الطالب — هو مجرد خسارة عشوائية.
          // استبدلنا type:"wrong" بـ type:"points" (نوع محايد لا يلوّث
          // wrongAnswers stat ولا يضيف badge "خطأ").
          recordStudentActivity(participantId, { type: "points", description: "حظ أوفر في صناديق المفاجآت", points: 0 });
        }
      }
      setRevealReady(true);
      // Persist this reveal as a complete luck-game GameResult (participant-only:
      // luck outcomes must not inflate knowledge accuracy stats).
      if (participantId) {
        recorder.reset();
        recorder.begin();
        void recorder.ensure({
          sessionId: currentSessionId,
          gameType: "mystery-box",
          gameMode: "individual",
          questionCount: 1,
          configJson: { boxId, prizeType: randomPrize.type, prizeText: randomPrize.text },
        }).then(() => recorder.finish([{
          studentId: participantId,
          studentName: participantName,
          pointsEarned: randomPrize.points,
          correctCount: 0,
          wrongCount: 0,
          isWinner: randomPrize.type !== "nothing",
        }]));
      }
    }, 1500);
  }, [phase, playSound, setCelebrationType, triggerConfetti, awardPoints, recordStudentActivity, participantId, participantName, students, revealedBoxes, safeTimeout, recorder, currentSessionId]);

  const nextRound = () => {
    if (!revealReady) return;
    selectionLockRef.current = false;
    setRevealReady(false);
    setRevealedBoxes((prev) => new Set([...prev, selectedBox!]));
    setSelectedBox(null);
    setPrize(null);
    setPhase("playing");
  };

  const reset = () => {
    selectionLockRef.current = false;
    setRevealReady(false);
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current.clear();
    setPhase("setup");
    setParticipantName("");
    setParticipantId("");
    setSelectedBox(null);
    setPrize(null);
    setRevealedBoxes(new Set());
  };

  // ===== Help modal =====
  if (showHelp) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-fuchsia-950 via-zinc-900 to-zinc-950 overflow-y-auto p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-fuchsia-400" />
            <h2 className="text-base font-bold text-white">طريقة اللعب</h2>
          </div>
          <div className="space-y-3 text-xs text-white/80 leading-relaxed">
            <div className="bg-white/5 rounded-lg p-3 border border-fuchsia-500/30">
              <div className="font-bold text-fuchsia-400 mb-1">1. الطالب</div>
              اختر طالباً (يُحمَّل تلقائياً من المتجر). يمكن اختياره عشوائياً.
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-fuchsia-500/30">
              <div className="font-bold text-fuchsia-400 mb-1">2. الصناديق</div>
              6 صناديق ملونة. اضغط على صندوق لكشف ما بداخله.
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-fuchsia-500/30">
              <div className="font-bold text-fuchsia-400 mb-1">3. الجائزة</div>
              كل صندوق يحتوي على جائزة عشوائية: هدية، أو نقاط، أو لقب، أو &quot;حظ أوفر&quot;.
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-fuchsia-500/30">
              <div className="font-bold text-fuchsia-400 mb-1">4. المكافأة</div>
              إذا كانت الجائزة نقاطاً، تُضاف فوراً لطالبك + <span className="text-[#FFD700] font-bold">احتفال</span>.
            </div>
          </div>
          <button
            onClick={() => setShowHelp(false)}
            className="mt-4 w-full bg-fuchsia-500 hover:bg-fuchsia-600 text-white py-2 rounded-lg text-sm font-bold transition"
          >
            فهمت! العب الآن
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-fuchsia-950 via-zinc-900 to-zinc-950 overflow-y-auto">
      <div className="p-3 flex flex-col h-full">
        {/* Title bar */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-fuchsia-400 to-purple-600 flex items-center justify-center shadow-lg shadow-fuchsia-500/50">
              <Gift className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">صناديق المفاجآت</h2>
              <div className="text-[9px] text-fuchsia-400/80">افتح واكتشف الجائزة</div>
            </div>
          </div>
          <button
            onClick={() => setShowHelp(true)}
            className="text-fuchsia-400 hover:text-fuchsia-300 hover:bg-fuchsia-500/10 p-1.5 rounded-lg transition"
            title="طريقة اللعب"
          >
            <BookOpen className="w-4 h-4" />
          </button>
        </div>

        {phase === "setup" && (
          <div className="flex-1 space-y-3">
            <div className="text-center text-[11px] text-white/60">اختر طالباً لفتح الصناديق</div>
            <input
              value={participantName}
              onChange={(e) => { setParticipantName(e.target.value); setParticipantId(""); }}
              placeholder="اسم الطالب"
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-fuchsia-500/50"
            />
            {students.length > 0 && (
              <>
                <button
                  onClick={pickRandom}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition shadow-lg shadow-purple-500/30"
                >
                  <Shuffle className="w-3.5 h-3.5" /> اختر عشوائياً
                </button>
                <div className="grid grid-cols-3 gap-1 max-h-24 overflow-y-auto">
                  {/* 🟢 v2 fix: فلتر absent — الطلاب الغائبون لا يظهرون في الشبكة */}
                  {filterPresentStudents(students).map((s) => (
                    <button
                      key={s.id}
                      // 🟢 v2 fix: استخدم pickStudentManual لتفعيل calledInSession
                      // عند الاختيار اليدوي (نفس منطق picker.pickRandom).
                      onClick={() => { const st = pickStudentManual(s.id); if (st) { setParticipantName(st.name); setParticipantId(st.id); } }}
                      className={cn(
                        "px-2 py-1 rounded text-[10px] transition border",
                        participantId === s.id
                          ? "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/50"
                          : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10"
                      )}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </>
            )}
            <button
              onClick={() => {
                if (students.length > 0 && !students.some((student) => student.id === participantId && !student.isAbsent)) return;
                setPhase("playing");
                setRevealReady(false);
                playSound("celebrate-fanfare-short");
              }}
              disabled={!participantName.trim() || (students.length > 0 && !participantId)}
              className="w-full bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 disabled:opacity-30 text-white font-bold py-2 rounded-lg text-xs transition shadow-lg shadow-emerald-500/30"
            >
              ابدأ اللعب
            </button>
          </div>
        )}

        {(phase === "playing" || phase === "reveal") && (
          <div className="flex-1 flex flex-col">
            <div className="text-center mb-3">
              <div className="text-[11px] text-white/60">اللاعب</div>
              <div className="text-lg font-bold text-[#FFD700]">{participantName}</div>
            </div>

            {phase === "playing" && (
              <div className="text-center text-[11px] text-white/60 mb-3">اختر صندوقاً!</div>
            )}

            <div className="grid grid-cols-3 gap-2.5">
              {BOXES.map((box) => {
                const isRevealed = revealedBoxes.has(box.id) || selectedBox === box.id;
                const isThis = selectedBox === box.id;
                return (
                  <button
                    key={box.id}
                    onClick={() => phase === "playing" && !isRevealed && selectBox(box.id)}
                    disabled={isRevealed}
                    className={cn(
                      "aspect-square rounded-2xl flex items-center justify-center text-3xl transition-all",
                      isThis ? "scale-110 ring-4 ring-[#FFD700]" : "",
                      isRevealed && !isThis ? "opacity-30" : "hover:scale-105 cursor-pointer"
                    )}
                    style={{
                      backgroundColor: isRevealed ? "#333" : box.color + "40",
                      border: `2px solid ${box.color}`,
                      boxShadow: isRevealed ? "none" : `0 0 15px ${box.color}50`,
                    }}
                  >
                    {isThis && prize ? (
                      <span className="text-2xl">{prize.text.split(" ").pop()}</span>
                    ) : isRevealed ? (
                      <span className="text-2xl">✓</span>
                    ) : (
                      <span>{box.icon}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {phase === "reveal" && prize && (
              <div className="mt-4 text-center animate-in zoom-in duration-500">
                <div className="text-2xl font-bold mb-2" style={{ color: prize.type === "nothing" ? "#94a3b8" : "#FFD700" }}>
                  {prize.text}
                </div>
                {prize.points > 0 && (
                  <div className="inline-block bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold mb-3 border border-emerald-500/40">
                    +{prize.points} نقطة مُضافة
                  </div>
                )}
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={nextRound}
                    disabled={!revealReady}
                    className="bg-gradient-to-r from-fuchsia-500 to-purple-500 hover:from-fuchsia-600 hover:to-purple-600 disabled:opacity-30 text-white font-bold py-2 px-4 rounded-lg text-xs transition shadow-lg shadow-fuchsia-500/30"
                  >
                    صندوق آخر
                  </button>
                  {revealedBoxes.size >= 5 && (
                    <button
                      onClick={reset}
                      className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-bold py-2 px-4 rounded-lg text-xs transition shadow-lg shadow-red-500/30"
                    >
                      لاعب جديد
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
