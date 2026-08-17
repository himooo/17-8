"use client";

import { useShellStore } from "@/lib/shell-store";
import { useMemo } from "react";

/**
 * LessonIntelligence — نظام ذكاء الدرس
 * 
 * يقرأ الـ Manifest الحالي ويستخرج منه:
 * - أسئلة كل idea تلقائياً
 * - الـ script كامل (مقوَّم لجمل)
 * - المصطلحات المهمة (الكلمات الملونة)
 * - الـ stats (عدد الأسئلة، عدد الأفكار، وقت التقدير)
 * - توصيات ذكية (أفضل لعبة تناسب المحتوى، ما ينقص...)
 */

export interface LessonInsight {
  // محتوى
  totalIdeas: number;
  totalSteps: number;
  totalQuestions: number;
  totalAssets: number;

  // الأسئلة
  questionsByDifficulty: { easy: number; medium: number; hard: number };
  questionCoverage: number; // نسبة الخطوات التي فيها أسئلة

  // الجودة
  scriptSentences: number;
  wordsPerStep: number;
  hasImages: boolean;
  hasNotes: boolean;
  estimatedMinutes: number; // الوقت المقدر للدرس

  // التوصيات
  suggestedGame: string;
  missingElements: string[];
  strengths: string[];
}

export function useLessonIntelligence(): LessonInsight | null {
  const manifest = useShellStore((s) => s.manifest);
  const lessonQuestions = useShellStore((s) => s.lessonQuestions);

  return useMemo(() => {
    if (!manifest) return null;

    const totalIdeas = manifest.ideas?.length || 0;
    const totalSteps = manifest.totalSteps || totalIdeas || 0;
    const totalQuestions = lessonQuestions.length;
    const totalAssets = manifest.assets?.length || 0;

    // Questions by difficulty
    const questionsByDifficulty = lessonQuestions.reduce(
      (acc, q) => {
        const diff = (q.difficulty || "medium") as "easy" | "medium" | "hard";
        acc[diff] = (acc[diff] || 0) + 1;
        return acc;
      },
      { easy: 0, medium: 0, hard: 0 } as { easy: number; medium: number; hard: number }
    );

    // Question coverage
    const questionCoverage = totalSteps > 0 ? (totalQuestions / totalSteps) * 100 : 0;

    // Script analysis
    let scriptSentences = 0;
    let totalWords = 0;
    const steps = manifest.ideas?.flatMap((i) => i.steps) || manifest.steps || [];
    steps.forEach((step) => {
      if (step.script) {
        const text = Array.isArray(step.script) ? step.script.join(" ") : step.script;
        scriptSentences += text.split(/[.،،!؟]+/).filter(Boolean).length;
        totalWords += text.split(/\s+/).filter(Boolean).length;
      }
    });

    const wordsPerStep = steps.length > 0 ? Math.round(totalWords / steps.length) : 0;
    const hasImages = (manifest.assets?.length ?? 0) > 0;
    const hasNotes = steps.some((s) => s.notes && s.notes.length > 10);

    // Estimated time: 2 minutes per step
    const estimatedMinutes = Math.max(5, totalSteps * 2 + totalQuestions * 1);

    // Suggested game based on question types
    const suggestedGame = computeSuggestedGame(totalQuestions, questionsByDifficulty);

    // Missing elements
    const missingElements: string[] = [];
    if (totalQuestions === 0) missingElements.push("لا توجد أسئلة — أضف أسئلة لجعل الدرس تفاعلياً");
    if (!hasImages) missingElements.push("لا توجد أصول بصرية — أضف صور أو SVG");
    if (!hasNotes) missingElements.push("لا توجد ملاحظات — أضف notes لكل خطوة");
    if (questionCoverage < 30) missingElements.push("تغطية الأسئلة ضعيفة — أضف أسئلة لبقية الخطوات");
    if (totalSteps < 3) missingElements.push("الدرس قصير — أضف المزيد من الخطوات");

    // Strengths
    const strengths: string[] = [];
    if (totalQuestions >= 5) strengths.push("عدد أسئلة كافٍ");
    if (hasImages) strengths.push("محتوى بصري غني");
    if (hasNotes) strengths.push("ملاحظات تفصيلية موجودة");
    if (questionCoverage > 50) strengths.push("تغطية أسئلة ممتازة");

    return {
      totalIdeas,
      totalSteps,
      totalQuestions,
      totalAssets,
      questionsByDifficulty,
      questionCoverage,
      scriptSentences,
      wordsPerStep,
      hasImages,
      hasNotes,
      estimatedMinutes,
      suggestedGame,
      missingElements,
      strengths,
    };
  }, [manifest, lessonQuestions]);
}

