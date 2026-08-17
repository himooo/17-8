"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardPlus,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useShellStore } from "@/lib/shell-store";
import { aiClient, localDb } from "@/lib/local-db";
import type { LessonQuestion, SlideIdea, SlideManifest, SlideStep } from "@/lib/slide-schema";
import { toast } from "sonner";

type FlatStep = { ideaId?: string; ideaTitle?: string; step: SlideStep };
type StepQuestion = NonNullable<SlideStep["question"]>;

function cloneManifest(value: SlideManifest): SlideManifest {
  return JSON.parse(JSON.stringify(value)) as SlideManifest;
}

function normalizeManifest(value: SlideManifest): SlideManifest {
  const next = cloneManifest(value);
  const total = next.ideas?.length
    ? next.ideas.reduce((sum, idea) => sum + idea.steps.length, 0)
    : next.steps?.length ?? 0;
  next.totalSteps = total;
  next.currentStep = Math.max(1, Math.min(next.currentStep || 1, Math.max(1, total)));
  if (next.ideas?.length) {
    next.currentIdeaId = next.ideas.some((idea) => idea.id === next.currentIdeaId)
      ? next.currentIdeaId
      : next.ideas[0].id;
  } else {
    delete next.currentIdeaId;
  }
  return next;
}

function stepsOf(manifest: SlideManifest | null): FlatStep[] {
  if (!manifest) return [];
  if (manifest.ideas?.length) {
    return manifest.ideas.flatMap((idea) => idea.steps.map((step) => ({ ideaId: idea.id, ideaTitle: idea.title, step })));
  }
  return (manifest.steps ?? []).map((step) => ({ step }));
}

function stepKey(item: FlatStep): string {
  return `${item.ideaId ?? "flat"}::${item.step.step}`;
}

function renumber(steps: SlideStep[]): SlideStep[] {
  return steps.map((step, index) => ({ ...step, step: index + 1 }));
}

function nextStepNumber(steps: SlideStep[]): number {
  return steps.reduce((max, step) => Math.max(max, Number(step.step) || 0), 0) + 1;
}

function normalizeQuestion(
  raw: Record<string, unknown>,
  index: number,
  lessonId: string,
  ideaId?: string,
  ideaTitle?: string,
  stepNumber?: number,
): LessonQuestion | null {
  const text = typeof raw.text === "string" ? raw.text.trim() : "";
  if (!text) return null;
  const options = Array.isArray(raw.options)
    ? raw.options.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
    : undefined;
  const difficulty = raw.difficulty === "easy" || raw.difficulty === "medium" || raw.difficulty === "hard" ? raw.difficulty : "medium";
  const correctAnswer = typeof raw.correctAnswer === "string" || typeof raw.correctAnswer === "number" ? raw.correctAnswer : undefined;
  const tags = Array.isArray(raw.tags) ? raw.tags.filter((item): item is string => typeof item === "string") : [];
  return {
    lessonId,
    text,
    options: options?.length ? Array.from(new Set(options)) : undefined,
    correctAnswer,
    rewardPoints: typeof raw.rewardPoints === "number" && raw.rewardPoints >= 0 ? Math.round(raw.rewardPoints) : 5,
    ideaId: ideaId ?? "flat",
    ideaTitle: ideaTitle ?? "المحتوى العام",
    step: stepNumber ?? index + 1,
    stepNumber: stepNumber ?? index + 1,
    difficulty,
    tags: Array.from(new Set([...tags, "ai-generated", `step:${stepNumber ?? index + 1}`])),
    gameReady: true,
  };
}

