import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import ArabicReshaper from "arabic-reshaper";
import bidiFactory from "bidi-js";

const bidi = bidiFactory();

function rtl(value: string) {
  return value.split("\n").map((line) => {
    const shaped = ArabicReshaper.convertArabic(line);
    const levels = bidi.getEmbeddingLevels(shaped, "rtl");
    return bidi.getReorderedString(shaped, levels);
  }).join("\n");
}

function wrap(value: string, max = 58) {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > max && current) { lines.push(current); current = word; } else current = candidate;
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

type IdeaRow = { ideaKey: string; total: number; answered?: number; unanswered?: number; correct: number; wrong: number; points?: number; successPct?: number | null; accuracyPct?: number | null; accuracy?: number | null };

export type TelegramReportInput = {
  studentName: string;
  points: number;
  correct: number;
  wrong: number;
  attempts: number;
  badges: string[];
  dateLabel: string;
  sessionLabel?: string;
  moodle?: {
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
    updatedAt: string;
    interactions: number;
    activityAttempts: number;
    byIdea: Array<IdeaRow>;
  };
  liveApp?: {
    total: number;
    answered?: number;
    unanswered?: number;
    correct: number;
    wrong: number;
    points?: number;
    accuracy: number | null;
    byIdea: Array<IdeaRow>;
    teacherInteractions?: number;
  };
  games?: {
    gameCount: number;
    points: number;
    correct: number;
    wrong: number;
    questions: number;
    byIdea: Array<IdeaRow>;
  };
  activities?: {
    total: number;
    points: number;
    byType: Array<{ type: string; count: number; pointsDelta: number }>;
  };
  fairness?: { picks: number; manualPicks: number; automaticPicks: number };
  celebrations?: {
    total: number;
    byType: Array<{ label: string; icon: string; count: number }>;
  };
  notes?: { total: number; shared: number };
  quality?: Array<{ label: string; status: string; detail: string }>;
};

