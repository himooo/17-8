import type { AttendanceAnalytics, ComparativeReport, GamesAnalytics } from "@/lib/reports-telegram-v10";
import type { ClassReportAggregate } from "@/lib/report-contract";
import { rowsToCsv } from "@/lib/reports-telegram-v10";

type ExportValue = string | number | boolean | Date | null | undefined;
type ExportRow = Record<string, ExportValue>;

type ExcelSheet = {
  name: string;
  rows: ExportRow[];
  fallback?: ExportRow;
};

function downloadBlob(content: BlobPart, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function classRows(report: ClassReportAggregate): ExportRow[] {
  return report.rows.map((row) => ({
    الطالب: row.student.name,
    الترتيب: row.rank,
    النقاط_المحلية: row.local.points,
    دقة_المحلي: row.local.accuracyPct,
    التفاعل_الصحيح: row.interactive.correct,
    التفاعل_المحلول: row.interactive.answered,
    دقة_التفاعل: row.interactive.accuracyPct,
    واجب_Moodle: row.homework.latest?.moodleGrade,
    من: row.homework.latest?.moodleMaxGrade,
    نقاط_الألعاب: row.games.points,
    اختيارات_عادلة: row.fairness.picks,
    الحالة: row.student.isAbsent ? "غائب" : "حاضر",
  }));
}

function sheetData(rows: ExportRow[], fallback: ExportRow = { الطالب: "لا توجد بيانات" }): Array<Array<ExportValue>> {
  const records = rows.length ? rows : [fallback];
  const headers = Object.keys(records[0]);
  return [headers, ...records.map((row) => headers.map((header) => row[header] ?? null))];
}

async function writeWorkbook(sheets: ExcelSheet[], filename: string) {
  const { default: writeExcelFile } = await import("write-excel-file/browser");
  const workbook = sheets.map((sheet) => ({
    name: sheet.name,
    data: sheetData(sheet.rows, sheet.fallback),
  }));
  await writeExcelFile(workbook).toFile(filename);
}

export function exportClassReportCsv(report: ClassReportAggregate, filename = "bisalasa-class-report.csv") {
  const records = classRows(report);
  const headers = records.length ? Object.keys(records[0]) : ["الطالب"];
  const csv = rowsToCsv(headers, records.map((row) => headers.map((header) => row[header])));
  downloadBlob("\ufeff" + csv, filename, "text/csv;charset=utf-8");
}

export async function exportClassReportXlsx(report: ClassReportAggregate, filename = "bisalasa-class-report.xlsx") {
  await writeWorkbook([
    { name: "تقرير الصف", rows: classRows(report) },
    {
      name: "الملخص",
      rows: [{
        الصف: report.scope.className,
        الطلاب: report.totals.students,
        النقاط_المحلية: report.totals.localPoints,
        التفاعل_الصحيح: report.totals.interactiveCorrect,
        إجابات_التفاعل: report.totals.interactiveAnswered,
        نقاط_الألعاب: report.totals.gamePoints,
        درجات_Moodle: report.totals.homeworkGradeCount,
      }],
    },
  ], filename);
}

export function exportAttendanceCsv(report: AttendanceAnalytics, filename = "bisalasa-attendance.csv") {
  const headers = ["studentId", "name", "present", "absent", "late", "rate"];
  const csv = rowsToCsv(headers, report.perStudent.map((row) => [row.studentId, row.name, row.present, row.absent, row.late, row.rate]));
  downloadBlob("\ufeff" + csv, filename, "text/csv;charset=utf-8");
}

export async function exportAttendanceXlsx(report: AttendanceAnalytics, filename = "bisalasa-attendance.xlsx") {
  await writeWorkbook([
    { name: "الحضور", rows: report.perStudent },
    { name: "حسب التاريخ", rows: report.byDate },
  ], filename);
}

export function exportComparisonCsv(report: ComparativeReport, filename = "bisalasa-class-comparison.csv") {
  const headers = ["المؤشر", "الفصل A", "الفصل B", "الفرق"];
  const rows = [["متوسط النقاط", report.classA.averagePoints, report.classB.averagePoints, report.deltas.averagePoints], ["الدقة %", report.classA.accuracyPct, report.classB.accuracyPct, report.deltas.accuracyPct], ["نقاط الألعاب", report.classA.gamePoints, report.classB.gamePoints, report.deltas.gamePoints]];
  downloadBlob("\ufeff" + rowsToCsv(headers, rows), filename, "text/csv;charset=utf-8");
}

export async function exportGamesXlsx(report: GamesAnalytics, filename = "bisalasa-games.xlsx") {
  await writeWorkbook([
    { name: "حسب اللعبة", rows: report.byGame },
    { name: "حسب الطالب", rows: report.byStudent },
  ], filename);
}
