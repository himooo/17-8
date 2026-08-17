"use client";

import { useEffect } from "react";
import { useShellStore } from "@/lib/shell-store";

type LiveStatus = { status: "correct" | "wrong" | "waiting" | "unknown"; updatedAt: string; label?: string };
type LiveResponse = { statuses: Array<{ moodleUserId: number; status: LiveStatus["status"]; updatedAt: string; label?: string }>; changed?: boolean; nextPollMs?: number; semantics?: string };
type CustomResponse = { statuses: Array<{ externalId: string; status: LiveStatus["status"]; updatedAt: string; label?: string }>; semantics?: string };
type MoodleConfig = { enabled?: boolean; hasToken?: boolean; courseId?: number | null };
type CustomConfig = { enabled?: boolean; hasToken?: boolean; baseUrl?: string };

const MIN_POLL_MS = 5_000;
const MAX_POLL_MS = 30_000;
const CONFIG_REFRESH_MS = 60_000;

export function MoodleLiveSync() {
  const setStudentLiveStatuses = useShellStore((state) => state.setStudentLiveStatuses);
  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let moodle: MoodleConfig | null = null;
    let custom: CustomConfig | null = null;
    let configReadAt = 0;
    let nextPollMs = MIN_POLL_MS;

    const readConfigs = async () => {
      const [moodleResponse, customResponse] = await Promise.all([
        fetch("/api/moodle", { cache: "no-store" }),
        fetch("/api/custom-sync", { cache: "no-store" }),
      ]);
      const moodlePayload = await moodleResponse.json().catch(() => ({ ok: false }));
      const customPayload = await customResponse.json().catch(() => ({ ok: false }));
      moodle = moodlePayload?.ok ? moodlePayload.data as MoodleConfig : null;
      custom = customPayload?.ok ? customPayload.data as CustomConfig : null;
      configReadAt = Date.now();
    };

    const schedule = (delay: number) => {
      if (!cancelled) timer = window.setTimeout(() => void poll(), Math.max(MIN_POLL_MS, Math.min(MAX_POLL_MS, delay)));
    };

    const poll = async () => {
      if (cancelled) return;
      const current = useShellStore.getState().studentLiveStatuses;
      const localOnly = Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith("moodle:") && !key.startsWith("custom:"))) as Record<string, LiveStatus & { source: "local" | "moodle" | "custom" }>;
      const sessionActive = Boolean(useShellStore.getState().currentSessionId && useShellStore.getState().activeClassId);
      if (!sessionActive || document.visibilityState === "hidden") {
        if (!cancelled) setStudentLiveStatuses(localOnly);
        schedule(document.visibilityState === "hidden" ? MAX_POLL_MS : 15_000);
        return;
      }
      try {
        if (!moodle || !custom || Date.now() - configReadAt > CONFIG_REFRESH_MS) await readConfigs();
        let next = localOnly;
        let changed = false;
        if (moodle?.enabled && moodle.hasToken && moodle.courseId) {
          try {
            const response = await fetch("/api/moodle", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "liveStatus" }), cache: "no-store" });
            const payload = await response.json().catch(() => ({ ok: false }));
            if (payload?.ok && !cancelled) {
              const data = payload.data as LiveResponse;
              data.statuses.forEach((status) => { next[`moodle:${status.moodleUserId}`] = { ...status, source: "moodle" }; });
              changed = data.changed === true;
              nextPollMs = data.nextPollMs ?? (changed ? MIN_POLL_MS : Math.min(MAX_POLL_MS, nextPollMs + MIN_POLL_MS));
            }
          } catch { nextPollMs = Math.min(MAX_POLL_MS, nextPollMs * 2); }
        }
        if (custom?.enabled && custom.hasToken && custom.baseUrl) {
          try {
            const response = await fetch("/api/custom-sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "pull" }), cache: "no-store" });
            const payload = await response.json().catch(() => ({ ok: false }));
            if (payload?.ok && !cancelled) (payload.data as CustomResponse).statuses.forEach((status) => { next[`custom:${status.externalId}`] = { ...status, source: "custom" }; });
          } catch { nextPollMs = Math.min(MAX_POLL_MS, nextPollMs * 2); }
        }
        if (!cancelled) setStudentLiveStatuses(next);
        if (changed) nextPollMs = MIN_POLL_MS;
      } catch {
        if (!cancelled) setStudentLiveStatuses(current);
        nextPollMs = Math.min(MAX_POLL_MS, nextPollMs * 2);
      } finally {
        schedule(nextPollMs);
      }
    };

    void poll();
    const onVisibility = () => { if (document.visibilityState === "visible" && !cancelled) { if (timer !== undefined) window.clearTimeout(timer); nextPollMs = MIN_POLL_MS; void poll(); } };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { cancelled = true; if (timer !== undefined) window.clearTimeout(timer); document.removeEventListener("visibilitychange", onVisibility); };
  }, [setStudentLiveStatuses]);
  return null;
}
