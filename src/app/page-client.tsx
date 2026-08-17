"use client";

import dynamic from "next/dynamic";
import { IframeStage } from "@/components/shell/IframeStage";
import { BisalasaLogo } from "@/components/shell/BisalasaLogo";
import { Activity } from "lucide-react";
import { StudentViewToggleButton } from "@/components/shell/StudentViewMode";
import { useEffect, useState, useRef } from "react";
import { useShellStore, dbStudentToStoreStudent } from "@/lib/shell-store";
import { hydrateFromDb } from "@/lib/db-sync";
import { toast } from "sonner";
import { initTtsAnnouncer, updateTtsSetting } from "@/lib/tts-announcer";

const TeacherLoading = () => null;
const SmartWhiteboard = dynamic(() => import("@/components/shell/SmartWhiteboard").then((m) => m.SmartWhiteboard), { ssr: false, loading: TeacherLoading });
const DraggableTeleprompter = dynamic(() => import("@/components/shell/DraggableTeleprompter").then((m) => m.DraggableTeleprompter), { ssr: false, loading: TeacherLoading });
const FloatingSideRail = dynamic(() => import("@/components/shell/FloatingSideRail").then((m) => m.FloatingSideRail), { ssr: false, loading: TeacherLoading });
const BottomControlBar = dynamic(() => import("@/components/shell/BottomControlBar").then((m) => m.BottomControlBar), { ssr: false, loading: TeacherLoading });
const KeyboardShortcuts = dynamic(() => import("@/components/shell/KeyboardShortcuts").then((m) => m.KeyboardShortcuts), { ssr: false, loading: TeacherLoading });
const EffectsEngine = dynamic(() => import("@/components/shell/EffectsEngine").then((m) => m.EffectsEngine), { ssr: false, loading: TeacherLoading });
const WhiteboardContextMenu = dynamic(() => import("@/components/shell/WhiteboardContextMenu").then((m) => m.WhiteboardContextMenu), { ssr: false, loading: TeacherLoading });
const ConfirmDialogHost = dynamic(() => import("@/components/shell/ConfirmDialogHost").then((m) => m.ConfirmDialogHost), { ssr: false, loading: TeacherLoading });
const CelebrationsOverlay = dynamic(() => import("@/components/shell/CelebrationsOverlay").then((m) => m.CelebrationsOverlay), { ssr: false, loading: TeacherLoading });
const VirtualCommentLayer = dynamic(() => import("@/components/shell/VirtualCommentLayer").then((m) => m.VirtualCommentLayer), { ssr: false, loading: TeacherLoading });
const VirtualCommentBubble = dynamic(() => import("@/components/shell/VirtualCommentBubble").then((m) => m.VirtualCommentBubble), { ssr: false, loading: TeacherLoading });
const MoodleLiveSync = dynamic(() => import("@/components/shell/MoodleLiveSync").then((m) => m.MoodleLiveSync), { ssr: false, loading: TeacherLoading });
const LiveSyncBridge = dynamic(() => import("@/components/shell/LiveSyncBridge").then((m) => m.LiveSyncBridge), { ssr: false, loading: TeacherLoading });

const TOP_BAR_HEIGHT = 28;
const BOTTOM_BAR_HEIGHT = 48;
const STAGE_MARGIN = 4;
export const SIDE_RAIL_WIDTH = 52;