export async function generateTelegramStudentPdf(input: TelegramReportInput) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fontBytes = await fs.readFile(path.join(process.cwd(), "public", "fonts", "Amiri-Regular.ttf"));
  // Keep the full Amiri cmap: presentation-form glyphs used by ArabicReshaper
  // must remain available in pdf-lib/fontkit output.
  const font = await pdf.embedFont(fontBytes, { subset: false });
  const ink = rgb(0.08, 0.15, 0.28);
  const muted = rgb(0.32, 0.38, 0.48);
  let page: PDFPage = pdf.addPage([595.28, 841.89]);
  let y = page.getHeight() - 70;

  const newPage = () => {
    page = pdf.addPage([595.28, 841.89]);
    y = page.getHeight() - 58;
  };
  const ensureSpace = (needed = 26) => { if (y < needed + 45) newPage(); };
  const draw = (text: string, size: number, color = ink, gap = 30, max = 67) => {
    for (const line of wrap(text, max)) {
      ensureSpace(size + 10);
      page.drawText(rtl(line), { x: 55, y, size, font, color, maxWidth: page.getWidth() - 110, lineHeight: size + 8 });
      y -= gap;
    }
  };
  const section = (title: string) => { y -= 8; ensureSpace(40); draw(title, 16, ink, 28); };
  const ideaLabel = (key: string) => key === "lesson_unmapped" ? "على مستوى الدرس (غير موسوم)" : key;

  const total = input.correct + input.wrong;
  const accuracy = total ? Math.round((input.correct / total) * 100) : 0;
  draw("تقرير ولي الأمر — منصة بسلاسة", 20, ink, 42);
  draw(`الطالب: ${input.studentName}`, 15, ink, 28);
  draw(`التاريخ: ${input.dateLabel}`, 12, muted, 24);
  if (input.sessionLabel) draw(`الجلسة: ${input.sessionLabel}`, 12, muted, 30);
  page.drawLine({ start: { x: 55, y: y + 8 }, end: { x: page.getWidth() - 55, y: y + 8 }, thickness: 1, color: rgb(0.82, 0.85, 0.9) }); y -= 18;

  section("ملخص الأداء");
  draw(`النقاط: ${input.points}`, 13, ink, 24);
  draw(`الإجابات الصحيحة: ${input.correct}`, 13, ink, 24);
  draw(`الأخطاء: ${input.wrong}`, 13, ink, 24);
  draw(`المحاولات: ${input.attempts}`, 13, ink, 24);
  draw(`الدقة: ${accuracy}%`, 13, ink, 34);
  draw("الشارات الأخيرة", 16, ink, 28);
  for (const line of wrap(input.badges.length ? input.badges.join("، ") : "لا توجد شارات جديدة")) draw(line, 12, muted, 22);

  if (input.moodle) {
    section("واجب Moodle");
    const homeworkStatus = input.moodle.status === "not_submitted" ? "لم يُسلّم" : input.moodle.status === "late" ? "متأخر" : input.moodle.status === "stale" ? "بيانات قديمة" : "تم التسليم";
    draw(`الحالة: ${homeworkStatus}`, 12, ink, 21);
    draw(`الإكمال: ${input.moodle.answeredQuestions}/${input.moodle.totalQuestions} (${input.moodle.completionPct}%)`, 12, ink, 21);
    draw(`النجاح من المحلول: ${input.moodle.successOnAnsweredPct == null ? "—" : `${input.moodle.successOnAnsweredPct}%`}`, 12, ink, 21);
    draw(`النجاح من الإجمالي: ${input.moodle.successOnTotalPct == null ? "—" : `${input.moodle.successOnTotalPct}%`}`, 12, ink, 21);
    draw(`الصحيح / الخاطئ / غير المحلول: ${input.moodle.correctQuestions} / ${input.moodle.wrongQuestions} / ${input.moodle.unansweredQuestions}`, 12, ink, 21);
    draw(`الدرجة الرسمية: ${input.moodle.moodleGrade == null ? "—" : `${input.moodle.moodleGrade}${input.moodle.moodleMaxGrade == null ? "" : `/${input.moodle.moodleMaxGrade}`}`}`, 12, ink, 21);
    draw(`تفاعلات المعلم: ${input.moodle.interactions} • محاولات النشاط: ${input.moodle.activityAttempts}`, 12, muted, 25);
    draw("التحليل حسب الفكرة", 14, ink, 24);
    for (const row of input.moodle.byIdea.slice(0, 20)) draw(`${ideaLabel(row.ideaKey)}: ${row.correct}/${row.answered ?? row.total} صحيح • ${(row.unanswered ?? (row.total - (row.answered ?? 0)))} غير محلول • ${row.successPct == null ? "—" : `${row.successPct}%`} • نقاط ${row.points ?? 0}`, 10, muted, 18);
    draw(`آخر تحديث للواجب: ${new Date(input.moodle.updatedAt).toLocaleString("ar-EG")}`, 10, muted, 22);
  }

  if (input.liveApp && input.liveApp.total > 0) {
    section("حل App التفاعلي أثناء الحصة");
    draw(`الإجمالي: ${input.liveApp.total} • الصحيح: ${input.liveApp.correct} • الخاطئ: ${input.liveApp.wrong} • الدقة: ${input.liveApp.accuracy == null ? "—" : `${input.liveApp.accuracy}%`}`, 12, ink, 24);
    draw(`المحلول: ${input.liveApp.answered ?? input.liveApp.total} • غير المحلول: ${input.liveApp.unanswered ?? 0} • نقاط التفاعل: ${input.liveApp.points ?? 0} • تدخلات المعلم: ${input.liveApp.teacherInteractions ?? 0}`, 11, muted, 24);
    draw("تحليل الفكرة", 14, ink, 24);
    for (const row of input.liveApp.byIdea.slice(0, 20)) draw(`${ideaLabel(row.ideaKey)}: ${row.correct}/${row.total} صحيح • ${row.wrong} خطأ • ${row.accuracyPct ?? row.accuracy ?? "—"}%`, 10, muted, 18);
  }

  if (input.games && input.games.gameCount > 0) {
    section("الألعاب المرتبطة بالدرس");
    draw(`عدد الألعاب: ${input.games.gameCount} • الأسئلة: ${input.games.questions} • النقاط: ${input.games.points}`, 12, ink, 22);
    draw(`الصحيح: ${input.games.correct} • الخطأ: ${input.games.wrong}`, 12, ink, 22);
    for (const row of input.games.byIdea.slice(0, 20)) draw(`${ideaLabel(row.ideaKey)}: ${row.correct} صحيح • ${row.wrong} خطأ • نقاط ${row.points ?? 0}`, 10, muted, 18);
  }

  if (input.activities && input.activities.total > 0) {
    section("سجل التفاعل والتحفيز");
    draw(`إجمالي الأحداث: ${input.activities.total} • صافي النقاط من السجل: ${input.activities.points}`, 12, ink, 23);
    for (const row of input.activities.byType.slice(0, 12)) draw(`${row.type}: ${row.count} مرة • نقاط ${row.pointsDelta}`, 10, muted, 18);
  }
  if (input.fairness && input.fairness.picks > 0) {
    section("المشاركة أثناء الحصة");
    draw(`اختيارات المعلم: ${input.fairness.picks} • يدوية: ${input.fairness.manualPicks} • تلقائية: ${input.fairness.automaticPicks}`, 12, ink, 22);
    draw("هذا المؤشر يصف فرص المشاركة المسجلة، وليس درجة الطالب.", 10, muted, 20);
  }
  if (input.celebrations && input.celebrations.total > 0) {
    section("الاحتفالات");
    draw(`إجمالي الاحتفالات: ${input.celebrations.total}`, 12, ink, 22);
    for (const row of input.celebrations.byType.slice(0, 12)) draw(`${row.icon} ${row.label}: ${row.count}`, 10, muted, 18);
  }
  if (input.notes && input.notes.total > 0) {
    section("ملاحظات المعلم");
    draw(`إجمالي الملاحظات: ${input.notes.total} • المشارك مع ولي الأمر: ${input.notes.shared}`, 12, ink, 22);
  }
  if (input.quality && input.quality.length) {
    section("جودة مصادر البيانات");
    for (const row of input.quality) draw(`${row.label}: ${row.status} — ${row.detail}`, 10, muted, 18);
  }
  y -= 10;
  draw("هذا التقرير ملخص آلي للمراجعة، وقرار المعلم هو المرجع النهائي.", 11, muted, 28);
  draw("تم توليد التقرير محلياً بواسطة منصة بسلاسة.", 10, muted, 20);
  return Buffer.from(await pdf.save());
}
