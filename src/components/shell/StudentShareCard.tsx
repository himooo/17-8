"use client";

import { useState, useEffect } from "react";
import { useShellStore } from "@/lib/shell-store";
import { localDb } from "@/lib/local-db";
import { GameOverlay } from "./GameOverlay";
import { Share2, Copy, MessageCircle, Send, Download, X } from "lucide-react";
import { toast } from "sonner";
import type { StudentReportAggregate } from "@/lib/report-contract";

interface ShareCardProps {
  studentId: string;
  studentName: string;
  onClose: () => void;
}

export function StudentShareCard({ studentId, studentName, onClose }: ShareCardProps) {
  const students = useShellStore((s) => s.students);
  const currentSessionId = useShellStore((s) => s.currentSessionId);
  const student = students.find((s) => s.id === studentId);

  const [activities, setActivities] = useState<Array<{ type: string; count: number; pointsDelta: number }>>([]);
  const [celebrations, setCelebrations] = useState<Array<{ celebrationLabel: string; celebrationIcon: string }>>([]);
  const [notes, setNotes] = useState<Array<{ text: string; createdAt: string }>>([]);
  const [reportSummary, setReportSummary] = useState<StudentReportAggregate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [agg, celeb, noteList, summary] = await Promise.all([
          localDb.studentActivities.aggregateByType(studentId, currentSessionId || undefined),
          localDb.celebrationEvents.listByStudent(studentId, currentSessionId || undefined),
          localDb.studentNotes.listByStudent(studentId, currentSessionId || undefined),
          localDb.reports.student({ studentId, sessionId: currentSessionId }),
        ]);
        if (cancelled) return;
        setActivities(agg as any);
        setCelebrations(celeb as any);
        setNotes(noteList as any);
        setReportSummary(summary as StudentReportAggregate);
      } catch (e) {
        console.warn("[ShareCard] load error:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [studentId, currentSessionId]);

  if (!student) return null;

  const accuracy = student.attempts > 0 ? Math.round((student.correctAnswers / student.attempts) * 100) : 0;
  const sessionLabel = currentSessionId ? "الحصة الحالية" : "آخر التفاعلات";

  // بناء نص المشاركة
  const buildShareText = () => {
    let text = `🎓 تقرير الطالب: ${studentName}\n`;
    if (student.title) text += `🏆 اللقب: ${student.title}\n`;
    text += `\n📊 الإحصائيات (${sessionLabel}):\n`;
    text += `  • النقاط: ${student.points}\n`;
    text += `  • إجابات صحيحة: ${student.correctAnswers}\n`;
    text += `  • إجابات خاطئة: ${student.wrongAnswers}\n`;
    text += `  • الدقة: ${accuracy}%\n`;
    if (reportSummary) {
      text += `\n📚 Moodle: ${reportSummary.homework.latest ? `${reportSummary.homework.latest.completionPct}% إكمال • ${reportSummary.homework.latest.successOnTotalPct ?? "—"}% نجاح من الإجمالي • الدرجة ${reportSummary.homework.latest.moodleGrade ?? "—"}` : "لا يوجد واجب مسجل"}\n`;
      text += `🧩 التفاعل: ${reportSummary.interactive.correct}/${reportSummary.interactive.answered} صحيح • ${reportSummary.interactive.accuracyPct ?? "—"}%\n`;
      text += `🎮 الألعاب: ${reportSummary.games.gameCount} لعبة • ${reportSummary.games.points} نقطة\n`;
    }

    if (activities.length > 0) {
      text += `\n🎉 الإنجازات:\n`;
      for (const a of activities) {
        const label = getActivityLabel(a.type);
        text += `  • ${label}: ${a.count}\n`;
      }
    }

    if (celebrations.length > 0) {
      text += `\n🎊 الاحتفالات (${celebrations.length}):\n`;
      const grouped: Record<string, number> = {};
      for (const c of celebrations) {
        grouped[c.celebrationLabel] = (grouped[c.celebrationLabel] || 0) + 1;
      }
      for (const [label, count] of Object.entries(grouped)) {
        text += `  • ${label}: ${count}\n`;
      }
    }

    if (notes.length > 0) {
      text += `\n📝 ملاحظات المعلم:\n`;
      for (const n of notes.slice(0, 3)) {
        text += `  • ${n.text}\n`;
      }
    }

    text += `\n— منصة بسلاسة التعليمية`;
    return text;
  };

  const shareText = buildShareText();

  const handleWhatsApp = () => {
    const encoded = encodeURIComponent(shareText);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
    toast.success("تم فتح واتساب");
  };

  const handleTelegram = () => {
    const encoded = encodeURIComponent(shareText);
    window.open(`https://t.me/share/url?url=&text=${encoded}`, "_blank");
    toast.success("تم فتح تيليجرام");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      toast.success("تم نسخ التقرير");
    } catch {
      toast.error("فشل النسخ");
    }
  };

  return (
    <GameOverlay open onClose={onClose} title={`مشاركة تقرير: ${studentName}`} accentColor="#10b981" widthPercent={70} heightPercent={80}>
      <div className="p-4 flex flex-col h-full" dir="rtl">
        {/* ===== بطاقة التقرير ===== */}
        <div
          className="bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 rounded-2xl p-6 shadow-2xl border border-blue-500/30 mb-4"
          style={{ minHeight: "300px" }}
        >
          {/* رأس البطاقة */}
          <div className="flex items-center justify-between mb-4 border-b border-white/20 pb-3">
            <div>
              <h2 className="text-2xl font-black text-white">{studentName}</h2>
              {student.title && (
                <span className="text-sm text-amber-400 font-bold">🏆 {student.title}</span>
              )}
            </div>
            <div className="text-left">
              <div className="text-xs text-blue-300">بسلاسة</div>
              <div className="text-xs text-blue-400">{new Date().toLocaleDateString("ar-EG")}</div>
            </div>
          </div>

          {/* الإحصائيات */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            <StatBox label="النقاط" value={student.points} color="#fbbf24" icon="⭐" />
            <StatBox label="صحيحة" value={student.correctAnswers} color="#10b981" icon="✓" />
            <StatBox label="خاطئة" value={student.wrongAnswers} color="#ef4444" icon="✗" />
            <StatBox label="الدقة" value={`${accuracy}%`} color="#3b82f6" icon="🎯" />
          </div>

          {/* الإنجازات المجمّعة */}
          {loading ? (
            <div className="text-center text-white/50 text-sm py-4">جارٍ التحميل...</div>
          ) : (
            <>
              {reportSummary && (
                <div className="mb-3 grid grid-cols-3 gap-1.5">
                  <MiniMetric label="Moodle" value={reportSummary.homework.latest ? `${reportSummary.homework.latest.completionPct}%` : "—"} />
                  <MiniMetric label="التفاعل" value={reportSummary.interactive.accuracyPct == null ? "—" : `${reportSummary.interactive.accuracyPct}%`} />
                  <MiniMetric label="الألعاب" value={`${reportSummary.games.points} نقطة`} />
                </div>
              )}

              {activities.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs text-blue-300 font-bold mb-1">🎉 الإنجازات ({sessionLabel})</div>
                  <div className="flex flex-wrap gap-1.5">
                    {activities.map((a, i) => (
                      <span key={i} className="text-[10px] bg-white/10 px-2 py-1 rounded-full text-white">
                        {getActivityLabel(a.type)} ×{a.count}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {celebrations.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs text-blue-300 font-bold mb-1">🎊 الاحتفالات ({celebrations.length})</div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(
                      celebrations.reduce((acc, c) => {
                        acc[c.celebrationLabel] = (acc[c.celebrationLabel] || 0) + 1;
                        return acc;
                      }, {} as Record<string, number>)
                    ).map(([label, count], i) => (
                      <span key={i} className="text-[10px] bg-amber-500/20 px-2 py-1 rounded-full text-amber-300">
                        {label} ×{count}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {notes.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs text-blue-300 font-bold mb-1">📝 ملاحظات المعلم</div>
                  <div className="space-y-1">
                    {notes.slice(0, 3).map((n, i) => (
                      <div key={i} className="text-[11px] text-white/80 bg-white/5 rounded px-2 py-1">
                        • {n.text}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ===== أزرار المشاركة — كبيرة وواضحة ===== */}
        <div className="flex flex-col gap-2 mt-4 shrink-0">
          <div className="text-xs text-white/60 text-center mb-1">مشاركة عبر:</div>
          <div className="flex gap-2 justify-center">
            <button
              onClick={handleWhatsApp}
              className="flex items-center gap-2 bg-[#25D366] hover:bg-[#25D366]/90 text-white font-bold px-5 py-3 rounded-xl transition shadow-lg text-sm min-w-[100px] justify-center"
            >
              <MessageCircle className="w-5 h-5" />
              واتساب
            </button>
            <button
              onClick={handleTelegram}
              className="flex items-center gap-2 bg-[#0088cc] hover:bg-[#0088cc]/90 text-white font-bold px-5 py-3 rounded-xl transition shadow-lg text-sm min-w-[100px] justify-center"
            >
              <Send className="w-5 h-5" />
              تيليجرام
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 bg-zinc-700 hover:bg-zinc-600 text-white font-bold px-5 py-3 rounded-xl transition shadow-lg text-sm min-w-[100px] justify-center"
            >
              <Copy className="w-5 h-5" />
              نسخ النص
            </button>
          </div>
        </div>
      </div>
    </GameOverlay>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-white/10 px-2 py-1.5 text-center"><div className="text-[9px] text-white/45">{label}</div><div className="text-[11px] font-bold text-white/85">{value}</div></div>;
}

function StatBox({ label, value, color, icon }: { label: string; value: any; color: string; icon: string }) {
  return (
    <div className="bg-white/5 rounded-lg p-2 text-center border border-white/10">
      <div className="text-lg mb-0.5">{icon}</div>
      <div className="text-lg font-black" style={{ color }}>{value}</div>
      <div className="text-[9px] text-white/60">{label}</div>
    </div>
  );
}

function getActivityLabel(type: string): string {
  const labels: Record<string, string> = {
    correct: "✓ إجابة صحيحة",
    wrong: "✗ إجابة خاطئة",
    goodTry: "👍 محاولة جيدة",
    points: "⭐ نقاط",
    badge: "🏅 شارة",
    gift: "🎁 هدية",
    celebration: "🎊 احتفال",
    soundGift: "🔊 هدية صوتية",
    note: "📝 ملاحظة",
    game: "🎮 لعبة",
    absent: "❌ غياب",
  };
  return labels[type] || type;
}
