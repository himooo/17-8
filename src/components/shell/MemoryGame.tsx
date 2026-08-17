"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { useShellStore } from "@/lib/shell-store";
import { useGameStudentPicker } from "@/lib/useGameStudentPicker";
import { RotateCcw, Trophy, Zap, Eye, BookOpen, Award, Shuffle, Music, Eye as EyeIcon } from "lucide-react";
import { cn } from "@/lib/utils";
// 🟢 v2 fix: use unified awardGameBonus + pickStudentManual + filterPresentStudents
import { awardGameBonus, pickStudentManual, filterPresentStudents } from "@/lib/game-utils";

import { useGameActivity } from "@/lib/game-activity-context";
import { useGameResultRecorder } from "@/lib/game-result-recorder";

// 🟢 v3 fix: MemoryGame should NOT trigger any TTS (no reading).
// The default `playSound` goes through the smart-audio engine which may
// speak TTS lines for certain sound IDs. Here we play WAV files directly
// via Howl so only the sound effect plays — no voice, no announcements.
let HowlCtor: any = null;
async function getHowl() {
  if (HowlCtor) return HowlCtor;
  try {
    const mod: any = await import("howler");
    HowlCtor = mod.Howl || (mod.default && mod.default.Howl);
  } catch { /* ignore */ }
  return HowlCtor;
}
const wavCache = new Map<string, any>();
async function playWavOnly(path: string) {
  const Howl = await getHowl();
  if (!Howl) return;
  let h = wavCache.get(path);
  if (!h) {
    h = new Howl({ src: [path], volume: 0.7 });
    wavCache.set(path, h);
  }
  h.play();
}
/**
 * MemoryGame v7.0 — 🟢 v3 restructure: merged SimonSaysGame as "audio" mode.
 *
 * Two modes (toggle in setup):
 *   - "visual": 4 colored pads, sounds are secondary cues (old MemoryGame)
 *   - "audio":  4 distinct sounds, pads light up but the cue is the sound
 *             (old SimonSaysGame — now unified here)
 *
 * Why merge? SimonSaysGame was 100% identical in mechanics to MemoryGame —
 * same 4-pad grid, same growing sequence, same best-round tracking.
 * Only the cue modality (visual vs audio) differed. Keeping two files
 * for the same game was wasteful and confusing for the teacher.
 */
const COLORS = [
  { id: 0, bg: "bg-red-500", activeBg: "bg-red-300", name: "أحمر", glow: "#ef4444" },
  { id: 1, bg: "bg-blue-500", activeBg: "bg-blue-300", name: "أزرق", glow: "#3b82f6" },
  { id: 2, bg: "bg-green-500", activeBg: "bg-green-300", name: "أخضر", glow: "#10b981" },
  { id: 3, bg: "bg-yellow-500", activeBg: "bg-yellow-300", name: "أصفر", glow: "#eab308" },
];
// 🟢 v3: Two distinct sound sets so the audio mode feels different from visual mode.
const VISUAL_SOUNDS = ["celebrate-bell", "celebrate-chime", "celebrate-ding-dong", "celebrate-bubble"];
const AUDIO_SOUNDS = ["celebrate-correct-ding", "celebrate-chime-bell", "celebrate-success-bell", "celebrate-magic-chime"];

