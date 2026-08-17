"use client";

// ====================================================================
//  WeeklyChallenge.tsx — P2-13: نظام التحدي الأسبوعي
//
//  منطق بسيط بدون مزامنة سحابية:
//    • المهمة الافتراضية: "من يجيب N أسئلة صحيحة هذا الأسبوع؟"
//    • المصدر الحقيقي الوحيد = badges في الطالب المحمَّل في store
//      (badges.type === "correct" خلال الأسبوع الجاري).
//    • نحسب بداية الأسبوع على أنها اليوم السبت (يُطابق الأغلب في
//      المنطقة العربية). لو تريد بداية أخرى غيّر weekStartsOn أدناه.
//    • leaderboard مصغرة تعرض أكثر 3 طلاب حققوا التحدي.
//    • زر "منح التحدي": يضيف شارة star يدوياً + إشعار toast.
// ====================================================================

import { useMemo, useState } from "react";
import { useShellStore } from "@/lib/shell-store";
import type { Student } from "@/lib/slide-schema";
import { Button } from "@/components/ui/button";
import { X, Star, Trophy, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// بداية الأسبوع: 6 = السبت (معيار المنطقة)
const WEEK_STARTS_ON = 6;

/**
 * تاريخ بداية الأسبوع الحالي (منتصف ليلة يوم weekStartsOn الأخير)
 */
function weekStart(date = new Date()): Date {
  const d = new Date(date);
  const diff = (d.getDay() - WEEK_STARTS_ON + 7) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * تنسق تاريخ ISO مختصر بصيغة عربية مختصرة
 */
function fmtShort(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ar-EG", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

/** هيكل لطالب مع احصائية أسبوعية */
interface WeeklyEntry {
  student: Student;
  weekCorrect: number; // عدد إجابات صحيحة خلال الأسبوع الجاري
  totalCorrect: number;
}

/**
 * WeeklyChallenge — نافذة تعرض التحدي الأسبوعي المصغّر.
 * @param onClose يغلق النافذة (يتمرر من BottomControlBar)
 */
export function WeeklyChallenge({ onClose }: { onClose: () => void }) {
  const students = useShellStore((s) => s.students);
  const awardBadge = useShellStore((s) => s.awardBadge);
  const awardPoints = useShellStore((s) => s.awardPoints);
  const playSound = useShellStore((s) => s.playSound);
  const triggerConfetti = useShellStore((s) => s.triggerConfetti);

  // أول الطلاب الذين كَسروا عتبة 10 إجابات هذا الأسبوع
  const target = 10;
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [todayIso] = useState(() => new Date().toISOString());

  // نقرأ badges لكل طالب ونحسب نقاطه على مدار الأسبوع الحالي فقط
  const entries: WeeklyEntry[] = useMemo(() => {
    const wkStart = weekStart().getTime();
    return students.map((s) => {
      const weekCorrect = (s.badges || []).filter(
        (b) => b.type === "correct" && new Date(b.awardedAt).getTime() >= wkStart
      ).length;
      return { student: s, weekCorrect, totalCorrect: s.correctAnswers };
    });
  }, [students]);

  // أكثر 3 طلاب إجابات صحيحة هذا الأسبوع
  const top3 = useMemo(() => {
    return [...entries]
      .sort((a, b) => b.weekCorrect - a.weekCorrect)
      .slice(0, 3);
  }, [entries]);

  // من حطّم الهدف حتى الآن؟
  const winners = useMemo(
    () => entries.filter((e) => e.weekCorrect >= target),
    [entries]
  );

  // منح التحدي لطالب (يدوياً — المدرّسة تختار من الفائزين)
  const handleGrantChallenge = async (studentId: string, studentName: string) => {
    try {
      // منح شارة "star" على التحدي + نقاط إضافية بسيطة
      awardBadge(studentId, "star");
      awardPoints(studentId, 5); // مكافأة صغيرة على تجاوز العتبة
      setGranted((prev) => new Set(prev).add(studentId));
      playSound("celebrate-stamp");
      triggerConfetti();
      toast.success(`🏆 ${studentName} أكمل التحدي الأسبوعي! +5 نقاط`);
    } catch (e) {
      console.warn("[WeeklyChallenge] grant failed:", e);
      toast.error("تعذّر منح اكتمال التحدي — حاول مرة أخرى");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[220] bg-black/70 backdrop-blur-md flex items-center justify-center p-3"
      onClick={onClose}
    >
      {/* C33 (P2 fix): use Z_CRITICAL_MODAL=220 instead of z-[230] */}
      <div
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
        className="bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="bg-gradient-to-l from-[#FFD700]/40 to-zinc-900 p-3.5 border-b border-white/10">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                <h3 className="text-white font-extrabold">التحدي الأسبوعي</h3>
              </div>
              <p className="text-[11px] text-white/60 mt-0.5">
                من يجيب {target} إجابات صحيحة خلال أسبوع {fmtShort(weekStart().toISOString())}؟
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={onClose} className="text-white/60 hover:text-white h-8 w-8 p-0">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Top 3 leaderboard */}
        <div className="p-3.5 border-b border-white/10 bg-zinc-900/40">
          <div className="text-[10px] text-white/50 mb-2 flex items-center gap-1">
            <Zap className="w-3 h-3" />
            المتصدرون هذا الأسبوع
          </div>
          {entries.length === 0 ? (
            <div className="text-white/40 text-xs py-6 text-center">
              لا يوجد طلاب بعد — أضف طلاب من لوحة الطلاب أولاً.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {top3.map((e, idx) => {
                const pct = Math.min(100, Math.round((e.weekCorrect / target) * 100));
                const done = e.weekCorrect >= target;
                return (
                  <li
                    key={e.student.id}
                    className={cn(
                      "rounded-lg border p-2 flex items-center gap-2 transition-colors",
                      idx === 0
                        ? "border-amber-400/40 bg-amber-400/10"
                        : "border-white/10 bg-zinc-900/50"
                    )}
                  >
                    <div className="w-6 text-center text-white/60 font-bold">{idx + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-bold text-xs truncate">
                        {e.student.name}
                        {e.student.title && (
                          <span className="mr-1.5 text-[9px] text-amber-300 font-normal">
                            {e.student.title}
                          </span>
                        )}
                      </div>
                      <div className="w-full bg-white/10 rounded-full h-1.5 mt-1 overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            done
                              ? "bg-emerald-400"
                              : "bg-gradient-to-l from-amber-400 to-orange-400"
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-[10px] font-bold" style={{ color: done ? "#10b981" : "#fbbf24" }}>
                      {e.weekCorrect}/{target}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Winners — من تجاوز العتبة (مع زر منح) */}
        <div className="p-3.5 flex-1 overflow-y-auto bg-zinc-900/20" style={{ scrollbarWidth: "thin" }}>
          <div className="text-[10px] text-white/50 mb-2">تجاوزوا التحدي:</div>
          {winners.length === 0 ? (
            <div className="text-white/40 text-xs py-4 text-center">
              لم يتجاوز أحد {target} إجابات هذا الأسبوع بعد
            </div>
          ) : (
            <ul className="space-y-1.5">
              {winners.map((e) => (
                <li
                  key={e.student.id}
                  className="flex items-center gap-2 rounded-lg bg-zinc-900/60 border border-emerald-400/20 p-2"
                >
                  <Star className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-xs font-bold truncate">{e.student.name}</div>
                    <div className="text-[10px] text-white/50">
                      {e.weekCorrect} إجابة خلال هذا الأسبوع
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleGrantChallenge(e.student.id, e.student.name)}
                    disabled={granted.has(e.student.id)}
                    className="h-6 text-[10px] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {granted.has(e.student.id) ? "✔ مُنح" : "منح التحدي"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer — زر إغلاق */}
        <div className="p-3 border-t border-white/10 bg-zinc-900/60 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="w-full text-white/60 h-8 text-xs"
          >
            إغلاق
          </Button>
        </div>
      </div>
    </div>
  );
}
