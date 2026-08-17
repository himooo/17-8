"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { useShellStore } from "@/lib/shell-store";
import type { GameType } from "@/lib/slide-schema";
import {
  ArrowRight,
  ArrowLeft,
  Trophy,
  Award,
  X,
  Shuffle,
  Star,
  Medal,
  Sparkles,
  Heart,
  PartyPopper,
  XCircle,
  CheckCircle2,
  Clock,
  Pause,
  Play,
  BarChart3,
  Dices,
  Gift,
  Brain,
  Zap,
  Users,
  Calculator,
  Eye,
  Disc,
  Bomb,
  Music,
  RotateCcw,
  Swords,
  Square,
  FileText,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { playSmartSound } from "@/lib/smart-audio";
import { BisalasaLogo } from "./BisalasaLogo";
import { AwardedGiftDisplay } from "./AwardedGiftDisplay";
import { StudentCard } from "./StudentCard";
import { GameOverlay } from "./GameOverlay";

// Performance: game code is not part of the first teacher-shell chunk. Each
// game is fetched only after the teacher opens that game/overlay. This keeps
// the initial canvas responsive on low-memory classroom machines.
function GameLoading() {
  return <div className="flex min-h-24 items-center justify-center text-xs text-white/60">جارٍ تحميل اللعبة…</div>;
}
const RandomStudentWheel = dynamic(() => import("./RandomStudentWheel").then((m) => m.RandomStudentWheel), { ssr: false, loading: GameLoading });
const ClassLeaderboardView = dynamic(() => import("./ClassLeaderboardView").then((m) => m.ClassLeaderboardView), { ssr: false, loading: GameLoading });
const LuckyWheelGame = dynamic(() => import("./LuckyWheelGame").then((m) => m.LuckyWheelGame), { ssr: false, loading: GameLoading });
const QuizShowGame = dynamic(() => import("./QuizShowGame").then((m) => m.QuizShowGame), { ssr: false, loading: GameLoading });
const DiceRollGame = dynamic(() => import("./DiceRollGame").then((m) => m.DiceRollGame), { ssr: false, loading: GameLoading });
const ReactionTimeGame = dynamic(() => import("./ReactionTimeGame").then((m) => m.ReactionTimeGame), { ssr: false, loading: GameLoading });
const MathChallengeGame = dynamic(() => import("./MathChallengeGame").then((m) => m.MathChallengeGame), { ssr: false, loading: GameLoading });
const MemoryGame = dynamic(() => import("./MemoryGame").then((m) => m.MemoryGame), { ssr: false, loading: GameLoading });
const CelebrationsPanel = dynamic(() => import("./CelebrationsPanel").then((m) => m.CelebrationsPanel), { ssr: false, loading: GameLoading });
const QuestionChallengeGame = dynamic(() => import("./QuestionChallengeGame").then((m) => m.QuestionChallengeGame), { ssr: false, loading: GameLoading });
const MysteryBoxGame = dynamic(() => import("./MysteryBoxGame").then((m) => m.MysteryBoxGame), { ssr: false, loading: GameLoading });
const QuickFireGame = dynamic(() => import("./QuickFireGame").then((m) => m.QuickFireGame), { ssr: false, loading: GameLoading });
const WeeklyChallenge = dynamic(() => import("./WeeklyChallenge").then((m) => m.WeeklyChallenge), { ssr: false, loading: GameLoading });
// 🟢 v3 restructure: removed SpinBottleGame, GiftRainGame, TugOfWarGame (Phase 1).

/**
 * BottomControlBar v10.0
 *
 * الجديد:
 * - شعار بسلاسة على اليمين
 * - مؤقت الجلسة مدمج (inline)
 * - زر لوحة المتصدرين
 * - زر عشوائي = يفتح عجلة (وليس اختيار مباشر)
 * - أزرار الألعاب (عجلة الحظ، زهر، رد فعل، شد حبل، مسابقة)
 * - أزرار التقييم للطالب المختار
 * - أزرار الاحتفال السريعة
 * - زر واحد للنجاح/الخطأ فقط (بدون تكرار أصوات)
 */
export function BottomControlBar() {
  const nextStep = useShellStore((s) => s.nextStep);
  const prevStep = useShellStore((s) => s.prevStep);
  const currentStep = useShellStore((s) => s.currentStep);
  const manifest = useShellStore((s) => s.manifest);
  const currentIdeaId = useShellStore((s) => s.currentIdeaId);

  // For random pick via wheel
  const [showWheel, setShowWheel] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showLuckyWheel, setShowLuckyWheel] = useState(false);
  const [showDice, setShowDice] = useState(false);
  const [showReaction, setShowReaction] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  // v11: ألعاب جديدة
  const [showMath, setShowMath] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  // v18: تحدي الأسئلة من المنهج (المظلة الموحدة بعد الدمج)
  const [showQuestionChallenge, setShowQuestionChallenge] = useState(false);
  const [showMysteryBox, setShowMysteryBox] = useState(false);
  // v21: المزيد من الألعاب + كارت الطالب
  const [showQuickFire, setShowQuickFire] = useState(false);
  const [showGiftPickerForCalled, setShowGiftPickerForCalled] = useState(false);
  const [showPrizePickerForCalled, setShowPrizePickerForCalled] = useState(false);
  const [availableGifts, setAvailableGifts] = useState<any[]>([]);
  const [availablePrizes, setAvailablePrizes] = useState<any[]>([]);
  const [showStudentCard, setShowStudentCard] = useState(false);
  // 🟢 v3 restructure: قائمة الألعاب المجمعة — الآن 4 فئات فقط:
  //   1. curriculum — ألعاب أسئلة المنهج
  //   2. memory    — ألعاب الذاكرة
  //   3. luck      — ألعاب الحظ والتحفيز
  //   4. tools     — أدوات (نرد، رد فعل، عجلة طالب)
  const [showGameMenu, setShowGameMenu] = useState<"curriculum" | "memory" | "luck" | "tools" | null>(null);
  // v11: لوحة الاحتفالات
  const [showCelebrations, setShowCelebrations] = useState(false);
  // P2-13: التحدي الأسبوعي
  const [showWeeklyChallenge, setShowWeeklyChallenge] = useState(false);

  const currentlyCalledStudent = useShellStore((s) => s.currentlyCalledStudent);
  const recordStudentActivity = useShellStore((s) => s.recordStudentActivity);
  const awardGiftToStudentStore = useShellStore((s) => s.awardGiftToStudent);
  const awardCorrect = useShellStore((s) => s.awardCorrect);
  const awardWrong = useShellStore((s) => s.awardWrong);
  const awardGoodTry = useShellStore((s) => s.awardGoodTry);
  const awardPoints = useShellStore((s) => s.awardPoints);
  const setStudentTitle = useShellStore((s) => s.setStudentTitle);
  const awardBadge = useShellStore((s) => s.awardBadge);
  const triggerConfetti = useShellStore((s) => s.triggerConfetti);
  const triggerRedFlash = useShellStore((s) => s.triggerRedFlash);
  const triggerGreenFlash = useShellStore((s) => s.triggerGreenFlash);
  const playSound = useShellStore((s) => s.playSound);
  const students = useShellStore((s) => s.students);
  const activeClassId = useShellStore((s) => s.activeClassId);
  const currentSessionId = useShellStore((s) => s.currentSessionId);
  const setActiveGame = useShellStore((s) => s.setActiveGame);
  const rewardActionRef = useRef<string | null>(null);
  const rewardActionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // إصلاح #6: زر إلغاء اختيار الطالب الحالي
  const clearCurrentStudent = useShellStore((s) => s.clearCurrentStudent);

  // Inline Session Timer: tied to the active lesson session, not component mount.
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [sessionPaused, setSessionPaused] = useState(false);
  useEffect(() => {
    const resetTimer = window.setTimeout(() => {
      setSessionSeconds(0);
      setSessionPaused(false);
    }, 0);
    return () => window.clearTimeout(resetTimer);
  }, [currentSessionId]);
  useEffect(() => {
    if (!currentSessionId || sessionPaused) return;
    const interval = setInterval(() => setSessionSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [currentSessionId, sessionPaused]);
  useEffect(() => () => {
    if (rewardActionTimerRef.current !== null) clearTimeout(rewardActionTimerRef.current);
  }, []);

  const beginRewardAction = (action: string) => {
    if (!currentlyCalledStudent) return false;
    const key = `${currentlyCalledStudent.id}:${action}`;
    if (rewardActionRef.current === key) return false;
    rewardActionRef.current = key;
    if (rewardActionTimerRef.current !== null) clearTimeout(rewardActionTimerRef.current);
    rewardActionTimerRef.current = setTimeout(() => {
      if (rewardActionRef.current === key) rewardActionRef.current = null;
      rewardActionTimerRef.current = null;
    }, 600);
    return true;
  };

  // Bottom overlays are mutually exclusive. Without this guard, rapid clicks on
  // weekly/leaderboard/card/celebrations (or a game category) stack several
  // fixed dialogs and make the top controls unreachable.
  // C33 fix (2026-AUG): confirm before closing an active game to prevent
  // losing unsaved progress (e.g., mid-question state, un-recorded answers).
  const closeBottomOverlays = useCallback((): boolean => {
    // If a game is active, ask for confirmation before closing.
    const isActive = useShellStore.getState().gameActivityActive;
    if (isActive) {
      const confirmed = window.confirm("هناك لعبة قيد التشغيل. هل تريد الخروج؟ سيُفقد التقدم غير المحفوظ.");
      if (!confirmed) return false;
    }
    setShowWheel(false);
    setShowLeaderboard(false);
    setShowLuckyWheel(false);
    setShowDice(false);
    setShowReaction(false);
    setShowQuiz(false);
    setShowMath(false);
    setShowMemory(false);
    setShowCelebrations(false);
    setShowWeeklyChallenge(false);
    setShowQuestionChallenge(false);
    setShowMysteryBox(false);
    setShowQuickFire(false);
    setShowStudentCard(false);
    setShowGiftPickerForCalled(false);
    setShowPrizePickerForCalled(false);
    setShowGameMenu(null);
    setActiveGame(null);
    return true;
  }, [setActiveGame]);

  // Listen for keyboard shortcuts and escape
  useEffect(() => {
    const handler = () => {
      closeBottomOverlays();
      setShowWheel(true);
      playSound("click");
    };
    window.addEventListener("open-student-wheel", handler);
    // Escape closes all overlays
    // P1-8 fix: added 10 missing overlays that Escape didn't close before.
    // 🟢 v3 restructure: removed TugOfWar, SpinBottle, SimonSays, GroupBattle, DuelQuiz, GiftRain (deleted/merged)
    const closeAll = () => {
      setShowWheel(false);
      setShowLeaderboard(false);
      setShowLuckyWheel(false);
      setShowDice(false);
      setShowReaction(false);
      setShowQuiz(false);
      setShowMath(false);
      setShowMemory(false);
      setShowCelebrations(false);
      setShowWeeklyChallenge(false);
      setShowQuestionChallenge(false);
      setShowMysteryBox(false);
      setShowQuickFire(false);
      setShowStudentCard(false);
      setShowGiftPickerForCalled(false);
      setShowPrizePickerForCalled(false);
      setShowGameMenu(null);
      setActiveGame(null);
    };
    window.addEventListener("close-all-overlays", closeAll);
    return () => {
      window.removeEventListener("open-student-wheel", handler);
      window.removeEventListener("close-all-overlays", closeAll);
    };
  }, [closeBottomOverlays, playSound, setActiveGame]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // Calculate total steps based on current idea
  const totalSteps = (() => {
    if (!manifest) return 0;
    if (manifest.ideas && manifest.ideas.length > 0 && currentIdeaId) {
      const idea = manifest.ideas.find((i) => i.id === currentIdeaId);
      return idea?.steps.length || 0;
    }
    return manifest.totalSteps || manifest.steps?.length || 0;
  })();

  const canGoNext = (() => {
    if (!manifest) return false;
    if (manifest.ideas && manifest.ideas.length > 0 && currentIdeaId) {
      const currentIdx = manifest.ideas.findIndex((i) => i.id === currentIdeaId);
      const isLastStepInIdea = currentStep >= totalSteps;
      const isLastIdea = currentIdx >= manifest.ideas.length - 1;
      return !(isLastStepInIdea && isLastIdea);
    }
    return currentStep < totalSteps;
  })();

  const canGoPrev = (() => {
    if (!manifest) return false;
    if (currentStep > 1) return true;
    if (manifest.ideas && manifest.ideas.length > 0 && currentIdeaId) {
      const currentIdx = manifest.ideas.findIndex((i) => i.id === currentIdeaId);
      return currentIdx > 0;
    }
    return false;
  })();

  // Random = open wheel (not direct pick)
  const handleRandomPick = () => {
    closeBottomOverlays();
    setShowWheel(true);
    playSound("click");
  };

  // ===== Reward handlers =====
  // إصلاح: إزالة playSmartSound لأن awardCorrect/awardWrong/etc تستدعي announce()
  // تلقائياً عبر tts-announcer. هذا يمنع التداخل الصوتي المزدوج.
  const handleCorrect = () => {
    const student = currentlyCalledStudent;
    if (!student || !beginRewardAction("correct")) return;
    awardCorrect(student.id, 3);
    triggerConfetti();
    toast.success(`إجابة صحيحة! ${student.name} +3 🏆`);
  };

  const handleGoodTry = () => {
    const student = currentlyCalledStudent;
    if (!student || !beginRewardAction("good-try")) return;
    awardGoodTry(student.id);
    triggerGreenFlash();
    toast.info(`محاولة جيدة! ${student.name} +1 ⭐`);
  };

  const handleWrong = () => {
    const student = currentlyCalledStudent;
    if (!student || !beginRewardAction("wrong")) return;
    awardWrong(student.id);
    triggerRedFlash();
    toast.error(`إجابة خاطئة - ${student.name}`);
  };

  const handleStar = () => {
    const student = currentlyCalledStudent;
    if (!student || !beginRewardAction("star")) return;
    awardPoints(student.id, 5);
    awardBadge(student.id, "star");
    triggerConfetti();
    toast.success(`نجمة! ${student.name} +5 ✨`);
  };

  const handleGold = () => {
    const student = currentlyCalledStudent;
    if (!student || !beginRewardAction("gold")) return;
    awardPoints(student.id, 10);
    awardBadge(student.id, "fast");
    triggerConfetti();
    toast.success(`مكافأة ذهبية! ${student.name} +10 🥇`);
  };

  const handleCreative = () => {
    const student = currentlyCalledStudent;
    if (!student || !beginRewardAction("creative")) return;
    awardPoints(student.id, 7);
    awardBadge(student.id, "creative");
    triggerGreenFlash();
    toast.success(`تفكير إبداعي! ${student.name} +7 🎨`);
  };

  const handleHelper = () => {
    const student = currentlyCalledStudent;
    if (!student || !beginRewardAction("helper")) return;
    awardPoints(student.id, 4);
    awardBadge(student.id, "helper");
    playSound("click");
    toast.info(`مساعدة زملاء! ${student.name} +4 🤝`);
  };

  // ===== Gift + Prize handlers (new) =====
  // Load gifts + prizes from IndexedDB on mount
  useEffect(() => {
    import("@/lib/data-store").then((m) => {
      m.getAllGifts().then(setAvailableGifts);
      m.getAllPrizes().then(setAvailablePrizes);
    });
  }, []);

  const handleAwardGiftToCalled = (gift: any) => {
    const student = currentlyCalledStudent;
    if (!student || !beginRewardAction(`gift:${gift.id}`)) return;
    // One authoritative path owns persistence, activity logging, announcement,
    // and the display overlay. Calling data-store + recordStudentActivity here
    // used to create duplicate gifts, activities, and sounds.
    awardGiftToStudentStore(student.id, student.name, gift.id, gift.name, gift.image);
    toast.success(`🎁 ${student.name} حصل على ${gift.name}!`);
    setShowGiftPickerForCalled(false);
  };

  const handleAwardPrizeToCalled = (prize: any) => {
    const student = currentlyCalledStudent;
    if (!student || !beginRewardAction(`prize:${prize.id}`)) return;
    // Award prize points + record activity
    if (prize.points > 0) {
      awardPoints(student.id, prize.points);
    }
    // If prize is a title, set it
    if (prize.type === "title") {
      setStudentTitle(student.id, prize.name);
    }
    // Record activity on student profile
    recordStudentActivity(student.id, {
      type: "star",
      description: `جائزة: ${prize.name} (${prize.points} نقطة)`,
      // awardPoints above is the sole point mutation; this call only adds the badge.
      points: 0,
    });
    playSound("celebrate-tada");
    triggerConfetti();
    toast.success(`🏆 ${student.name} حصل على جائزة: ${prize.name}!`);
    setShowPrizePickerForCalled(false);
  };

  // Open a game (legacy dispatcher — kept for keyboard shortcuts)
  // 🟢 v3 restructure: trimmed to surviving games only.
  const openGame = (game: "lucky" | "dice" | "reaction" | "quiz" | "math" | "memory") => {
    closeBottomOverlays();
    playSound("click");
    const gameMap: Record<string, GameType> = {
      lucky: "lucky-wheel",
      dice: "dice",
      reaction: "reaction",
      quiz: "quiz-show",
      math: "math-challenge",
      memory: "memory",
    };
    setActiveGame(gameMap[game] || null);
    if (game === "lucky") setShowLuckyWheel(true);
    if (game === "dice") setShowDice(true);
    if (game === "reaction") setShowReaction(true);
    if (game === "quiz") setShowQuiz(true);
    if (game === "math") setShowMath(true);
    if (game === "memory") setShowMemory(true);
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-card/95 backdrop-blur-md border-t border-border shadow-lg">
        <div
          className="flex items-center gap-2 px-3 py-2 overflow-x-auto"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(100,116,139,0.5) transparent",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {/* ===== Logo (يمين) ===== */}
          <div className="flex items-center gap-2 shrink-0 pl-2 border-l border-border">
            <BisalasaLogo size={28} showText={false} />
          </div>

          {/* ===== Session (سجل الجلسات في SQLite) ===== */}
          <SessionControls />

          {/* ===== Session Timer (inline) ===== */}
          <div className="flex items-center gap-1 bg-secondary/50 rounded-lg px-2 py-1 shrink-0">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-mono font-bold text-primary tabular-nums">
              {formatTime(sessionSeconds)}
            </span>
            <button
              onClick={() => {
                setSessionPaused(!sessionPaused);
                playSound("click");
              }}
              className="text-muted-foreground hover:text-foreground"
              title={sessionPaused ? "استئناف" : "إيقاف مؤقت"}
            >
              {sessionPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            </button>
            <button
              onClick={() => {
                setSessionSeconds(0);
                setSessionPaused(false);
                playSound("click");
              }}
              className="text-muted-foreground hover:text-red-400"
              title="إعادة التايمر"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          {/* ===== Navigation ===== */}
          <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-0.5 shrink-0">
            <ToolButton
              onClick={prevStep}
              disabled={!canGoPrev}
              title="الخطوة السابقة (←)"
              style={{ opacity: canGoPrev ? 1 : 0.4 }}
            >
              <ArrowRight className="w-4 h-4" />
            </ToolButton>
            <div className="text-[10px] font-mono px-2 text-center min-w-[60px]">
              <div className="font-bold text-primary">
                {manifest ? `${currentStep} / ${totalSteps}` : "—"}
              </div>
              <div className="text-muted-foreground text-[9px]">الخطوة</div>
            </div>
            <ToolButton
              onClick={nextStep}
              disabled={!canGoNext}
              title="الخطوة التالية (→ / Space)"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              style={{ opacity: canGoNext ? 1 : 0.4 }}
            >
              <ArrowLeft className="w-4 h-4" />
            </ToolButton>
          </div>

          {/* ===== Random Student Wheel ===== */}
          <button
            className="tool-btn bg-primary text-primary-foreground hover:bg-primary/90 gap-1 px-3 shrink-0"
            style={{ width: "auto" }}
            onClick={handleRandomPick}
            title="عجلة الطلاب العشوائية (R)"
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span className="text-xs">عجلة الطلاب</span>
          </button>

          {/* ===== Student evaluation buttons (shown when a student is called) ===== */}
          {currentlyCalledStudent && (
            <div className="flex items-center gap-0.5 bg-primary/5 border border-primary/30 rounded-lg p-0.5 animate-fade-in shrink-0">
              <span className="text-[11px] font-bold text-primary px-2 max-w-[120px] truncate">
                {currentlyCalledStudent.name}
              </span>

              <RewardBtn
                onClick={handleCorrect}
                title="إجابة صحيحة (+3)"
                color="#10b981"
                icon={<Trophy className="w-3.5 h-3.5" />}
                label="+3"
              />
              <RewardBtn
                onClick={handleGoodTry}
                title="محاولة جيدة (+1)"
                color="#f59e0b"
                icon={<Award className="w-3.5 h-3.5" />}
                label="+1"
              />
              <RewardBtn
                onClick={handleStar}
                title="نجمة (+5)"
                color="#a855f7"
                icon={<Star className="w-3.5 h-3.5" />}
                label="+5"
              />
              <RewardBtn
                onClick={handleGold}
                title="مكافأة ذهبية (+10)"
                color="#fbbf24"
                icon={<Medal className="w-3.5 h-3.5" />}
                label="+10"
              />
              <RewardBtn
                onClick={handleCreative}
                title="تفكير إبداعي (+7)"
                color="#06b6d4"
                icon={<Sparkles className="w-3.5 h-3.5" />}
                label="+7"
              />
              <RewardBtn
                onClick={handleHelper}
                title="مساعدة زملاء (+4)"
                color="#ec4899"
                icon={<Heart className="w-3.5 h-3.5" />}
                label="+4"
              />
              <RewardBtn
                onClick={handleWrong}
                title="إجابة خاطئة"
                color="#ef4444"
                icon={<X className="w-3.5 h-3.5" />}
                label="✗"
              />
              {/* Divider */}
              <div className="w-px h-6 bg-border mx-0.5" />
              {/* Gift button */}
              <RewardBtn
                onClick={() => { closeBottomOverlays(); setShowGiftPickerForCalled(true); playSound("click"); }}
                title="🎁 منح هدية"
                color="#ec4899"
                icon={<Gift className="w-3.5 h-3.5" />}
                label="🎁"
              />
              {/* Prize button */}
              <RewardBtn
                onClick={() => { closeBottomOverlays(); setShowPrizePickerForCalled(true); playSound("click"); }}
                title="🏆 منح جائزة"
                color="#fbbf24"
                icon={<Trophy className="w-3.5 h-3.5" />}
                label="🏆"
              />
              {/* Divider */}
              <div className="w-px h-6 bg-border mx-0.5" />
              {/* Deselect current student button (إصلاح #6) */}
              <RewardBtn
                onClick={() => { clearCurrentStudent(); playSound("click"); }}
                title="إلغاء اختيار الطالب الحالي"
                color="#64748b"
                icon={<XCircle className="w-3.5 h-3.5" />}
                label="إلغاء"
              />
            </div>
          )}

          {/* Spacer — absorbs slack; shrinks to 0 first, then horizontal scroll kicks in */}
          <div className="flex-1 min-w-0" />

          {/* ===== Games grouped by type (v3 — 4 categories instead of 4 mixed groups) ===== */}
          <div className="flex items-center gap-0.5 bg-secondary/50 rounded-lg p-0.5 shrink-0">
            {/* 🟢 v3 restructure: 4 فئات واضحة بدل 4 أزرار مكررة */}
            {/* 1. ألعاب المنهج — أعلى قيمة تعليمية */}
            <ToolButton
              onClick={() => { closeBottomOverlays(); setShowGameMenu("curriculum"); playSound("click"); }}
              title="📚 ألعاب المنهج (أسئلة من الدرس)"
              className="hover:bg-blue-500/20 hover:text-blue-400"
            >
              <Brain className="w-3.5 h-3.5" />
            </ToolButton>
            {/* 2. ألعاب الذاكرة */}
            <ToolButton
              onClick={() => { closeBottomOverlays(); setShowGameMenu("memory"); playSound("click"); }}
              title="🧠 ألعاب الذاكرة"
              className="hover:bg-pink-500/20 hover:text-pink-400"
            >
              <Eye className="w-3.5 h-3.5" />
            </ToolButton>
            {/* 3. ألعاب الحظ والتحفيز */}
            <ToolButton
              onClick={() => { closeBottomOverlays(); setShowGameMenu("luck"); playSound("click"); }}
              title="🎁 ألعاب الحظ والتحفيز"
              className="hover:bg-amber-500/20 hover:text-amber-400"
            >
              <Gift className="w-3.5 h-3.5" />
            </ToolButton>
            {/* 4. أدوات الفصل */}
            <ToolButton
              onClick={() => { closeBottomOverlays(); setShowGameMenu("tools"); playSound("click"); }}
              title="🛠️ أدوات الفصل (نرد، رد فعل، عجلة طالب)"
              className="hover:bg-emerald-500/20 hover:text-emerald-400"
            >
              <Wrench className="w-3.5 h-3.5" />
            </ToolButton>
          </div>

          {/* ===== عجلة الطلاب السريعة (اختصار) ===== */}
          <ToolButton
            onClick={handleRandomPick}
            title="🎯 عجلة الطلاب — اختيار عشوائي عادل"
            className="hover:bg-cyan-500/20 hover:text-cyan-400"
          >
            <Shuffle className="w-3.5 h-3.5" />
          </ToolButton>

          {/* ===== Celebrations ===== */}
          <button
            onClick={() => {
              closeBottomOverlays();
              setShowCelebrations(true);
              playSound("click");
            }}
            className="tool-btn bg-[#FFD700]/20 hover:bg-[#FFD700]/40 text-[#FFD700] gap-1 px-2 shrink-0"
            style={{ width: "auto" }}
            title="🎉 لوحة الاحتفالات"
          >
            <PartyPopper className="w-3.5 h-3.5" />
            <span className="text-xs hidden sm:inline">احتفالات</span>
          </button>

          {/* ===== P2-13: التحدي الأسبوعي ===== */}
          <button
            onClick={() => {
              closeBottomOverlays();
              setShowWeeklyChallenge(true);
              playSound("click");
            }}
            className="tool-btn bg-gradient-to-l from-amber-500/30 to-amber-300/20 hover:from-amber-500/50 hover:to-amber-300/40 text-amber-300 gap-1 px-2 shrink-0"
            style={{ width: "auto" }}
            title="🏆 التحدي الأسبوعي"
          >
            <Zap className="w-3.5 h-3.5" />
            <span className="text-xs hidden sm:inline">الأسبوعي</span>
          </button>

          {/* ===== Leaderboard ===== */}
          <button
            onClick={() => {
              // Allow leaderboard to open if either a class is active OR there are students in the store
              if (!activeClassId && students.length === 0) {
                toast.error("فعّل صفًا أو أضف طلاباً أولاً");
                return;
              }
              closeBottomOverlays();
              setShowLeaderboard(true);
              playSound("click");
            }}
            className="tool-btn bg-[#FFD700]/20 hover:bg-[#FFD700]/40 text-[#FFD700] gap-1 px-2 shrink-0"
            style={{ width: "auto" }}
            title="🏆 لوحة المتصدرين"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span className="text-xs hidden sm:inline">المتصدرون</span>
          </button>

          {/* ===== Student Card ===== */}
          <button
            onClick={() => {
              closeBottomOverlays();
              setShowStudentCard(true);
              playSound("click");
            }}
            className="tool-btn bg-[#FFD700]/20 hover:bg-[#FFD700]/40 text-[#FFD700] gap-1 px-2 shrink-0"
            style={{ width: "auto" }}
            title="🏆 كارت الطالب"
          >
            <Trophy className="w-3.5 h-3.5" />
            <span className="text-xs hidden sm:inline">كارت</span>
          </button>

          {/* P8 fix: Printable grades page — opens /grades in a NEW TAB so
              the teacher can print or save it as PDF without losing the
              live teaching view. Passes the current classId + sessionId
              so the report shows the right data. */}
          <button
            onClick={() => {
              const params = new URLSearchParams();
              if (activeClassId) params.set("classId", activeClassId);
              const sid = useShellStore.getState().currentSessionId;
              if (sid) params.set("sessionId", sid);
              const url = `/grades${params.toString() ? `?${params.toString()}` : ""}`;
              window.open(url, "_blank", "noopener,noreferrer");
              playSound("click");
              toast.success("تم فتح صفحة الدرجات في تاب جديد — استخدم Ctrl+P للطباعة");
            }}
            className="tool-btn bg-[#10b981]/20 hover:bg-[#10b981]/40 text-[#10b981] gap-1 px-2 shrink-0"
            style={{ width: "auto" }}
            title="📄 فتح صفحة الدرجات للطباعة (في تاب جديد)"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="text-xs hidden sm:inline">الدرجات</span>
          </button>

          {/* ===== Quick evaluation buttons (success/error only - no sound duplication with SideRail) ===== */}
          <div className="flex items-center gap-0.5 bg-secondary/50 rounded-lg p-0.5 shrink-0">
            <ToolButton
              onClick={() => {
                triggerGreenFlash();
                playSound("success");
              }}
              title="صوت نجاح (V)"
              className="hover:bg-green-500/20 hover:text-green-400"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
            </ToolButton>
            <ToolButton
              onClick={() => {
                triggerRedFlash();
                playSound("error");
              }}
              title="صوت خطأ (X)"
              className="hover:bg-red-500/20 hover:text-red-400"
            >
              <XCircle className="w-3.5 h-3.5" />
            </ToolButton>
          </div>

          {/* P7 fix: Stop TTS button — immediately stops the current TTS
              announcement AND clears the speak queue so the next sentence
              doesn't auto-play after the user told it to stop. */}
          <ToolButton
            onClick={() => {
              import("@/lib/tts-announcer").then((m) => {
                m.stopAnnouncement();
                toast.info("تم إيقاف النطق الحالي");
              });
            }}
            title="إيقاف النطق الحالي فوراً"
            className="hover:bg-orange-500/20 hover:text-orange-400"
          >
            <Square className="w-3.5 h-3.5" />
          </ToolButton>
        </div>
      </div>

      {/* ===== Overlays ===== */}
      {showWheel && <RandomStudentWheel onClose={() => setShowWheel(false)} />}
      {showLeaderboard && (
        <GameOverlay open={showLeaderboard} onClose={() => setShowLeaderboard(false)} title="المتصدرون" accentColor="#FFD700" widthPercent={90} heightPercent={92}>
          <ClassLeaderboardView onClose={() => setShowLeaderboard(false)} />
        </GameOverlay>
      )}
      {showLuckyWheel && (
        <GameOverlay open={showLuckyWheel} onClose={() => { setShowLuckyWheel(false); setActiveGame(null); }} title="عجلة الحظ" accentColor="#a855f7">
          <LuckyWheelGame onClose={() => { setShowLuckyWheel(false); setActiveGame(null); }} />
        </GameOverlay>
      )}
      {showDice && (
        <GameOverlay open={showDice} onClose={() => { setShowDice(false); setActiveGame(null); }} title="زهر النرد" accentColor="#10b981">
          <DiceRollGame onClose={() => { setShowDice(false); setActiveGame(null); }} />
        </GameOverlay>
      )}
      {showReaction && (
        <GameOverlay open={showReaction} onClose={() => { setShowReaction(false); setActiveGame(null); }} title="زمن رد الفعل" accentColor="#06b6d4">
          <ReactionTimeGame onClose={() => { setShowReaction(false); setActiveGame(null); }} />
        </GameOverlay>
      )}
      {showQuiz && (
        <GameOverlay open={showQuiz} onClose={() => { setShowQuiz(false); setActiveGame(null); }} title="مسابقة الأسئلة" accentColor="#0142A0">
          <QuizShowGame onClose={() => { setShowQuiz(false); setActiveGame(null); }} />
        </GameOverlay>
      )}
      {/* v11: ألعاب جديدة */}
      {showMath && (
        <GameOverlay open={showMath} onClose={() => { setShowMath(false); setActiveGame(null); }} title="تحدي الرياضيات" accentColor="#f59e0b">
          <MathChallengeGame onClose={() => { setShowMath(false); setActiveGame(null); }} />
        </GameOverlay>
      )}
      {showMemory && (
        <GameOverlay open={showMemory} onClose={() => { setShowMemory(false); setActiveGame(null); }} title="لعبة الذاكرة" accentColor="#ec4899">
          <MemoryGame onClose={() => { setShowMemory(false); setActiveGame(null); }} />
        </GameOverlay>
      )}
      {showCelebrations && <CelebrationsPanel onClose={() => setShowCelebrations(false)} />}
      {/* P2-13: نافذة التحدي الأسبوعي */}
      {showWeeklyChallenge && (
        <WeeklyChallenge onClose={() => setShowWeeklyChallenge(false)} />
      )}
      {showQuestionChallenge && (
        <GameOverlay open={showQuestionChallenge} onClose={() => { setShowQuestionChallenge(false); setActiveGame(null); }} title="تحدي الأسئلة" accentColor="#0142A0">
          <QuestionChallengeGame onClose={() => { setShowQuestionChallenge(false); setActiveGame(null); }} />
        </GameOverlay>
      )}
      {showMysteryBox && (
        <GameOverlay open={showMysteryBox} onClose={() => { setShowMysteryBox(false); setActiveGame(null); }} title="الصندوق الغامض" accentColor="#f59e0b">
          <MysteryBoxGame onClose={() => { setShowMysteryBox(false); setActiveGame(null); }} />
        </GameOverlay>
      )}
      {showQuickFire && (
        <GameOverlay open={showQuickFire} onClose={() => { setShowQuickFire(false); setActiveGame(null); }} title="الإطلاق السريع" accentColor="#06b6d4">
          <QuickFireGame onClose={() => { setShowQuickFire(false); setActiveGame(null); }} />
        </GameOverlay>
      )}
      {showStudentCard && <StudentCard onClose={() => setShowStudentCard(false)} />}

      {/* ===== Gift picker for currently-called student ===== */}
      {showGiftPickerForCalled && currentlyCalledStudent && (
        <GameOverlay open onClose={() => setShowGiftPickerForCalled(false)} title={`🎁 هدية لـ ${currentlyCalledStudent.name}`} accentColor="#ec4899" widthPercent={80} heightPercent={80}>
          <div className="p-4">
            <div className="grid grid-cols-4 gap-2">
              {availableGifts.map((g) => (
                <button
                  key={g.id}
                  onClick={() => handleAwardGiftToCalled(g)}
                  className="bg-white/5 hover:bg-pink-500/20 rounded-lg p-2 text-center transition flex flex-col items-center"
                  title={g.name}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.image} alt={g.name} className="w-10 h-10 object-cover rounded mb-1" loading="lazy" decoding="async" />
                  <span className="text-[9px] text-white/80 truncate w-full">{g.name}</span>
                </button>
              ))}
            </div>
            {availableGifts.length === 0 && <div className="text-white/40 text-center py-4 text-xs">لا توجد هدايا — أضفها من لوحة الهدايا</div>}
          </div>
        </GameOverlay>
      )}

      {/* ===== Prize picker for currently-called student ===== */}
      {showPrizePickerForCalled && currentlyCalledStudent && (
        <GameOverlay open onClose={() => setShowPrizePickerForCalled(false)} title={`🏆 جائزة لـ ${currentlyCalledStudent.name}`} accentColor="#f59e0b" widthPercent={80} heightPercent={80}>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-2">
              {availablePrizes.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleAwardPrizeToCalled(p)}
                  className="bg-white/5 hover:bg-amber-500/20 rounded-lg p-3 text-center transition flex flex-col items-center"
                  style={{ borderColor: p.color }}
                >
                  <span className="text-2xl mb-1">{p.icon || "🏆"}</span>
                  <span className="text-xs text-white font-bold">{p.name}</span>
                  {p.points > 0 && <span className="text-[10px] text-amber-400">+{p.points} نقطة</span>}
                </button>
              ))}
            </div>
            {availablePrizes.length === 0 && <div className="text-white/40 text-center py-4 text-xs">لا توجد جوائز — أضفها من لوحة الجوائز</div>}
          </div>
        </GameOverlay>
      )}
      {showGameMenu && (
        <GameOverlay
          open
          onClose={() => setShowGameMenu(null)}
          title={
            showGameMenu === "curriculum" ? "📚 ألعاب المنهج" :
            showGameMenu === "memory" ? "🧠 ألعاب الذاكرة" :
            showGameMenu === "luck" ? "🎁 ألعاب الحظ والتحفيز" :
            "🛠️ أدوات الفصل"
          }
          accentColor={
            showGameMenu === "curriculum" ? "#0142A0" :
            showGameMenu === "memory" ? "#ec4899" :
            showGameMenu === "luck" ? "#FFD700" :
            "#10b981"
          }
          widthPercent={80}
          heightPercent={85}
        >
          <div className="p-4">
            {/* Logo */}
            <div className="flex justify-center mb-4">
              <svg width="36" height="36" viewBox="0 0 32 32" fill="none">
                <circle cx="11.5" cy="11" r="2" fill="#DA151C" />
                <circle cx="20.5" cy="11" r="2" fill="#DA151C" />
                <path d="M7 16 Q16 25 25 16" stroke="#0142A0" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              </svg>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {showGameMenu === "curriculum" && (
                <>
                  {/* 🟢 v3 restructure: 4 ألعاب منهج فقط، مرتبة حسب القيمة التعليمية */}
                  <button onClick={() => { setShowGameMenu(null); setShowQuestionChallenge(true); setActiveGame("question-challenge"); }} className="bg-[#0142A0]/20 hover:bg-[#0142A0]/40 rounded-xl p-3 text-center transition">
                    <Brain className="w-6 h-6 text-[#60a5fa] mx-auto mb-1" />
                    <div className="text-sm font-bold text-white">تحدي الأسئلة</div>
                    <div className="text-[10px] text-white/60 mt-0.5">فردي / مبارزة / مجموعات</div>
                  </button>
                  <button onClick={() => { setShowGameMenu(null); setShowQuiz(true); }} className="bg-[#a855f7]/20 hover:bg-[#a855f7]/40 rounded-xl p-3 text-center transition">
                    <Users className="w-6 h-6 text-[#c084fc] mx-auto mb-1" />
                    <div className="text-sm font-bold text-white">مسابقة الأسئلة</div>
                    <div className="text-[10px] text-white/60 mt-0.5">2-4 لاعبين</div>
                  </button>
                  <button onClick={() => { setShowGameMenu(null); setShowQuickFire(true); setActiveGame("quick-fire"); }} className="bg-[#f59e0b]/20 hover:bg-[#f59e0b]/40 rounded-xl p-3 text-center transition">
                    <Zap className="w-6 h-6 text-[#fbbf24] mx-auto mb-1" />
                    <div className="text-sm font-bold text-white">أسئلة سريعة</div>
                    <div className="text-[10px] text-white/60 mt-0.5">10ث لكل سؤال</div>
                  </button>
                  <button onClick={() => { setShowGameMenu(null); setShowMath(true); }} className="bg-[#10b981]/20 hover:bg-[#10b981]/40 rounded-xl p-3 text-center transition">
                    <Calculator className="w-6 h-6 text-[#6ee7b7] mx-auto mb-1" />
                    <div className="text-sm font-bold text-white">تحدي الرياضيات</div>
                    <div className="text-[10px] text-white/60 mt-0.5">إدخال رقمي</div>
                  </button>
                </>
              )}
              {showGameMenu === "memory" && (
                <>
                  {/* 🟢 v3 restructure: لعبة ذاكرة واحدة (مع mode صوتي بدل SimonSays المنفصلة) */}
                  <button onClick={() => { setShowGameMenu(null); setShowMemory(true); }} className="bg-[#ec4899]/20 hover:bg-[#ec4899]/40 rounded-xl p-3 text-center transition">
                    <Eye className="w-6 h-6 text-[#f9a8d4] mx-auto mb-1" />
                    <div className="text-sm font-bold text-white">لعبة الذاكرة</div>
                    <div className="text-[10px] text-white/60 mt-0.5">بصري / صوتي</div>
                  </button>
                </>
              )}
              {showGameMenu === "luck" && (
                <>
                  {/* 🟢 v3 restructure: لعبة حظ واحدة (LuckyWheel) مع skin الصندوق كـ mode */}
                  <button onClick={() => { setShowGameMenu(null); setShowLuckyWheel(true); }} className="bg-[#FFD700]/20 hover:bg-[#FFD700]/40 rounded-xl p-3 text-center transition">
                    <Gift className="w-6 h-6 text-[#fbbf24] mx-auto mb-1" />
                    <div className="text-sm font-bold text-white">عجلة الحظ</div>
                    <div className="text-[10px] text-white/60 mt-0.5">عشوائي عادل</div>
                  </button>
                  <button onClick={() => { setShowGameMenu(null); setShowMysteryBox(true); setActiveGame("mystery-box"); }} className="bg-[#a855f7]/20 hover:bg-[#a855f7]/40 rounded-xl p-3 text-center transition">
                    <Gift className="w-6 h-6 text-[#c084fc] mx-auto mb-1" />
                    <div className="text-sm font-bold text-white">الصندوق الغامض</div>
                    <div className="text-[10px] text-white/60 mt-0.5">6 صناديق مفاجآت</div>
                  </button>
                </>
              )}
              {showGameMenu === "tools" && (
                <>
                  {/* 🟢 v3 restructure: أدوات (مش ألعاب تعليمية) — نرد، رد فعل، عجلة طالب */}
                  <button onClick={() => { setShowGameMenu(null); setShowDice(true); }} className="bg-[#3b82f6]/20 hover:bg-[#3b82f6]/40 rounded-xl p-3 text-center transition">
                    <Dices className="w-6 h-6 text-[#93c5fd] mx-auto mb-1" />
                    <div className="text-sm font-bold text-white">زهر النرد</div>
                    <div className="text-[10px] text-white/60 mt-0.5">1-4 أحجار</div>
                  </button>
                  <button onClick={() => { setShowGameMenu(null); setShowReaction(true); }} className="bg-[#06b6d4]/20 hover:bg-[#06b6d4]/40 rounded-xl p-3 text-center transition">
                    <Zap className="w-6 h-6 text-[#67e8f9] mx-auto mb-1" />
                    <div className="text-sm font-bold text-white">سرعة رد الفعل</div>
                    <div className="text-[10px] text-white/60 mt-0.5">استراحة نشطة</div>
                  </button>
                  <button onClick={() => { setShowGameMenu(null); setShowWheel(true); }} className="bg-[#10b981]/20 hover:bg-[#10b981]/40 rounded-xl p-3 text-center transition">
                    <Users className="w-6 h-6 text-[#6ee7b7] mx-auto mb-1" />
                    <div className="text-sm font-bold text-white">عجلة الطلاب</div>
                    <div className="text-[10px] text-white/60 mt-0.5">اختيار عشوائي عادل</div>
                  </button>
                </>
              )}
            </div>
          </div>
        </GameOverlay>
      )}
      <AwardedGiftDisplay />
    </>
  );
}

