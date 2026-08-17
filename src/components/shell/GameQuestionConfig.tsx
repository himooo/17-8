"use client";

// ====================================================================
//  GameQuestionConfig.tsx — v2 (2025-AUG)
//
//  A unified pre-game config UI for ALL question-based games.
//  Lets the teacher pick:
//    1. How many questions to pull (5 / 8 / 10 / 15 / 20 / الكل)
//    2. Question source (current-idea / all-ideas / specific idea)
//    3. Optionally preview how many questions are available
//
//  Philosophy: the teacher should be able to run MULTIPLE games on the
//  same idea WITHOUT repeating questions. This component shows how many
//  questions remain (total - asked-this-session) so the teacher can plan.
//
//  Usage:
//    const cfg = useGameQuestionConfig();
//    <GameQuestionConfigView {...cfg} />
//    // then pass cfg.limit and cfg.source to useGameQuestions:
//    const { questions } = useGameQuestions(cfg.source, cfg.limit);
// ====================================================================

import { useState, useMemo } from "react";
import { useShellStore } from "@/lib/shell-store";
import {
  getQuestions,
  useAvailableIdeas,
  useCurrentIdeaInfo,
} from "@/lib/question-provider";
import { cn } from "@/lib/utils";

export type GameConfigSource = "current-idea" | "all-ideas" | "manual" | "ai-generated";

export interface GameQuestionConfigState {
  limit: number; // 0 means "all"
  source: GameConfigSource;
  manualIdeaId: string | null;
}

export interface GameQuestionConfigActions {
  setLimit: (n: number) => void;
  setSource: (s: GameConfigSource) => void;
  setManualIdeaId: (id: string | null) => void;
}

export function useGameQuestionConfig(defaultLimit: number = 10): GameQuestionConfigState &
  GameQuestionConfigActions & {
    /** The QuestionSource enum value to pass to useGameQuestions */
    questionSource: "current-idea" | "all-ideas" | "manual" | "ai-generated";
    /** ideaId passed to useGameQuestions in manual mode */
    manualIdeaIdForHook: string | null;
    /** reset to defaults */
    reset: () => void;
  } {
  const [limit, setLimit] = useState<number>(defaultLimit);
  const [source, setSource] = useState<GameConfigSource>("current-idea");
  const [manualIdeaId, setManualIdeaId] = useState<string | null>(null);

  // Keep the teacher's source choice intact. Manual selection carries its
  // explicit idea id to useGameQuestions instead of silently using current idea.
  const questionSource: "current-idea" | "all-ideas" | "manual" | "ai-generated" = source;

  return {
    limit,
    source,
    manualIdeaId,
    setLimit,
    setSource,
    setManualIdeaId,
    questionSource,
    manualIdeaIdForHook: source === "manual" ? manualIdeaId : null,
    reset: () => {
      setLimit(defaultLimit);
      setSource("current-idea");
      setManualIdeaId(null);
    },
  };
}

const LIMIT_OPTIONS: { value: number; label: string }[] = [
  { value: 5, label: "5 أسئلة" },
  { value: 8, label: "8 أسئلة" },
  { value: 10, label: "10 أسئلة" },
  { value: 15, label: "15 سؤال" },
  { value: 20, label: "20 سؤال" },
  { value: 0, label: "كل الأسئلة" },
];

