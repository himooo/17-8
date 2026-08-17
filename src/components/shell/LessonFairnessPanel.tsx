"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Award, RotateCcw, Scale, Sparkles } from "lucide-react";
import { useShellStore } from "@/lib/shell-store";

const sourceLabels: Record<string, string> = {
  quickfire: "أسئلة سريعة",
  mathchallenge: "تحدي رياضيات",
  questionchallenge: "تحدي أسئلة",
  quizshow: "مسابقة",
  wheel: "عجلة الطلاب",
  luckywheel: "عجلة الحظ",
  manual: "اختيار يدوي",
  teleprompter: "التليبرومبتر",
  dice: "النرد",
  reaction: "رد الفعل",
  memory: "الذاكرة",
  "mystery-box": "الصندوق الغامض",
  hotpotato: "البطاطا الساخنة",
};

export function LessonFairnessPanel() {
  const students = useShellStore((state) => state.students);
  const ideaId = useShellStore((state) => state.currentIdeaId);
  const attempts = useShellStore((state) => state.lessonAttemptsByStudent);
  const correct = useShellStore((state) => state.lessonCorrectByStudent);
  const wrong = useShellStore((state) => state.lessonWrongByStudent);
  const performance = useShellStore((state) => state.performanceByIdea);
  const lastAsked = useShellStore((state) => state.lastAskedAtByStudent);
  const fairnessLog = useShellStore((state) => state.fairnessLog);
  const getScore = useShellStore((state) => state.getLessonFairnessScore);
  const resetLessonStats = useShellStore((state) => state.resetLessonStats);
  const mode = useShellStore((state) => state.settings.fairnessMode || "soft");
  const [now, setNow] = useState(0);
  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const ranked = useMemo(() => students
    .filter((student) => !student.isAbsent)
    .map((student) => {
      const idea = ideaId ? performance[ideaId]?.[student.id] : undefined;
      const ideaAttempts = idea?.attempts || 0;
      const ideaWrong = idea?.wrong || 0;
      return {
        student,
        attempts: attempts[student.id] || 0,
        correct: correct[student.id] || 0,
        wrong: wrong[student.id] || 0,
        ideaAttempts,
        ideaCorrect: idea?.correct || 0,
        ideaWrong,
        score: getScore(student.id, ideaId || undefined),
        struggling: ideaAttempts > 0 && ideaWrong / ideaAttempts >= 0.5,
        lastAsked: lastAsked[student.id] || 0,
      };
    })
    .sort((a, b) => b.score - a.score), [students, ideaId, performance, attempts, correct, wrong, lastAsked, getScore]);

  return (
    <aside className="w-[min(92vw,380px)] max-h-[78vh] overflow-y-auto rounded-2xl border border-indigo-400/30 bg-slate-950/95 p-4 text-white shadow-2xl backdrop-blur" dir="rtl">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Scale className="h-5 w-5 text-indigo-300" />
          <div>
            <h2 className="text-sm font-bold">لوحة عدالة الدرس</h2>
            <p className="text-[10px] text-slate-400">الوضع: {mode === "strict" ? "صارم" : mode === "soft" ? "لطيف" : "متوقف"}</p>
          </div>
        </div>
        <button type="button" onClick={resetLessonStats} className="rounded-lg p-2 text-slate-300 transition hover:bg-white/10" title="بدء جولة عدالة جديدة">
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-3 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
        <div className="flex items-center gap-2 font-semibold text-indigo-200"><Sparkles className="h-3.5 w-3.5" /> الفكرة الحالية: {ideaId || "عام"}</div>
        <p className="mt-1 text-[10px] text-slate-400">الأولوية الأعلى تعني أن الطالب حُرم من الفرص أو متعثر في هذه الفكرة تحديداً.</p>
      </div>

      <div className="space-y-2">
        {ranked.length === 0 && <p className="rounded-xl bg-white/5 p-4 text-center text-xs text-slate-400">لا يوجد طلاب حاضرون.</p>}
        {ranked.map((row) => (
          <div key={row.student.id} className={`rounded-xl border p-2.5 ${row.struggling ? "border-rose-400/40 bg-rose-400/10" : row.score >= 100 ? "border-emerald-400/30 bg-emerald-400/10" : "border-white/10 bg-white/5"}`}>
            <div className="flex items-center gap-2">
              {row.struggling ? <AlertCircle className="h-4 w-4 shrink-0 text-rose-300" /> : <Award className="h-4 w-4 shrink-0 text-amber-300" />}
              <span className="min-w-0 flex-1 truncate text-xs font-bold">{row.student.name}</span>
              <span className="rounded-full bg-indigo-400/20 px-2 py-0.5 text-[11px] font-bold text-indigo-100">{Math.round(row.score)}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400">
              <span>الدرس: {row.correct}/{row.attempts}</span>
              <span>الفكرة: {row.ideaCorrect}/{row.ideaAttempts}</span>
              <span>سُئل: {row.attempts}×</span>
              {row.lastAsked > 0 && now > 0 && <span>منذ {Math.max(0, Math.round((now - row.lastAsked) / 60000))}د</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 border-t border-white/10 pt-3">
        <h3 className="mb-2 text-[11px] font-bold text-slate-300">آخر الاختيارات</h3>
        <div className="space-y-1">
          {fairnessLog.slice(-6).reverse().map((entry, index) => {
            const student = students.find((item) => item.id === entry.studentId);
            return <div key={`${entry.timestamp}-${entry.studentId}-${index}`} className="flex items-center justify-between gap-2 text-[10px] text-slate-400"><span className="truncate">{student?.name || entry.studentId} · {sourceLabels[entry.source] || entry.source}</span><span className="shrink-0 text-slate-500">{entry.ideaId}</span></div>;
          })}
          {fairnessLog.length === 0 && <p className="text-[10px] text-slate-500">لم يتم تسجيل اختيارات بعد.</p>}
        </div>
      </div>
    </aside>
  );
}
