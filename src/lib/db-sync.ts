// ====================================================================
//  db-sync.ts — Synchronization layer between Zustand store and SQLite
//  Strategy:
//    1. On app boot: hydrate Zustand from SQLite (single source of truth)
//    2. On every mutation: fire-and-forget SQLite write
//    3. localStorage remains as cache for offline boot speed
//
//  Failure handling:
//    - If SQLite write fails, log error but keep Zustand state intact
//      (user experience is preserved; data will sync next time)
//    - If SQLite read fails on boot, fall back to localStorage cache
// ====================================================================
"use client";

import { localDb, type Student, type ClassRoom, type ImportedLesson } from "./local-db";
import type { SlideManifest, ImportedLesson as LegacyLesson } from "./slide-schema";
import { safeParse } from "./local-db";

// ---------- Sync state ----------
let isHydrating = false;
let isSyncing = false;
let pendingSyncs = 0;
let lastSyncError: string | null = null;
const listeners = new Set<() => void>();

export function getSyncState() {
  return {
    isHydrating,
    isSyncing,
    pendingSyncs,
    lastSyncError,
    lastSyncAt: lastSyncTimestamp,
  };
}

export function subscribeSync(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => fn());
}

let lastSyncTimestamp: number | null = null;

function trackSync<T>(promise: Promise<T>, rejectOnError = false): Promise<T | undefined> {
  pendingSyncs++;
  isSyncing = true;
  notify();
  return promise
    .then((result) => {
      lastSyncTimestamp = Date.now();
      lastSyncError = null;
      return result;
    })
    .catch((err) => {
      lastSyncError = err.message || "Sync failed";
      console.error("[db-sync] write failed:", err);
      // Most UI effects remain best-effort, but roster mutations can opt into
      // rejection so the UI never reports a student as saved/deleted when the
      // authoritative SQLite write failed.
      if (rejectOnError) throw err;
      return undefined;
    })
    .finally(() => {
      pendingSyncs--;
      if (pendingSyncs <= 0) {
        isSyncing = false;
        pendingSyncs = 0;
      }
      notify();
    });
}

// ====================================================================
//  Hydration: SQLite -> Zustand
// ====================================================================
export async function hydrateFromDb(
  setStudents: (s: Student[]) => void,
  setLessons: (l: LegacyLesson[]) => void,
  setSettings: (s: any) => void,
  setActiveClassId: (id: string | null) => void,
  // H8 fix: caller provides the CURRENT activeClassId; we only fall back to
  // classes[0].id if no class is currently active. Without this, hydration
  // would stomp the user's selected class on every reload.
  currentActiveClassId?: string | null
): Promise<void> {
  if (isHydrating) return;
  isHydrating = true;
  notify();
  try {
    // Run all reads in parallel for speed
    const [classes, lessons, settings] = await Promise.all([
      localDb.classes.list().catch(() => [] as ClassRoom[]),
      localDb.lessons.list().catch(() => [] as ImportedLesson[]),
      localDb.settings.get().catch(() => ({})),
    ]);

    // H8 fix: prefer the currently-selected class; only auto-pick the first
    // DB class if nothing is active AND the current id isn't in the DB list.
    let activeClassId: string | null = currentActiveClassId ?? null;
    if (activeClassId && !classes.some((c) => c.id === activeClassId)) {
      // Previously-active class is gone from DB — fall back to first
      activeClassId = classes.length > 0 ? classes[0].id : null;
    } else if (!activeClassId && classes.length > 0) {
      activeClassId = classes[0].id;
    }
    setActiveClassId(activeClassId);

    // Load students for active class
    let students: Student[] = [];
    if (activeClassId) {
      students = await localDb.students.listByClass(activeClassId).catch(() => [] as Student[]);
    }
    setStudents(students);

    // Convert DB lessons to legacy format (store uses ImportedLesson from slide-schema)
    const legacyLessons: LegacyLesson[] = lessons.map((l) => {
      const manifest: SlideManifest | undefined = safeParse<SlideManifest | undefined>(l.manifestJson, undefined);
      return {
        id: l.id,
        fileName: l.fileName,
        title: l.title,
        importedAt: l.importedAt,
        content: l.content,
        manifest,
      };
    });
    setLessons(legacyLessons);

    // Settings
    if (settings && Object.keys(settings).length > 0) {
      setSettings(settings);
    }

    // H7 fix: after writing from DB, ask Zustand persist to rehydrate its
    // persisted slice (settings/UI prefs) so localStorage-cached UI prefs
    // MERGE with (and for pure-UI keys, override) the DB values.
    try {
      // Dynamic import avoids circular deps at module scope in ESM/Turbopack.
      const mod = await import("./shell-store") as { useShellStore?: { persist?: { rehydrate?: () => Promise<void> | void } } };
      const persistApi = mod.useShellStore?.persist;
      if (persistApi && typeof persistApi.rehydrate === "function") {
        await persistApi.rehydrate();
      }
    } catch (rehydrateErr) {
      // Not fatal — store module may not be ready yet (SSR / early boot).
      console.warn("[db-sync] persist rehydrate skipped:", rehydrateErr);
    }

    // Mark that we've hydrated (for migration logic to skip if already done)
    if (typeof window !== "undefined") {
      window.localStorage.setItem("bisalasa-db-hydrated", "1");
    }
  } catch (err) {
    console.error("[db-sync] hydration failed:", err);
    lastSyncError = err instanceof Error ? err.message : "Hydration failed";
  } finally {
    isHydrating = false;
    notify();
  }
}

