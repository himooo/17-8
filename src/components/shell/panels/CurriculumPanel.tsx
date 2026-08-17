"use client";

import { useEffect, useRef, useState } from "react";
import { useShellStore } from "@/lib/shell-store";
import { readFileAsText, extractManifestFromHTML, importReactBuild } from "@/lib/shell-utils";
import type { SlideManifest } from "@/lib/slide-schema";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Trash2,
  Play,
  Search,
  Star,
  FileText,
  Upload,
  FolderOpen,
  ChevronLeft,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";

const IDEA_COLORS: Record<string, string> = {
  blue: "border-blue-500/50 bg-blue-500/10 text-blue-400",
  red: "border-red-500/50 bg-red-500/10 text-red-400",
  green: "border-green-500/50 bg-green-500/10 text-green-400",
  amber: "border-amber-500/50 bg-amber-500/10 text-amber-400",
  purple: "border-purple-500/50 bg-purple-500/10 text-purple-400",
  cyan: "border-cyan-500/50 bg-cyan-500/10 text-cyan-400",
};

/**
 * CurriculumPanel v3.0
 * - يدعم استيراد HTML + React builds
 * - يدعم الأفكار المتداخلة (Ideas)
 * - القفز المباشر على أي خطوة
 */
export function CurriculumPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expandedLesson, setExpandedLesson] = useState<string | null>(null);
  const [expandedIdea, setExpandedIdea] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [lessonQuery, setLessonQuery] = useState("");
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => { if (typeof window === "undefined") return new Set(); try { const saved = JSON.parse(localStorage.getItem("bisalasa.lessonFavorites") || "[]"); return new Set(Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : []); } catch { return new Set(); } });

  const lessons = useShellStore((s) => s.lessons);
  const activeLessonId = useShellStore((s) => s.activeLessonId);
  const addLesson = useShellStore((s) => s.addLesson);
  const removeLesson = useShellStore((s) => s.removeLesson);
  const requestConfirm = useShellStore((s) => s.requestConfirm);
  const setActiveLesson = useShellStore((s) => s.setActiveLesson);
  const manifest = useShellStore((s) => s.manifest);
  const goToStep = useShellStore((s) => s.goToStep);
  const goToIdea = useShellStore((s) => s.goToIdea);
  const currentStep = useShellStore((s) => s.currentStep);
  const currentIdeaId = useShellStore((s) => s.currentIdeaId);

  const toggleFavorite = (lessonId: string) => setFavoriteIds((current) => { const next = new Set(current); if (next.has(lessonId)) next.delete(lessonId); else next.add(lessonId); localStorage.setItem("bisalasa.lessonFavorites", JSON.stringify([...next])); return next; });

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const fileArr = Array.from(files);
    const hasNonHtml = fileArr.some((f) => !f.name.endsWith(".html") && !f.name.endsWith(".htm"));
    const hasIndexHtml = fileArr.some((f) => f.name === "index.html" || f.name.endsWith("index.html"));

    // A React build: multiple files (JS/CSS alongside an index.html), not
    // just a batch of standalone .html lesson files.
    if (hasNonHtml && hasIndexHtml) {
      try {
        const result = await importReactBuild(fileArr);
        if (!result) {
          toast.error("لم يتم العثور على index.html في الملفات المختارة");
          return;
        }
        const lesson = {
          id: `lesson_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          fileName: "React Build",
          title: result.manifest?.title || "درس React مستورد",
          importedAt: new Date().toISOString(),
          content: result.html,
          manifest: result.manifest,
        };
        addLesson(lesson);
        toast.success("تم استيراد شريحة React بنجاح");
      } catch (e) {
        console.error("Failed to import React build:", e);
        toast.error("فشل استيراد شريحة React");
      }
      return;
    }

    for (const file of fileArr) {
      if (!file.name.endsWith(".html") && !file.name.endsWith(".htm")) {
        continue;
      }
      try {
        const content = await readFileAsText(file);
        const manifest = extractManifestFromHTML(content);
        const lesson = {
          id: `lesson_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          fileName: file.name,
          title: manifest?.title || file.name.replace(/\.html?$/, ""),
          importedAt: new Date().toISOString(),
          content: content, // HTML مباشرة (ليس data URL)
          manifest,
        };
        addLesson(lesson);
      } catch (e) {
        console.error("Failed to import file:", file.name, e);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  // C13: navigation requests are tracked explicitly. Instead of an arbitrary
  // setTimeout(100/500) race, we remember WHAT the user wants to jump to,
  // and an effect below dispatches once that lesson becomes active.
  // If the lesson is already active we jump immediately (no pending).
  type PendingJump =
    | { kind: "step"; lessonId: string; step: number; ideaId?: string }
    | { kind: "idea"; lessonId: string; ideaId: string; step: number };
  const [pendingJump, setPendingJump] = useState<PendingJump | null>(null);

  // Dispatch a pending jump only when the target lesson is actually active.
  // This replaces the setTimeout race: the state is the source of truth, and
  // we never navigate before the lesson loads (or after it unloaded).
  useEffect(() => {
    if (!pendingJump) return;
    if (activeLessonId !== pendingJump.lessonId) return;
    if (pendingJump.kind === "step") {
      goToStep(pendingJump.step, pendingJump.ideaId);
    } else {
      goToIdea(pendingJump.ideaId, pendingJump.step);
    }
    // Defer the clear so we don't trigger a cascading render synchronously
    // after the navigation dispatch above.
    queueMicrotask(() => setPendingJump(null));
  }, [pendingJump, activeLessonId, goToStep, goToIdea]);

  // القفز المباشر للخطوة - تأكد أن الدرس نشط أولاً
  const jumpToStep = (lessonId: string, step: number, ideaId?: string) => {
    if (activeLessonId !== lessonId) {
      setPendingJump({ kind: "step", lessonId, step, ideaId });
      setActiveLesson(lessonId);
    } else {
      goToStep(step, ideaId);
    }
  };

  const jumpToIdea = (lessonId: string, ideaId: string, step = 1) => {
    if (activeLessonId !== lessonId) {
      setPendingJump({ kind: "idea", lessonId, ideaId, step });
      setActiveLesson(lessonId);
    } else {
      goToIdea(ideaId, step);
    }
  };

  const visibleLessons = lessons.filter((lesson) => { const query = lessonQuery.trim().toLocaleLowerCase(); return !query || lesson.title.toLocaleLowerCase().includes(query) || lesson.fileName.toLocaleLowerCase().includes(query); }).sort((a, b) => Number(favoriteIds.has(b.id)) - Number(favoriteIds.has(a.id)));

  return (
    <div className="flex flex-col h-full">
      {/* Import area */}
      <div className="p-2 border-b border-border bg-secondary/20">
        <input
          ref={fileInputRef}
          type="file"
          accept=".html,.htm,.js,.css"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button
          size="sm"
          className="w-full h-8 text-xs bg-primary hover:bg-primary/90"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-3.5 h-3.5 ml-1" />
          استيراد شرائح (HTML/React)
        </Button>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={cn(
            "mt-1 border-2 border-dashed rounded text-[10px] text-center py-1.5 transition-colors",
            dragOver
              ? "border-primary bg-primary/10 text-primary"
              : "border-border text-muted-foreground"
          )}
        >
          اسحب ملف/ملفات HTML، أو اختر ملفات React build معاً (index.html + JS/CSS)
        </div>
      </div>

      {/* Lessons list */}
      <div className="border-b border-border bg-background/70 p-2"><div className="flex items-center gap-1 rounded border border-border bg-secondary/20 px-2"><Search className="h-3 w-3 text-muted-foreground" /><input value={lessonQuery} onChange={(event) => setLessonQuery(event.target.value)} placeholder="بحث في الدروس" className="h-7 min-w-0 flex-1 bg-transparent text-[10px] outline-none" /><span className="text-[9px] text-muted-foreground">{visibleLessons.length}</span></div></div>
      <ScrollArea className="flex-1 panel-scroll">
        <div className="p-2 space-y-1">
          {lessons.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-xs">لا توجد دروس مستوردة</p>
              <p className="text-[10px] mt-1 opacity-70">
                اضغط على &quot;استيراد&quot; بالأعلى
              </p>
            </div>
          ) : (
            visibleLessons.map((lesson) => {
              const isActive = activeLessonId === lesson.id;
              const isExpanded = expandedLesson === lesson.id;
              const steps = lesson.manifest?.steps || [];
              const ideas = lesson.manifest?.ideas || [];
              const hasIdeas = ideas.length > 0;

              return (
                <div
                  key={lesson.id}
                  className={cn(
                    "rounded-md border transition-colors selectable-card",
                    isActive
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card"
                  )}
                >
                  <div className="flex items-center gap-1 p-1.5">
                    <button
                      onClick={() => setExpandedLesson(isExpanded ? null : lesson.id)}
                      className="mini-icon-btn"
                      disabled={steps.length === 0 && ideas.length === 0}
                      style={{ opacity: steps.length === 0 && ideas.length === 0 ? 0.3 : 1 }}
                    >
                      {(steps.length > 0 || ideas.length > 0) && (
                        <ChevronLeft
                          className={cn(
                            "w-3 h-3 transition-transform",
                            isExpanded && "-rotate-90"
                          )}
                        />
                      )}
                    </button>
                    <button
                      onClick={() => setActiveLesson(lesson.id)}
                      className="flex-1 flex items-center gap-1.5 min-w-0 text-right"
                    >
                      <FileText
                        className={cn(
                          "w-3.5 h-3.5 flex-shrink-0",
                          isActive ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                      <span
                        className={cn(
                          "text-xs truncate",
                          isActive ? "font-bold text-primary" : "text-foreground"
                        )}
                      >
                        {lesson.title}
                      </span>
                      {lesson.manifest?.contentType === "react" && (
                        <span className="text-[8px] bg-purple-500/20 text-purple-400 px-1 rounded">
                          React
                        </span>
                      )}
                    </button>
                    {isActive && <Play className="w-3 h-3 text-primary fill-primary" />}
                    <button onClick={() => toggleFavorite(lesson.id)} className={cn("mini-icon-btn", favoriteIds.has(lesson.id) ? "text-amber-400" : "text-muted-foreground")} title={favoriteIds.has(lesson.id) ? "إزالة من المفضلة" : "إضافة للمفضلة"}><Star className="w-3 h-3" fill={favoriteIds.has(lesson.id) ? "currentColor" : "none"} /></button>
                    <button
                      onClick={async () => {
                        if (await requestConfirm(`هل تريد حذف الدرس "${lesson.title}"؟`, { danger: true })) {
                          removeLesson(lesson.id);
                          toast.success("تم حذف الدرس");
                        }
                      }}
                      className="mini-icon-btn hover:bg-accent/20 hover:text-accent"
                      title="حذف"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Expanded content: ideas or flat steps */}
                  {isExpanded && (
                    <div className="border-t border-border/50 p-1 space-y-1 bg-secondary/20">
                      {hasIdeas ? (
                        // ===== Ideas Mode =====
                        ideas.map((idea) => {
                          const isIdeaExpanded = expandedIdea === idea.id;
                          const isCurrentIdea = currentIdeaId === idea.id && isActive;
                          return (
                            <div
                              key={idea.id}
                              className={cn(
                                "rounded border transition-colors",
                                isCurrentIdea
                                  ? "border-primary bg-primary/5"
                                  : "border-border"
                              )}
                            >
                              <div className="flex items-center gap-1 p-1">
                                <button
                                  onClick={() =>
                                    setExpandedIdea(isIdeaExpanded ? null : idea.id)
                                  }
                                  className="mini-icon-btn"
                                >
                                  <ChevronLeft
                                    className={cn(
                                      "w-3 h-3 transition-transform",
                                      isIdeaExpanded && "-rotate-90"
                                    )}
                                  />
                                </button>
                                <button
                                  onClick={() => jumpToIdea(lesson.id, idea.id, 1)}
                                  className="flex-1 flex items-center gap-1.5 text-right min-w-0"
                                >
                                  <Lightbulb
                                    className={cn(
                                      "w-3 h-3 flex-shrink-0",
                                      isCurrentIdea ? "text-primary" : "text-amber-400"
                                    )}
                                  />
                                  <span className="text-[11px] truncate font-medium">
                                    {idea.title}
                                  </span>
                                  <span className="text-[9px] text-muted-foreground">
                                    ({idea.steps.length})
                                  </span>
                                </button>
                              </div>

                              {isIdeaExpanded && (
                                <div className="border-t border-border/30 p-1 space-y-0.5 bg-background/30">
                                  {idea.steps.map((step) => {
                                    const isCurrentStep =
                                      isActive &&
                                      currentIdeaId === idea.id &&
                                      currentStep === step.step;
                                    return (
                                      <button
                                        key={step.step}
                                        onClick={() =>
                                          jumpToStep(lesson.id, step.step, idea.id)
                                        }
                                        className={cn(
                                          "w-full flex items-center gap-1.5 px-2 py-1 rounded text-[11px] text-right transition-colors",
                                          isCurrentStep
                                            ? "bg-primary text-primary-foreground"
                                            : "hover:bg-accent/10 text-foreground"
                                        )}
                                      >
                                        <span className="font-mono text-[9px] opacity-70">
                                          {String(step.step).padStart(2, "0")}
                                        </span>
                                        <span className="flex-1 truncate">
                                          {step.title || `خطوة ${step.step}`}
                                        </span>
                                        {step.type === "question" && (
                                          <span className="text-[9px]">❓</span>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        // ===== Flat Steps Mode =====
                        steps.map((step) => {
                          const isCurrentStep = isActive && currentStep === step.step;
                          return (
                            <button
                              key={step.step}
                              onClick={() => jumpToStep(lesson.id, step.step)}
                              className={cn(
                                "w-full flex items-center gap-1.5 px-2 py-1 rounded text-[11px] text-right transition-colors",
                                isCurrentStep
                                  ? "bg-primary text-primary-foreground"
                                  : "hover:bg-accent/10 text-foreground"
                              )}
                            >
                              <span className="font-mono text-[9px] opacity-70">
                                {String(step.step).padStart(2, "0")}
                              </span>
                              <span className="flex-1 truncate">
                                {step.title || `خطوة ${step.step}`}
                              </span>
                              {step.type === "question" && (
                                <span className="text-[9px]">❓</span>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Manifest info */}
      {manifest && (
        <div className="border-t border-border p-2 bg-secondary/20">
          <div className="text-[10px] text-muted-foreground mb-0.5">الدرس الحالي</div>
          <div className="text-xs font-bold text-primary truncate">
            {manifest.title}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {manifest.ideas && manifest.ideas.length > 0 ? (
              <>
                {manifest.ideas.length} فكرة •{" "}
                {manifest.ideas.reduce((s, i) => s + i.steps.length, 0)} خطوة
              </>
            ) : (
              <>
                {currentStep} / {manifest.totalSteps || manifest.steps?.length || 0} خطوة
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