export function GameQuestionConfigView({
  state,
  actions,
  compact = false,
}: {
  state: GameQuestionConfigState;
  actions: GameQuestionConfigActions;
  compact?: boolean;
}) {
  const ideas = useAvailableIdeas();
  const currentIdea = useCurrentIdeaInfo();
  const currentIdeaId = useShellStore((s) => s.currentIdeaId);
  const askedIds = useShellStore((s) => s.askedQuestionIds);
  const manifest = useShellStore((s) => s.manifest);
  const aiQuestionPool = useShellStore((s) => s.aiQuestionPool);
  // 🟢 v3: track whether the user is using the manual input field (so the
  // preset buttons don't show "active" when a custom number is entered).
  const [customLimitActive, setCustomLimitActive] = useState(false);

  // Compute remaining questions from the selected source only. A global asked
  // count is misleading after the teacher has used another idea/game.
  const remaining = useMemo(() => {
    if (!manifest && state.source !== "ai-generated") return 0;
    if (state.source === "ai-generated" && aiQuestionPool.length === 0) return 0;
    const pool = getQuestions({
      mode: state.source === "manual" ? "manual" : state.source,
      ideaId: state.source === "manual"
        ? state.manualIdeaId ?? undefined
        : state.source === "current-idea"
        ? currentIdeaId ?? undefined
        : undefined,
      limit: 0,
      shuffle: false,
      excludeAsked: false,
    });
    return pool.filter((q) => !askedIds?.has((q as { _stableId?: string })._stableId ?? "")).length;
  }, [manifest, aiQuestionPool, state.source, state.manualIdeaId, currentIdeaId, askedIds]);

  if (!manifest && !(state.source === "ai-generated" && aiQuestionPool.length > 0)) {
    return (
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-center text-amber-300 text-xs">
                    {state.source === "ai-generated" ? "⚠️ ولّد أسئلة من AI واعتمدها أولاً من لوحة الذكاء الاصطناعي." : "⚠️ حمّل درساً من المنهج أولاً حتى تتمكن من تشغيل الألعاب التي تستخدم الأسئلة."}

      </div>
    );
  }

  return (
    <div className={cn("space-y-3", compact ? "text-[10px]" : "text-xs")}>
      {/* Question count */}
      <div>
        <label className="text-white/60 mb-1.5 block font-bold">عدد الأسئلة</label>
        <div className="flex flex-wrap gap-1 items-center">
          {LIMIT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { actions.setLimit(opt.value); setCustomLimitActive(false); }}
              aria-pressed={state.limit === opt.value && !customLimitActive}
              aria-label={`اختيار ${opt.label}`}
              className={cn(
                "px-2.5 py-1 rounded-md font-bold transition border",
                state.limit === opt.value && !customLimitActive
                  ? "bg-[#0142A0] text-white border-[#0142A0]"
                  : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {/* 🟢 v3: manual input for custom question count */}
        <div className="mt-2 flex items-center gap-2">
          <label className="text-[10px] text-white/60 whitespace-nowrap">
            أو أدخل عدد يدوي:
          </label>
          <input
            type="number"
            min={1}
            max={100}
            value={state.limit > 0 && !LIMIT_OPTIONS.some(o => o.value === state.limit) ? state.limit : ""}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v > 0) {
                actions.setLimit(Math.min(100, v));
                setCustomLimitActive(true);
              } else if (e.target.value === "") {
                setCustomLimitActive(false);
              }
            }}
            onFocus={() => setCustomLimitActive(true)}
            placeholder="مثلاً: 7"
            className="w-20 bg-white/5 border border-white/10 rounded-md px-2 py-1 text-white text-xs focus:outline-none focus:border-[#0142A0]/50"
          />
          <span className="text-[10px] text-white/40">سؤال</span>
        </div>
                    {remaining > 0 && (

          <div className="text-[10px] text-white/40 mt-1">
                          متاح: {remaining} سؤال من هذا المصدر

          </div>
        )}
        {remaining === 0 && (
          <div className="text-[10px] text-amber-400 mt-1">
            {state.source === "ai-generated" ? "⚠️ لا توجد أسئلة AI معتمدة حالياً — ولّد أسئلة ثم اضغط اعتماد." : "⚠️ لا توجد أسئلة متبقية في هذا المصدر — اختر «كل الدرس» أو ابدأ جلسة جديدة لإعادة فتحها"}
          </div>
        )}
      </div>

      {/* Source */}
      <div>
        <label className="text-white/60 mb-1.5 block font-bold">مصدر الأسئلة</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
          <button
            onClick={() => actions.setSource("current-idea")}
            aria-pressed={state.source === "current-idea"}
            aria-label="مصدر الأسئلة: الفكرة الحالية"
            className={cn(
              "px-2 py-1.5 rounded-md font-bold transition border text-center",
              state.source === "current-idea"
                ? "bg-[#10b981] text-white border-[#10b981]"
                : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
            )}
            title="أسئلة الفكرة الحالية فقط"
          >
            الفكرة الحالية
            {currentIdea.title && (
              <div className="text-[9px] opacity-80 truncate">{currentIdea.title}</div>
            )}
          </button>
          <button
            onClick={() => actions.setSource("all-ideas")}
            aria-pressed={state.source === "all-ideas"}
            aria-label="مصدر الأسئلة: كل الدرس"
            className={cn(
              "px-2 py-1.5 rounded-md font-bold transition border text-center",
              state.source === "all-ideas"
                ? "bg-[#a855f7] text-white border-[#a855f7]"
                : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
            )}
            title="كل أسئلة الدرس"
          >
            كل الدرس
            <div className="text-[9px] opacity-80">
              {ideas.reduce((s, i) => s + i.questionCount, 0)} سؤال
            </div>
          </button>
          <button
            onClick={() => actions.setSource("manual")}
            aria-pressed={state.source === "manual"}
            aria-label="مصدر الأسئلة: فكرة محددة"
            className={cn(
              "px-2 py-1.5 rounded-md font-bold transition border text-center",
              state.source === "manual"
                ? "bg-[#f59e0b] text-white border-[#f59e0b]"
                : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
            )}
            title="اختيار فكرة محددة"
          >
            فكرة محددة
            <div className="text-[9px] opacity-80">
              {ideas.length} فكرة
            </div>
          </button>
          <button
            onClick={() => actions.setSource("ai-generated")}
            aria-pressed={state.source === "ai-generated"}
            aria-label="مصدر الأسئلة: أسئلة مولدة بالذكاء الاصطناعي"
            className={cn(
              "px-2 py-1.5 rounded-md font-bold transition border text-center",
              state.source === "ai-generated"
                ? "bg-[#06b6d4] text-white border-[#06b6d4]"
                : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
            )}
            title="أسئلة AI التي اعتمدها المدرس"
          >
            أسئلة AI
            <div className="text-[9px] opacity-80">{aiQuestionPool.length} سؤال</div>
          </button>
        </div>
      </div>

      {/* Manual idea picker */}
      {state.source === "manual" && (
        <div>
          <label className="text-white/60 mb-1.5 block font-bold">اختر الفكرة</label>
          <select
            aria-label="اختيار فكرة محددة لمصدر الأسئلة"
            value={state.manualIdeaId ?? ""}
            onChange={(e) => actions.setManualIdeaId(e.target.value || null)}
            className="w-full bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-white text-xs"
          >
            <option value="">— اختر فكرة —</option>
            {ideas.map((idea) => (
              <option key={idea.id} value={idea.id} className="bg-zinc-900">
                {idea.title} ({idea.questionCount} سؤال)
              </option>
            ))}
          </select>
          {!state.manualIdeaId && (
            <div className="text-[10px] text-amber-400 mt-1">⚠️ اختر فكرة من القائمة</div>
          )}
        </div>
      )}
    </div>
  );
}