export default function HomePage({ studentBroadcast = false }: { studentBroadcast?: boolean }) {
  const settings = useShellStore((s) => s.settings);
  const workspaceMode = settings.workspaceMode || "landscape";

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  // Accessibility enhancement for the teacher shell and dynamically loaded panels.
  // Existing visual titles remain the source of truth; this only exposes them to
  // keyboard/screen-reader users through the standard button name attribute.
  useEffect(() => {
    const labelButtons = () => {
      document.querySelectorAll<HTMLButtonElement>("button:not([aria-label])").forEach((button) => {
        const label = button.getAttribute("title") || button.textContent?.replace(/\s+/g, " ").trim();
        if (label) button.setAttribute("aria-label", label.slice(0, 160));
      });
    };
    labelButtons();
    const observer = new MutationObserver(labelButtons);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ count?: number }>).detail;
      toast.success(`تمت معالجة ${detail?.count || "كل"} من الطلاب المتعثرين في الفكرة الحالية`, { duration: 2600 });
    };
    window.addEventListener("bisalasa:fairness-resolved", handler);
    return () => window.removeEventListener("bisalasa:fairness-resolved", handler);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  // ===== Session prompt: سؤال بدء جلسة جديدة عند فتح التطبيق =====
  const requestConfirm = useShellStore((s) => s.requestConfirm);
  const startNewSession = useShellStore((s) => s.startNewSession);
  const endCurrentSession = useShellStore((s) => s.endCurrentSession);
  const currentSessionId = useShellStore((s) => s.currentSessionId);
  const sessionPromptShown = useRef(false);

  useEffect(() => {
    if (studentBroadcast || sessionPromptShown.current || typeof window === "undefined") return;

    let cancelled = false;
    const promptForSession = async () => {
      if (cancelled || sessionPromptShown.current) return;
      sessionPromptShown.current = true;
      const existingSessionId = useShellStore.getState().currentSessionId;
      if (existingSessionId) {
        // لا نعرض الحوار قبل اكتمال hydration؛ هذا يمنع ظهوره متأخرًا فوق
        // أول نقرة للمدرس بعد فتح التطبيق.
        const resume = await requestConfirm(
          "يوجد جلسة نشطة محفوظة من قبل. هل تريد استكمالها؟ (اضغط إلغاء لبدء جلسة جديدة)"
        );
        if (!resume) {
          await endCurrentSession();
          await startNewSession();
        }
      } else {
        const shouldStart = await requestConfirm(
          "هل تريد بدء جلسة جديدة؟ سيتم تسجيل جميع أنشطة الطلاب في هذه الجلسة."
        );
        if (shouldStart) await startNewSession();
      }
    };

    const handleHydrationComplete = () => { void promptForSession(); };
    window.addEventListener("bisalasa:hydration-complete", handleHydrationComplete);

    // Covers a fast boot where hydration completed before this effect subscribed.
    if (window.__BISALASA_HYDRATION_COMPLETE__) void promptForSession();

    return () => {
      cancelled = true;
      window.removeEventListener("bisalasa:hydration-complete", handleHydrationComplete);
    };
  }, [studentBroadcast, requestConfirm, startNewSession, endCurrentSession]);

  // ===== Session prompt: سؤال إنهاء الجلسة عند إغلاق التطبيق =====
  // P1-14 fix: beforeunload must be fire-and-forget. Browsers don't wait for async
  // work in beforeunload — the tab may close before the fetch finishes, so endedAt
  // and statsJson may never be written. We send the request without awaiting; the
  // e.preventDefault() + returnValue trigger the "leave site?" confirmation, giving
  // the request a small window to complete.
  //
  // P11 fix (2025-AUG): the previous implementation called endCurrentSession on
  // EVERY beforeunload, including F5 reloads. That ended the session in the DB
  // AND cleared currentSessionId from the persisted store, so after a reload
  // the teacher lost their session. Now we only end the session when the user
  // is actually navigating away from the app (location change) OR closing the
  // tab — not on browser refresh. We detect "true navigation" via
  // performance.getEntriesByType("navigation")[0].type — "reload" means F5,
  // "navigate" means real navigation.
  useEffect(() => {
    if (studentBroadcast) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const sessionId = useShellStore.getState().currentSessionId;
      if (!sessionId) return;

      // P11 fix: detect if this is a reload (F5/Ctrl+R) vs a real navigation.
      // On reload, we DON'T end the session — it will be restored on next boot
      // via the persisted currentSessionId in localStorage.
      try {
        const navEntries = performance.getEntriesByType(
          "navigation"
        ) as PerformanceNavigationTiming[];
        const navType = navEntries[0]?.type;
        if (navType === "reload") {
          // Just persist state — don't end the session.
          return;
        }
      } catch {
        // If performance API fails, fall through to the old behavior.
      }

      // Real navigation/tab close — end the session.
      void endCurrentSession();
      e.preventDefault();
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [studentBroadcast, endCurrentSession]);

  // ===== Hydrate Zustand from SQLite on boot =====
  // SQLite is the source of truth; localStorage is cache only.
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Skip if already hydrated this session
    if (window.__BISALASA_HYDRATED__) return;
    window.__BISALASA_HYDRATED__ = true;

    let cancelled = false;
    const doHydrate = () => {
      if (cancelled) return;
      void hydrateFromDb(
        (students) => { if (!cancelled) useShellStore.setState({ students: students.map(dbStudentToStoreStudent) }); },
        (lessons) => {
          if (cancelled) return;
          useShellStore.setState({ lessons });
          // Restore the persisted lesson through the real activation path so
          // local HTML lessons that do not emit MANIFEST still hydrate their
          // manifest and SQLite question bank on boot.
          const state = useShellStore.getState();
          const persistedLessonId = state.activeLessonId;
          const lessonToActivate = persistedLessonId && lessons.some((lesson) => lesson.id === persistedLessonId)
            ? persistedLessonId
            : lessons[0]?.id;
          if (lessonToActivate) state.setActiveLesson(lessonToActivate);
        },
        (settings) => {
          if (cancelled) return;
          useShellStore.setState({ settings });
          // استعادة virtualCommentsEnabled من الإعدادات
          if (settings && typeof settings.virtualCommentsEnabled === "boolean") {
            useShellStore.setState({ virtualCommentsEnabled: settings.virtualCommentsEnabled });
          }
          // ===== تهيئة النظام الصوتي من الإعدادات =====
          if (settings) {
            initTtsAnnouncer({
              ttsEnabled: settings.ttsEnabled ?? true,
              ttsRate: settings.ttsRate ?? 1.0,
              ttsSpeakStudentName: settings.ttsSpeakStudentName ?? true,
              ttsSpeakPoints: settings.ttsSpeakPoints ?? true,
              ttsSpeakCelebrations: settings.ttsSpeakCelebrations ?? true,
              ttsSpeakGifts: settings.ttsSpeakGifts ?? true,
            });
          }
        },
        (id) => { if (!cancelled) useShellStore.setState({ activeClassId: id }); },
        // H8 fix: pass the current activeClassId so hydration preserves it
        useShellStore.getState().activeClassId
      ).finally(() => {
        if (!cancelled) {
          window.__BISALASA_HYDRATION_COMPLETE__ = true;
          window.dispatchEvent(new Event("bisalasa:hydration-complete"));
        }
      });
    };

    // Wait for zustand persist to finish rehydrating before hydrating from DB.
    // Falls back to a 300ms timeout if onFinishHydration is unavailable.
    const persistApi = (useShellStore as { persist?: { onFinishHydration?: (cb: () => void) => () => void; hasHydrated?: () => boolean } }).persist;
    let unsub: (() => void) | undefined;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
    let hydrationStarted = false;
    const startHydration = () => {
      if (hydrationStarted) return;
      hydrationStarted = true;
      if (fallbackTimer !== undefined) clearTimeout(fallbackTimer);
      doHydrate();
    };
    if (persistApi?.onFinishHydration) {
      if (persistApi.hasHydrated?.()) {
        startHydration();
      } else {
        unsub = persistApi.onFinishHydration(startHydration);
        // Zustand can finish persistence before this effect subscribes. Never
        // leave SQLite hydration blocked forever if that race occurs.
        fallbackTimer = setTimeout(startHydration, 500);
      }
    } else {
      fallbackTimer = setTimeout(startHydration, 300);
    }

    // Load celebrations list from DB (so triggerCelebration + overlay use the
    // user-edited labels/icons/colors/sounds instead of the static defaults).
    useShellStore.getState().loadCelebrationsFromDb();

    // Seed a real, comprehensive demo curriculum on first run (no-op if the
    // user already has any lessons). After seeding, re-pull lessons so the
    // demo appears immediately in the CurriculumPanel without a reload.
    (async () => {
      try {
        const { seedDemoLessonIfEmpty } = await import("@/lib/seed-demo-lesson");
        await seedDemoLessonIfEmpty();
        const { localDb } = await import("@/lib/local-db");
        const fresh = await localDb.lessons.list();
        if (!cancelled && fresh.length > 0) {
          useShellStore.setState({ lessons: fresh });
        }
      } catch (e) {
        console.warn("[page] demo lesson seeding failed:", e);
      }
    })();

    return () => { cancelled = true; unsub?.(); if (fallbackTimer !== undefined) clearTimeout(fallbackTimer); };
  }, []);

  const stageTop = TOP_BAR_HEIGHT + STAGE_MARGIN;

  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // P9 fix: "app fullscreen" = browser fullscreen WITH all panels visible.
  // The existing "F" button enters browser fullscreen but HIDES panels
  // (presentation mode). The new side button (في FloatingSideRail) toggles
  // `appFullscreenKeepPanels` so when the browser enters fullscreen, the
  // full layout (TopBar + stage + side rail + teleprompter + bottom bar)
  // stays visible — giving the teacher the full screen space without
  // losing access to any control.
  const [appFullscreenKeepPanels, setAppFullscreenKeepPanels] = useState(false);
  useEffect(() => {
    useShellStore.setState({ appFullscreenKeepPanels });
  }, [appFullscreenKeepPanels]);
  // Expose a toggle to the side rail via a window event.
  useEffect(() => {
    const handler = () => {
      const next = !useShellStore.getState().appFullscreenKeepPanels;
      setAppFullscreenKeepPanels(next);
      // Trigger browser fullscreen to match.
      (async () => {
        try {
          if (next && !document.fullscreenElement) {
            await document.documentElement.requestFullscreen();
          } else if (!next && document.fullscreenElement) {
            await document.exitFullscreen();
          }
        } catch (e) {
          console.warn("[appFullscreen] toggle failed:", e);
        }
      })();
    };
    window.addEventListener("bisalasa:toggleAppFullscreen", handler);
    return () => window.removeEventListener("bisalasa:toggleAppFullscreen", handler);
  }, []);

  // Teleprompter width (for landscape mode - right side) - حجم معقول
  const teleprompterWidth = settings.teleprompterWidth || 300;
  // Teleprompter height (for portrait mode - top) - حجم معقول
  const teleprompterHeight = settings.teleprompterHeight || 150;
  // هامش صغير بين السكريبت والكانفاس
  const SCRIPT_GAP = 4;

  // P9 fix: "presentation mode" (existing F button) hides panels.
  // `appFullscreenKeepPanels` overrides that — when true, the full layout
  // is rendered even in browser fullscreen.
  const renderPresentationMode = isFullscreen && !appFullscreenKeepPanels;

  if (studentBroadcast) {
    return (
      <main className="fixed inset-0 overflow-hidden bg-black" data-student-broadcast="true" aria-label="المشهد الطلابي">
        <div className="absolute inset-0">
          <IframeStage studentView />
        </div>
      </main>
    );
  }

  return (
    <main className="w-screen h-screen overflow-hidden bg-background relative">
      {/* ===== Top Bar (فوق كل الأحوال - يظهر في الفيديو) ===== */}
      <TopBar />

      {/* Teleprompter يتم وضعه داخل الـ workspace layout أدناه */}

      {/* ===== Main Stage Area =====
          فلسفة الـ workspace:
          - landscape (عرضي): القوائم يمين + الاسكربت يمين بجانب القوائم + الكانفاس في النص (يأخذ أقصى مساحة عرض)
          - portrait (طولي 9:16): الاسكربت فوق + القوائم يمين + الكانفاس في النص (يأخذ أقصى مساحة طول)
          في الحالتين: الكانفاس هو الـ iframe الذي يظهر للطلاب في الزوم
      */}
      {renderPresentationMode ? (
        <div className="fixed inset-0 z-[200]">
          <IframeStage>
            <SmartWhiteboard />
          </IframeStage>
        </div>
      ) : workspaceMode === "landscape" ? (
        // ===== Landscape (عرضي): القوائم + الاسكربت على اليمين، الكانفاس قريب جداً =====
        <>
          <div
            className="absolute"
            style={{
              top: `${stageTop}px`,
              bottom: `${BOTTOM_BAR_HEIGHT + STAGE_MARGIN}px`,
              left: `${STAGE_MARGIN}px`,
              right: `${SIDE_RAIL_WIDTH + teleprompterWidth + SCRIPT_GAP}px`,
            }}
          >
            <IframeStage>
              <SmartWhiteboard />
            </IframeStage>
          </div>
          {/* القوائم على أقصى اليمين */}
          <FloatingSideRail top={stageTop} bottom={BOTTOM_BAR_HEIGHT} />
          {/* الاسكربت بجانب القوائم (على اليمين) - قريب من الكانفاس */}
          <div
            className="absolute z-50"
            style={{
              top: `${stageTop}px`,
              bottom: `${BOTTOM_BAR_HEIGHT + STAGE_MARGIN}px`,
              right: `${SIDE_RAIL_WIDTH + STAGE_MARGIN}px`,
              width: `${teleprompterWidth}px`,
            }}
          >
            <DraggableTeleprompter />
          </div>
        </>
      ) : (
        // ===== Portrait (طولي 9:16): الاسكربت فوق، القوائم يمين من فوق لتحت، الكانفاس قريب =====
        <>
          <div
            className="absolute"
            style={{
              top: `${stageTop + teleprompterHeight + SCRIPT_GAP}px`,
              bottom: `${BOTTOM_BAR_HEIGHT + STAGE_MARGIN}px`,
              left: `${STAGE_MARGIN}px`,
              right: `${SIDE_RAIL_WIDTH + STAGE_MARGIN}px`,
            }}
          >
            <IframeStage>
              <SmartWhiteboard />
            </IframeStage>
          </div>
          {/* القوائم على أقصى اليمين - من فوق لتحت كاملة */}
          <FloatingSideRail top={stageTop} bottom={BOTTOM_BAR_HEIGHT} />
          {/* الاسكربت في الأعلى - قابل للتكبير/التصغير بالسحب من الأسفل */}
          <div
            className="absolute z-50"
            style={{
              top: `${stageTop}px`,
              left: `${STAGE_MARGIN}px`,
              right: `${SIDE_RAIL_WIDTH + STAGE_MARGIN}px`,
              height: `${teleprompterHeight}px`,
            }}
          >
            <DraggableTeleprompter />
          </div>
        </>
      )}

      {/* Bottom Control Bar */}
      {!renderPresentationMode && <BottomControlBar />}

      {/* Right-click context menu for whiteboard */}
      <WhiteboardContextMenu />

      {/* Background Systems */}
      <KeyboardShortcuts />
      <EffectsEngine />
      <ConfirmDialogHost />
      {/* Single celebration system — CelebrationsOverlay handles banner + confetti.
          StageCelebrations was removed because both were listening to the same
          celebrationCounter and rendering on top of each other (text pile-up bug). */}
      <CelebrationsOverlay />
      <VirtualCommentLayer />
      <VirtualCommentBubble />
      <MoodleLiveSync />
      <LiveSyncBridge />
    </main>
  );
}