export function MemoryGame({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<"idle" | "showing" | "input" | "done">("idle");
  const [sequence, setSequence] = useState<number[]>([]);
  const [userInput, setUserInput] = useState<number[]>([]);
  const [activeColor, setActiveColor] = useState<number | null>(null);
  const [round, setRound] = useState(0);
  const [bestRound, setBestRound] = useState<number | null>(null);
  const [studentId, setStudentId] = useState<string>("");
  const [studentName, setStudentName] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  // 🟢 v3: mode toggle — "visual" (old MemoryGame) or "audio" (old SimonSays)
  const [mode, setMode] = useState<"visual" | "audio">("visual");
  const inputBlockedRef = useRef(false);

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

  const students = useShellStore((s) => s.students);
  const currentSessionId = useShellStore((s) => s.currentSessionId);
  const playSound = useShellStore((s) => s.playSound);
  const triggerConfetti = useShellStore((s) => s.triggerConfetti);
  const triggerRedFlash = useShellStore((s) => s.triggerRedFlash);
  const setCelebrationType = useShellStore((s) => s.setCelebrationType);
  // 🟢 v2 fix: removed awardCorrect + recordStudentActivity — replaced by
  // awardGameBonus which doesn't inflate correctAnswers stat.
  const picker = useGameStudentPicker("memory");

  // ===== GameResult persistence (shared recorder) =====
  const recorder = useGameResultRecorder();
  const roundsCompletedRef = useRef(0);
  const awardedPointsRef = useRef(0);

  // Mark this game as active/inactive for mid-game exit confirmation.
  const setGameActive = useGameActivity();

  // Mark the game as "active" while in mid-play so the wrapping GameOverlay
  // asks for confirmation before closing (prevents accidental loss of progress).
  const isGameActive = phase === "showing" || phase === "input";
  useEffect(() => {
    setGameActive(isGameActive);
  }, [isGameActive, setGameActive]);

  // C35 (P2 fix): clear all tracked timeouts on unmount.
  useEffect(() => clearTrackedTimeouts, [clearTrackedTimeouts]);

  // ===== Auto-load student (prefer not-yet-called) =====
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

  const startGame = () => {
    const selectedStudent = students.find((student) => student.id === studentId && !student.isAbsent);
    if (!selectedStudent) return;
    clearTrackedTimeouts();
    inputBlockedRef.current = false;
    roundsCompletedRef.current = 0;
    awardedPointsRef.current = 0;
    recorder.reset();
    recorder.begin();
    const first = Math.floor(Math.random() * 4);
    setSequence([first]);
    setUserInput([]);
    setRound(1);
    setPhase("showing");
    // 🟢 v3 fix: use playWavOnly — no TTS in MemoryGame
    playWavOnly("/sounds/celebrate-spin.wav");
  };

  // Show sequence
  useEffect(() => {
    if (phase !== "showing") return;
    // 🟢 v3: في وضع audio، نزيد مدة العرض ليعتمد الطالب على الصوت أكثر.
    const showDuration = mode === "audio" ? 700 : 500;
    const gapDuration = mode === "audio" ? 400 : 300;
    const sounds = mode === "audio" ? AUDIO_SOUNDS : VISUAL_SOUNDS;
    let i = 0;
    const showNext = () => {
      if (i >= sequence.length) {
        setActiveColor(null);
        setPhase("input");
        return;
      }
      setActiveColor(sequence[i]);
      // 🟢 v3 fix: use playWavOnly — no TTS
      playWavOnly(`/sounds/${sounds[sequence[i]]}.wav`);
      safeTimeout(() => {
        setActiveColor(null);
        i++;
        safeTimeout(showNext, gapDuration);
      }, showDuration);
    };
    safeTimeout(showNext, showDuration);
    return clearTrackedTimeouts;
  }, [phase, sequence, mode, safeTimeout, clearTrackedTimeouts]);

  const handleClick = (colorId: number) => {
    if (phase !== "input" || inputBlockedRef.current) return;
    const newInput = [...userInput, colorId];
    setUserInput(newInput);
    setActiveColor(colorId);
    const sounds = mode === "audio" ? AUDIO_SOUNDS : VISUAL_SOUNDS;
    // 🟢 v3 fix: use playWavOnly — no TTS
    playWavOnly(`/sounds/${sounds[colorId]}.wav`);
    safeTimeout(() => setActiveColor(null), 200);

    if (sequence[newInput.length - 1] !== colorId) {
      inputBlockedRef.current = true;
      setPhase("done");
      // 🟢 v3 fix: use playWavOnly — no TTS
      playWavOnly("/sounds/celebrate-lose.wav");
      triggerRedFlash();
      if (bestRound === null || round - 1 > bestRound) {
        setBestRound(round - 1);
        // 🟢 v3 fix: الاحتفالات فقط في النهاية (done phase) — مش أثناء اللعب.
        // النقاط تُضاف هنا، لكن الـ confetti/celebrationType تُطلق في done phase فقط
        // حتى لا تغطّي على ما يظهر للطالب أثناء التسلسل.
        if (studentId && round - 1 > 0 && students.find((s) => s.id === studentId)) {
          const pts = Math.min(round - 1, 10);
          awardedPointsRef.current += pts;
          awardGameBonus(studentId, pts, `كسر أفضل رقم في الذاكرة (الجولة ${round - 1})`);
        }
      }
      // Persist the round as a GameResult so reports include memory games.
      if (studentId) {
        void recorder.ensure({
          sessionId: currentSessionId,
          gameType: mode === "audio" ? "memory-audio" : "memory",
          gameMode: "individual",
          questionCount: roundsCompletedRef.current,
          configJson: { mode, reachedRound: round },
        }).then(() => recorder.finish([{
          studentId,
          studentName,
          pointsEarned: awardedPointsRef.current,
          correctCount: roundsCompletedRef.current,
          wrongCount: 1,
          isWinner: roundsCompletedRef.current > 0,
        }]));
      }
      return;
    }

    if (newInput.length === sequence.length) {
      inputBlockedRef.current = true;
      roundsCompletedRef.current += 1;
      // 🟢 v3 fix: لا احتفالات أثناء اللعب — فقط صوت تصفيق خفيف
      // 🟢 v3 fix: use playWavOnly — no TTS
      playWavOnly("/sounds/celebrate-clap.wav");
      // 🟢 v2 fix: استبدلنا recordStudentActivity(type:"correct", points:1) بـ
      // awardGameBonus لمنع double-badge.
      if (studentId && students.find((s) => s.id === studentId)) {
        awardedPointsRef.current += 1;
        awardGameBonus(studentId, 1, `إكمال جولة ذاكرة رقم ${round}`);
      }
      // 🟢 v3 fix: أزلنا triggerConfetti + setCelebrationType("stars") هنا
      // لأن الاحتفالات بتغطّي على التسلسل الظاهر للطالب. الاحتفال فقط في النهاية.
      safeTimeout(() => {
        const next = [...sequence, Math.floor(Math.random() * 4)];
        setSequence(next);
        setUserInput([]);
        setRound(round + 1);
        inputBlockedRef.current = false;
        setPhase("showing");
      }, 800);
    }
  };

  const reset = () => {
    clearTrackedTimeouts();
    inputBlockedRef.current = false;
    setPhase("idle");
    setSequence([]);
    setUserInput([]);
    setRound(0);
  };

  // 🟢 v3 fix: الاحتفال ONLY عند الوصول لـ done phase (لو الطالب كسر رقمه).
  // مفيش احتفال أثناء اللعب حتى لا يغطّي على التسلسل الظاهر.
  const prevPhaseRef = useRef<"idle" | "showing" | "input" | "done">("idle");
  useEffect(() => {
    if (prevPhaseRef.current !== "done" && phase === "done") {
      // just entered done phase — fire celebration if a record was broken
      if (bestRound !== null && round - 1 >= bestRound && round > 1) {
        triggerConfetti();
        setCelebrationType("stars");
      }
    }
    prevPhaseRef.current = phase;
  }, [phase, bestRound, round, triggerConfetti, setCelebrationType]);

  // ===== Help modal =====
  if (showHelp) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-pink-950 via-zinc-900 to-zinc-950 overflow-y-auto p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-pink-400" />
            <h2 className="text-base font-bold text-white">طريقة اللعب</h2>
          </div>
          <div className="space-y-3 text-xs text-white/80 leading-relaxed">
            <div className="bg-white/5 rounded-lg p-3 border border-pink-500/30">
              <div className="font-bold text-pink-400 mb-1">1. الطالب</div>
              اختر الطالب (يُحمَّل تلقائياً من المتجر).
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-pink-500/30">
              <div className="font-bold text-pink-400 mb-1">2. شاهد التسلسل</div>
              تظهر الألوان بنمط معين مع أصوات — ركّز وتذكّر الترتيب.
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-pink-500/30">
              <div className="font-bold text-pink-400 mb-1">3. أعد التسلسل</div>
              اضغط على الألوان بنفس الترتيب. كل جولة صحيحة تضيف لوناً جديداً.
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-pink-500/30">
              <div className="font-bold text-pink-400 mb-1">4. المكافأة</div>
              عند كسر أفضل رقم شخصي، يحصل الطالب على <span className="text-[#FFD700] font-bold">نقاط</span> + احتفال نجوم.
            </div>
          </div>
          <button
            onClick={() => setShowHelp(false)}
            className="mt-4 w-full bg-pink-500 hover:bg-pink-600 text-white py-2 rounded-lg text-sm font-bold transition"
          >
            فهمت! العب الآن
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gradient-to-br from-pink-950 via-zinc-900 to-zinc-950 overflow-y-auto">
      <div className="p-3 flex flex-col h-full">
        {/* Title bar */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-600 flex items-center justify-center shadow-lg shadow-pink-500/50">
              {mode === "audio" ? <Music className="w-5 h-5 text-white" /> : <Eye className="w-5 h-5 text-white" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {mode === "audio" ? "الذاكرة الصوتية" : "لعبة الذاكرة"}
              </h2>
              <div className="text-[9px] text-pink-400/80">
                {mode === "audio" ? "استمع وكرّر" : "شاهد وكرّر"}
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowHelp(true)}
            className="text-pink-400 hover:text-pink-300 hover:bg-pink-500/10 p-1.5 rounded-lg transition"
            title="طريقة اللعب"
          >
            <BookOpen className="w-4 h-4" />
          </button>
        </div>

        {/* 🟢 v3: Mode toggle (visual / audio) — replaces separate SimonSaysGame */}
        {phase === "idle" && (
          <div className="mb-3">
            <label className="text-[11px] text-white/60 mb-1 block font-bold">نمط اللعب</label>
            <div className="grid grid-cols-2 gap-1">
              <button
                onClick={() => setMode("visual")}
                className={cn(
                  "px-3 py-2 rounded-md text-xs font-bold border transition flex items-center justify-center gap-1.5",
                  mode === "visual"
                    ? "bg-pink-500 text-white border-pink-400"
                    : "border-white/10 text-white/60 hover:bg-white/10"
                )}
              >
                <EyeIcon className="w-3.5 h-3.5" />
                بصري
                <span className="text-[9px] opacity-70">(ألوان)</span>
              </button>
              <button
                onClick={() => setMode("audio")}
                className={cn(
                  "px-3 py-2 rounded-md text-xs font-bold border transition flex items-center justify-center gap-1.5",
                  mode === "audio"
                    ? "bg-cyan-500 text-white border-cyan-400"
                    : "border-white/10 text-white/60 hover:bg-white/10"
                )}
              >
                <Music className="w-3.5 h-3.5" />
                صوتي
                <span className="text-[9px] opacity-70">(نغمات)</span>
              </button>
            </div>
          </div>
        )}

        {/* Student picker (setup only) */}
        {phase === "idle" && (
          <div className="mb-3">
            <label className="text-[11px] text-white/60 mb-1 block">الطالب</label>
            <input
              value={studentName}
              onChange={(e) => { setStudentName(e.target.value); setStudentId(""); }}
              placeholder="اسم الطالب"
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-pink-500/50"
            />
            {students.length > 0 && (
              <>
                <button
                  onClick={() => {
                    // 🟢 v2 fix: picker.pickRandom يعلّم calledInSession داخلياً،
                    // لا حاجة لـ recordStudentActivity إضافي (كان يُنشئ badge مكرر).
                    const picked = picker.pickRandom(studentId ? [studentId] : []);
                    if (picked) {
                      setStudentName(picked.name);
                      setStudentId(picked.id);
                      playWavOnly("/sounds/celebrate-spin.wav");
                    }
                  }}
                  className="mt-2 w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition shadow-lg shadow-purple-500/30"
                >
                  <Shuffle className="w-3.5 h-3.5" /> اختر عشوائياً (عادل)
                </button>
                <div className="grid grid-cols-3 gap-1 mt-2 max-h-24 overflow-y-auto">
                  {/* 🟢 v2 fix: فلتر absent — الطلاب الغائبون لا يظهرون في الشبكة */}
                  {filterPresentStudents(students).map((s) => (
                    <button
                      key={s.id}
                      // 🟢 v2 fix: استخدم pickStudentManual لتفعيل calledInSession
                      // عند الاختيار اليدوي (نفس منطق picker.pickRandom).
                      onClick={() => { const st = pickStudentManual(s.id); if (st) { setStudentName(st.name); setStudentId(st.id); } }}
                      className={cn(
                        "px-2 py-1 rounded text-[10px] transition border",
                        studentId === s.id
                          ? "bg-pink-500/20 text-pink-300 border-pink-500/50"
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

        {/* HUD */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-white/5 rounded-lg px-3 py-1.5 border border-white/10 text-center">
            <div className="text-[10px] text-white/60">الجولة</div>
            <div className="text-lg font-bold text-pink-400">{round}</div>
          </div>
          {bestRound !== null && (
            <div className="bg-white/5 rounded-lg px-3 py-1.5 border border-white/10 text-center">
              <div className="text-[10px] text-white/60">الأفضل</div>
              <div className="text-lg font-bold text-[#FFD700]">{bestRound}</div>
            </div>
          )}
          <div className="bg-white/5 rounded-lg px-3 py-1.5 border border-white/10 text-center">
            <div className="text-[10px] text-white/60">الحالة</div>
            <div className="text-xs font-bold text-white">
              {phase === "idle" && "جاهز"}
              {phase === "showing" && "شاهد..."}
              {phase === "input" && "كرر!"}
              {phase === "done" && "انتهت"}
            </div>
          </div>
        </div>

        {/* Pads */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="grid grid-cols-2 gap-3" style={{ width: 280, height: 280 }}>
            {COLORS.map((c) => (
              <button
                key={c.id}
                onClick={() => handleClick(c.id)}
                disabled={phase !== "input"}
                className={cn(
                  "rounded-2xl transition-all duration-150 disabled:cursor-not-allowed",
                  activeColor === c.id ? c.activeBg + " scale-95 shadow-lg" : c.bg + " hover:opacity-80",
                  phase === "input" && "cursor-pointer"
                )}
                style={{
                  boxShadow: activeColor === c.id
                    ? `0 0 30px ${c.bg.replace("bg-", "").includes("red") ? "#ef4444" : c.bg.includes("blue") ? "#3b82f6" : c.bg.includes("green") ? "#10b981" : "#eab308"}`
                    : "0 4px 12px rgba(0,0,0,0.4)",
                }}
              />
            ))}
          </div>

          {phase === "idle" && (
            <button
              onClick={startGame}
              disabled={!studentId}
              className="mt-4 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 disabled:opacity-30 text-white font-bold py-2 px-5 rounded-lg text-sm flex items-center gap-2 transition shadow-lg shadow-pink-500/30"
            >
              <Zap className="w-4 h-4" /> ابدأ
            </button>
          )}

          {phase === "done" && (
            <div className="mt-4 text-center">
              <div className="text-5xl mb-2 animate-bounce">🏆</div>
              <div className="text-sm text-white/70 mb-1">وصلت للجولة</div>
              <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-3 flex items-center gap-2 justify-center">
                <Award className="w-4 h-4 text-[#FFD700]" />
                {round}
              </div>
              <button
                onClick={reset}
                className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-bold py-2 px-5 rounded-lg text-xs flex items-center gap-2 transition shadow-lg shadow-red-500/30"
              >
                <RotateCcw className="w-3 h-3" /> مرة أخرى
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
