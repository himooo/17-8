"use client";

import { useShellStore, useCurrentStepData } from "@/lib/shell-store";
import { splitScriptIntoSentences } from "@/lib/shell-utils";
import { aiClient } from "@/lib/local-db";
import { cn } from "@/lib/utils";
import { X, StickyNote, Minus, Plus, Eye, EyeOff, UserRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildSmartContext } from "@/lib/smart-context";
import { pickStudentFair } from "@/lib/game-utils";

type AiDraft = { label: string; text: string; sourceModel: string; createdAt: string; review: "pending" | "approved" | "rejected" };

/**
 * DraggableTeleprompter v6.0
 *
 * - نافذة السكريبت: بسيطة
 * - زراير: تكبير/تصغير الخط + إخفاء/إظهار + ملاحظات
 * - وضع يمين: التحكم في العرض (سحب من الحافة اليسرى)
 * - وضع فوق: التحكم في الارتفاع (سحب من الحافة السفلية)
 * - الملاحظات: تبدأ من فوق خالص، خط أحمر على خلفية غامقة، زر إغلاق فقط
 * - جمل بألوان متناوبة
 */
export function DraggableTeleprompter() {
  const stepData = useCurrentStepData();
  const settings = useShellStore((s) => s.settings);
  const manifest = useShellStore((s) => s.manifest);
  const currentStep = useShellStore((s) => s.currentStep);
  const currentIdeaId = useShellStore((s) => s.currentIdeaId);
  const lessonQuestions = useShellStore((s) => s.lessonQuestions);
  const students = useShellStore((s) => s.students);
  const studentLiveStatuses = useShellStore((s) => s.studentLiveStatuses);
  const sessionStats = useShellStore((s) => s.sessionStats);
  const requestConfirm = useShellStore((s) => s.requestConfirm);
  const updateSettings = useShellStore((s) => s.updateSettings);
  const highlightedSentence = useShellStore((s) => s.highlightedSentence);
  const setHighlightedSentence = useShellStore((s) => s.setHighlightedSentence);
  const notesOverlayOpen = useShellStore((s) => s.settings.notesOverlayOpen);
  const stepNotes = stepData?.notes;
  const [aiBusy, setAiBusy] = useState(false);
  const [aiDraft, setAiDraft] = useState<AiDraft | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const smartContext = useMemo(() => buildSmartContext({
    manifest,
    currentStep: currentStep + 1,
    currentIdeaId,
    lessonQuestions,
    lessonContext: settings.lessonContext,
    students,
    liveStatuses: studentLiveStatuses,
    sessionStats: sessionStats as unknown as Record<string, unknown>,
    teacherNotesAllowed: settings.aiIncludeLessonContext === true,
    studentDataAllowed: false,
    maxChars: 12000,
  }), [currentIdeaId, currentStep, lessonQuestions, manifest, sessionStats, settings.aiIncludeLessonContext, settings.lessonContext, studentLiveStatuses, students]);

  const workspaceMode = settings.workspaceMode || "landscape";
  const width = settings.teleprompterWidth ?? 300;
  const height = settings.teleprompterHeight ?? 150;
  const customFontSize = settings.teleprompterFontSize || 22;
  const hidden = settings.teleprompterHidden || false;

  const [isResizing, setIsResizing] = useState(false);
  const resizeStart = useRef<{ pos: number; size: number }>({ pos: 0, size: 0 });

  const handleResizeStart = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    const currentSize = workspaceMode === "landscape" ? width : height;
    resizeStart.current = {
      pos: workspaceMode === "landscape" ? e.clientX : e.clientY,
      size: currentSize,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleResizeMove = (e: React.PointerEvent) => {
    if (!isResizing) return;
    if (workspaceMode === "landscape") {
      const delta = resizeStart.current.pos - e.clientX;
      const newWidth = Math.max(180, Math.min(600, resizeStart.current.size + delta));
      updateSettings({ teleprompterWidth: newWidth });
    } else {
      const delta = e.clientY - resizeStart.current.pos;
      const newHeight = Math.max(60, Math.min(500, resizeStart.current.size + delta));
      updateSettings({ teleprompterHeight: newHeight });
    }
  };

  const handleResizeEnd = () => {
    setIsResizing(false);
  };

  const toggleNotes = () => {
    updateSettings({ notesOverlayOpen: !notesOverlayOpen });
  };

  const toggleHidden = () => {
    updateSettings({ teleprompterHidden: !hidden });
  };

  const pickFairStudent = () => {
    const picked = pickStudentFair({ ideaId: currentIdeaId || "general", source: "teleprompter" });
    if (picked) {
      import("sonner").then(({ toast }) => toast.info(`تم اختيار ${picked.name} عبر بوابة العدالة`));
    }
  };

  const adjustFont = (delta: number) => {
    const newSize = Math.max(12, Math.min(48, customFontSize + delta));
    updateSettings({ teleprompterFontSize: newSize });
  };

  const runTeleprompterAi = async (kind: "questions" | "explain" | "example" | "simplify") => {
    if (!settings.aiEnabled || aiBusy || !stepData) return;
    const script = Array.isArray(stepData.script) ? stepData.script.join(" ") : stepData.script || "";
    if (!script.trim()) {
      setAiError("لا يوجد سكريبت لهذه الخطوة لتحليله.");
      return;
    }
    const labels = { questions: "أسئلة محتملة", explain: "شرح أكثر", example: "مثال تطبيقي", simplify: "تبسيط للطالب" } as const;
    const instructions = {
      questions: "اقترح 3 أسئلة شفوية قصيرة يمكن للمدرس طرحها على الطلاب، مع إجابة نموذجية لكل سؤال.",
      explain: "اشرح الفكرة بطريقة إضافية قصيرة وواضحة للمدرس، دون اختراع معلومات خارج النص.",
      example: "قدّم مثالاً رياضياً عملياً بسيطاً مرتبطاً بالنص، مع خطوات الحل.",
      simplify: "بسّط الشرح ليقوله المدرس لطالب صغير، مع الحفاظ على الدقة الرياضية.",
    } as const;
    setAiBusy(true);
    setAiError(null);
    try {
      const scopedContext = settings.aiIncludeLessonContext
        ? smartContext.text
        : `الخطوة الحالية فقط:\nالعنوان: ${stepData.title || "غير محدد"}\nالسكريبت:\n${script}`;
      const result = await aiClient.generate({
        input: `${scopedContext}\n\nالمطلوب: ${instructions[kind]}`,
        operation: `teleprompter-${kind}`,
        model: settings.aiModel,
        temperature: settings.aiTemperature,
        maxOutputTokens: settings.aiMaxOutputTokens,
        systemInstruction: "أنت مساعد للمدرس داخل غرفة عمليات بسلاسة. أرجع اقتراحاً قصيراً بالعربية، لا تعدّل الدرس ولا تعرض شيئاً للطلاب تلقائياً. القرار النهائي للمدرس.",
      });
      setAiDraft({ label: labels[kind], text: result.text, sourceModel: settings.aiModel || "الموديل الافتراضي", createdAt: new Date().toISOString(), review: "pending" });
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "تعذر تنفيذ أداة AI");
    } finally {
      setAiBusy(false);
    }
  };

  const approveAiDraft = () => {
    if (!aiDraft) return;
    setAiDraft({ ...aiDraft, review: "approved" });
  };
  const rejectAiDraft = () => setAiDraft((draft) => draft ? { ...draft, review: "rejected" } : null);
  const insertAiDraftToWhiteboard = async () => {
    if (!aiDraft || aiDraft.review !== "approved") {
      setAiError("اعتمد مسودة AI أولاً؛ لن تُرسل أي نتيجة للسبورة تلقائياً.");
      return;
    }
    const approved = await requestConfirm("سيتم فتح مسودة AI داخل محرر السبورة للمراجعة قبل العرض. هل تريد المتابعة؟", { danger: false });
    if (!approved) return;
    window.dispatchEvent(new CustomEvent("bisalasa:whiteboard-ai-text", { detail: { text: aiDraft.text, source: "teleprompter-copilot" } }));
  };

  const speakAiDraft = () => {
    if (!aiDraft || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(aiDraft.text));
  };

  if (hidden) {
    return (
      <button
        onClick={toggleHidden}
        className="fixed top-9 left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground px-3 py-1 rounded-md text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1 shadow-lg"
      >
        <Eye className="w-3 h-3" />
        عرض السكريبت
      </button>
    );
  }

  const sentences = splitScriptIntoSentences(stepData?.script);
  const hasContent = sentences.length > 0;

  return (
    <div
      className="teleprompter-bar relative z-50 flex flex-col bg-card border-2 border-primary shadow-2xl rounded-lg h-full w-full overflow-hidden"
      onPointerMove={handleResizeMove}
      onPointerUp={handleResizeEnd}
    >
      {/* ===== النوت دائماً ظاهر — خط أحمر صغير مظلل بالأبيض =====
          لا يشغل مساحة (inline + compact)، يظهر في الوضعين portrait و landscape */}
      {stepNotes && (
        <div
          className="shrink-0 px-2 py-0.5 bg-white/95 border-b border-red-500/40 overflow-hidden"
          style={{ maxHeight: "40px" }}
        >
          <div
            className="text-red-600 whitespace-nowrap overflow-hidden text-ellipsis leading-tight"
            style={{ fontSize: "11px", fontFamily: "Cairo, sans-serif", fontWeight: 600 }}
            title={stepNotes}
          >
            📝 {stepNotes}
          </div>
        </div>
      )}

      {/* ===== شريط علوي ===== */}
      <div className="flex items-center justify-between px-2 py-0.5 border-b border-border/50 bg-secondary/30 select-none flex-shrink-0">
        <div className="flex items-center gap-1.5 text-primary min-w-0">
          <span className="text-[10px] font-bold">السكريبت</span>
          {stepData?.title && (
            <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
              • {stepData.title}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {/* تكبير الخط */}
          <button
            onClick={() => adjustFont(2)}
            className="mini-icon-btn"
            title="تكبير الخط"
          >
            <Plus className="w-3 h-3" />
          </button>
          {/* تصغير الخط */}
          <button
            onClick={() => adjustFont(-2)}
            className="mini-icon-btn"
            title="تصغير الخط"
          >
            <Minus className="w-3 h-3" />
          </button>
          {/* الملاحظات */}
          <button
            onClick={toggleNotes}
            className={cn(
              "mini-icon-btn",
              notesOverlayOpen && "bg-accent text-accent-foreground"
            )}
            title="الملاحظات"
          >
            <StickyNote className="w-3 h-3" />
          </button>
          <button
            onClick={pickFairStudent}
            className="mini-icon-btn"
            title="اختيار طالب عادل"
          >
            <UserRound className="w-3 h-3" />
          </button>
          {/* إخفاء */}
          <button
            onClick={toggleHidden}
            className="mini-icon-btn"
            title="إخفاء السكريبت"
          >
            <EyeOff className="w-3 h-3" />
          </button>
        </div>
      </div>

      {settings.aiEnabled && (
        <div className="flex flex-wrap items-center gap-1 border-b border-primary/20 bg-primary/5 px-2 py-1" dir="rtl">
          <span className="text-[9px] font-bold text-primary">AI للمدرس:</span><span className="text-[8px] text-muted-foreground" title="يضم عنوان الدرس والخطوات السابقة والحالية والأسئلة المجهولة دون أسماء طلاب">سياق ذكي {smartContext.chars} حرف{smartContext.truncated ? " — مختصر" : ""}</span>
          {([['questions', '💡 أسئلة محتملة'], ['explain', '📖 اشرح أكثر'], ['example', '💬 أعطِ مثال'], ['simplify', '🧒 بسّط للطالب']] as const).map(([kind, label]) => (
            <button key={kind} type="button" onClick={() => void runTeleprompterAi(kind)} disabled={aiBusy || !stepData} className="rounded border border-primary/25 bg-background px-1.5 py-0.5 text-[9px] hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50">
              {aiBusy ? "..." : label}
            </button>
          ))}
        </div>
      )}

      {aiDraft && (
        <div className="shrink-0 space-y-1 border-b border-emerald-500/30 bg-emerald-500/10 px-2 py-1.5" dir="rtl">
          <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold text-emerald-700">اقتراح AI: {aiDraft.label}</span><button type="button" className="text-[10px] text-muted-foreground" onClick={() => setAiDraft(null)}>إغلاق</button></div>
          <div className="flex flex-wrap gap-2 text-[8px] text-muted-foreground"><span>المصدر: {aiDraft.sourceModel}</span><span>الحالة: {aiDraft.review === "pending" ? "بانتظار اعتماد المدرس" : aiDraft.review === "approved" ? "معتمدة للمراجعة النهائية" : "مرفوضة"}</span><span>{new Date(aiDraft.createdAt).toLocaleTimeString("ar-EG")}</span></div>
          <div className="max-h-28 overflow-y-auto whitespace-pre-wrap text-[10px] leading-relaxed">{aiDraft.text}</div>
          <div className="flex flex-wrap gap-1"><button type="button" onClick={approveAiDraft} disabled={aiDraft.review === "approved"} className="rounded border border-emerald-600/30 px-1.5 py-0.5 text-[9px] hover:bg-emerald-500/10 disabled:opacity-50">اعتماد المسودة</button><button type="button" onClick={rejectAiDraft} className="rounded border border-red-600/30 px-1.5 py-0.5 text-[9px] hover:bg-red-500/10">رفض</button><button type="button" onClick={() => void insertAiDraftToWhiteboard()} disabled={aiDraft.review !== "approved"} className="rounded border border-emerald-600/30 px-1.5 py-0.5 text-[9px] hover:bg-emerald-500/10 disabled:opacity-50">أضف للسبورة بعد الاعتماد</button><button type="button" onClick={speakAiDraft} className="rounded border border-emerald-600/30 px-1.5 py-0.5 text-[9px] hover:bg-emerald-500/10">اقرأها بصوت عالٍ</button></div>
        </div>
      )}
      {aiError && <div className="shrink-0 border-b border-red-500/30 bg-red-500/10 px-2 py-1 text-[9px] text-red-700" dir="rtl">{aiError}</div>}

      {/* ===== المحتوى (السكريبت) ===== */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2">
          {hasContent ? (
            <div
              className="leading-relaxed"
              style={{ fontSize: `${customFontSize}px`, fontFamily: "Cairo, sans-serif" }}
            >
              {sentences.map((sentence, i) => {
                const colors = [
                  "#ffffff", "#93c5fd", "#fca5a5", "#6ee7b7",
                  "#fde047", "#c084fc", "#67e8f9", "#f9a8d4",
                ];
                const color = colors[i % colors.length];
                return (
                  <span
                    key={i}
                    onClick={() =>
                      setHighlightedSentence(highlightedSentence === i ? null : i)
                    }
                    className={cn(
                      "cursor-pointer transition-colors px-0.5 rounded",
                      highlightedSentence === i
                        ? "bg-primary/30 font-bold"
                        : "hover:bg-white/10"
                    )}
                    style={{ color: highlightedSentence === i ? "#FFD700" : color }}
                  >
                    {sentence}{" "}
                  </span>
                );
              })}
            </div>
          ) : (
            <div className="text-muted-foreground text-sm text-center py-2">
              ابدأ بعرض درس لرؤية السكريبت
            </div>
          )}
      </div>

      {/* ===== مقبض السحب لتغيير الحجم ===== */}
      {workspaceMode === "landscape" ? (
        <div
          onPointerDown={handleResizeStart}
          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-primary/30 hover:bg-primary/60 transition-colors z-20"
          title="اسحب لتغيير العرض"
        />
      ) : (
        <div
          onPointerDown={handleResizeStart}
          className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize bg-primary/30 hover:bg-primary/60 transition-colors z-20"
          title="اسحب لتغيير الارتفاع"
        />
      )}
    </div>
  );
}
