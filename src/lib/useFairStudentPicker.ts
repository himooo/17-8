// ====================================================================
//  useFairStudentPicker.ts — Shared hook for fair student selection
//
//  Used by: QuizShow, DuelQuiz, GroupBattle, HotPotato, TugOfWar, etc.
//
//  Features:
//    - Excludes absent students (isAbsent)
//    - Excludes already-called students (calledInSession) — fair rotation
//    - If all called, resets calledInSession and picks again
//    - Returns the picked student + helper functions
// =================================================================///
"use client";

import { useState, useCallback } from "react";
import { useShellStore } from "./shell-store";
import type { Student } from "./slide-schema";
import * as dbSync from "./db-sync";

export interface FairPickerResult {
  /** Pick a fair student (excludes absent + already-called) */
  pickFair: (excludeIds?: string[]) => Student | null;
  /** The currently picked student */
  pickedStudent: Student | null;
  /** Clear the picked student */
  clearPicked: () => void;
  /** Mark a student as called in session (for fair rotation tracking) */
  markCalled: (id: string) => void;
  /** Reset all calledInSession flags (new round) */
  resetRound: () => void;
  /** Get available students (present + not-yet-called) */
  availableStudents: Student[];
  /** Get all present students (excludes absent) */
  presentStudents: Student[];
  /** Get all absent students */
  absentStudents: Student[];
}

export function useFairStudentPicker(): FairPickerResult {
  const students = useShellStore((s) => s.students);
  const setStudents = useShellStore.setState;
  const [pickedStudent, setPickedStudent] = useState<Student | null>(null);

  const presentStudents = students.filter((s) => !s.isAbsent);
  const absentStudents = students.filter((s) => s.isAbsent);
  const availableStudents = presentStudents.filter((s) => !s.calledInSession);

  const pickFair = useCallback((excludeIds: string[] = []): Student | null => {
    // Filter out absent + excluded + already-called
    const candidates = presentStudents.filter(
      (s) => !excludeIds.includes(s.id) && !s.calledInSession
    );
    // If all called, reset and try again
    const pool = candidates.length > 0
      ? candidates
      : presentStudents.filter((s) => !excludeIds.includes(s.id));
    if (pool.length === 0) return null;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    // Mark as called
    setStudents((state: any) => ({
      students: state.students.map((st: Student) =>
        st.id === picked.id
          ? { ...st, calledInSession: true, lastCalled: new Date().toISOString() }
          : st
      ),
    }));
    setPickedStudent(picked);
    return picked;
  }, [presentStudents, setStudents]);

  const clearPicked = useCallback(() => setPickedStudent(null), []);

  const markCalled = useCallback((id: string) => {
    const nowIso = new Date().toISOString();
    setStudents((state: any) => ({
      students: state.students.map((st: Student) =>
        st.id === id
          ? { ...st, calledInSession: true, lastCalled: nowIso }
          : st
      ),
    }));
    dbSync.syncStudentUpdate(id, { lastCalled: nowIso });
  }, [setStudents]);

  const resetRound = useCallback(() => {
    setStudents((state: any) => ({
      students: state.students.map((st: Student) => ({
        ...st,
        calledInSession: false,
      })),
    }));
  }, [setStudents]);

  return {
    pickFair,
    pickedStudent,
    clearPicked,
    markCalled,
    resetRound,
    availableStudents,
    presentStudents,
    absentStudents,
  };
}

// (useLessonQuestions was removed — every game uses useGameQuestions from
// useGameStudentPicker.ts instead. This dead export was just confusion.)