export function LessonEditorPanel() {
  const activeLessonId = useShellStore((state) => state.activeLessonId);
  const activeLesson = useShellStore((state) => state.lessons.find((lesson) => lesson.id === activeLessonId));
  const manifest = useShellStore((state) => state.manifest);
  const setManifest = useShellStore((state) => state.setManifest);
  const updateSettings = useShellStore((state) => state.updateSettings);
  const aiQuestionPool = useShellStore((state) => state.aiQuestionPool);
  const setAiQuestionPool = useShellStore((state) => state.setAiQuestionPool);

  const [draft, setDraft] = useState<SlideManifest | null>(() => (manifest ? normalizeManifest(manifest) : null));
  const [selectedKey, setSelectedKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [analysis, setAnalysis] = useState<Record<string, unknown> | null>(null);
  const [improvement, setImprovement] = useState<string | null>(null);
  const [questionDrafts, setQuestionDrafts] = useState<LessonQuestion[]>([]);
  const [savedSnapshot, setSavedSnapshot] = useState<SlideManifest | null>(() => (manifest ? normalizeManifest(manifest) : null));

  // This effect intentionally resets the local draft when the active lesson
  // changes; it prevents edits from leaking between two imported lessons.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const next = manifest ? normalizeManifest(manifest) : null;
    setDraft(next);
    setSavedSnapshot(next);
    setSelectedKey("");
    setAnalysis(null);
    setImprovement(null);
    setQuestionDrafts([]);
  }, [activeLessonId, manifest]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const flatSteps = useMemo(() => stepsOf(draft), [draft]);
  const selected = flatSteps.find((item) => stepKey(item) === selectedKey);

  const updateDraft = (mutate: (next: SlideManifest) => void) => {
    setDraft((current) => {
      if (!current) return current;
      const next = cloneManifest(current);
      mutate(next);
      return normalizeManifest(next);
    });
  };

  const updateStep = (key: string, patch: Partial<SlideStep>) => {
    updateDraft((next) => {
      const [ideaId, stepNo] = key.split("::");
      const target = ideaId === "flat"
        ? next.steps?.find((step) => String(step.step) === stepNo)
        : next.ideas?.find((idea) => idea.id === ideaId)?.steps.find((step) => String(step.step) === stepNo);
      if (target) Object.assign(target, patch);
    });
  };

  const updateQuestion = (patch: Partial<StepQuestion>) => {
    if (!selected) return;
    updateStep(selectedKey, { question: { ...(selected.step.question ?? {}), ...patch } });
  };

  const addIdea = () => {
    updateDraft((next) => {
      const oldFlat = next.ideas?.length ? [] : next.steps ?? [];
      const idea: SlideIdea = { id: `idea-${Date.now()}`, title: "فكرة جديدة", description: "", steps: renumber(oldFlat), color: "blue" };
      next.ideas = [...(next.ideas ?? []), idea];
      delete next.steps;
      next.currentIdeaId = idea.id;
    });
    toast.success("أضيفت فكرة جديدة إلى مسودة الدرس");
  };

  const addStep = () => {
    updateDraft((next) => {
      if (next.ideas?.length) {
        const idea = next.ideas.find((item) => item.id === (selected?.ideaId ?? next.currentIdeaId)) ?? next.ideas[0];
        if (!idea) return;
        idea.steps = [...idea.steps, { step: nextStepNumber(idea.steps), title: "خطوة جديدة", type: "content", script: "", notes: "" }];
        next.currentIdeaId = idea.id;
      } else {
        next.steps = [...(next.steps ?? []), { step: nextStepNumber(next.steps ?? []), title: "خطوة جديدة", type: "content", script: "", notes: "" }];
      }
    });
    toast.success("أضيفت خطوة جديدة");
  };

  const removeSelectedStep = () => {
    if (!selected) return;
    updateDraft((next) => {
      if (selected.ideaId) {
        const idea = next.ideas?.find((item) => item.id === selected.ideaId);
        if (idea) idea.steps = renumber(idea.steps.filter((step) => step !== selected.step));
      } else {
        next.steps = renumber((next.steps ?? []).filter((step) => step !== selected.step));
      }
    });
    setSelectedKey("");
    toast.success("حُذفت الخطوة من المسودة");
  };

  const moveSelectedStep = (direction: -1 | 1) => {
    if (!selected) return;
    updateDraft((next) => {
      const list = selected.ideaId ? next.ideas?.find((idea) => idea.id === selected.ideaId)?.steps : next.steps;
      if (!list) return;
      const index = list.findIndex((step) => step === selected.step);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= list.length) return;
      [list[index], list[targetIndex]] = [list[targetIndex], list[index]];
      const normalized = renumber(list);
      if (selected.ideaId) {
        const idea = next.ideas?.find((item) => item.id === selected.ideaId);
        if (idea) idea.steps = normalized;
      } else next.steps = normalized;
    });
  };

  const removeIdea = (ideaId: string) => {
    updateDraft((next) => {
      if (!next.ideas?.length) return;
      next.ideas = next.ideas.filter((idea) => idea.id !== ideaId);
      if (!next.ideas.length) next.ideas = undefined;
      next.currentIdeaId = next.ideas?.[0]?.id;
    });
    setSelectedKey("");
  };

  const resetDraft = () => {
    if (!savedSnapshot) return;
    setDraft(cloneManifest(savedSnapshot));
    setSelectedKey("");
    setImprovement(null);
    setQuestionDrafts([]);
    toast.info("تم إلغاء التعديلات غير المحفوظة");
  };

  const save = async () => {
    if (!draft || !activeLesson) return;
    const next = normalizeManifest(draft);
    if (!next.lessonId || !next.title.trim()) {
      toast.error("يجب إدخال معرف وعنوان الدرس قبل الحفظ");
      return;
    }
    setBusy(true);
    try {
      await localDb.lessons.upsert({
        id: activeLesson.id,
        lessonId: next.lessonId,
        fileName: activeLesson.fileName,
        title: next.title.trim(),
        subtitle: next.subtitle?.trim() ?? "",
        content: activeLesson.content,
        manifestJson: JSON.stringify(next),
      });
      const position = useShellStore.getState();
      setManifest(next);
      useShellStore.setState((state) => ({
        currentStep: position.currentStep,
        currentIdeaId: position.currentIdeaId,
        lessons: state.lessons.map((lesson) => lesson.id === activeLesson.id ? { ...lesson, title: next.title, manifest: next } : lesson),
      }));
      setDraft(next);
      setSavedSnapshot(cloneManifest(next));
      toast.success("تم حفظ تعديل الدرس والـManifest في SQLite");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر حفظ الدرس");
    } finally {
      setBusy(false);
    }
  };

  const buildEditorContext = () => stepsOf(draft).map(({ ideaTitle, step }) => `الفكرة: ${ideaTitle || "عام"}\nالخطوة ${step.step}: ${step.title || ""}\nالسكريبت: ${Array.isArray(step.script) ? step.script.join(" ") : step.script || ""}\nالنوتس: ${step.notes || ""}`).join("\n\n");

  const analyze = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      const result = await aiClient.analyzeLesson({ input: `حلل هذا الدرس الرياضي دون اختراع بيانات:\nالعنوان: ${draft.title}\nالوصف: ${draft.subtitle || ""}\n${buildEditorContext()}` });
      setAnalysis(result.result);
      const existing = await localDb.settings.get();
      const previous = existing.lessonContext && typeof existing.lessonContext === "object" ? existing.lessonContext : {};
      const nextLessonContext = { ...previous, [draft.lessonId]: { ...result.result, savedAt: new Date().toISOString() } };
      await localDb.settings.set({ lessonContext: nextLessonContext });
      updateSettings({ lessonContext: nextLessonContext });
      toast.success("تم تحليل الدرس وحفظ Lesson Context للمراجعة");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر تحليل الدرس");
    } finally {
      setBusy(false);
    }
  };

  const improve = async () => {
    if (!draft || !selected?.step) return;
    const script = Array.isArray(selected.step.script) ? selected.step.script.join(" ") : selected.step.script || "";
    if (!script.trim()) return toast.error("اكتب سكريبت الخطوة أولاً");
    setBusy(true);
    try {
      const result = await aiClient.generate({
        input: `العنوان: ${selected.step.title || ""}\nالسكريبت: ${script}\nحسّن صياغته للمدرس مع الحفاظ على المعنى والدقة الرياضية. أعد النص المحسن فقط.`,
        operation: "lesson-editor-improve-script",
        systemInstruction: "أنت مساعد تربوي. لا تخترع نتائج أو بيانات، ولا تعدّل الدرس تلقائياً؛ أرجع مسودة عربية قصيرة للمراجعة.",
      });
      setImprovement(result.text.trim());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر تحسين السكريبت");
    } finally {
      setBusy(false);
    }
  };

  const generateStepQuestions = async () => {
    if (!draft || !selected?.step) return;
    const script = Array.isArray(selected.step.script) ? selected.step.script.join(" ") : selected.step.script || "";
    setBusy(true);
    try {
      const result = await aiClient.generateQuestions({
        input: `الدرس: ${draft.title}\nالفكرة: ${selected.ideaTitle || "المحتوى العام"}\nالخطوة: ${selected.step.title || ""}\nالسكريبت: ${script}\nولّد 3 أسئلة رياضيات قصيرة مرتبطة بهذه الخطوة، مع إجابة صحيحة وخيارات عند الحاجة ومستوى صعوبة.`,
        lessonId: draft.lessonId,
        count: 3,
      });
      const normalized = result.questions.map((raw, index) => normalizeQuestion(raw, index, draft.lessonId, selected.ideaId, selected.ideaTitle, selected.step.step)).filter((question): question is LessonQuestion => Boolean(question));
      setQuestionDrafts(normalized);
      toast.success(`تم تجهيز ${normalized.length} سؤالاً للمراجعة فقط`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر توليد أسئلة الخطوة");
    } finally {
      setBusy(false);
    }
  };

  const approveStepQuestions = () => {
    if (!questionDrafts.length) return;
    const merged = [...aiQuestionPool];
    for (const question of questionDrafts) {
      const key = `${question.lessonId}:${question.ideaId}:${question.stepNumber}:${question.text}`;
      if (!merged.some((existing) => `${existing.lessonId}:${existing.ideaId}:${existing.stepNumber}:${existing.text}` === key)) merged.push(question);
    }
    setAiQuestionPool(merged);
    setQuestionDrafts([]);
    toast.success("اعتمد المدرس أسئلة الخطوة كمصدر مستقل للألعاب");
  };

  if (!draft || !activeLesson) return <div className="p-4 text-xs text-muted-foreground" dir="rtl">حمّل درساً أولاً لفتح محرر الدرس.</div>;

  return (
    <div className="h-full overflow-y-auto" dir="rtl">
      <div className="space-y-3 p-3 pb-20">
        <section className="rounded-lg border border-primary/30 bg-primary/5 p-2.5">
          <div className="flex items-start justify-between gap-2">
            <div><div className="text-sm font-bold">محرر الدرس</div><div className="text-[9px] leading-4 text-muted-foreground">عدّل المحتوى محلياً، راجعه، ثم احفظه. لا تظهر Notes أو اقتراحات AI للطلاب تلقائياً.</div></div>
            <div className="flex gap-1"><Button size="sm" variant="outline" className="h-8 text-[10px]" onClick={resetDraft} disabled={busy}><RotateCcw className="ml-1 h-3 w-3" />تراجع</Button><Button size="sm" className="h-8 text-[10px]" onClick={() => void save()} disabled={busy}><Save className="ml-1 h-3 w-3" />حفظ</Button></div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <label className="text-[10px]">عنوان الدرس<input value={draft.title} onChange={(event) => updateDraft((next) => { next.title = event.target.value; })} className="mt-1 h-8 w-full rounded border border-border bg-background px-2 text-xs font-bold" /></label>
            <label className="text-[10px]">العنوان الفرعي<input value={draft.subtitle ?? ""} onChange={(event) => updateDraft((next) => { next.subtitle = event.target.value; })} className="mt-1 h-8 w-full rounded border border-border bg-background px-2 text-xs" /></label>
            <label className="text-[10px]">نسبة العرض<select value={draft.aspectRatio ?? "16:9"} onChange={(event) => updateDraft((next) => { next.aspectRatio = event.target.value as SlideManifest["aspectRatio"]; })} className="mt-1 h-8 w-full rounded border border-border bg-background px-2 text-xs"><option value="16:9">16:9</option><option value="9:16">9:16</option><option value="4:3">4:3</option><option value="1:1">1:1</option></select></label>
            <label className="text-[10px]">المرحلة<select value={draft.targetAge ?? "primary-upper"} onChange={(event) => updateDraft((next) => { next.targetAge = event.target.value as SlideManifest["targetAge"]; })} className="mt-1 h-8 w-full rounded border border-border bg-background px-2 text-xs"><option value="primary-lower">ابتدائي أدنى</option><option value="primary-upper">ابتدائي أعلى</option><option value="preparatory">إعدادي</option></select></label>
          </div>
        </section>

        <section className="rounded-lg border border-border p-2.5">
          <div className="mb-2 flex items-center justify-between"><div className="text-xs font-bold">الأفكار والخطوات <span className="font-normal text-muted-foreground">({flatSteps.length} خطوة)</span></div><div className="flex gap-1"><Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={addIdea}><Plus className="ml-1 h-3 w-3" />فكرة</Button><Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={addStep}><Plus className="ml-1 h-3 w-3" />خطوة</Button></div></div>
          {draft.ideas?.length ? <div className="space-y-1.5">{draft.ideas.map((idea) => <div key={idea.id} className="rounded border border-border bg-secondary/20 p-2"><div className="flex items-center gap-1"><input value={idea.title} onChange={(event) => updateDraft((next) => { const item = next.ideas?.find((entry) => entry.id === idea.id); if (item) item.title = event.target.value; })} className="h-7 min-w-0 flex-1 rounded border border-border bg-background px-2 text-[10px] font-bold" /><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeIdea(idea.id)} title="حذف الفكرة"><Trash2 className="h-3 w-3 text-red-500" /></Button></div><div className="mt-1 text-[9px] text-muted-foreground">{idea.steps.length} خطوة • {idea.description || "بدون وصف"}</div></div>)}</div> : <div className="rounded border border-dashed border-border p-3 text-center text-[10px] text-muted-foreground">درس بخطوات مسطحة. يمكنك إضافة فكرة لتحويله إلى محتوى متداخل.</div>}
        </section>

        <section className="rounded-lg border border-border p-2.5">
          <div className="mb-1 text-xs font-bold">اختيار الخطوة</div>
          <select value={selectedKey} onChange={(event) => { setSelectedKey(event.target.value); setImprovement(null); setQuestionDrafts([]); }} className="h-8 w-full rounded border border-border bg-background px-2 text-[10px]"><option value="">اختر خطوة للتحرير</option>{flatSteps.map((item) => <option key={stepKey(item)} value={stepKey(item)}>{item.ideaTitle ? `${item.ideaTitle} — ` : ""}{item.step.step}. {item.step.title || "خطوة بلا عنوان"}</option>)}</select>
          {selected && <div className="mt-2 space-y-2 rounded border border-primary/25 bg-primary/5 p-2">
            <div className="flex items-center justify-between gap-1"><div className="text-[10px] font-bold">تحرير الخطوة {selected.step.step}</div><div className="flex gap-0.5"><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveSelectedStep(-1)} title="تحريك لأعلى"><ChevronUp className="h-3 w-3" /></Button><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveSelectedStep(1)} title="تحريك لأسفل"><ChevronDown className="h-3 w-3" /></Button><Button size="icon" variant="ghost" className="h-7 w-7" onClick={removeSelectedStep} title="حذف الخطوة"><Trash2 className="h-3 w-3 text-red-500" /></Button></div></div>
            <input value={selected.step.title ?? ""} onChange={(event) => updateStep(selectedKey, { title: event.target.value })} className="h-8 w-full rounded border border-border bg-background px-2 text-xs" placeholder="عنوان الخطوة" />
            <textarea value={Array.isArray(selected.step.script) ? selected.step.script.join("\n") : selected.step.script ?? ""} onChange={(event) => updateStep(selectedKey, { script: event.target.value })} className="min-h-28 w-full rounded border border-border bg-background p-2 text-xs leading-5" placeholder="سكريبت الشرح" />
            <textarea value={selected.step.notes ?? ""} onChange={(event) => updateStep(selectedKey, { notes: event.target.value })} className="min-h-20 w-full rounded border border-border bg-background p-2 text-xs leading-5" placeholder="Notes المدرس — خاصة بالمدرس ولا تظهر في Student View" />
            <div className="grid grid-cols-2 gap-1.5"><label className="text-[10px]">نوع الخطوة<select value={selected.step.type ?? "content"} onChange={(event) => updateStep(selectedKey, { type: event.target.value as SlideStep["type"] })} className="mt-1 h-8 w-full rounded border border-border bg-background px-2 text-[10px]"><option value="content">محتوى</option><option value="question">سؤال</option><option value="transition">انتقال</option><option value="celebration">احتفال</option></select></label><label className="text-[10px]">مدة تلقائية ms<input type="number" min="0" value={selected.step.autoSlideMs ?? ""} onChange={(event) => updateStep(selectedKey, { autoSlideMs: event.target.value ? Number(event.target.value) : undefined })} className="mt-1 h-8 w-full rounded border border-border bg-background px-2 text-[10px]" /></label></div>
            <div className="rounded border border-border bg-background/60 p-2"><div className="mb-1 text-[10px] font-bold">سؤال الخطوة</div><input value={selected.step.question?.text ?? ""} onChange={(event) => updateQuestion({ text: event.target.value })} className="h-8 w-full rounded border border-border bg-background px-2 text-[10px]" placeholder="نص السؤال الاختياري" /><div className="mt-1.5 grid grid-cols-2 gap-1"><input value={selected.step.question?.correctAnswer?.toString() ?? ""} onChange={(event) => updateQuestion({ correctAnswer: event.target.value })} className="h-8 rounded border border-border bg-background px-2 text-[10px]" placeholder="الإجابة الصحيحة" /><input value={selected.step.question?.options?.join("، ") ?? ""} onChange={(event) => updateQuestion({ options: event.target.value.split(/[،,\n]/).map((item) => item.trim()).filter(Boolean) })} className="h-8 rounded border border-border bg-background px-2 text-[10px]" placeholder="الخيارات مفصولة بفاصلة" /></div><div className="mt-1.5 grid grid-cols-2 gap-1"><select value={selected.step.question?.difficulty ?? "medium"} onChange={(event) => updateQuestion({ difficulty: event.target.value as StepQuestion["difficulty"] })} className="h-8 rounded border border-border bg-background px-2 text-[10px]"><option value="easy">سهل</option><option value="medium">متوسط</option><option value="hard">صعب</option></select><input value={selected.step.question?.tags?.join(", ") ?? ""} onChange={(event) => updateQuestion({ tags: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} className="h-8 rounded border border-border bg-background px-2 text-[10px]" placeholder="Tags" /></div></div>
            <div className="grid grid-cols-3 gap-1"><Button size="sm" variant="outline" className="h-8 text-[9px]" onClick={() => void improve()} disabled={busy}><Sparkles className="ml-1 h-3 w-3" />تحسين السكريبت</Button><Button size="sm" variant="outline" className="h-8 text-[9px]" onClick={() => void generateStepQuestions()} disabled={busy}><ClipboardPlus className="ml-1 h-3 w-3" />3 أسئلة AI</Button><Button size="sm" variant="outline" className="h-8 text-[9px]" onClick={() => updateStep(selectedKey, { question: undefined })} disabled={busy}><X className="ml-1 h-3 w-3" />مسح السؤال</Button></div>
            {improvement && <div className="rounded border border-amber-500/30 bg-amber-500/10 p-2 text-[10px] leading-5"><div className="font-bold">مسودة تحسين — لا تُطبق تلقائياً</div><div className="mt-1 whitespace-pre-wrap">{improvement}</div><div className="mt-2 flex gap-1"><Button size="sm" className="h-7 text-[9px]" onClick={() => { updateStep(selectedKey, { script: improvement }); setImprovement(null); }}><Check className="ml-1 h-3 w-3" />اعتماد</Button><Button size="sm" variant="outline" className="h-7 text-[9px]" onClick={() => setImprovement(null)}>رفض</Button></div></div>}
            {questionDrafts.length > 0 && <div className="rounded border border-sky-500/30 bg-sky-500/10 p-2"><div className="text-[10px] font-bold">أسئلة مولدة للمراجعة ({questionDrafts.length})</div><div className="mt-1 space-y-1">{questionDrafts.map((question, index) => <div key={`${question.text}-${index}`} className="rounded border border-border bg-background p-1.5 text-[10px]"><span className="font-bold">{index + 1}. </span>{question.text}<span className="mr-1 text-muted-foreground">({question.difficulty})</span></div>)}</div><Button size="sm" className="mt-2 h-8 w-full text-[10px]" onClick={approveStepQuestions}><Check className="ml-1 h-3 w-3" />اعتمادها للألعاب</Button></div>}
          </div>}
        </section>

        <section className="rounded-lg border border-primary/30 bg-primary/5 p-2.5"><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-1 text-xs font-bold"><Bot className="h-3.5 w-3.5 text-primary" />تحليل الدرس والسياق</div><Button size="sm" variant="outline" className="h-8 text-[10px]" onClick={() => void analyze()} disabled={busy}><Bot className="ml-1 h-3 w-3" />حلل الدرس بـAI</Button></div>{analysis && <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap break-words rounded bg-background/70 p-2 text-[10px] leading-5">{JSON.stringify(analysis, null, 2)}</pre>}</section>
        {busy && <div className="flex items-center gap-1 text-[9px] text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />جاري تنفيذ مسودة قابلة للمراجعة...</div>}
        <div className="text-[9px] leading-4 text-muted-foreground">كل تعديل غير محفوظ محلي داخل المسودة. زر الحفظ فقط يكتب إلى `manifestJson`، واقتراحات AI لا تُعرض للطلاب ولا للألعاب قبل اعتماد المدرس.</div>
      </div>
    </div>
  );
}
