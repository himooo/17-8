import { useEffect, useState } from "react";
import { BarChart3, BookOpen, FileDown, FileText, Presentation, Users, Scale } from "lucide-react";
import { toast } from "sonner";
import { useShellStore } from "@/lib/shell-store";
import { localDb } from "@/lib/local-db";
import type { ClassReportAggregate } from "@/lib/report-contract";
import { ReportAnalyticsV10 } from "@/components/shell/ReportAnalyticsV10";

export function ReportsPanel() {
  const manifest = useShellStore((store) => store.manifest);
  const lessons = useShellStore((store) => store.lessons);
  const activeLessonId = useShellStore((store) => store.activeLessonId);
  const activeClassId = useShellStore((store) => store.activeClassId);
  const currentSessionId = useShellStore((store) => store.currentSessionId);
  const currentStep = useShellStore((store) => store.currentStep);
  const currentIdeaId = useShellStore((store) => store.currentIdeaId);
  const setCurrentStep = useShellStore((store) => store.setCurrentStep);
  const setCurrentIdea = useShellStore((store) => store.setCurrentIdea);
  const students = useShellStore((store) => store.students);
  const sessionStats = useShellStore((store) => store.sessionStats);
  const [busy, setBusy] = useState<string | null>(null);
  const [classReport, setClassReport] = useState<ClassReportAggregate | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const activeLesson = lessons.find((lesson) => lesson.id === activeLessonId) ?? null;
  const fairnessSummary = classReport ? classReport.rows.reduce((summary, row) => ({ picks: summary.picks + row.fairness.picks, manual: summary.manual + row.fairness.manualPicks }), { picks: 0, manual: 0 }) : { picks: 0, manual: 0 };
  useEffect(() => {
    let cancelled = false;
    const loadingTimer = window.setTimeout(() => {
      if (!cancelled) setReportLoading(true);
    }, 0);
    localDb.reports.class({ classId: activeClassId, sessionId: currentSessionId })
      .then((report) => { if (!cancelled) { setClassReport(report); setReportError(null); } })
      .catch((error) => { if (!cancelled) { setClassReport(null); setReportError(error instanceof Error ? error.message : "تعذر تحميل التقرير الموحد"); } })
      .finally(() => { if (!cancelled) setReportLoading(false); });
    return () => { cancelled = true; window.clearTimeout(loadingTimer); };
  }, [activeClassId, currentSessionId]);
  const slideNavigation = {
    currentStep,
    currentIdeaId,
    goToStep: (step: number, ideaId?: string) => {
      setCurrentStep(step);
      if (ideaId !== undefined) setCurrentIdea(ideaId);
    },
  };

  const run = async (key: string, task: () => Promise<void>) => {
    try {
      setBusy(key);
      await task();
      toast.success("تم إنشاء الملف بنجاح");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "تعذر إنشاء الملف");
    } finally {
      setBusy(null);
    }
  };

  const openGrades = () => {
    const query = new URLSearchParams();
    if (activeClassId) query.set("classId", activeClassId);
    if (currentSessionId) query.set("sessionId", currentSessionId);
    window.open(`/grades?${query.toString()}`, "bisalasa-grades");
  };

  const exportClassSummary = () => run("summary", async () => {
    const { exportReportCardToPdf } = await import("@/lib/pdf-export");
    const report = classReport ?? await localDb.reports.class({ classId: activeClassId, sessionId: currentSessionId });
    return exportReportCardToPdf({
      filename: `ملخص-حصة-رياضيات-${new Date().toISOString().slice(0, 10)}`,
      title: `ملخص حصة الرياضيات${activeLesson ? ` — ${activeLesson.title}` : ""}`,
      subtitle: `${report.scope.className} • ${report.rows.length} طالب • ${new Date().toLocaleString("ar-EG")}`,
      sections: [
        { heading: "مؤشرات الحصة", rows: [["عدد الطلاب", String(report.totals.students)], ["النقاط المحلية", String(report.totals.localPoints)], ["صحيح التفاعل", String(report.totals.interactiveCorrect)], ["إجابات التفاعل", String(report.totals.interactiveAnswered)], ["نقاط الألعاب", String(report.totals.gamePoints)], ["طلاب بدرجة Moodle", String(report.totals.homeworkGradeCount)]] },
        { heading: "مصادر الدرجات لكل طالب", rows: report.rows.map((row) => [row.student.name, `محلي ${row.local.points} • تفاعل ${row.interactive.correct}/${row.interactive.answered} • Moodle ${row.homework.latest?.moodleGrade == null ? "—" : `${row.homework.latest.moodleGrade}/${row.homework.latest.moodleMaxGrade ?? "—"}`} • ألعاب ${row.games.points}`]) },
      ],
    });
  });

  const actions = [
    { key: "student", icon: BookOpen, title: "نسخة الطالب PDF", description: "الشرائح الأصلية كما تظهر في العرض", disabled: !manifest || !activeLesson, task: async () => { const { exportLessonSlidesToPdf } = await import("@/lib/pdf-export"); return exportLessonSlidesToPdf({ manifest, activeLesson, navigation: slideNavigation, filename: `${activeLesson?.title ?? "درس"}-نسخة-الطالب`, teacherCopy: false }); } },
    { key: "teacher", icon: Presentation, title: "نسخة المدرس PDF", description: "الشرائح الأصلية مع السكربت والملاحظات والإجابات", disabled: !manifest || !activeLesson, task: async () => { const { exportLessonSlidesToPdf } = await import("@/lib/pdf-export"); return exportLessonSlidesToPdf({ manifest, activeLesson, navigation: slideNavigation, filename: `${activeLesson?.title ?? "درس"}-نسخة-المدرس`, teacherCopy: true }); } },
    { key: "stage", icon: FileText, title: "الشريحة والسبورة PDF", description: "لقطة الشريحة الحالية مع شرح المدرس", disabled: false, task: async () => { const { exportCurrentStageToPdf } = await import("@/lib/pdf-export"); return exportCurrentStageToPdf({ filename: `شريحة-${currentStep}-رياضيات`, orientation: "landscape" }); } },
  ];

  return (
    <div dir="rtl" className="p-4 space-y-4">
      <div className="rounded-xl border border-primary/20 bg-primary/10 p-3">
        <div className="flex items-center gap-2 text-sm font-black text-primary"><BarChart3 className="h-4 w-4" /> مركز تقارير غرفة العمليات</div>
        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">كل تقرير يظل قراراً للمدرس: يمكنك تصدير الحصة كاملة، الشريحة الحالية، أو ملخص الصف بعد مراجعة النتائج.</p>
      </div>
      {reportLoading && <div className="rounded-lg border border-border bg-card/60 p-2 text-[10px] text-muted-foreground">جارٍ تجميع مصادر التقرير: Moodle، التفاعل، الألعاب، والأنشطة...</div>}
      {reportError && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-[10px] text-red-700">تعذر تحميل التقرير الموحد: {reportError}</div>}
      {classReport && <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[["الطلاب", classReport.totals.students], ["صحيح التفاعل", classReport.totals.interactiveCorrect], ["نقاط الألعاب", classReport.totals.gamePoints], ["درجات Moodle", classReport.totals.homeworkGradeCount], ["اختيارات عادلة", fairnessSummary.picks]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-border bg-card p-2 text-center"><div className="text-lg font-black text-primary">{value}</div><div className="text-[9px] text-muted-foreground">{label}</div></div>)}
      </div>}
      <div className="grid gap-2">
        {actions.map(({ key, icon: Icon, title, description, disabled, task }) => (
          <button key={key} disabled={disabled || busy !== null} onClick={() => run(key, task)} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-right transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-45">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary"><Icon className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1"><span className="block text-xs font-bold">{busy === key ? "جاري الإنشاء..." : title}</span><span className="mt-0.5 block text-[10px] text-muted-foreground">{description}</span></span>
            <FileDown className="h-4 w-4 text-muted-foreground" />
          </button>
        ))}
      </div>
      <button onClick={exportClassSummary} disabled={busy !== null} className="flex w-full items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-right hover:bg-emerald-500/15 disabled:opacity-50"><Users className="h-5 w-5 text-emerald-500" /><span className="flex-1"><span className="block text-xs font-bold">ملخص الصف والحصة PDF</span><span className="block text-[10px] text-muted-foreground">النقاط، المشاركة، الأسئلة، الحضور، والطلاب</span></span><FileDown className="h-4 w-4" /></button>
      <button onClick={openGrades} className="flex w-full items-center gap-3 rounded-xl border border-border bg-secondary/50 p-3 text-right hover:bg-accent"><BarChart3 className="h-5 w-5 text-primary" /><span className="flex-1"><span className="block text-xs font-bold">فتح تقرير الدرجات المتقدم</span><span className="block text-[10px] text-muted-foreground">يفتح /grades للطباعة أو الحفظ PDF</span></span></button>
      {classReport && <div className="flex items-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-3 text-[10px] leading-5 text-indigo-800"><Scale className="h-4 w-4 shrink-0" /><span>سجل العدالة: {fairnessSummary.picks} اختياراً، منها {fairnessSummary.manual} اختيار يدوي مسجل وقابل للمراجعة حسب الفكرة والمصدر.</span></div>}
      <ReportAnalyticsV10 classReport={classReport} activeClassId={activeClassId} currentSessionId={currentSessionId} />
      <div className="rounded-lg border border-border p-3 text-[10px] leading-5 text-muted-foreground">{manifest ? `الدرس النشط: ${activeLesson?.title ?? "—"} • الشريحة ${currentStep}` : "حمّل درساً لتفعيل نسخ الطلاب والمدرسين."}{classReport && <span className="mt-1 block text-[9px] text-emerald-700">التقرير الموحد جاهز: كل صف يضم Moodle والتفاعل والألعاب والأنشطة من نفس العقد.</span>}</div>
    </div>
  );
}
