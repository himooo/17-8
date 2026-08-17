"use client";

import { useShellStore } from "@/lib/shell-store";
import { cn } from "@/lib/utils";
import { BookOpen, Radio, VolumeX, Pen, Clock, Activity } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * TopStatusBar - شريط الحالة العلوي الرفيع
 * يعرض: العلامة، اسم الدرس، مؤشرات الحالة
 */
export function TopStatusBar() {
  const manifest = useShellStore((s) => s.manifest);
  const lessons = useShellStore((s) => s.lessons);
  const activeLessonId = useShellStore((s) => s.activeLessonId);
  const settings = useShellStore((s) => s.settings);
  const currentStep = useShellStore((s) => s.currentStep);
  const currentIdeaId = useShellStore((s) => s.currentIdeaId);
  const currentSessionId = useShellStore((s) => s.currentSessionId);
  const students = useShellStore((s) => s.students);
  const liveStatuses = useShellStore((s) => s.studentLiveStatuses);

  const activeLesson = lessons.find((l) => l.id === activeLessonId);
  const understanding = students.length > 0 ? Math.round(students.reduce((sum, student) => { const live = liveStatuses[student.id] ?? (student.moodleUserId ? liveStatuses[`moodle:${student.moodleUserId}`] : undefined) ?? (student.studentCode ? liveStatuses[`custom:${student.studentCode}`] : undefined); return sum + (live?.status === "correct" ? 1 : live?.status === "waiting" ? 0.5 : 0); }, 0) / students.length * 100) : null;
  const ideaAnswers = Object.values(liveStatuses).filter((status) => status.source === "live" && status.lessonId === manifest?.lessonId && (status.ideaId ?? "root") === (currentIdeaId ?? "root") && typeof status.isCorrect === "boolean");
  const ideaUnderstanding = ideaAnswers.length ? Math.round(ideaAnswers.filter((status) => status.isCorrect === true).length / ideaAnswers.length * 100) : null;
  const lastAlertRef = useRef("");
  useEffect(() => {
    if (ideaUnderstanding === null || ideaUnderstanding >= 50) return;
    const signature = `${manifest?.lessonId ?? ""}:${currentIdeaId ?? "root"}:${ideaAnswers.length}:${ideaUnderstanding}`;
    if (lastAlertRef.current === signature) return;
    lastAlertRef.current = signature;
    toast.warning("نصف الفصل لم يفهم الفكرة بعد — جرّب إعادة الشرح أو سؤالاً علاجياً", { duration: 3600 });
  }, [currentIdeaId, ideaAnswers.length, ideaUnderstanding, manifest?.lessonId]);

  return (
    <div className="fixed top-0 left-0 right-0 z-40 h-7 bg-card border-b border-border flex items-center px-3 gap-2 text-[11px]">  {/* P2 fix: was z-30 (collided with BOTTOM_BAR=30), now z-40 (TOP_BAR) */}
      {/* Brand */}
      <div className="flex items-center gap-1.5 font-bold flex-shrink-0">
        <div className="w-5 h-5 rounded brand-gradient flex items-center justify-center text-white text-[10px] font-bold">
          ب
        </div>
        <span className="text-primary">بِسَلَاسَة</span>
        <span className="text-muted-foreground text-[10px] hidden sm:inline">
          غرفة عمليات المدرس
        </span>
      </div>

      <div className="w-px h-4 bg-border" />

      {/* Current lesson */}
      <div className="flex items-center gap-1 min-w-0 flex-1">
        <BookOpen className="w-3 h-3 text-muted-foreground flex-shrink-0" />
        <span className="truncate text-muted-foreground">
          {activeLesson ? (
            <>
              <span className="font-bold text-foreground">
                {activeLesson.title}
              </span>
              {manifest && (
                <span className="mr-2 text-muted-foreground">
                  {manifest.ideas && manifest.ideas.length > 0 ? (
                    <>
                      • {manifest.ideas.length} فكرة • {manifest.ideas.reduce((s, i) => s + i.steps.length, 0)} خطوة • الخطوة {currentStep}
                      {currentIdeaId && (
                        <span className="text-primary">
                          {" "}• {manifest.ideas.find(i => i.id === currentIdeaId)?.title}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      • {manifest.totalSteps} خطوة • الخطوة {currentStep}
                    </>
                  )}
                </span>
              )}
            </>
          ) : (
            "لا يوجد درس محمّل"
          )}
        </span>
      </div>

      {/* Status pills */}
      <div className="flex items-center gap-1">
        {understanding !== null && (
          <div className={cn("status-pill", understanding >= 70 ? "success" : understanding >= 40 ? "accent" : "danger")} title="مؤشر تقديري من آخر حالات الإجابة. لا يستبدل قرار المدرس."><Activity className="w-2.5 h-2.5" /> فهم {understanding}%</div>
        )}
        {ideaUnderstanding !== null && (
          <div className={cn("status-pill", ideaUnderstanding >= 70 ? "success" : ideaUnderstanding >= 50 ? "accent" : "danger")} title="إجابات الفكرة الحالية فقط من Live App. القرار للمدرس."><Activity className="w-2.5 h-2.5" /> الفكرة {ideaUnderstanding}%</div>
        )}

        {currentSessionId && (
          <div className="status-pill success" title="جلسة نشطة — كل تفاعل الطلاب مسجَّل في SQLite">
            <Clock className="w-2.5 h-2.5" />
            جلسة نشطة
          </div>
        )}

        <div
          className={cn(
            "status-pill",
            settings.presentationMode === "auto" ? "accent" : "primary"
          )}
        >
          <Radio className="w-2.5 h-2.5" />
          {settings.presentationMode === "auto" ? "تلقائي" : "يدوي"}
        </div>

        {settings.muted && (
          <div className="status-pill accent">
            <VolumeX className="w-2.5 h-2.5" />
            مكتوم
          </div>
        )}

        {settings.whiteboardEnabled && (
          <div className="status-pill primary">
            <Pen className="w-2.5 h-2.5" />
            السبورة
          </div>
        )}

        {settings.iframeDevice && settings.iframeDevice !== "desktop" && (
          <div className="status-pill success">
            {settings.iframeDevice === "tablet" ? "📱 تابلت" : "📱 موبايل"}
          </div>
        )}

        {settings.iframeZoom && settings.iframeZoom !== 100 && (
          <div className="status-pill primary">
            {settings.iframeZoom}%
          </div>
        )}
      </div>
    </div>
  );
}
