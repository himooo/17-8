"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarCheck, Download, FileSpreadsheet, Gamepad2, GitCompare, Save, Users } from "lucide-react";
import { toast } from "sonner";
import { localDb, type ClassRoom } from "@/lib/local-db";
import type { ClassReportAggregate } from "@/lib/report-contract";
import type { AttendanceAnalytics, ComparativeReport, GamesAnalytics, ReportSection, ReportTemplate } from "@/lib/reports-telegram-v10";
import { REPORT_SECTIONS } from "@/lib/reports-telegram-v10";
import { exportAttendanceCsv, exportAttendanceXlsx, exportClassReportCsv, exportClassReportXlsx, exportComparisonCsv, exportGamesXlsx } from "@/lib/report-export-v10";

type Props = { classReport: ClassReportAggregate | null; activeClassId: string | null; currentSessionId: string | null };

const ReportPerformanceChart = dynamic(() => import("./ReportPerformanceChart").then((module) => module.ReportPerformanceChart), {
  ssr: false,
  loading: () => <div className="h-52 rounded-xl border border-dashed border-border p-3 text-[10px] text-muted-foreground">جارٍ تحميل الرسم...</div>,
});

function Stat({ label, value }: { label: string; value: string | number }) { return <div className="rounded-xl border border-border bg-card p-2 text-center"><div className="text-lg font-black text-primary">{value}</div><div className="text-[9px] text-muted-foreground">{label}</div></div>; }

