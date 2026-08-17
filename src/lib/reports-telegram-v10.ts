import type { ClassReportAggregate, StudentReportAggregate } from "@/lib/report-contract";

export type ReportLanguage = "ar" | "en";
export type ReportKind = "student" | "class" | "parent" | "teacher" | "attendance" | "games" | "comparative" | "analytics";
export type ReportSection = "summary" | "attendance" | "interactive" | "homework" | "games" | "fairness" | "activities" | "notes" | "achievements" | "timeline" | "teacher" | "recommendations";

export type ReportTemplate = {
  id: string;
  name: string;
  kind: ReportKind;
  language: ReportLanguage;
  sections: ReportSection[];
  enabled: boolean;
  isDefault: boolean;
  revision: number;
  updatedAt: string;
};

export type ReportPeriod = { start: string; end: string; timezone?: string };
export type ParentReportPreferences = {
  language: ReportLanguage;
  sections: ReportSection[];
  frequency: "session" | "daily" | "weekly" | "monthly" | "manual";
  liveEvents: boolean;
  reminders: boolean;
};

export type AttendanceInput = { studentId: string; name: string; date: string; status: "present" | "absent" | "late" };
export type AttendanceAnalytics = {
  period: ReportPeriod;
  totalDays: number;
  present: number;
  absent: number;
  late: number;
  attendanceRate: number;
  perStudent: Array<{ studentId: string; name: string; present: number; absent: number; late: number; rate: number }>;
  byDate: Array<{ date: string; present: number; absent: number; late: number }>;
};

export type ComparativeReport = {
  classA: { id: string | null; name: string; students: number; averagePoints: number; accuracyPct: number; attendanceRate: number | null; gamePoints: number };
  classB: { id: string | null; name: string; students: number; averagePoints: number; accuracyPct: number; attendanceRate: number | null; gamePoints: number };
  deltas: { averagePoints: number; accuracyPct: number; attendanceRate: number | null; gamePoints: number };
  leader: "A" | "B" | "tie";
};

export type GamesAnalytics = {
  totalGames: number;
  totalQuestions: number;
  averageDurationMs: number | null;
  byGame: Array<{ gameType: string; played: number; points: number; correct: number; wrong: number; accuracyPct: number | null }>;
  byStudent: Array<{ studentId: string; name: string; games: number; wins: number; points: number; accuracyPct: number | null }>;
};

export type TelegramCommand = "start" | "help" | "report" | "weekly" | "attendance" | "achievements" | "link" | "contact" | "unknown";
export type TelegramCallback = { action: "report" | "weekly" | "attendance" | "achievements" | "contact"; studentId: string };
export type TelegramQueuePayload = { method: "sendMessage" | "sendDocument" | "sendPhoto"; chatId: string; body: Record<string, unknown>; kind: string; studentId?: string | null; idempotencyKey: string };

export const REPORT_SECTIONS: Array<{ id: ReportSection; ar: string; en: string }> = [
  { id: "summary", ar: "الملخص", en: "Summary" }, { id: "attendance", ar: "الحضور", en: "Attendance" },
  { id: "interactive", ar: "التفاعل", en: "Interactive" }, { id: "homework", ar: "الواجب", en: "Homework" },
  { id: "games", ar: "الألعاب", en: "Games" }, { id: "fairness", ar: "العدالة", en: "Fairness" },
  { id: "activities", ar: "الأنشطة", en: "Activities" }, { id: "notes", ar: "ملاحظات المعلم", en: "Teacher notes" },
  { id: "achievements", ar: "الإنجازات", en: "Achievements" }, { id: "timeline", ar: "الخط الزمني", en: "Timeline" },
  { id: "teacher", ar: "مراجعة المعلم", en: "Teacher reflection" }, { id: "recommendations", ar: "التوصيات", en: "Recommendations" },
];

export const DEFAULT_REPORT_TEMPLATES: ReportTemplate[] = [
  { id: "student-standard", name: "تقرير الطالب الكامل", kind: "student", language: "ar", sections: ["summary", "interactive", "homework", "games", "fairness", "notes", "achievements", "recommendations"], enabled: true, isDefault: true, revision: 1, updatedAt: new Date(0).toISOString() },
  { id: "parent-safe", name: "ملخص ولي الأمر", kind: "parent", language: "ar", sections: ["summary", "attendance", "homework", "games", "achievements", "recommendations"], enabled: true, isDefault: true, revision: 1, updatedAt: new Date(0).toISOString() },
  { id: "class-standard", name: "تقرير الصف", kind: "class", language: "ar", sections: ["summary", "interactive", "homework", "games", "fairness", "recommendations"], enabled: true, isDefault: true, revision: 1, updatedAt: new Date(0).toISOString() },
  { id: "teacher-reflection", name: "مراجعة المعلم", kind: "teacher", language: "ar", sections: ["summary", "interactive", "games", "fairness", "activities", "teacher", "recommendations"], enabled: true, isDefault: true, revision: 1, updatedAt: new Date(0).toISOString() },
];