// ====================================================================
//  SessionControls — أزرار بدء/إنهاء جلسة SQLite + مؤشر الحالة
// ====================================================================
function SessionControls() {
  const currentSessionId = useShellStore((s) => s.currentSessionId);
  const startNewSession = useShellStore((s) => s.startNewSession);
  const endCurrentSession = useShellStore((s) => s.endCurrentSession);
  const activeClassId = useShellStore((s) => s.activeClassId);
  const playSound = useShellStore((s) => s.playSound);
  const [busy, setBusy] = useState(false);

  const handleStart = async () => {
    setBusy(true);
    try {
      const id = await startNewSession();
      if (id) {
        toast.success("بدأت جلسة جديدة — كل تفاعل الطلاب يُسجَّل الآن");
        playSound("celebrate-stamp");
      } else {
        toast.error("تعذر بدء الجلسة — تحقق من اتصال قاعدة البيانات");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleEnd = async () => {
    setBusy(true);
    try {
      await endCurrentSession();
      toast.info("انتهت الجلسة — تم حفظ سجلها في قاعدة البيانات");
      playSound("click");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-0.5 bg-secondary/50 rounded-lg p-0.5 shrink-0">
      {currentSessionId ? (
        <button
          onClick={handleEnd}
          disabled={busy}
          className="tool-btn bg-red-500/20 hover:bg-red-500/40 text-red-300 gap-1 px-2 disabled:opacity-50"
          style={{ width: "auto" }}
          title={activeClassId ? "إنهاء الجلسة وحفظها في SQLite" : "إنهاء الجلسة (بدون صف نشط)"}
        >
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs hidden sm:inline">إنهاء الجلسة</span>
        </button>
      ) : (
        <button
          onClick={handleStart}
          disabled={busy}
          className="tool-btn bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 gap-1 px-2 disabled:opacity-50"
          style={{ width: "auto" }}
          title={activeClassId ? "بدء جلسة جديدة تُسجَّل في SQLite" : "فعّل صفًا أولاً لتُربط الجلسة به"}
        >
          <Clock className="w-3.5 h-3.5" />
          <span className="text-xs hidden sm:inline">جلسة جديدة</span>
        </button>
      )}
    </div>
  );
}

// ====================================================================
//  ToolButton
// ====================================================================
function ToolButton({
  active,
  onClick,
  title,
  children,
  className,
  disabled,
  style,
}: {
  active?: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      // shrink-0 prevents the button from compressing when the toolbar overflows.
      // The toolbar uses overflow-x-auto, so buttons stay at their natural width
      // and the user scrolls horizontally to reach off-screen ones.
      className={cn("tool-btn shrink-0", active && "active", className)}
      style={style}
    >
      {children}
    </button>
  );
}

// ====================================================================
//  Reward Button - زر مكافأة صغير
// ====================================================================
function RewardBtn({
  onClick,
  title,
  color,
  icon,
  label,
}: {
  onClick: () => void;
  title: string;
  color: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      // shrink-0 prevents compression; toolbar scrolls horizontally instead.
      className="h-8 px-2 rounded text-[11px] font-bold flex items-center justify-center gap-0.5 transition-all hover:scale-110 shrink-0"
      style={{
        background: `${color}20`,
        color: color,
        border: `1px solid ${color}40`,
      }}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