export function ReportAnalyticsV10({ classReport, activeClassId, currentSessionId }: Props) {
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [compareId, setCompareId] = useState("");
  const [comparison, setComparison] = useState<ComparativeReport | null>(null);
  const [attendance, setAttendance] = useState<AttendanceAnalytics | null>(null);
  const [games, setGames] = useState<GamesAnalytics | null>(null);
  const [teacher, setTeacher] = useState<Record<string, unknown> | null>(null);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [templateName, setTemplateName] = useState("قالب صف مخصص");
  const [templateSections, setTemplateSections] = useState<ReportSection[]>(["summary", "interactive", "homework", "games", "recommendations"]);
  const [busy, setBusy] = useState<string | null>(null);
  const period = useMemo(() => { const end = new Date(); const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000); return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }; }, []);

  useEffect(() => { localDb.classes.list().then(setClasses).catch(() => setClasses([])); }, []);
  useEffect(() => { localDb.reports.listTemplates({ kind: "class", classId: activeClassId }).then((rows) => { setTemplates(rows); if (!selectedTemplate && rows[0]) { setSelectedTemplate(rows[0]); setTemplateSections(rows[0].sections); setTemplateName(rows[0].name); } }).catch(() => undefined); }, [activeClassId, selectedTemplate]);

  const chartData = useMemo(() => (classReport?.rows ?? []).slice(0, 12).map((row) => ({ name: row.student.name.slice(0, 12), points: row.local.points, accuracy: row.local.accuracyPct })), [classReport]);
  const otherClasses = classes.filter((row) => row.id !== activeClassId);
  const run = async (key: string, task: () => Promise<void>) => { try { setBusy(key); await task(); toast.success("تم تنفيذ العملية"); } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر تنفيذ العملية"); } finally { setBusy(null); } };
  const toggleSection = (section: ReportSection) => setTemplateSections((current) => current.includes(section) ? current.filter((item) => item !== section) : [...current, section]);

  if (!classReport) return <div className="rounded-xl border border-dashed border-border p-3 text-[10px] text-muted-foreground">ستظهر لوحة التحليلات بعد تحميل تقرير الصف.</div>;

  return <div dir="rtl" className="space-y-3">
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
      <div className="flex items-center gap-2 text-sm font-black text-primary"><BarChart3 className="h-4 w-4" /> لوحة التحليلات V10</div>
      <p className="mt-1 text-[10px] leading-5 text-muted-foreground">تحليل قابل للمراجعة يجمع الصف، الفكرة، Moodle، التفاعل، الألعاب والعدالة. لا يغيّر هذا التقرير نقاط الطالب ولا يستبدل قرار المدرس.</p>
    </div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5"><Stat label="الطلاب" value={classReport.totals.students} /><Stat label="النقاط" value={classReport.totals.localPoints} /><Stat label="صحيح التفاعل" value={classReport.totals.interactiveCorrect} /><Stat label="نقاط الألعاب" value={classReport.totals.gamePoints} /><Stat label="درجات Moodle" value={classReport.totals.homeworkGradeCount} /></div>
    <ReportPerformanceChart data={chartData} />
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="rounded-xl border border-border bg-card p-3"><div className="mb-2 flex items-center gap-2 text-xs font-black"><GitCompare className="h-4 w-4 text-primary" /> مقارنة فصلين</div><div className="flex gap-2"><select value={compareId} onChange={(event) => setCompareId(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-2 text-[11px]"><option value="">اختر فصلاً للمقارنة</option>{otherClasses.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select><button disabled={!compareId || busy !== null} onClick={() => run("compare", async () => setComparison(await localDb.reports.compare({ classAId: activeClassId ?? "", classBId: compareId, sessionId: currentSessionId })))} className="rounded-lg bg-primary px-3 py-2 text-[10px] font-bold text-primary-foreground disabled:opacity-50">حلل</button></div>{comparison && <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]"><div className="rounded-lg bg-muted p-2"><b>{comparison.classA.name}</b><br />متوسط: {comparison.classA.averagePoints}<br />دقة: {comparison.classA.accuracyPct}%</div><div className="rounded-lg bg-muted p-2"><b>{comparison.classB.name}</b><br />متوسط: {comparison.classB.averagePoints}<br />دقة: {comparison.classB.accuracyPct}%</div><button onClick={() => exportComparisonCsv(comparison)} className="col-span-2 rounded-lg border border-border px-2 py-1 text-[10px]">تصدير المقارنة CSV</button></div>}</div>
      <div className="rounded-xl border border-border bg-card p-3"><div className="mb-2 flex items-center gap-2 text-xs font-black"><CalendarCheck className="h-4 w-4 text-emerald-600" /> الحضور والتقرير الانعكاسي</div><div className="flex gap-2"><button disabled={!activeClassId || busy !== null} onClick={() => run("attendance", async () => setAttendance(await localDb.reports.attendance({ classId: activeClassId ?? "", ...period })))} className="flex-1 rounded-lg border border-border px-2 py-2 text-[10px]">احسب الحضور</button><button disabled={busy !== null} onClick={() => run("teacher", async () => setTeacher(await localDb.reports.teacher({ classId: activeClassId, sessionId: currentSessionId })))} className="flex-1 rounded-lg border border-border px-2 py-2 text-[10px]">مراجعة المعلم</button></div>{attendance && <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[9px]"><Stat label="أيام" value={attendance.totalDays} /><Stat label="حاضر" value={attendance.present} /><Stat label="معدل" value={`${attendance.attendanceRate}%`} /><button onClick={() => exportAttendanceCsv(attendance)} className="rounded border border-border p-1">CSV</button><button onClick={() => run("attendance-xlsx", async () => exportAttendanceXlsx(attendance))} className="rounded border border-border p-1">XLSX</button></div>}{teacher && <div className="mt-2 rounded-lg bg-muted p-2 text-[10px] leading-5">تفاعل المعلم: {String(teacher.teacherInteractions ?? 0)} • مشاركة: {String(teacher.participationRate ?? 0)}%<br />طلاب يحتاجون مراجعة: {Array.isArray(teacher.strugglingStudents) ? teacher.strugglingStudents.join("، ") || "لا يوجد" : "—"}</div>}</div>
    </div>
    <div className="rounded-xl border border-border bg-card p-3"><div className="mb-2 flex items-center gap-2 text-xs font-black"><FileSpreadsheet className="h-4 w-4 text-emerald-600" /> التصدير الجدولي</div><div className="grid grid-cols-2 gap-2"><button disabled={busy !== null} onClick={() => exportClassReportCsv(classReport)} className="flex items-center justify-center gap-1 rounded-lg border border-border px-2 py-2 text-[10px]"><Download className="h-3 w-3" /> CSV</button><button disabled={busy !== null} onClick={() => run("class-xlsx", async () => exportClassReportXlsx(classReport))} className="flex items-center justify-center gap-1 rounded-lg border border-border px-2 py-2 text-[10px]"><FileSpreadsheet className="h-3 w-3" /> XLSX</button><button disabled={busy !== null} onClick={() => run("games-xlsx", async () => exportGamesXlsx(games ?? await localDb.reports.games({ classId: activeClassId, sessionId: currentSessionId })))} className="flex items-center justify-center gap-1 rounded-lg border border-border px-2 py-2 text-[10px]"><Gamepad2 className="h-3 w-3" /> ألعاب XLSX</button></div></div>
    <div className="rounded-xl border border-border bg-card p-3"><div className="mb-2 flex items-center justify-between gap-2"><div className="flex items-center gap-2 text-xs font-black"><Users className="h-4 w-4 text-primary" /> قوالب التقارير</div><select value={selectedTemplate?.id ?? ""} onChange={(event) => { const found = templates.find((row) => row.id === event.target.value); if (found) { setSelectedTemplate(found); setTemplateSections(found.sections); setTemplateName(found.name); } }} className="max-w-[160px] rounded-lg border border-border bg-background px-2 py-1 text-[10px]"><option value="">قالب جديد</option>{templates.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></div><input value={templateName} onChange={(event) => setTemplateName(event.target.value)} className="mb-2 w-full rounded-lg border border-border bg-background px-2 py-2 text-[10px]" placeholder="اسم القالب" /><div className="grid grid-cols-2 gap-1">{REPORT_SECTIONS.map((section) => <label key={section.id} className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[9px]"><input type="checkbox" checked={templateSections.includes(section.id)} onChange={() => toggleSection(section.id)} />{section.ar}</label>)}</div><button disabled={!templateSections.length || busy !== null} onClick={() => run("template", async () => { const saved = await localDb.reports.saveTemplate({ id: selectedTemplate?.id, revision: selectedTemplate?.revision, name: templateName, kind: "class", language: "ar", sections: templateSections, enabled: true }); setTemplates(await localDb.reports.listTemplates({ kind: "class", classId: activeClassId })); setSelectedTemplate(saved as ReportTemplate); })} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-[10px] font-bold text-primary-foreground"><Save className="h-3 w-3" /> حفظ القالب</button></div>
  </div>;
}
