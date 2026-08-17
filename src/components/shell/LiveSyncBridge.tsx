"use client";

import { useEffect, useRef } from "react";
import { useShellStore } from "@/lib/shell-store";

export function LiveSyncBridge() {
  const enabled = useShellStore((state) => state.settings.liveSyncEnabled === true);
  const pollMs = useShellStore((state) => Math.max(1000, Math.min(30000, state.settings.liveSyncPollMs ?? 3000)));
  const lessonId = useShellStore((state) => state.manifest?.lessonId);
  const setStudentLiveStatuses = useShellStore((state) => state.setStudentLiveStatuses);
  const sinceRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const cursorKey = `bisalasa-live-sync-cursor:${lessonId ?? "none"}`;
    sinceRef.current = window.sessionStorage.getItem(cursorKey) || new Date(Date.now() - 60_000).toISOString();
    if (!enabled || !lessonId) return;
    let cancelled = false;
    let timer: number | undefined;
    const poll = async () => {
      if (cancelled) return;
      try {
        const params = new URLSearchParams({ since: sinceRef.current ?? new Date(Date.now() - 60_000).toISOString(), lessonId });
        const response = await fetch(`/api/live-sync?${params.toString()}`, { cache: "no-store" });
        const payload = await response.json().catch(() => ({ ok: false }));
        const events = payload?.ok && Array.isArray(payload.data?.events) ? payload.data.events as Array<{ eventId?: string; studentCode?: string | null; lessonId?: string | null; ideaId?: string | null; isCorrect?: boolean; timestamp?: string }> : [];
        if (!cancelled && events.length) {
          const current = useShellStore.getState().studentLiveStatuses;
          const next = { ...current };
          let newest = sinceRef.current;
          for (const event of events) {
            const student = useShellStore.getState().students.find((item) => item.studentCode && item.studentCode === event.studentCode);
            if (!student || !event.timestamp) continue;
            const key = `live:${student.id}:${event.ideaId ?? "root"}`;
            next[key] = { status: event.isCorrect ? "correct" : "wrong", source: "live", updatedAt: event.timestamp, label: student.name, lessonId: event.lessonId ?? lessonId, ideaId: event.ideaId ?? undefined, isCorrect: event.isCorrect === true };
            if (!newest || event.timestamp > newest) newest = event.timestamp;
          }
          setStudentLiveStatuses(next);
          sinceRef.current = newest;
          if (newest) window.sessionStorage.setItem(cursorKey, newest);
          window.dispatchEvent(new CustomEvent("bisalasa:live-answer", { detail: { events } }));
        }
      } catch {
        // Live App is optional; local lesson, games and board continue normally.
      } finally {
        if (!cancelled) timer = window.setTimeout(() => void poll(), pollMs);
      }
    };
    void poll();
    return () => { cancelled = true; if (timer !== undefined) window.clearTimeout(timer); };
  }, [enabled, lessonId, pollMs, setStudentLiveStatuses]);

  return null;
}