function computeSuggestedGame(
  totalQuestions: number,
  byDifficulty: { easy: number; medium: number; hard: number }
): string {
  if (totalQuestions === 0) return "لا شيء يتطلب أسئلة";
  if (byDifficulty.easy > byDifficulty.hard) return "QuickFire أو Memory (بسيط)";
  if (byDifficulty.hard > 5) return "QuizShow أو MathChallenge (تحدي حقيقي)";
  if (totalQuestions > 10) return "GroupBattle أو Duel Quiz (طويل)";
  return "LuckyWheel أو MysteryBox (متنوع)";
}

// ============================================================
// Blueprint Panel — يعرض نتائج التحليل بصرياً
// ============================================================

export function LessonBlueprint({ onClose }: { onClose?: () => void }) {
  const insight = useLessonIntelligence();

  if (!insight) {
    return (
      <div className="p-6 text-center text-white/50">
        لا يوجد درس نشط حالياً.<br />
        قم باستيراد درس أولاً من لوحة المنهج.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-white">تحليل ذكي للدرس</div>
          <div className="text-[10px] text-white/50">
            {insight.totalSteps} خطوة • {insight.totalQuestions} سؤال • {insight.estimatedMinutes} دقيقة
          </div>
        </div>
        <div className="text-3xl">🧠</div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard value={insight.totalIdeas} label="أفكار" icon="📚" color="#3b82f6" />
        <StatCard value={insight.totalSteps} label="خطوات" icon="👣" color="#8b5cf6" />
        <StatCard value={insight.totalQuestions} label="أسئلة" icon="❓" color="#f59e0b" />
        <StatCard value={insight.totalAssets} label="أصول" icon="🖼️" color="#ec4899" />
      </div>

      {/* Question difficulty bars */}
      <div className="bg-white/5 rounded-lg p-3 space-y-2">
        <div className="text-[10px] font-bold text-white/60 uppercase mb-1">توزيع الأسئلة</div>
        <div className="flex gap-1 h-4 rounded overflow-hidden">
          <div className="bg-emerald-500" style={{ width: `${(insight.questionsByDifficulty.easy / Math.max(1, insight.totalQuestions)) * 100}%` }} title="سهل" />
          <div className="bg-amber-500" style={{ width: `${(insight.questionsByDifficulty.medium / Math.max(1, insight.totalQuestions)) * 100}%` }} title="متوسط" />
          <div className="bg-red-500" style={{ width: `${(insight.questionsByDifficulty.hard / Math.max(1, insight.totalQuestions)) * 100}%` }} title="صعب" />
        </div>
        <div className="flex justify-between text-[9px] text-white/40">
          <span>سهل: {insight.questionsByDifficulty.easy}</span>
          <span>متوسط: {insight.questionsByDifficulty.medium}</span>
          <span>صعب: {insight.questionsByDifficulty.hard}</span>
        </div>
      </div>

      {/* Coverage */}
      <div className="bg-white/5 rounded-lg p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold text-white/60">تغطية الأسئلة</span>
          <span className="text-xs font-bold text-white">{insight.questionCoverage.toFixed(0)}%</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${insight.questionCoverage}%`,
              backgroundColor: insight.questionCoverage > 70 ? "#10b981" : insight.questionCoverage > 40 ? "#f59e0b" : "#ef4444",
            }}
          />
        </div>
      </div>

      {/* Suggested game */}
      <div className="bg-gradient-to-r from-[#0142A0]/20 to-[#DA151C]/20 rounded-lg p-3 border border-[#0142A0]/40">
        <div className="text-[10px] font-bold text-white/60 mb-1">🎮 أفضل لعبة لهذا الدرس</div>
        <div className="text-sm font-bold text-white">{insight.suggestedGame}</div>
      </div>

      {/* Missing elements (if any) */}
      {insight.missingElements.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-bold text-white/60 uppercase">⚠️ ما ينقص</div>
          {insight.missingElements.map((el, i) => (
            <div key={i} className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded p-2">
              {el}
            </div>
          ))}
        </div>
      )}

      {/* Strengths (if any) */}
      {insight.strengths.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-bold text-white/60 uppercase">✅ نقاط القوة</div>
          {insight.strengths.map((s, i) => (
            <div key={i} className="text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded p-2">
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ value, label, icon, color }: {
  value: number; label: string; icon: string; color: string;
}) {
  return (
    <div className="bg-white/5 rounded-lg p-2.5 text-center border border-white/10">
      <div className="text-xl">{icon}</div>
      <div className="text-lg font-black" style={{ color }}>{value}</div>
      <div className="text-[9px] text-white/50">{label}</div>
    </div>
  );
}