const VALID_SECTIONS = new Set(REPORT_SECTIONS.map((row) => row.id));
export function normalizeReportTemplate(input: Partial<ReportTemplate>, fallbackKind: ReportKind = "student"): ReportTemplate {
  const sections = Array.isArray(input.sections) ? [...new Set(input.sections.filter((value): value is ReportSection => typeof value === "string" && VALID_SECTIONS.has(value as ReportSection)))] : [];
  return { id: typeof input.id === "string" && input.id.trim() ? input.id.trim().slice(0, 120) : `template-${fallbackKind}`, name: typeof input.name === "string" && input.name.trim() ? input.name.trim().slice(0, 120) : "قالب تقرير", kind: input.kind && ["student", "class", "parent", "teacher", "attendance", "games", "comparative", "analytics"].includes(input.kind) ? input.kind : fallbackKind, language: input.language === "en" ? "en" : "ar", sections: sections.length ? sections : ["summary"], enabled: input.enabled !== false, isDefault: input.isDefault === true, revision: Number.isInteger(input.revision) && (input.revision as number) > 0 ? input.revision as number : 1, updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : new Date().toISOString() };
}

export function renderMessageTemplate(template: string, variables: Record<string, string | number | null | undefined>): string {
  const safe = template.slice(0, 4000);
  return safe.replace(/\{([a-zA-Z0-9_.-]+)\}/g, (_, key: string) => variables[key] == null ? "" : String(variables[key]));
}

export function parseTelegramCommand(text: string): { command: TelegramCommand; argument: string } {
  const normalized = text.trim().replace(/@[A-Za-z0-9_]+$/, "");
  const match = normalized.match(/^\/(start|help|report|weekly|attendance|achievements|link|contact)(?:\s+(.+))?$/i);
  if (!match) return { command: "unknown", argument: normalized };
  return { command: match[1].toLowerCase() as TelegramCommand, argument: (match[2] ?? "").trim() };
}

export function makeParentKeyboard(studentId: string, language: ReportLanguage = "ar") {
  const labels = language === "ar" ? { weekly: "تقرير الأسبوع", achievements: "الإنجازات", attendance: "الحضور", contact: "تواصل مع المدرس" } : { weekly: "Weekly report", achievements: "Achievements", attendance: "Attendance", contact: "Contact teacher" };
  return { inline_keyboard: [[{ text: labels.weekly, callback_data: `weekly:${studentId}` }, { text: labels.achievements, callback_data: `achievements:${studentId}` }], [{ text: labels.attendance, callback_data: `attendance:${studentId}` }, { text: labels.contact, callback_data: `contact:${studentId}` }]] };
}

export function parseTelegramCallback(data: string): TelegramCallback | null {
  const match = data.trim().match(/^(report|weekly|attendance|achievements|contact):([A-Za-z0-9_-]{1,120})$/);
  return match ? { action: match[1] as TelegramCallback["action"], studentId: match[2] } : null;
}

export function retryDelayMs(attempt: number, baseMs = 30_000, maxMs = 6 * 60 * 60 * 1000) {
  const safeAttempt = Math.max(0, Math.min(12, Math.floor(attempt)));
  return Math.min(maxMs, baseMs * (2 ** safeAttempt));
}

export function makeIdempotencyKey(kind: string, chatId: string, studentId: string | null, period: string) {
  return [kind, chatId, studentId ?? "none", period].map((part) => part.replace(/[^A-Za-z0-9_.:-]/g, "_")).join(":").slice(0, 240);
}

export function createRateLimiter(limit = 30, windowMs = 60_000) {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return (key: string, now = Date.now()) => { const current = buckets.get(key); if (!current || current.resetAt <= now) { buckets.set(key, { count: 1, resetAt: now + windowMs }); return true; } if (current.count >= limit) return false; current.count += 1; return true; };
}

function percent(correct: number, total: number) { return total ? Math.round((correct / total) * 10000) / 100 : 0; }
function average(value: number, count: number) { return count ? Math.round((value / count) * 100) / 100 : 0; }
function classSummary(report: ClassReportAggregate) { const rows = report.rows; const attempted = rows.reduce((sum, row) => sum + row.local.correct + row.local.wrong, 0); return { id: report.scope.classId, name: report.scope.className, students: rows.length, averagePoints: average(report.totals.localPoints, rows.length), accuracyPct: percent(report.totals.localCorrect, attempted), attendanceRate: null as number | null, gamePoints: report.totals.gamePoints }; }
export function buildComparativeReport(a: ClassReportAggregate, b: ClassReportAggregate): ComparativeReport { const classA = classSummary(a); const classB = classSummary(b); const deltas = { averagePoints: Math.round((classA.averagePoints - classB.averagePoints) * 100) / 100, accuracyPct: Math.round((classA.accuracyPct - classB.accuracyPct) * 100) / 100, attendanceRate: null, gamePoints: classA.gamePoints - classB.gamePoints }; const leader = deltas.averagePoints === 0 ? "tie" : deltas.averagePoints > 0 ? "A" : "B"; return { classA, classB, deltas, leader }; }