// ====================================================================
//  Mutation sync: Zustand -> SQLite (fire-and-forget)
// ====================================================================

// ----- Classes -----
export function syncClassCreate(name: string, description: string, color: string) {
  return trackSync(localDb.classes.create(name, description, color));
}

export function syncClassUpdate(id: string, patch: Partial<ClassRoom>) {
  return trackSync(localDb.classes.update(id, patch));
}

export function syncClassDelete(id: string) {
  return trackSync(localDb.classes.delete(id));
}

// ----- Students -----
export function syncStudentCreate(student: Student) {
  return trackSync(
    localDb.students.upsert(student.id, student.classId, {
      name: student.name,
      points: student.points,
      correctAnswers: student.correctAnswers,
      wrongAnswers: student.wrongAnswers,
      attempts: student.attempts,
      title: student.title,
      isAbsent: student.isAbsent || false,
    }),
    true
  );
}

export function syncStudentUpdate(studentId: string, patch: Partial<Student>) {
  return trackSync(localDb.students.update(studentId, patch));
}

export function syncStudentDelete(studentId: string) {
  return trackSync(localDb.students.delete(studentId), true);
}

export function syncStudentAwardCorrect(studentId: string, points = 3) {
  return trackSync(localDb.students.awardCorrect(studentId, points));
}

// P1-10 fix: atomic increment via Prisma's { increment: points }.
// The OLD awardPoints path used syncStudentUpdate({ points: absoluteValue }) which
// wrote the absolute value — a multi-tab race could lose increments. This helper
// uses localDb.students.awardPoints which is atomic at the DB level.
export function syncStudentAwardPoints(studentId: string, points: number) {
  return trackSync(localDb.students.awardPoints(studentId, points));
}

// P1-9 fix: persist a StudentGift DB record when a gift is awarded.
// The store action awardGiftToStudent only set awardedGiftDisplay + logged
// StudentActivity — it did NOT create a StudentGift row, so gifts from
// QuickGiftPanel were lost on reload.
export function syncGiftAward(studentId: string, giftId: string, giftName: string, giftImage: string) {
  return trackSync(
    localDb.gifts.awardToStudent(studentId, giftId, giftName, giftImage)
  );
}

export function syncStudentAwardWrong(studentId: string) {
  return trackSync(localDb.students.awardWrong(studentId));
}

export function syncStudentAwardGoodTry(studentId: string) {
  return trackSync(localDb.students.awardGoodTry(studentId));
}

export function syncStudentAwardBadge(studentId: string, type: string, note?: string) {
  return trackSync(localDb.students.awardBadge(studentId, type, note));
}

export function syncStudentSetTitle(studentId: string, title: string) {
  return trackSync(localDb.students.setTitle(studentId, title));
}

