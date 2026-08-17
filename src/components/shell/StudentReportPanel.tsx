"use client";

// ====================================================================
//  StudentReportPanel.tsx — vP2-10 نظام تقارير الطلاب
//
//  تقرير شامل لكل طالب من عدة أقسام:
//    1. Header: اسم الطالب + لقبه + صفّه (الصف النشط)
//    2. Grid 2x3 كروت إحصائية: النقاط / الإجابات الصحيحة / الدقة / الهدايا / الشارات / الجلسات
//    3. رسم بياني شريطي (bar chart) لنقاطه المكتسبة عبر الوقت (الشارات كـ proxy زمني) — CSS فقط
//    4. قائمة آخر 10 أنشطة (badges)
//    5. زر تصدير JSON
//
//  مصدر البيانات: shellStore.students (الكاش التفاعلي الآني) + جلب الأسماء
//  الإضافية (هدايا/جلسات) من db-sync. لا يعتمد على أي مكتبة رسم بياني.
// ====================================================================

import { useState, useEffect, useMemo } from "react";
import { useShellStore } from "@/lib/shell-store";
import { getTotalSteps } from "@/lib/slide-schema";
import type { Student } from "@/lib/slide-schema";
import { Button } from "@/components/ui/button";
import {
  X,
  Trophy,
  Target,
  Star,
  Gift,
  Award,
  BarChart3,
  Download,
  Clock,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { computeTitleRule } from "@/lib/title-rules";
import type { StudentReportAggregate } from "@/lib/report-contract";

// دالة إحضار الهدايا من db-sync (معابر data-store)
async function fetchGiftCount(studentId: string): Promise<number> {
  try {
    const { localDb } = await import("@/lib/local-db");
    const gifts = await localDb.gifts.listByStudent(studentId);
    return gifts?.length ?? 0;
  } catch {
    return 0;
  }
}

// عدد الجلسات التي كانت فيها للطالب. نستخدم السجل الحالي snapshot
// (نفس تقدير leaderboard — عدد الجلسات الكلي للصف لأن الربط الفعلي معقد)
async function fetchSessionCount(activeClassId: string | null): Promise<number> {
  try {
    const { localDb } = await import("@/lib/local-db");
    const sessions = await localDb.sessions.list(activeClassId ?? undefined);
    return sessions?.length ?? 0;
  } catch {
    return 0;
  }
}

// نوع بطاقة إحصائية
interface StatCard {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}

type MoodleHomeworkSnapshot = {
  id: string;
  status: string;
  totalQuestions: number;
  answeredQuestions: number;
  unansweredQuestions: number;
  correctQuestions: number;
  wrongQuestions: number;
  completionPct: number;
  successOnAnsweredPct: number | null;
  successOnTotalPct: number | null;
  moodleGrade: number | null;
  moodleMaxGrade: number | null;
  submittedAt: string | null;
  updatedAt: string;
};
type MoodleHomeworkQuestion = {
  snapshotId: string;
  moodleQuestionId?: number;
  lessonKey?: string;
  ideaKey: string | null;
  isAnswered: boolean;
  isCorrect: boolean | null;
  pointsEarned: number;
};
type MoodleStudentSummary = {
  snapshots: MoodleHomeworkSnapshot[];
  homeworkQuestions: MoodleHomeworkQuestion[];
  attempts: Array<Record<string, unknown>>;
  interactions: Array<Record<string, unknown>>;
};

function homeworkIdeaLabel(row: { correct: number; answered: number; total: number; successPct: number | null }) {
  return `${row.correct}/${row.answered} صحيح • ${row.total - row.answered} لم يُحل${row.successPct == null ? "" : ` • ${row.successPct}%`}`;
}

/**
 * StudentReportPanel — تقرير تفصيلي لطالب واحد مختار من store.students
 *
 * @param studentId معرف الطالب المُختار
 * @param onClose دالة يمررها الأب لإغلاق التقرير
 */
export function StudentReportPanel({
  studentId,
  onClose,
}: {
  studentId: string | null;
  onClose: () => void;
}) {
  // نُقرأ مباشرة من store — أسرع وأكثر آنية من أي fetch بعيد
  const students = useShellStore((s) => s.students);
  const activeClassId = useShellStore((s) => s.activeClassId);
  const currentSessionId = useShellStore((s) => s.currentSessionId);
  const liveStatuses = useShellStore((s) => s.studentLiveStatuses);
  const activeLessonId = useShellStore((s) => s.activeLessonId);
  const lessons = useShellStore((s) => s.lessons);
  const manifest = useShellStore((s) => s.manifest);
  const currentStep = useShellStore((s) => s.currentStep);
  const currentIdeaId = useShellStore((s) => s.currentIdeaId);

  const student: Student | undefined = students.find((s) => s.id === studentId);
  const activeLesson = lessons.find((lesson) => lesson.id === activeLessonId) ?? null;
  const liveStatus = student
    ? liveStatuses[student.id]
      ?? (student.moodleUserId ? liveStatuses[`moodle:${student.moodleUserId}`] : undefined)
      ?? (student.studentCode ? liveStatuses[`custom:${student.studentCode}`] : undefined)
    : undefined;
  const interactiveLesson = {
    lessonId: activeLesson?.id ?? null,
    title: activeLesson?.title ?? null,
    currentStep,
    totalSteps: getTotalSteps(manifest),
    ideaId: currentIdeaId,
  };
  const liveStatusLabel = liveStatus?.status === "correct" ? "إجابة صحيحة" : liveStatus?.status === "wrong" ? "إجابة خاطئة" : liveStatus?.status === "waiting" ? "ينتظر إجابة" : "لا توجد حالة مباشرة";
  const liveSourceLabel = liveStatus?.source === "moodle" ? "Moodle" : liveStatus?.source === "custom" ? "Custom App" : liveStatus?.source === "local" ? "محلي" : "—";

  // ── بيانات جانبية: عدد الهدايا + الجلسات (async) ──────────────────
  const [giftCount, setGiftCount] = useState<number>(0);
  const [sessionCount, setSessionCount] = useState<number>(0);
  const [activeClassName, setActiveClassName] = useState<string>("—");
  const [reportSummary, setReportSummary] = useState<StudentReportAggregate | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  // تحميل بيانات الجانب الإضافي عند فتح التقرير لطالب جديد أو تغيّر الصف النشط
  useEffect(() => {
    let cancelled = false;
    if (!studentId) return;
    fetchGiftCount(studentId).then((c) => {
      if (!cancelled) setGiftCount(c);
    });
    fetchSessionCount(activeClassId).then((c) => {
      if (!cancelled) setSessionCount(c);
    });
    import("@/lib/local-db")
      .then(({ localDb }) => localDb.reports.student({ studentId, sessionId: currentSessionId, classId: activeClassId }))
      .then((unified) => {
        if (!cancelled) { setReportSummary(unified); setReportError(null); }
      })
      .catch((error) => {
        if (!cancelled) { setReportSummary(null); setReportError(error instanceof Error ? error.message : "تعذر تحميل التقرير الموحد"); }
      });
    // اسم الصف النشط للـ header
    if (activeClassId) {
      import("@/lib/data-store")
        .then((m) => m.getAllClasses())
        .then((classes) => {
          if (!cancelled) {
            const cls = classes.find((c) => c.id === activeClassId);
            setActiveClassName(cls?.name ?? "—");
          }
        })
        .catch(() => {
          if (!cancelled) setActiveClassName("—");
        });
    } else {
      // عندما لا يوجد صف نشط نعرض شرطة — نؤجل الـ setState خارج جسم الـ effect
      // المباشر ليتوافق مع react-hooks/set-state-in-effect
      setTimeout(() => {
        if (!cancelled) setActiveClassName("—");
      }, 0);
    }
    return () => {
      cancelled = true;
    };
  }, [studentId, activeClassId, currentSessionId]);

  const latestHomework = reportSummary?.homework.latest ?? null;
  const homeworkByIdea = useMemo(() => (reportSummary?.homework.byIdea ?? []).map((row) => ({ ...row, successPct: row.accuracyPct })), [reportSummary]);

  // إذا الطالب تم حذفه أثناء فتح التقرير، نغلق
  useEffect(() => {
    if (!student && studentId) onClose();
  }, [student, studentId, onClose]);

  // ── إحصائيات الحسابات ────────────────────────────────────────────
  // نقاط دقيقة 0 = لا محاولات مسجلة
  const accuracy = useMemo(() => {
    if (!student || student.attempts === 0) return 0;
    return Math.round((student.correctAnswers / student.attempts) * 100);
  }, [student]);

  // أحدث 10 أنشطة: نأخذ آخر الإدخالات في badges (الأقدم إلى الأحدث)
  const last10 = useMemo(() => {
    if (!student) return [];
    // Badge array in store appends new entries at the end → slice(-10) = latest
    return [...student.badges].slice(-10).reverse();
  }, [student]);

  // قاعدة اللقب (من title-rules) المستحقّة حالياً
  const titleRule = useMemo(() => {
    if (!student) return null;
    return computeTitleRule({
      points: student.points,
      correct: student.correctAnswers,
      wrong: student.wrongAnswers,
      badges: student.badges.length,
    });
  }, [student]);

  // ── الرسم البياني الشريطي ─────────────────────────────────────────
  // نمثل "نقاط مكتسبة عبر الوقت" بتوزيع الشارات على 6 فترات زمنية متساوية
  // لأن Store لا يخزن سجل نقاط تاريخي دقيق — لكن awardedAt في كل badge تعطينا
  // إشارة زمنية حقيقية يمكن تجميعها.
  const POINT_BUCKETS = 6; // 6 أعمدة
  const barData = useMemo(() => {
    if (!student || student.badges.length === 0) return Array(POINT_BUCKETS).fill(0);
    const sorted = [...student.badges].sort(
      (a, b) => new Date(a.awardedAt).getTime() - new Date(b.awardedAt).getTime()
    );
    const t0 = new Date(sorted[0].awardedAt).getTime();
    const t1 = new Date(sorted[sorted.length - 1].awardedAt).getTime();
    const span = Math.max(t1 - t0, 1); // تجنّب القسمة على صفر
    const buckets = Array(POINT_BUCKETS).fill(0);
    for (const b of sorted) {
      const t = new Date(b.awardedAt).getTime();
      // نسبة الزمن بين أول وآخر badge → فهرس الفترة
      const frac = (t - t0) / span;
      const idx = Math.min(POINT_BUCKETS - 1, Math.floor(frac * POINT_BUCKETS));
      buckets[idx] += 1; // كل شارة = نقطة مكتسبة
    }
    return buckets;
  }, [student]);

  const barMax = Math.max(...barData, 1); // للتحجيم حتى لو الكل 0

  if (!student) return null;

  const stats: StatCard[] = [
    {
      label: "النقاط",
      value: student.points,
      icon: <Trophy className="w-4 h-4" />,
      color: "#fbbf24",
    },
    {
      label: "إجابات صحيحة",
      value: student.correctAnswers,
      icon: <Target className="w-4 h-4" />,
      color: "#10b981",
    },
    {
      label: "الدقة",
      value: `${accuracy}%`,
      icon: <Zap className="w-4 h-4" />,
      color: "#8b5cf6",
    },
    {
      label: "الهدايا",
      value: giftCount,
      icon: <Gift className="w-4 h-4" />,
      color: "#ec4899",
    },
    {
      label: "الشارات",
      value: student.badges.length,
      icon: <Award className="w-4 h-4" />,
      color: "#06b6d4",
    },
    {
      label: "الجلسات",
      value: sessionCount,
      icon: <Clock className="w-4 h-4" />,
      color: "#6366f1",
    },
  ];

  const moodlePdfSections: Array<{ heading: string; rows: Array<[string, string]> }> = latestHomework ? [
    {
      heading: "واجب Moodle",
      rows: [
        ["الحالة", latestHomework.status === "not_submitted" ? "لم يُسلّم" : latestHomework.status === "late" ? "متأخر" : latestHomework.status === "stale" ? "بيانات قديمة" : "تم التسليم"],
        ["الإكمال", `${latestHomework.answeredQuestions}/${latestHomework.totalQuestions} (${latestHomework.completionPct}%)`],
        ["النجاح من المحلول", latestHomework.successOnAnsweredPct == null ? "—" : `${latestHomework.successOnAnsweredPct}%`],
        ["النجاح من الإجمالي", latestHomework.successOnTotalPct == null ? "—" : `${latestHomework.successOnTotalPct}%`],
        ["الصحيح / الخاطئ / غير المحلول", `${latestHomework.correctQuestions} / ${latestHomework.wrongQuestions} / ${latestHomework.unansweredQuestions}`],
        ["الدرجة الرسمية", latestHomework.moodleGrade == null ? "—" : `${latestHomework.moodleGrade}${latestHomework.moodleMaxGrade == null ? "" : `/${latestHomework.moodleMaxGrade}`}`],
        ["آخر تحديث", latestHomework.updatedAt ? new Date(latestHomework.updatedAt).toLocaleString("ar-EG") : "—"],
        ["تفاعلات المعلم", String(reportSummary?.interactive.teacherInteractions ?? 0)],
        ["محاولات الأنشطة التفاعلية", String(reportSummary?.interactive.answered ?? 0)],
      ] as Array<[string, string]>,
    },
    {
      heading: "تحليل الواجب حسب الفكرة",
      rows: (homeworkByIdea.length ? homeworkByIdea : [{ ideaKey: "على مستوى الدرس", total: 0, answered: 0, correct: 0, wrong: 0, points: 0, successPct: null }]).map((row) => [
        row.ideaKey === "على مستوى الدرس" ? "على مستوى الدرس (غير موسوم)" : row.ideaKey,
        `${homeworkIdeaLabel(row)} • نقاط ${row.points}`,
      ] as [string, string]),
    },
  ] : [];

  const unifiedPdfSections: Array<{ heading: string; rows: Array<[string, string]> }> = reportSummary ? [
    { heading: "التفاعل أثناء الحصة", rows: [["المحلول / الصحيح / الخطأ", `${reportSummary.interactive.answered} / ${reportSummary.interactive.correct} / ${reportSummary.interactive.wrong}`], ["الدقة", reportSummary.interactive.accuracyPct == null ? "—" : `${reportSummary.interactive.accuracyPct}%`], ["النقاط", String(reportSummary.interactive.points)], ["تدخلات المعلم", String(reportSummary.interactive.teacherInteractions)]] },
    { heading: "الألعاب", rows: [["عدد الألعاب", String(reportSummary.games.gameCount)], ["الأسئلة", String(reportSummary.games.questions)], ["الصحيح / الخطأ", `${reportSummary.games.correct} / ${reportSummary.games.wrong}`], ["النقاط", String(reportSummary.games.points)]] },
    { heading: "الأنشطة والاحتفالات", rows: [["الأنشطة", String(reportSummary.activities.total)], ["نقاط سجل الأنشطة", String(reportSummary.activities.points)], ["الاحتفالات", String(reportSummary.celebrations.total)], ["ملاحظات المعلم", `${reportSummary.notes.total} (${reportSummary.notes.shared} مشاركة)`]] },
  ] : [];

  // === تصدير PDF ===
  const handleExportPdf = async () => {
    try {
      const { exportReportCardToPdf } = await import("@/lib/pdf-export");
      await exportReportCardToPdf({
        filename: `تقرير-${student.name}-${new Date().toISOString().slice(0, 10)}`,
        title: `تقرير الطالب: ${student.name}`,
        subtitle: `${activeClassName} • تم الإنشاء في ${new Date().toLocaleString("ar-EG")}`,
        sections: [
          { heading: "الملخص التعليمي", rows: [["النقاط", String(student.points)], ["الإجابات الصحيحة", String(student.correctAnswers)], ["الإجابات الخاطئة", String(student.wrongAnswers)], ["المحاولات", String(student.attempts)], ["الدقة", `${accuracy}%`]] },
          { heading: "المشاركة والتحفيز", rows: [["الهدايا", String(giftCount)], ["الشارات", String(student.badges.length)], ["الجلسات", String(sessionCount)], ["اللقب الحالي", student.title || titleRule?.name || "—"]] },
          { heading: "المؤشر الحي والشرح التفاعلي", rows: [["حالة الطالب", liveStatusLabel], ["مصدر الحالة", liveSourceLabel], ["آخر تحديث", liveStatus?.updatedAt ? new Date(liveStatus.updatedAt).toLocaleString("ar-EG") : "—"], ["الدرس النشط", interactiveLesson.title || "—"], ["موضع الشريحة", `${interactiveLesson.currentStep}/${interactiveLesson.totalSteps || "—"}`], ["الفكرة النشطة", interactiveLesson.ideaId || "—"]] },
          ...moodlePdfSections,
          ...unifiedPdfSections,
          { heading: "آخر الأنشطة", rows: (reportSummary?.activities.recent ?? last10.map((badge) => ({ label: badge.type, createdAt: badge.awardedAt }))).slice(0, 20).map((item) => ["label" in item ? item.label : item.type, new Date(item.createdAt).toLocaleString("ar-EG")] as [string, string]) },
        ],
      });
      toast.success("تم حفظ تقرير الطالب PDF بنجاح");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "تعذر إنشاء تقرير PDF");
    }
  };

  // === تصدير JSON ===
  const handleExportJson = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      student: {
        id: student.id,
        name: student.name,
        title: student.title,
        points: student.points,
        correctAnswers: student.correctAnswers,
        wrongAnswers: student.wrongAnswers,
        attempts: student.attempts,
        accuracyPct: accuracy,
        giftCount,
        badgeCount: student.badges.length,
        sessionCount,
        classId: activeClassId,
        className: activeClassName,
      },
      rule: titleRule
        ? { id: titleRule.id, name: titleRule.name, icon: titleRule.icon, priority: titleRule.priority }
        : null,
      recentBadges: last10.map((b) => ({ type: b.type, awardedAt: b.awardedAt, note: (b as { note?: string }).note })),
      pointsOverTime: barData,
      liveStatus: liveStatus ? { ...liveStatus } : null,
      interactiveLesson,
      unified: reportSummary,
      moodle: latestHomework ? {
        homework: latestHomework,
        byIdea: homeworkByIdea,
        interactionCount: reportSummary?.interactive.teacherInteractions ?? 0,
        activityAttemptCount: reportSummary?.interactive.answered ?? 0,
      } : null,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    // اسم الملف: اسم الطالب + تاريخ اليوم
    const safeName = student.name.replace(/[\\/:*?"<>|]/g, "_");
    a.download = `تقرير_${safeName}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("تم تصدير تقرير JSON بنجاح 📄");
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
        className="bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-hidden flex flex-col"
      >
        {/* ================= 1. Header: الاسم + اللقب + الصف ================= */}
        <div className="bg-gradient-to-l from-[#0142A0]/60 to-zinc-900 p-4 border-b border-white/10 shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h2 className="text-white font-extrabold text-lg truncate">
                {student.name}
              </h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {/* اللقب التلقائي الحالي */}
                {student.title && (
                  <span className="text-xs bg-amber-400/15 text-amber-300 px-2 py-0.5 rounded-full border border-amber-400/30 truncate max-w-[140px]">
                    {student.title}
                  </span>
                )}
                {/* الصف النشط */}
                <span className="text-xs text-white/60 truncate">
                  📚 {activeClassName}
                </span>
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={onClose} className="text-white/60 hover:text-white h-8 w-8 p-0">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* ================= 2. Grid 2x3 كروت إحصائية ================= */}
        <div className="p-4 border-b border-white/10 bg-zinc-900/30 shrink-0">
          <div className="grid grid-cols-3 gap-2">
            {stats.map((c) => (
              <div
                key={c.label}
                className="bg-zinc-900/60 border border-white/5 rounded-xl p-2.5 text-center flex flex-col items-center justify-center"
              >
                <div style={{ color: c.color }} className="mb-1">
                  {c.icon}
                </div>
                <div className="text-lg font-extrabold text-white leading-none">{c.value}</div>
                <div className="text-[9px] text-white/50 mt-1">{c.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ================= 2.5. المؤشر الحي والشرح التفاعلي ================= */}
        <div className="px-4 py-3 border-b border-white/10 bg-zinc-950/50">
          <div className="text-xs text-white/70 mb-2 flex items-center gap-1"><Target className="w-3.5 h-3.5 text-cyan-400" /> المؤشر الحي والشرح التفاعلي</div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="rounded-lg bg-white/5 px-2 py-1.5"><span className="text-white/40">الحالة: </span><span className="text-white/85">{liveStatusLabel}</span></div>
            <div className="rounded-lg bg-white/5 px-2 py-1.5"><span className="text-white/40">المصدر: </span><span className="text-cyan-300">{liveSourceLabel}</span></div>
            <div className="rounded-lg bg-white/5 px-2 py-1.5"><span className="text-white/40">الدرس: </span><span className="text-white/85 truncate">{interactiveLesson.title || "لا يوجد درس نشط"}</span></div>
            <div className="rounded-lg bg-white/5 px-2 py-1.5"><span className="text-white/40">الشريحة: </span><span className="text-white/85">{interactiveLesson.currentStep}/{interactiveLesson.totalSteps || "—"}</span></div>
          </div>
        </div>

        {reportError && <div className="mx-4 border-b border-red-500/30 bg-red-500/10 px-2 py-2 text-[10px] text-red-200">تعذر تحميل التقرير الموحد: {reportError}</div>}

        {/* ================= 2.6. واجب Moodle وتحليل الفكرة ================= */}
                  {latestHomework ? (

          <div className="px-4 py-3 border-b border-white/10 bg-emerald-950/20">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="text-xs text-emerald-200 flex items-center gap-1"><Target className="w-3.5 h-3.5" /> واجب Moodle</div>
              <span className="text-[10px] text-white/50">{latestHomework.status === "not_submitted" ? "لم يُسلّم" : latestHomework.status === "late" ? "متأخر" : latestHomework.status === "stale" ? "بيانات قديمة" : "تم التسليم"}</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
              <div className="rounded bg-white/5 px-1 py-1"><div className="text-white/45">الإكمال</div><div className="text-white font-semibold">{latestHomework.completionPct}%</div></div>
              <div className="rounded bg-white/5 px-1 py-1"><div className="text-white/45">صح/محلول</div><div className="text-emerald-200 font-semibold">{latestHomework.successOnAnsweredPct == null ? "—" : `${latestHomework.successOnAnsweredPct}%`}</div></div>
              <div className="rounded bg-white/5 px-1 py-1"><div className="text-white/45">صح/الإجمالي</div><div className="text-cyan-200 font-semibold">{latestHomework.successOnTotalPct == null ? "—" : `${latestHomework.successOnTotalPct}%`}</div></div>
              <div className="rounded bg-white/5 px-1 py-1"><div className="text-white/45">الدرجة</div><div className="text-amber-200 font-semibold">{latestHomework.moodleGrade == null ? "—" : `${latestHomework.moodleGrade}${latestHomework.moodleMaxGrade == null ? "" : `/${latestHomework.moodleMaxGrade}`}`}</div></div>
            </div>
            <div className="mt-2 text-[10px] text-white/50">{latestHomework.answeredQuestions}/{latestHomework.totalQuestions} سؤالاً محلولاً • {latestHomework.correctQuestions} صحيح • {latestHomework.unansweredQuestions} غير محلول</div>
            {homeworkByIdea.length > 0 ? (
              <div className="mt-2 space-y-1.5">
                <div className="text-[10px] text-white/60">التوزيع حسب الفكرة</div>
                {homeworkByIdea.slice(0, 12).map((row) => (
                  <div key={row.ideaKey} className="flex items-center justify-between gap-2 rounded bg-black/20 px-2 py-1.5 text-[10px]">
                    <span className="truncate text-white/80">{row.ideaKey === "على مستوى الدرس" ? "على مستوى الدرس (غير موسوم)" : row.ideaKey}</span>
                    <span className="shrink-0 text-white/55">{homeworkIdeaLabel(row)}</span>
                  </div>
                ))}
              </div>
            ) : <div className="mt-2 text-[10px] text-white/45">لا توجد نتائج أسئلة مفصلة بعد.</div>}
          </div>
        ) : <div className="px-4 py-3 border-b border-white/10 bg-zinc-950/40 text-[10px] text-white/45">لا توجد لقطة واجب Moodle لهذا الطالب بعد.</div>}

        {/* ================= 2.7. التقرير الموحد: تفاعل + ألعاب + جودة المصادر ================= */}
        {reportSummary && (
          <div className="px-4 py-3 border-b border-white/10 bg-cyan-950/15 space-y-2">
            <div className="text-xs text-cyan-200 flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" /> دورة الطالب الموحدة</div>
            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
              <div className="rounded bg-white/5 px-2 py-1.5"><span className="text-white/45">التفاعل: </span><span className="text-white/85">{reportSummary.interactive.correct}/{reportSummary.interactive.answered} صحيح</span></div>
              <div className="rounded bg-white/5 px-2 py-1.5"><span className="text-white/45">الألعاب: </span><span className="text-amber-200">{reportSummary.games.gameCount} • {reportSummary.games.points} نقطة</span></div>
              <div className="rounded bg-white/5 px-2 py-1.5"><span className="text-white/45">الأنشطة: </span><span className="text-white/85">{reportSummary.activities.total}</span></div>
              <div className="rounded bg-white/5 px-2 py-1.5"><span className="text-white/45">تدخلات المعلم: </span><span className="text-cyan-200">{reportSummary.interactive.teacherInteractions}</span></div>
            </div>
            {reportSummary.interactive.byIdea.length > 0 && <div className="space-y-1"><div className="text-[10px] text-white/55">التفاعل حسب الفكرة</div>{reportSummary.interactive.byIdea.slice(0, 8).map((row) => <div key={row.ideaKey} className="flex justify-between gap-2 rounded bg-black/20 px-2 py-1 text-[10px]"><span className="truncate text-white/75">{row.ideaKey === "lesson_unmapped" ? "على مستوى الدرس" : row.ideaKey}</span><span className="shrink-0 text-white/55">{row.correct}/{row.answered} • {row.accuracyPct == null ? "—" : `${row.accuracyPct}%`}</span></div>)}</div>}
            <div className="flex flex-wrap gap-1">{reportSummary.quality.map((item) => <span key={item.source} className={cn("rounded-full px-2 py-0.5 text-[9px]", item.status === "ok" ? "bg-emerald-500/15 text-emerald-200" : item.status === "stale" ? "bg-amber-500/15 text-amber-200" : item.status === "not-linked" ? "bg-blue-500/15 text-blue-200" : "bg-white/10 text-white/50")}>{item.label}: {item.status}</span>)}</div>
          </div>
        )}

        {/* ================= 3. الرسم البياني الشريطي البسيط ================= */}
        <div className="p-4 border-b border-white/10 bg-zinc-900/30 shrink-0">
          <div className="text-xs text-white/70 mb-2 flex items-center gap-1">
            <BarChart3 className="w-3.5 h-3.5" />
            النقاط المكتسبة عبر الوقت (كل شارة = نقطة)
          </div>
          <div className="flex items-end gap-1.5 h-24 px-1">
            {barData.map((count, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full group">
                {/* القيمة فوق العمود عند التحويم */}
                <div className="text-[9px] text-white/70 mb-1 opacity-0 group-hover:opacity-100 transition">
                  {count}
                </div>
                <div
                  className="w-full rounded-t-sm transition-all duration-300 group-hover:brightness-125"
                  style={{
                    height: `${(count / barMax) * 100}%`,
                    minHeight: count > 0 ? "4px" : "2px",
                    background:
                      "linear-gradient(180deg, #fbbf24 0%, #d97706 55%, #92400e 100%)",
                    borderRadius: "2px 2px 0 0",
                    opacity: count === 0 ? 0.15 : 1,
                  }}
                />
                <div className="w-full bg-white/5" style={{ height: "1px" }} />
                <div className="text-[8px] text-white/30 mt-0.5">ف{idx + 1}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ================= 4. قائمة آخر 10 أنشطة ================= */}
        <div className="p-4 flex-1 overflow-y-auto bg-zinc-900/20" style={{ scrollbarWidth: "thin" }}>
          <div className="text-xs text-white/70 mb-2 flex items-center gap-1">
            <Star className="w-3.5 h-3.5 text-cyan-400" />
            آخر {last10.length} أنشطة
          </div>
          {last10.length === 0 && (
            <div className="text-white/40 text-xs py-6 text-center">
              لا توجد أنشطة بعد — فالتصليح يبدأ الآن
            </div>
          )}
          <ul className="space-y-1.5">
            {last10.map((b, i) => (
              <li
                key={`${b.awardedAt}-${i}`}
                className="flex items-center gap-2 text-xs bg-zinc-900/50 border border-white/5 rounded-lg px-2.5 py-1.5"
              >
                <span className={cn(
                  "shrink-0 w-5 h-5 flex items-center justify-center rounded",
                  b.type === "correct"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : b.type === "wrong"
                    ? "bg-red-500/20 text-red-400"
                    : "bg-amber-500/20 text-amber-400"
                )}>
                  {b.type === "correct" ? "✓" : b.type === "wrong" ? "✗" : "★"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-white/85 truncate text-[11px]">
                    {(b as { note?: string }).note ||
                      b.type.replace(/[-_]/g, " ")}
                  </div>
                </div>
                <div className="text-[10px] text-white/40 shrink-0">
                  {new Date(b.awardedAt).toLocaleDateString("ar-EG", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* ================= 5. Footer: تصدير PDF وJSON ================= */}
        <div className="p-3 border-t border-white/10 bg-zinc-900/60 shrink-0 flex gap-2">
          <Button
            size="sm"
            onClick={handleExportPdf}
            className="flex-1 bg-emerald-700 hover:bg-emerald-700/80 h-8 text-xs"
          >
            <Download className="w-3.5 h-3.5 ml-1" />
            PDF
          </Button>
          <Button
            size="sm"
            onClick={handleExportJson}
            className="flex-1 bg-[#0142A0] hover:bg-[#0142A0]/80 h-8 text-xs"
          >
            <Download className="w-3.5 h-3.5 ml-1" />
            JSON
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="text-white/70 text-xs"
          >
            <X className="w-3.5 h-3.5 ml-1" />
            إغلاق
          </Button>
        </div>
      </div>
    </div>
  );
}