export function buildAttendanceAnalytics(rows: AttendanceInput[], period: ReportPeriod): AttendanceAnalytics { const byStudent = new Map<string, { studentId: string; name: string; present: number; absent: number; late: number }>(); const byDate = new Map<string, { date: string; present: number; absent: number; late: number }>(); for (const row of rows) { const student = byStudent.get(row.studentId) ?? { studentId: row.studentId, name: row.name, present: 0, absent: 0, late: 0 }; const date = byDate.get(row.date) ?? { date: row.date, present: 0, absent: 0, late: 0 }; student[row.status] += 1; date[row.status] += 1; byStudent.set(row.studentId, student); byDate.set(row.date, date); } const present = rows.filter((row) => row.status === "present").length; const absent = rows.filter((row) => row.status === "absent").length; const late = rows.filter((row) => row.status === "late").length; const total = present + absent + late; return { period, totalDays: new Set(rows.map((row) => row.date)).size, present, absent, late, attendanceRate: percent(present + late, total), perStudent: [...byStudent.values()].map((row) => ({ ...row, rate: percent(row.present + row.late, row.present + row.absent + row.late) })).sort((a, b) => a.name.localeCompare(b.name, "ar")), byDate: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)) }; }

export function buildGamesAnalytics(reports: StudentReportAggregate[]): GamesAnalytics { const byGame = new Map<string, { gameType: string; played: number; points: number; correct: number; wrong: number }>(); const byStudent = reports.map((row) => ({ studentId: row.student.id, name: row.student.name, games: row.games.gameCount, wins: 0, points: row.games.points, correct: row.games.correct, wrong: row.games.wrong })); for (const report of reports) { for (const activity of report.activities.byType.filter((row) => row.type === "game")) { const gameType = "game"; const current = byGame.get(gameType) ?? { gameType, played: 0, points: 0, correct: 0, wrong: 0 }; current.played += activity.count; current.points += activity.pointsDelta; byGame.set(gameType, current); } } const totalGames = reports.reduce((sum, row) => sum + row.games.gameCount, 0); const totalQuestions = reports.reduce((sum, row) => sum + row.games.questions, 0); return { totalGames, totalQuestions, averageDurationMs: null, byGame: [...byGame.values()].map((row) => ({ ...row, accuracyPct: percent(row.correct, row.correct + row.wrong) })), byStudent: byStudent.map(({ correct, wrong, ...row }) => ({ ...row, accuracyPct: percent(correct, correct + wrong) })).sort((a, b) => b.points - a.points) }; }

export function buildTeacherReflection(report: ClassReportAggregate) { const rows = report.rows; const interactions = rows.reduce((sum, row) => sum + row.interactive.teacherInteractions, 0); const events = rows.reduce((sum, row) => sum + row.activities.total, 0); const struggling = rows.filter((row) => row.interactive.accuracyPct != null && (row.interactive.accuracyPct as number) < 60).map((row) => row.student.name); return { questionsAsked: report.totals.interactiveAnswered, teacherInteractions: interactions, activityEvents: events, participationRate: percent(rows.filter((row) => row.interactive.answered > 0).length, rows.length), strugglingStudents: struggling, recommendations: [interactions === 0 ? "سجّل تدخلاً عند التعامل الفردي مع طالب" : "استمر في تسجيل التدخلات القابلة للمراجعة", struggling.length ? "راجع أفكار الطلاب المتعثرين قبل الانتقال" : "استمر في التدرج الحالي"] }; }

export function csvEscape(value: unknown) { const text = String(value ?? ""); return /[\n\r,\"]/.test(text) ? `"${text.replace(/\"/g, "\"\"")}"` : text; }
export function rowsToCsv(headers: string[], rows: Array<Array<unknown>>) { return [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n") + "\r\n"; }

export function parentSections(preferences: Partial<ParentReportPreferences>): ParentReportPreferences { const sections = Array.isArray(preferences.sections) ? [...new Set(preferences.sections.filter((section): section is ReportSection => VALID_SECTIONS.has(section)))] : []; return { language: preferences.language === "en" ? "en" : "ar", sections: sections.length ? sections : ["summary", "attendance", "homework", "achievements"], frequency: ["session", "daily", "weekly", "monthly", "manual"].includes(preferences.frequency as string) ? preferences.frequency as ParentReportPreferences["frequency"] : "weekly", liveEvents: preferences.liveEvents === true, reminders: preferences.reminders === true }; }
