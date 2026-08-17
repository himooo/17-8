"use client";

import { useEffect, useState } from "react";
import { useShellStore, useCurrentStepData } from "@/lib/shell-store";
import { getCurrentSteps } from "@/lib/slide-schema";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  StickyNote,
  BookOpen,
  HelpCircle,
  AlertCircle,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { localDb, type StudentNote } from "@/lib/local-db";

/**
 * NotesPanel v3.1 - يدعم الأفكار المتداخلة
 */
export function NotesPanel() {
  const stepData = useCurrentStepData();
  const manifest = useShellStore((s) => s.manifest);
  const currentStep = useShellStore((s) => s.currentStep);
  const currentIdeaId = useShellStore((s) => s.currentIdeaId);
  const calledStudent = useShellStore((s) => s.currentlyCalledStudent);
  const [noteQuery, setNoteQuery] = useState("");
  const [searchedNotes, setSearchedNotes] = useState<StudentNote[]>([]);
  const [notesBusy, setNotesBusy] = useState(false);

  // Get steps safely - support both flat and ideas mode
  const allSteps = (() => {
    if (!manifest) return [];
    if (manifest.ideas && manifest.ideas.length > 0) {
      // Ideas mode: gather all steps from all ideas with their idea info
      const result: Array<{ step: number; title?: string; notes?: string; type?: string; ideaTitle?: string; ideaColor?: string }> = [];
      manifest.ideas.forEach((idea) => {
        idea.steps.forEach((s) => {
          result.push({
            ...s,
            ideaTitle: idea.title,
            ideaColor: idea.color,
          });
        });
      });
      return result;
    }
    return manifest.steps || [];
  })();

  // Get current idea steps
  const currentIdeaSteps = (() => {
    if (!manifest) return [];
    return getCurrentSteps(manifest, currentIdeaId || undefined);
  })();

  useEffect(() => {
    const timer = window.setTimeout(() => { setNotesBusy(true); localDb.studentNotes.search({ query: noteQuery, studentId: calledStudent?.id, limit: 50 }).then(setSearchedNotes).catch(() => setSearchedNotes([])).finally(() => setNotesBusy(false)); }, 180);
    return () => window.clearTimeout(timer);
  }, [noteQuery, calledStudent?.id]);

  const exportNotes = () => {
    const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, "\"\"")}"`;
    const csv = "\ufeff" + ["التاريخ", "الطالب", "الملاحظة", "مشتركة"].join(",") + "\r\n" + searchedNotes.map((note) => [note.createdAt, calledStudent?.name ?? "", note.text, note.isShared ? "نعم" : "لا"].map(escape).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "bisalasa-notes.csv"; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Current step info */}
      <div className="p-2 border-b border-border bg-secondary/20">
        <div className="text-[10px] text-muted-foreground">
          {manifest?.ideas && manifest.ideas.length > 0 ? (
            <>
              الفكرة: {manifest.ideas.find(i => i.id === currentIdeaId)?.title || "—"} • الخطوة {currentStep}
            </>
          ) : (
            <>
              الخطوة {currentStep} {manifest && `من ${manifest.totalSteps || manifest.steps?.length || 0}`}
            </>
          )}
        </div>
        <div className="text-xs font-bold text-primary">
          {stepData?.title || (manifest?.title ?? "—")}
        </div>
        {stepData?.type && (
          <div className="mt-1">
            <span
              className={cn(
                "text-[9px] px-1.5 py-0.5 rounded-full font-medium",
                stepData.type === "question"
                  ? "bg-accent/15 text-accent"
                  : stepData.type === "celebration"
                  ? "bg-success/15 text-success"
                  : "bg-secondary text-secondary-foreground"
              )}
              style={
                stepData.type === "celebration"
                  ? { background: "rgba(16, 185, 129, 0.15)", color: "#6ee7b7" }
                  : undefined
              }
            >
              {stepData.type === "question"
                ? "سؤال تفاعلي"
                : stepData.type === "celebration"
                ? "احتفال"
                : stepData.type === "transition"
                ? "انتقال"
                : "شرح"}
            </span>
          </div>
        )}
      </div>

      <div className="border-b border-border bg-background/70 p-2 space-y-1">
        <div className="flex items-center gap-1 text-[10px] font-bold"><StickyNote className="w-3 h-3" /> بحث ملاحظات المعلم</div>
        <div className="flex gap-1"><input value={noteQuery} onChange={(event) => setNoteQuery(event.target.value)} placeholder={calledStudent ? `ملاحظات ${calledStudent.name}` : "ابحث في الملاحظات"} className="min-w-0 flex-1 h-7 rounded border border-border bg-background px-2 text-[10px]" /><button onClick={exportNotes} disabled={notesBusy || searchedNotes.length === 0} className="rounded border border-border px-2 text-[9px] disabled:opacity-50">CSV</button></div>
        {notesBusy ? <div className="text-[9px] text-muted-foreground">جاري البحث...</div> : searchedNotes.length > 0 ? <div className="max-h-24 space-y-1 overflow-auto">{searchedNotes.slice(0, 5).map((note) => <div key={note.id} className="rounded border border-border/60 bg-secondary/20 p-1 text-[9px] leading-4"><span className="text-muted-foreground">{new Date(note.createdAt).toLocaleDateString("ar-EG")}:</span> {note.text}{note.isShared && <span className="mr-1 text-emerald-600">• مشتركة</span>}</div>)}</div> : <div className="text-[9px] text-muted-foreground">لا توجد نتائج.</div>}
      </div>

      <ScrollArea className="flex-1 panel-scroll">
        <div className="p-2 space-y-2">
          {/* Notes */}
          <div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
              <StickyNote className="w-3 h-3" />
              ملاحظات المدرس
            </div>
            <div className="text-xs leading-relaxed bg-secondary/30 rounded p-2 min-h-[60px] border border-border">
              {stepData?.notes ? (
                <p className="whitespace-pre-wrap text-foreground">{stepData.notes}</p>
              ) : (
                <p className="text-muted-foreground italic text-[11px]">
                  لا توجد ملاحظات لهذه الخطوة
                </p>
              )}
            </div>
          </div>

          {/* Question details */}
          {stepData?.question && (
            <div>
              <div className="flex items-center gap-1 text-[10px] text-accent mb-1">
                <HelpCircle className="w-3 h-3" />
                بيانات السؤال
              </div>
              <div className="bg-accent/5 rounded p-2 space-y-1 border border-accent/30">
                {stepData.question.text && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">السؤال: </span>
                    <span className="text-foreground">{stepData.question.text}</span>
                  </div>
                )}
                {stepData.question.correctAnswer !== undefined && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">الإجابة: </span>
                    <span className="font-bold text-success" style={{ color: "#6ee7b7" }}>
                      {stepData.question.correctAnswer}
                    </span>
                  </div>
                )}
                {stepData.question.options && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">الاختيارات: </span>
                    <span className="text-foreground">{stepData.question.options.join(" | ")}</span>
                  </div>
                )}
                {stepData.question.rewardPoints && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">المكافأة: </span>
                    <span className="font-bold text-primary">
                      +{stepData.question.rewardPoints} نقطة
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* All steps quick view */}
          {allSteps.length > 1 && (
            <div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                {manifest?.ideas && manifest.ideas.length > 0 ? (
                  <>
                    <Lightbulb className="w-3 h-3" />
                    كل الأفكار والخطوات ({allSteps.length})
                  </>
                ) : (
                  <>
                    <BookOpen className="w-3 h-3" />
                    كل الخطوات
                  </>
                )}
              </div>
              <div className="space-y-1">
                {/* Ideas mode: group by idea */}
                {manifest?.ideas && manifest.ideas.length > 0 ? (
                  manifest.ideas.map((idea) => {
                    const isCurrentIdea = idea.id === currentIdeaId;
                    return (
                      <div key={idea.id} className="border border-border/50 rounded overflow-hidden">
                        <div className={cn(
                          "px-2 py-1 text-[10px] font-bold flex items-center gap-1",
                          isCurrentIdea ? "bg-primary/20 text-primary" : "bg-secondary/40 text-muted-foreground"
                        )}>
                          <Lightbulb className="w-2.5 h-2.5" />
                          {idea.title}
                          <span className="opacity-50">({idea.steps.length})</span>
                        </div>
                        <div className="p-1 space-y-0.5 bg-background/30">
                          {idea.steps.map((s) => {
                            const isCurrentStep = isCurrentIdea && currentStep === s.step;
                            return (
                              <div
                                key={`${idea.id}-${s.step}`}
                                className={cn(
                                  "text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1",
                                  isCurrentStep
                                    ? "bg-primary text-primary-foreground"
                                    : "hover:bg-accent/10 text-foreground"
                                )}
                              >
                                <span className="font-mono opacity-70">
                                  {String(s.step).padStart(2, "0")}
                                </span>
                                <span className="flex-1 truncate">
                                  {s.title || `خطوة ${s.step}`}
                                </span>
                                {s.notes && <span className="opacity-50">📝</span>}
                                {s.type === "question" && <AlertCircle className="w-2.5 h-2.5" />}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  // Flat mode
                  allSteps.map((s) => {
                    const isCurrentStep = currentStep === s.step;
                    return (
                      <div
                        key={s.step}
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1",
                          isCurrentStep
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary/50 text-foreground"
                        )}
                      >
                        <span className="font-mono opacity-70">
                          {String(s.step).padStart(2, "0")}
                        </span>
                        <span className="flex-1 truncate">
                          {s.title || `خطوة ${s.step}`}
                        </span>
                        {s.notes && <span className="opacity-50">📝</span>}
                        {s.type === "question" && <AlertCircle className="w-2.5 h-2.5" />}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
