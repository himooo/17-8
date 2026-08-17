// ====================================================================
//  migrate-from-localStorage.ts v7.3
//  Reads legacy localStorage data and pushes it to SQLite.
//  IndexedDB is NO LONGER USED — all data goes to SQLite.
// =================================================================///
"use client";

import { localDb } from "./local-db";
import { migrateCelebrationsFromLocalStorage } from "./celebrations";

export interface MigrationResult {
  success: boolean;
  message: string;
  details: {
    classes: number;
    students: number;
    groups: number;
    prizes: number;
    gifts: number;
    studentGifts: number;
    attendance: number;
    sounds: number;
    settings: boolean;
    lessons: number;
    celebrations: number;
  };
}

export async function migrateFromLocalStorage(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: true,
    message: "",
    details: {
      classes: 0, students: 0, groups: 0, prizes: 0, gifts: 0,
      studentGifts: 0, attendance: 0, sounds: 0, settings: false, lessons: 0,
      celebrations: 0,
    },
  };

  if (typeof window === "undefined") {
    result.success = false;
    result.message = "Cannot run migration on server";
    return result;
  }

  try {
    // 1. Migrate Zustand localStorage (students + lessons + settings)
    const zustandRaw = window.localStorage.getItem("bisalasa-shell-store-v10");
    if (zustandRaw) {
      try {
        const zustand = JSON.parse(zustandRaw);
        const state = zustand.state || zustand;

        if (state.settings) {
          await localDb.settings.set(state.settings);
          result.details.settings = true;
        }

        if (Array.isArray(state.students) && state.students.length > 0) {
          const classes = await localDb.classes.list();
          let defaultClass = classes[0];
          if (!defaultClass) {
            defaultClass = await localDb.classes.create("طلابي", "الطلاب المستوردون", "#0142A0");
          }
          result.details.classes = 1;

          for (const s of state.students) {
            await localDb.students.upsert(s.id, defaultClass.id, {
              name: s.name, points: s.points || 0,
              correctAnswers: s.correctAnswers || 0,
              wrongAnswers: s.wrongAnswers || 0,
              attempts: s.attempts || 0,
            });
            result.details.students++;
          }
        }

        if (Array.isArray(state.lessons) && state.lessons.length > 0) {
          for (const l of state.lessons) {
            await localDb.lessons.upsert({
              lessonId: l.manifest?.lessonId || l.id,
              fileName: l.fileName, title: l.title,
              subtitle: l.manifest?.subtitle || "",
              content: l.content,
              manifestJson: l.manifest ? JSON.stringify(l.manifest) : "{}",
            });
            result.details.lessons++;
          }
        }
      } catch (e) {
        console.warn("[migrate] failed to parse zustand localStorage:", e);
      }
    }

    // 2. Clear IndexedDB (delete the old database)
    if (typeof indexedDB !== "undefined" && typeof indexedDB.deleteDatabase === "function") {
      try {
        indexedDB.deleteDatabase("bisalasa-data-store");
      } catch {
        // ignore
      }
    }

    // 3. Migrate custom celebrations from old localStorage key
    try {
      const before = (await localDb.celebration.list()).length;
      await migrateCelebrationsFromLocalStorage();
      const after = (await localDb.celebration.list()).length;
      result.details.celebrations = Math.max(0, after - before);
    } catch (e) {
      console.warn("[migrate] celebrations migration failed:", e);
    }

    // Mark as migrated
    window.localStorage.setItem("bisalasa-migrated-to-sqlite", "1");

    result.message = `Migration complete: ${result.details.students} students, ${result.details.lessons} lessons, ${result.details.celebrations} celebrations`;
    return result;
  } catch (err: any) {
    result.success = false;
    result.message = `Migration failed: ${err.message || err}`;
    return result;
  }
}

export function isMigrated(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem("bisalasa-migrated-to-sqlite") === "1";
}

export function hasLegacyData(): boolean {
  if (typeof window === "undefined") return false;
  return !!window.localStorage.getItem("bisalasa-shell-store-v10");
}