/**
 * TopBar - شريط علوي ثابت
 * يحتوي على: لوجو بسلاسة + عنوان الدرس + اسم الصف
 */
function TopBar() {
  const manifest = useShellStore((s) => s.manifest);
  const currentIdeaId = useShellStore((s) => s.currentIdeaId);
  const activeClassId = useShellStore((s) => s.activeClassId);
  const settings = useShellStore((s) => s.settings);
  const studentLiveStatuses = useShellStore((s) => s.studentLiveStatuses);
  const updateSettings = useShellStore((s) => s.updateSettings);
  const requestConfirm = useShellStore((s) => s.requestConfirm);
  const [className, setClassName] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const timer = window.setTimeout(() => {
      if (!activeClassId) {
        setClassName(null);
        return;
      }
      void import("@/lib/data-store").then((m) => m.getAllClasses()).then((classes) => {
        if (!alive) return;
        const cls = classes.find((c) => c.id === activeClassId);
        setClassName(cls?.name || null);
      }).catch(() => {
        if (alive) setClassName(null);
      });
    }, 0);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [activeClassId]);

  const ideaTitle = manifest?.ideas?.find((i) => i.id === currentIdeaId)?.title;
  const workspaceMode = settings.workspaceMode || "landscape";

  return (
    <div className="fixed top-0 left-0 right-0 z-40 h-7 bg-card border-b border-border flex items-center justify-between px-3">
      {/* يمين: لوجو بسلاسة + بسلاسة مع م.آية + عنوان الدرس */}
      <div className="flex items-center gap-2 min-w-0">
        <BisalasaLogo size={22} showText={false} />
        <div className="flex flex-col leading-none">
          <span className="text-[10px] font-bold text-white">بسلاسة</span>
          <span className="text-[8px] text-white/70">مع م.آية</span>
        </div>
        {manifest?.title && (
          <>
            <span className="text-muted-foreground">•</span>
            <span className="text-xs font-bold text-foreground truncate max-w-[200px]">
              {manifest.title}
            </span>
            {ideaTitle && (
              <>
                <span className="text-muted-foreground">•</span>
                <span className="text-[11px] text-muted-foreground truncate max-w-[100px]">
                  {ideaTitle}
                </span>
              </>
            )}
          </>
        )}
      </div>

      {/* وسط: زر تبديل workspace mode (أيقونة فقط + تأكيد) */}
      <button
        onClick={async () => {
          const newMode = workspaceMode === "landscape" ? "portrait" : "landscape";
          const ok = await requestConfirm(
            newMode === "portrait"
              ? "هل تريد التبديل للوضع الطولي (9:16)؟ سيظهر الإسكربت في الأعلى والقوائم على اليمين."
              : "هل تريد التبديل للوضع العرضي؟ سيظهر الإسكربت على اليمين والقوائم بجانبه."
          );
          if (ok) updateSettings({ workspaceMode: newMode });
        }}
        className="text-[10px] bg-secondary/50 hover:bg-secondary px-2 py-0.5 rounded-md font-bold text-foreground flex items-center gap-1"
        title={workspaceMode === "landscape" ? "التبديل للوضع الطولي (9:16)" : "التبديل للوضع العرضي"}
      >
        {workspaceMode === "landscape" ? "📱" : "💻"}
      </button>

            {/* يسار: حالة الاتصال الحي + اسم الصف + P2-15: زر معاينة الطالب */}
      <div className="flex items-center gap-2 text-[10px]">
        {Object.keys(studentLiveStatuses).length > 0 && <span className="status-pill success" title="نشاط Moodle الأخير؛ لا يُعد حكماً على صحة الإجابة"><Activity className="h-2.5 w-2.5" /> مباشر {Object.values(studentLiveStatuses).filter((value) => value.status === "waiting").length}</span>}

        {className ? (
          <span className="bg-[#10b981]/20 text-[#10b981] px-2 py-0.5 rounded-full font-bold">
            {className}
          </span>
        ) : (
          <span className="text-muted-foreground">لا يوجد صف نشط</span>
        )}
        {/* P2-15: معاينة الطالب — يظهر الدرس كما يراه الطلاب دون واجهة المعلم */}
        <StudentViewToggleButton />
      </div>
    </div>
  );
}