// H4 fix: dedicated helper (even though syncStudentUpdate works) so mutations
// read clearly at call sites. `lastCalled` IS in the Prisma schema.
export function syncStudentLastCalled(studentId: string, isoTimestamp: string) {
  return trackSync(localDb.students.update(studentId, { lastCalled: isoTimestamp }));
}

export function syncStudentsResetSession(classId?: string) {
  return trackSync(localDb.students.resetSession(classId));
}

// ----- Sessions -----
export function syncSessionStart(classId: string | null, name?: string) {
  return trackSync(localDb.sessions.start(classId, name));
}

// P1-4 fix: syncSessionEnd now accepts stats and writes them to statsJson.
// Before, endCurrentSession only set endedAt — session stats (totalQuestions,
// correctAnswers, participationCount) were thrown away.
export function syncSessionEnd(sessionId: string, stats?: { totalQuestions: number; correctAnswers: number; participationCount: number }) {
  return trackSync(localDb.sessions.end(sessionId, stats));
}

export function syncSessionList(classId?: string) {
  return trackSync(localDb.sessions.list(classId));
}

// ----- Lessons -----
export function syncLessonUpsert(lesson: LegacyLesson) {
  const manifestJson = lesson.manifest ? JSON.stringify(lesson.manifest) : "{}";
  return trackSync(
    localDb.lessons.upsert({
      lessonId: lesson.manifest?.lessonId || lesson.id,
      fileName: lesson.fileName,
      title: lesson.title,
      subtitle: lesson.manifest?.subtitle || "",
      content: lesson.content,
      manifestJson,
    })
  );
}

export function syncLessonDelete(id: string) {
  return trackSync(localDb.lessons.delete(id));
}

// ----- Settings -----
let settingsDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let settingsRetryTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSettingsSnapshot: Record<string, unknown> | null = null;
let settingsRetryAttempt = 0;
let settingsFlushInFlight = false;

function scheduleSettingsFlush(delayMs: number) {
  if (settingsDebounceTimer) clearTimeout(settingsDebounceTimer);
  settingsDebounceTimer = setTimeout(() => {
    settingsDebounceTimer = null;
    void flushSettings();
  }, delayMs);
}

async function flushSettings() {
  if (settingsFlushInFlight || !pendingSettingsSnapshot) return;
  const snapshot = pendingSettingsSnapshot;
  pendingSettingsSnapshot = null;
  settingsFlushInFlight = true;
  const result = await trackSync(localDb.settings.set(snapshot));
  settingsFlushInFlight = false;

  if (result === undefined) {
    // Keep the last failed snapshot and retry a few times. This prevents a
    // transient API/SQLite hiccup from silently losing teacher preferences.
    if (!pendingSettingsSnapshot) pendingSettingsSnapshot = snapshot;
    if (settingsRetryAttempt < 3) {
      settingsRetryAttempt += 1;
      const backoff = 1000 * 2 ** (settingsRetryAttempt - 1);
      if (settingsRetryTimer) clearTimeout(settingsRetryTimer);
      settingsRetryTimer = setTimeout(() => {
        settingsRetryTimer = null;
        void flushSettings();
      }, backoff);
    } else {
      settingsRetryAttempt = 0;
    }
    return;
  }

  settingsRetryAttempt = 0;
  if (pendingSettingsSnapshot) scheduleSettingsFlush(0);
}

export function syncSettings(settings: any) {
  // Debounce settings syncs — they change often (sliders, toggles), but keep
  // the newest immutable snapshot so rapid updates cannot write stale state.
  pendingSettingsSnapshot = { ...(settings || {}) };
  settingsRetryAttempt = 0;
  if (settingsRetryTimer) {
    clearTimeout(settingsRetryTimer);
    settingsRetryTimer = null;
  }
  scheduleSettingsFlush(800);
}

// ====================================================================
//  Health check + retry
// ====================================================================
export async function checkDbHealth(): Promise<boolean> {
  try {
    await localDb.stats.summary();
    return true;
  } catch {
    return false;
  }
}

export async function retryPendingSyncs() {
  if (pendingSettingsSnapshot && !settingsFlushInFlight) {
    settingsRetryAttempt = 0;
    scheduleSettingsFlush(0);
  }
  return true;
}
