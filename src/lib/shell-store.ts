"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  Student,
  StudentBadge,
  ImportedLesson,
  ShellSettings,
  SlideManifest,
  SlideStep,
  GameType,
  LessonQuestion,
} from "./slide-schema";
import { getCurrentSteps, getTotalSteps } from "./slide-schema";
import { extractAllQuestions } from "./shell-utils";
import * as dbSync from "./db-sync";
import type { Student as DbStudent } from "./local-db";
import { localDb } from "./local-db";
import { computeTitle, computeTitleRule, TITLE_RULES } from "./title-rules";
import { announce, initTtsAnnouncer, updateTtsSetting } from "./tts-announcer";
import { getCelebrationMetaOrDefault, DEFAULT_CELEBRATIONS } from "./celebrations";
import { hapticPattern } from "./rewards-audio-v10";

function parseStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : undefined;
  } catch {
    return undefined;
  }
}

function parseObjectArray<T extends Record<string, unknown>>(value: unknown): T[] {
  if (Array.isArray(value)) return value.filter((item): item is T => Boolean(item && typeof item === "object"));
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is T => Boolean(item && typeof item === "object")) : [];
  } catch {
    return [];
  }
}

function normalizeDbLessonQuestion(row: Record<string, unknown>, fallbackLessonId: string): LessonQuestion | null {
  const text = typeof row.text === "string" ? row.text.trim() : "";
  if (!text) return null;
  const options = parseStringArray(row.options) ?? parseStringArray(row.optionsJson);
  const correctAnswer = typeof row.correctAnswer === "string" || typeof row.correctAnswer === "number"
    ? row.correctAnswer
    : undefined;
  const tags = parseStringArray(row.tags) ?? [];
  const images = parseObjectArray<Record<string, unknown>>(row.imageJson).filter((image) => typeof image.url === "string" && image.url.trim()).map((image) => ({ url: String(image.url), alt: typeof image.alt === "string" ? image.alt : undefined, type: typeof image.type === "string" ? image.type : undefined }));
  const usage = tags.filter((tag) => tag.startsWith("bisalasa:usage:")).map((tag) => tag.slice("bisalasa:usage:".length)).filter((value): value is "presentation" | "moodle-interactive" | "moodle-homework" | "game" => ["presentation", "moodle-interactive", "moodle-homework", "game"].includes(value));
  const imageRefs = tags.filter((tag) => tag.startsWith("bisalasa:asset:")).map((tag) => tag.slice("bisalasa:asset:".length)).filter(Boolean);
  return {
    id: typeof row.id === "string" ? row.id : undefined,
    lessonId: typeof row.lessonId === "string" ? row.lessonId : fallbackLessonId,
    text,
    correctAnswer,
    options,
    rewardPoints: typeof row.rewardPoints === "number" ? row.rewardPoints : Number(row.rewardPoints) || 5,
    ideaTitle: typeof row.ideaTitle === "string" ? row.ideaTitle : undefined,
    ideaId: typeof row.ideaId === "string" ? row.ideaId : undefined,
    step: typeof row.stepNumber === "number" ? row.stepNumber : Number(row.stepNumber) || undefined,
    stepNumber: typeof row.stepNumber === "number" ? row.stepNumber : Number(row.stepNumber) || undefined,
    difficulty: row.difficulty === "easy" || row.difficulty === "medium" || row.difficulty === "hard" ? row.difficulty : undefined,
    tags,
    images,
    imageRefs,
    usage: usage.length ? Array.from(new Set(usage)) : ["game"],
    gameReady: row.gameReady === undefined ? true : Boolean(row.gameReady),
  };
}

function triggerClassroomHaptic(pattern: "light" | "success" | "error", settings: ShellSettings) {
  if (!settings.hapticsEnabled || settings.muted || typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try { navigator.vibrate(hapticPattern(pattern)); } catch { /* unsupported devices are non-fatal */ }
}

// ===== Helper: تسجيل نشاط الطالب في قاعدة البيانات =====
function logStudentActivity(
  studentId: string,
  sessionId: string | null,
  type: string,
  pointsDelta: number = 0,
  description: string = "",
  metadata: Record<string, unknown> = {}
) {
  try {
    localDb.studentActivities.create({
      studentId,
      sessionId,
      type,
      pointsDelta,
      description,
      metadataJson: JSON.stringify(metadata),
    });
  } catch (e) {
    console.warn("[logStudentActivity] failed:", e);
  }
}

// ===== Helper: تسجيل احتفال في قاعدة البيانات =====
function logCelebrationEvent(
  studentId: string | null,
  sessionId: string | null,
  celebrationId: string,
  celebrationLabel: string,
  celebrationIcon: string = "🎉"
) {
  try {
    localDb.celebrationEvents.create({
      studentId,
      sessionId,
      celebrationId,
      celebrationLabel,
      celebrationIcon,
    });
  } catch (e) {
    console.warn("[logCelebrationEvent] failed:", e);
  }
}

// Reusable whiteboard tool/color union types (avoids "as never" casts elsewhere)
export type WhiteboardTool =
  | "select"
  | "pen"
  | "laser"
  | "eraser"
  | "eraser-big"
  | "text"
  | "shape"
  | "arrow"
  | "check"
  | "x"
  | "star"
  | "highlighter"
  | "rainbow"
  | "laserpen"
  | "equation";
export type WhiteboardColor = "blue" | "red" | "green" | "black" | "white" | "yellow";
export type StampId =
  | "smile" | "star" | "check" | "heart" | "trophy" | "thumbs-up" | "100" | "good"
  | "logo" | "with-aya" | "stamp-round" | "stamp-rect" | "smile-stamp" | "bravo"
  | "excellent" | "wow" | "try-again" | "wrong" | "almost" | "keep-trying" | "good-job";

// Module-scope resolvers for the confirm/prompt dialog system (see requestConfirm/requestPrompt below).
// Kept outside the store itself since functions shouldn't live in reactive/persisted state.
let confirmResolver: ((result: boolean) => void) | null = null;
let promptResolver: ((result: string | null) => void) | null = null;

// C4: If the component hosting a dialog unmounts (or a second requestConfirm/Prompt
// arrives before the first resolves), the previous Promise never settles → leak.
// These helpers force-resolve any pending promise with the "cancel" default.
function settleConfirm(result: boolean) {
  if (confirmResolver) {
    try { confirmResolver(result); } catch {}
    confirmResolver = null;
  }
}
function settlePrompt(result: string | null) {
  if (promptResolver) {
    try { promptResolver(result); } catch {}
    promptResolver = null;
  }
}

// Optional global safety net: never leave a pending resolver if the page is unloading.
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    settleConfirm(false);
    settlePrompt(null);
  });
}

// Adapter: convert DB Student shape to slide-schema Student shape
export function dbStudentToStoreStudent(s: DbStudent): Student {
  return {
    id: s.id,
    name: s.name,
    points: s.points,
    correctAnswers: s.correctAnswers,
    wrongAnswers: s.wrongAnswers,
    attempts: s.attempts,
    badges: (s.badges || []).map((b) => ({
      type: b.type as StudentBadge["type"],
      awardedAt: b.awardedAt,
    })),
    lastCalled: s.lastCalled || undefined,
    lastAbsentAt: s.lastAbsentAt || null,
    calledInSession: false, // session-only flag, not persisted
    createdAt: s.createdAt,
    title: s.title || undefined,
    moodleUserId: s.moodleUserId ?? null,
    moodleUsername: s.moodleUsername ?? null,
    moodleCourseId: s.moodleCourseId ?? null,
    isAbsent: s.isAbsent,
  };
}

// ====================================================================
//  Default Settings
// ====================================================================
const DEFAULT_SETTINGS: ShellSettings = {
  muted: false,
  volume: 0.7,
  teleprompterFontSize: 22,
  teleprompterSize: "medium",
  teleprompterHidden: false,
  teleprompterHeight: 130,
  teleprompterPosX: 0,
  teleprompterPosY: 0,
  teleprompterWidth: 0, // 0 = full width
  notesOverlayOpen: false,
  whiteboardEnabled: false,
  autoClearOnStepChange: true,
  presentationMode: "manual",
  theme: "dark",
  penThickness: 2,
  penColor: "blue",
  iframeDevice: "desktop",
  iframeZoom: 100,
  iframeOrientation: "landscape",
  iframeAspect: "auto",
  stageScale: 1,
  precisionMode: false,
  precisionScale: 2,
  whiteboardBackground: "transparent",
  workspaceMode: "landscape",
  aiEnabled: false,
  aiModel: "gemini-2.5-flash",
  aiTemperature: 0.35,
  aiMaxOutputTokens: 1200,
  aiIncludeLessonContext: false,
  liveSyncEnabled: false,
  liveSyncPollMs: 3000,
  fairnessMode: "soft",
  audioMixerEnabled: true,
  audioMasterVolume: 0.7,
  audioChannels: {
    music: { volume: 1, muted: false },
    effects: { volume: 1, muted: false },
    tts: { volume: 1, muted: false },
    ambient: { volume: 1, muted: false },
  },
  ambianceType: "none",
  hapticsEnabled: false,
};

// ====================================================================
//  Store Types
// ====================================================================
export type FairnessMode = "off" | "soft" | "strict";

export interface IdeaPerformance {
  attempts: number;
  correct: number;
  wrong: number;
  updatedAt: number;
}

export interface FairnessLogEntry {
  studentId: string;
  ideaId: string;
  source: string;
  timestamp: number;
  manual: boolean;
  score: number;
  mode: FairnessMode;
  rejectedManual?: boolean;
}

export type StudentLiveStatus = {
  status: "correct" | "wrong" | "waiting" | "unknown";
  source: "moodle" | "custom" | "local" | "live";
  updatedAt: string;
  label?: string;
  lessonId?: string;
  ideaId?: string;
  isCorrect?: boolean;
};

interface ShellState {
  // ----- Settings -----
  settings: ShellSettings;
  updateSettings: (patch: Partial<ShellSettings>) => void;
  resetSettings: () => void;

  // ----- Students -----
  students: Student[];
  addStudent: (name: string) => Promise<void>;
  addStudentsBulk: (names: string[]) => Promise<void>;
  removeStudent: (id: string) => Promise<void>;
  clearStudents: () => Promise<void>;
  awardPoints: (id: string, points: number) => void;
  awardCorrect: (id: string, points?: number, ideaId?: string) => void;
  awardWrong: (id: string, ideaId?: string) => void;
  awardGoodTry: (id: string) => void;
  awardBadge: (id: string, badge: StudentBadge["type"]) => void;
  resetSession: () => void;
  setStudentAbsent: (id: string, isAbsent: boolean) => void;
  /** Sets a student's title/rank (e.g. awarded via a prize or the leaderboard editor).
   *  Updates the reactive store immediately and syncs to the DB in the background. */
  setStudentTitle: (id: string, title: string | null) => void;
  /** P2-12: يحسب اللقب التلقائي من إحصائيات الطالب ويحدّثه في المتجر + DB.
   *  يُستدعى بعد أي منح نقاط/إجابة صحيحة/خطأ حتى يبقى اللقب محدثاً دائماً. */
  refreshTitle: (studentId: string) => void;
  /** Record any activity (gift/celebration/sound/game-win) on a student's profile */
  recordStudentActivity: (studentId: string, activity: { type: string; description: string; points?: number }) => void;

  // ----- Random Picker -----
  currentlyCalledStudent: Student | null;
  isPicking: boolean;
  pickRandomStudent: () => void;
  clearCurrentStudent: () => void;
  /** Fairly picks up to `count` students who haven't been called this
   *  session (marks them called too) — for games needing several
   *  participants at once instead of just one (e.g. Hot Potato). */
  pickFairStudentsBatch: (count: number) => Student[];
  ideaSelectionHistory: Record<string, string[]>;
  recordIdeaSelection: (ideaId: string, studentId: string) => void;
  lessonAttemptsByStudent: Record<string, number>;
  lessonCorrectByStudent: Record<string, number>;
  lessonWrongByStudent: Record<string, number>;
  lastAskedAtByStudent: Record<string, number>;
  performanceByIdea: Record<string, Record<string, IdeaPerformance>>;
  fairnessLog: FairnessLogEntry[];
  recordAnswerForIdea: (studentId: string, ideaId: string, isCorrect: boolean) => void;
  isStrugglingInIdea: (studentId: string, ideaId: string) => boolean;
  getIdeaPerformance: (studentId: string, ideaId: string) => IdeaPerformance | null;
  getLessonFairnessScore: (studentId: string, ideaId?: string) => number;
  resetLessonStats: () => void;
  resetIdeaStats: (ideaId: string) => void;

  // ----- Group fairness (shared across ALL group-based games) -----
  /** IDs of groups already picked this session — not re-picked until every
   *  group in the pool has had a turn. Reset by resetSession(). */
  calledGroupIds: string[];
  /** Pick N groups fairly from the given pool, respecting calledGroupIds
   *  (shared globally, so switching between group games stays fair). */
  pickFairGroups: (pool: { id: string; name: string; color: string; studentIds: string | string[] }[], count: number) => { id: string; name: string; color: string; studentIds: string | string[] }[];

  // ----- Lessons -----
  lessons: ImportedLesson[];
  activeLessonId: string | null;
  addLesson: (lesson: ImportedLesson) => void;
  removeLesson: (id: string) => void;
  setActiveLesson: (id: string) => void;

  // ----- Slide Manifest & Navigation -----
  manifest: SlideManifest | null;
  currentStep: number;
  currentIdeaId: string | null;
  setManifest: (m: SlideManifest | null) => void;
  setCurrentStep: (step: number) => void;
  setCurrentIdea: (ideaId: string | null) => void;
  goToStep: (step: number, ideaId?: string) => void;
  nextStep: () => void;
  prevStep: () => void;
  goToIdea: (ideaId: string, step?: number) => void;

  // ----- UI Panels -----
  activePanel: "curriculum" | "students" | "assets" | "notes" | "settings" | "moodle" | "prizes" | "gifts" | "classes" | "groups" | "sounds" | "celebrations" | "blueprint" | "lesson-editor" | "quickgift" | "ai" | "reports" | "fairness" | "rewards-v10" | null;
  setActivePanel: (p: ShellState["activePanel"]) => void;
  togglePanel: (p: ShellState["activePanel"]) => void;

  // ----- Optional Moodle live understanding indicator -----
  studentLiveStatuses: Record<string, StudentLiveStatus>;
  setStudentLiveStatuses: (statuses: Record<string, StudentLiveStatus>) => void;
  clearStudentLiveStatuses: () => void;

  // ----- Whiteboard -----
  whiteboardTool: WhiteboardTool;
  whiteboardColor: WhiteboardColor;
  whiteboardThickness: number;
  whiteboardShape: "circle" | "rectangle" | "triangle";
  setWhiteboardTool: (t: ShellState["whiteboardTool"]) => void;
  setWhiteboardColor: (c: ShellState["whiteboardColor"]) => void;
  setWhiteboardThickness: (t: number) => void;
  setWhiteboardShape: (s: ShellState["whiteboardShape"]) => void;
  clearWhiteboard: () => void;
  undoWhiteboard: () => void;
  whiteboardClearSignal: number;
  whiteboardUndoSignal: number;
  whiteboardRedoSignal: number;
  whiteboardHistoryCount: { index: number; total: number };
  setWhiteboardHistoryCount: (v: { index: number; total: number }) => void;
  redoWhiteboard: () => void;

  // ----- Advanced Whiteboard Tools (v9) -----
  laserColor: string;
  laserSize: number;
  textFormat: { bold: boolean; italic: boolean; underline: boolean };
  setLaserColor: (c: string) => void;
  setLaserSize: (s: number) => void;
  setTextFormat: (f: Partial<{ bold: boolean; italic: boolean; underline: boolean }>) => void;

  // ----- Stage (fullscreen) -----
  // IframeStage owns the actual fullscreen implementation; other components
  // (FloatingSideRail, KeyboardShortcuts) request a toggle via this signal
  // instead of reaching into a window.__toggleFullscreen global.
  requestFullscreenToggle: () => void;
  fullscreenToggleSignal: number;
  // P9 fix: "app fullscreen" — browser fullscreen WITH all panels visible.
  // When true, the rendering keeps the full layout (TopBar + stage + side rail
  // + teleprompter + bottom bar) even while document.fullscreenElement is set.
  appFullscreenKeepPanels: boolean;

  // 🟢 v2 (game-question system): askedQuestionIds tracks question stable
  // IDs already used in this session. Games call markQuestionAsked(id) after
  // a question is fully resolved, and getQuestions() excludes those IDs so
  // the teacher can run multiple games on the same idea WITHOUT repeating
  // questions. Cleared on session end (see endCurrentSession).
  askedQuestionIds: Set<string>;
  markQuestionAsked: (stableId: string) => void;
  clearAskedQuestions: () => void;

  // ----- Confirm / Prompt dialogs (replaces native confirm()/prompt()) -----
  confirmDialog: { message: string; title?: string; danger?: boolean } | null;
  requestConfirm: (message: string, opts?: { title?: string; danger?: boolean }) => Promise<boolean>;
  resolveConfirm: (result: boolean) => void;
  promptDialog: { message: string; title?: string; defaultValue?: string; inputType?: "text" | "number" } | null;
  requestPrompt: (message: string, opts?: { title?: string; defaultValue?: string; inputType?: "text" | "number" }) => Promise<string | null>;
  resolvePrompt: (result: string | null) => void;

  // ----- Effects -----
  triggerConfetti: () => void;
  confettiSignal: number;
  triggerRedFlash: () => void;
  redFlashSignal: number;
  triggerGreenFlash: () => void;
  greenFlashSignal: number;
  playSound: (type: string) => void;

  // ----- Helper Asset Viewer -----
  viewingHelperAsset: { type: string; data: string; name: string } | null;
  setViewingHelperAsset: (asset: { type: string; data: string; name: string } | null) => void;

  // ----- Teleprompter -----
  highlightedSentence: number | null;
  setHighlightedSentence: (i: number | null) => void;

  // ===== v10 NEW STATE (15) =====
  // 1. activeClassId - الصف النشط حالياً
  activeClassId: string | null;
  setActiveClassId: (id: string | null) => void;

  // 2. activeGame - اللعبة النشطة في الـ iframe
  activeGame: GameType | null;
  setActiveGame: (g: GameType | null) => void;
  // 2b. gameActivityActive — true when the current game is mid-play.
  // Set by useGameActivity() (game-activity-context.tsx). Read by the
  // global Escape handler (KeyboardShortcuts.tsx) so Escape asks for
  // confirmation before force-closing a mid-game session.
  gameActivityActive: boolean;
  setGameActivityActive: (v: boolean) => void;

  // 3. gameParticipants - المشاركون في اللعبة الحالية (بتفاصيلهم)
  gameParticipants: { id: string; name: string; points: number; correct: number; wrong: number }[];
  setGameParticipants: (p: { id: string; name: string; points: number; correct: number; wrong: number }[]) => void;

  // 4. wheelResult - آخر نتيجة لعجلة الطلاب
  wheelResult: { studentId: string; name: string } | null;
  setWheelResult: (r: { studentId: string; name: string } | null) => void;

  // 5. luckyWheelResult - آخر نتيجة لعجلة الحظ
  luckyWheelResult: { prizeId: string; name: string; color: string; icon?: string } | null;
  setLuckyWheelResult: (r: { prizeId: string; name: string; color: string; icon?: string } | null) => void;

  // 6. diceResult - آخر نتيجة زهر
  diceResult: { value: number; rolledAt: string } | null;
  setDiceResult: (r: { value: number; rolledAt: string } | null) => void;

  // 7. reactionBestMs - أفضل زمن رد فعل (ms)
  reactionBestMs: number | null;
  setReactionBestMs: (ms: number | null) => void;

  // 8. tugOfWarState - حالة لعبة شد الحبل
  tugOfWarState: { leftScore: number; rightScore: number; winner: "left" | "right" | null };
  setTugOfWarState: (s: { leftScore: number; rightScore: number; winner: "left" | "right" | null }) => void;

  // 9. quizShowState - حالة مسابقة الأسئلة
  quizShowState: { currentQuestion: string | null; options: string[]; correctIdx: number; scores: Record<string, number> };
  setQuizShowState: (s: { currentQuestion: string | null; options: string[]; correctIdx: number; scores: Record<string, number> }) => void;

  // 10. awardedGiftDisplay - الهدية المعروضة حالياً
  awardedGiftDisplay: { studentId: string; studentName: string; giftId: string; giftName: string; giftImage: string } | null;
  setAwardedGiftDisplay: (g: { studentId: string; studentName: string; giftId: string; giftName: string; giftImage: string } | null) => void;

  // 11. leaderboardVisible - هل لوحة المتصدرين معروضة في الـ iframe
  leaderboardVisible: boolean;
  setLeaderboardVisible: (v: boolean) => void;

  // 12. selectedStamp - الختم المختار حالياً
  selectedStamp: StampId | null;
  setSelectedStamp: (s: ShellState["selectedStamp"]) => void;

  // 12b. Virtual Comments — نظام التعليقات الافتراضية
  // منفصل تماماً عن calledInSession — fair rotation مستقل
  virtualCommentsEnabled: boolean;
  virtualCommentCalledIds: string[];
  currentVirtualComment: {
    student: { id: string; name: string; gender?: "male" | "female" };
    text: string;
    tone: "confident" | "confused" | "excited" | "curious" | "neutral";
    commentId: string;
    step: number;
  } | null;
  /**
   * وضع "الخطوة البينية": عند true، ضغطة التالي/السابق التالية تعرض التعليق
   * فقط بدون تحريك الشريحة. الضغطة التالية بعدها تحرك الشريحة فعلياً.
   * هذا يجعل التعليق يتصرف كـ "خطوة مستقلة" بين الشرائح بدون تغيير
   * بروتوكول postMessage مع الـ iframe.
   */
  virtualCommentPendingNav: "show-comment" | null;
  setVirtualCommentsEnabled: (v: boolean) => void;
  triggerVirtualComment: (step: number, ideaId?: string) => void;
  dismissVirtualComment: () => void;
  resetVirtualCommentRound: () => void;
  /** Helper داخلي: هل في تعليق معرّف لخطوة معيّنة في الـ manifest الحالي؟ */
  hasVirtualCommentAt: (step: number, ideaId?: string | null) => boolean;

  // 13. celebrationType - نوع الاحتفال النشط
  celebrationType: string | null;
  celebrationCounter: number;
  setCelebrationType: (c: string | null) => void;
  triggerCelebration: (type: string) => void;
  // celebrations list loaded from DB (single source of truth for label/icon/color/sound).
  // DEFAULT_CELEBRATIONS used as fallback until DB load completes.
  celebrations: import("@/lib/celebrations").CelebrationConfig[];
  setCelebrationsList: (list: import("@/lib/celebrations").CelebrationConfig[]) => void;
  loadCelebrationsFromDb: () => Promise<void>;

  // 14. sessionStats - إحصائيات الجلسة
  sessionStats: { totalQuestions: number; correctAnswers: number; participationCount: number };
  incrementSessionStat: (key: "totalQuestions" | "correctAnswers" | "participationCount") => void;
  resetSessionStats: () => void;

  // 15. classLeaderboardSnapshot - نسخة من قائمة المتصدرين للصف
  classLeaderboardSnapshot: { studentId: string; name: string; points: number; title?: string }[];
  setClassLeaderboardSnapshot: (s: { studentId: string; name: string; points: number; title?: string }[]) => void;

  // 16. currentSessionId - الجلسة النشطة حالياً (محفوظة في SQLite)
  currentSessionId: string | null;
  setCurrentSessionId: (id: string | null) => void;
  /** يبدأ جلسة جديدة في SQLite ويحدّث currentSessionId */
  startNewSession: (name?: string) => Promise<string | null>;
  /** ينهي الجلسة الحالية إن وجدت */
  endCurrentSession: () => Promise<void>;

  // Helper: set sound selection (for SoundsPanel)
  soundVolume: number;
  setSoundVolume: (v: number) => void;

  // Helper: awards a gift to a student (triggers awardedGiftDisplay)
  awardGiftToStudent: (studentId: string, studentName: string, giftId: string, giftName: string, giftImage: string) => void;

  // ===== v18: Lesson Questions + Game System =====
  lessonQuestions: LessonQuestion[];
  setLessonQuestions: (q: LessonQuestion[]) => void;
  /** أسئلة AI المعروضة للمدرس بعد المعاينة؛ لا تدخل الألعاب إلا عند اختيار المصدر صراحة. */
  aiQuestionPool: LessonQuestion[];
  setAiQuestionPool: (q: LessonQuestion[]) => void;
  clearAiQuestionPool: () => void;
  currentGameQuestion: LessonQuestion | null;
  setCurrentGameQuestion: (q: LessonQuestion | null) => void;
  gameMode: "individual" | "duel" | "group" | null;
  setGameMode: (m: "individual" | "duel" | "group" | null) => void;
}

// ====================================================================
//  Helper: Smart Fair Randomizer
//  - Excludes absent students (isAbsent flag)
//  - Excludes already-called students (calledInSession)
//  - If all called, resets calledInSession and picks again
// ====================================================================
function pickFairStudent(students: Student[]): Student | null {
  if (students.length === 0) return null;
  // Filter out absent students first
  const present = students.filter((s) => !s.isAbsent);
  if (present.length === 0) return null; // All absent
  // Filter out already-called (fair rotation)
  const available = present.filter((s) => !s.calledInSession);
  const pool = available.length > 0 ? available : present;
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx];
}

// ====================================================================
//  Store
// ====================================================================
export const useShellStore = create<ShellState>()(
  persist(
    (set, get) => ({
      // ----- Settings -----
      settings: DEFAULT_SETTINGS,
      updateSettings: (patch) => {
        set((s) => ({ settings: { ...s.settings, ...patch } }));
        dbSync.syncSettings(get().settings);
      },
      resetSettings: () => {
        set({ settings: DEFAULT_SETTINGS });
        dbSync.syncSettings(DEFAULT_SETTINGS);
      },

      // ----- Students -----
      students: [],
      addStudent: async (name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        // منع التكرار: قائمة store.students هي فعلاً طلاب الصف النشط
        // (يتم تحميلها بالفلترة في data-store/hydrateFromDb), لذا مقارنة
        // الاسم المباشرة كافية لمنع إضافة طالب بنفس الاسم في نفس الصف.
        const existing = get().students.find((s) => s.name.trim() === trimmed);
        if (existing) {
          import("sonner").then(({ toast }) =>
            toast.warning(`الطالب "${trimmed}" موجود بالفعل في هذا الصف`)
          );
          return;
        }
        const newStudent: Student = {
          id: `st_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: trimmed,
          points: 0,
          correctAnswers: 0,
          wrongAnswers: 0,
          attempts: 0,
          badges: [],
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ students: [...s.students, newStudent] }));
        // Sync to DB (fire-and-forget). classId is null if no active class —
        // schema allows null so the student is added to the general pool only.
        const classId = get().activeClassId || null;
        const { badges: _newBadges, ...newStudentForSync } = newStudent;
        await dbSync.syncStudentCreate({
          ...newStudentForSync,
          classId,
          isAbsent: false,
          lastCalled: null,
          updatedAt: newStudent.createdAt,
        });
      },
      addStudentsBulk: async (names) => {
        // منع التكرار: فلترة الأسماء الفارغة + الأسماء التي توجد بالفعل
        // في قائمة الصف النشط (store.students — محمّلة بالفلترة مسبقاً).
        const existingNames = new Set(get().students.map((s) => s.name.trim()));
        const seen = new Set<string>();
        const filtered = names
          .map((n) => n.trim())
          .filter((n) => {
            if (!n) return false;
            if (existingNames.has(n) || seen.has(n)) return false;
            seen.add(n);
            return true;
          });
        if (filtered.length === 0) return;
        const skipped = names.map((n) => n.trim()).filter(Boolean).length - filtered.length;
        if (skipped > 0) {
          import("sonner").then(({ toast }) =>
            toast.warning(`تم تخطي ${skipped} اسم مكرر`)
          );
        }
        const newStudents: Student[] = filtered.map((name, i) => ({
          id: `st_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
          name,
          points: 0,
          correctAnswers: 0,
          wrongAnswers: 0,
          attempts: 0,
          badges: [],
          createdAt: new Date().toISOString(),
        }));
        set((s) => ({ students: [...s.students, ...newStudents] }));
        // Bulk sync to DB — classId is null if no active class
        const classId = get().activeClassId || null;
        await Promise.all(newStudents.map(async (st) => {
          const { badges: _stBadges, ...stForSync } = st;
          await dbSync.syncStudentCreate({
            ...stForSync,
            classId,
            isAbsent: false,
            lastCalled: null,
            updatedAt: st.createdAt,
          });
        }));
      },
      removeStudent: async (id) => {
        set((s) => ({
          students: s.students.filter((st) => st.id !== id),
          currentlyCalledStudent:
            s.currentlyCalledStudent?.id === id ? null : s.currentlyCalledStudent,
        }));
        // Wait for the DB mutation. Callers that immediately refresh a roster
        // must not race the delete and reinsert the just-removed student.
        await dbSync.syncStudentDelete(id);
      },
      clearStudents: async () => {
        const prev = get().students;
        set({ students: [], currentlyCalledStudent: null });
        await Promise.all(prev.map((student) => dbSync.syncStudentDelete(student.id)));
      },
      awardPoints: (id, points) => {
        const student = get().students.find((s) => s.id === id);
        const sessionId = get().currentSessionId;
        set((s) => ({
          students: s.students.map((st) =>
            st.id === id ? {
              ...st,
              points: st.points + points,
              calledInSession: true,
              lastCalled: new Date().toISOString(),
            } : st
          ),
          currentlyCalledStudent:
            s.currentlyCalledStudent?.id === id
              ? {
                  ...s.currentlyCalledStudent,
                  points: s.currentlyCalledStudent.points + points,
                  calledInSession: true,
                }
              : s.currentlyCalledStudent,
        }));
        // Persist the increment exactly once. The API uses Prisma's atomic
        // increment, so concurrent tabs cannot overwrite one another and the
        // absolute-value write cannot double-count the award.
        dbSync.syncStudentAwardPoints(id, points);
        get().refreshTitle(id);
        // ===== تسجيل في StudentActivity =====
        logStudentActivity(id, sessionId, "points", points, `منح ${points} نقاط`);
        // ===== الإعلان الصوتي =====
        if (student) {
          announce("points-awarded", {
            studentName: student.name,
            points,
            totalPoints: student.points + points,
          });
        }
      },
      awardCorrect: (id, points = 3, ideaId) => {
        const student = get().students.find((s) => s.id === id);
        const sessionId = get().currentSessionId;
        set((s) => ({
          students: s.students.map((st) =>
            st.id === id
              ? {
                  ...st,
                  points: st.points + points,
                  correctAnswers: st.correctAnswers + 1,
                  attempts: st.attempts + 1,
                  calledInSession: true,
                  lastCalled: new Date().toISOString(),
                  badges: [
                    ...st.badges,
                    { type: "correct", awardedAt: new Date().toISOString() },
                  ],
                }
              : st
          ),
          currentlyCalledStudent:
            s.currentlyCalledStudent?.id === id
              ? {
                  ...s.currentlyCalledStudent,
                  points: s.currentlyCalledStudent.points + points,
                  correctAnswers: s.currentlyCalledStudent.correctAnswers + 1,
                  attempts: s.currentlyCalledStudent.attempts + 1,
                  calledInSession: true,
                }
              : s.currentlyCalledStudent,
          studentLiveStatuses: { ...s.studentLiveStatuses, [id]: { status: "correct", source: "local", updatedAt: new Date().toISOString(), label: "إجابة صحيحة" } },
        }));
        dbSync.syncStudentAwardCorrect(id, points);
        dbSync.syncStudentUpdate(id, { lastCalled: new Date().toISOString() });
        get().recordAnswerForIdea(id, ideaId || get().currentIdeaId || "general", true);
        get().refreshTitle(id);
        triggerClassroomHaptic("success", get().settings);
        // ===== تسجيل في StudentActivity =====
        logStudentActivity(id, sessionId, "correct", points, "إجابة صحيحة");
        // ===== الإعلان الصوتي =====
        if (student) {
          announce("answer-correct", {
            studentName: student.name,
            points,
            totalPoints: student.points + points,
          });
        }
      },
      awardWrong: (id, ideaId) => {
        const student = get().students.find((s) => s.id === id);
        const sessionId = get().currentSessionId;
        set((s) => ({
          students: s.students.map((st) =>
            st.id === id
              ? {
                  ...st,
                  wrongAnswers: st.wrongAnswers + 1,
                  attempts: st.attempts + 1,
                  calledInSession: true,
                  lastCalled: new Date().toISOString(),
                  badges: [
                    ...st.badges,
                    { type: "wrong", awardedAt: new Date().toISOString() },
                  ],
                }
              : st
          ),
          currentlyCalledStudent:
            s.currentlyCalledStudent?.id === id
              ? {
                  ...s.currentlyCalledStudent,
                  wrongAnswers: s.currentlyCalledStudent.wrongAnswers + 1,
                  attempts: s.currentlyCalledStudent.attempts + 1,
                  calledInSession: true,
                }
              : s.currentlyCalledStudent,
          studentLiveStatuses: { ...s.studentLiveStatuses, [id]: { status: "wrong", source: "local", updatedAt: new Date().toISOString(), label: "يحتاج دعماً" } },
        }));
        dbSync.syncStudentAwardWrong(id);
        dbSync.syncStudentUpdate(id, { lastCalled: new Date().toISOString() });
        get().recordAnswerForIdea(id, ideaId || get().currentIdeaId || "general", false);
        get().refreshTitle(id);
        triggerClassroomHaptic("error", get().settings);
        // ===== تسجيل في StudentActivity =====
        logStudentActivity(id, sessionId, "wrong", 0, "إجابة خاطئة");
        // ===== الإعلان الصوتي =====
        if (student) {
          announce("answer-wrong", { studentName: student.name });
        }
      },
      awardGoodTry: (id) => {
        const student = get().students.find((s) => s.id === id);
        const sessionId = get().currentSessionId;
        set((s) => ({
          students: s.students.map((st) =>
            st.id === id
              ? {
                  ...st,
                  attempts: st.attempts + 1,
                  points: st.points + 1,
                  calledInSession: true,
                  lastCalled: new Date().toISOString(),
                  badges: [
                    ...st.badges,
                    { type: "good-try", awardedAt: new Date().toISOString() },
                  ],
                }
              : st
          ),
          studentLiveStatuses: { ...s.studentLiveStatuses, [id]: { status: "waiting", source: "local", updatedAt: new Date().toISOString(), label: "محاولة جيدة" } },
        }));
        dbSync.syncStudentAwardGoodTry(id);
        dbSync.syncStudentUpdate(id, { lastCalled: new Date().toISOString() });
        // goodTry يمنح نقطة — قد تعبر عتبات الألقاب (بطل/نجم/أسطورة)
        get().refreshTitle(id);
        triggerClassroomHaptic("light", get().settings);
        // ===== تسجيل في StudentActivity =====
        logStudentActivity(id, sessionId, "goodTry", 1, "محاولة جيدة");
        // ===== الإعلان الصوتي =====
        if (student) {
          announce("good-try", {
            studentName: student.name,
            totalPoints: student.points + 1,
          });
        }
      },
      awardBadge: (id, badgeType) => {
        const student = get().students.find((s) => s.id === id);
        const sessionId = get().currentSessionId;
        set((s) => ({
          students: s.students.map((st) =>
            st.id === id
              ? {
                  ...st,
                  calledInSession: true,
                  lastCalled: new Date().toISOString(),
                  badges: [
                    ...st.badges,
                    { type: badgeType, awardedAt: new Date().toISOString() },
                  ],
                }
              : st
          ),
        }));
        dbSync.syncStudentAwardBadge(id, badgeType);
        // ===== تسجيل في StudentActivity =====
        logStudentActivity(id, sessionId, "badge", 0, `شارة: ${badgeType}`, { badgeType });
        // ===== الإعلان الصوتي =====
        if (student) {
          announce("badge-awarded", {
            studentName: student.name,
            badgeType,
          });
        }
      },
      resetSession: () => {
        set((s) => ({
          students: s.students.map((st) => ({
            ...st,
            calledInSession: false,
          })),
          currentlyCalledStudent: null,
          isPicking: false,
          calledGroupIds: [],
          ideaSelectionHistory: {},
          lessonAttemptsByStudent: {},
          lessonCorrectByStudent: {},
          lessonWrongByStudent: {},
          lastAskedAtByStudent: {},
          performanceByIdea: {},
          fairnessLog: [],
        }));
        dbSync.syncStudentsResetSession(get().activeClassId || undefined);
      },
      setStudentAbsent: (id, isAbsent) => {
        const student = get().students.find((s) => s.id === id);
        const sessionId = get().currentSessionId;
        const lastAbsentAt = !isAbsent ? new Date().toISOString() : (student?.lastAbsentAt ?? null);
        set((s) => ({
          students: s.students.map((st) =>
            st.id === id ? { ...st, isAbsent, lastAbsentAt } as Student : st
          ),
        }));
        dbSync.syncStudentUpdate(id, { isAbsent, lastAbsentAt });
        // ===== تسجيل في StudentActivity =====
        logStudentActivity(id, sessionId, "absent", 0, isAbsent ? "تسجيل غياب" : "إلغاء غياب", { isAbsent });
        // ===== الإعلان الصوتي =====
        if (student) {
          if (isAbsent) {
            announce("student-absent", { studentName: student.name });
          } else {
            announce("student-picked", { studentName: student.name });
          }
        }
      },
      setStudentTitle: (id, title) => {
        set((s) => ({
          students: s.students.map((st) => (st.id === id ? { ...st, title: title ?? undefined } : st)),
          currentlyCalledStudent:
            s.currentlyCalledStudent?.id === id
              ? { ...s.currentlyCalledStudent, title: title ?? undefined }
              : s.currentlyCalledStudent,
        }));
        dbSync.syncStudentSetTitle(id, title || "");
      },
      // P2-12: يقرأ إحصائيات الطالب ويحسب لقبه التلقائي (أعلى قاعدة تتحقق).
      // لا يُحدّث المتجر إلا إذا تغيّر اللقب فعلاً (تفادي كتابات DB زائدة).
      refreshTitle: (studentId) => {
        const student = get().students.find((s) => s.id === studentId);
        if (!student) return;
        const stats = {
          points: student.points,
          correct: student.correctAnswers,
          wrong: student.wrongAnswers,
          badges: student.badges.length,
        };
        const autoTitle = computeTitle(stats);
        const autoRule = computeTitleRule(stats);
        // C40 (P2 fix): respect manually-set titles. Only override if the auto-title
        // is a major promotion (عبقري/بطل tier). Auto titles are stored as
        // "<icon> <name>" (e.g. "🧠 عبقري") — compare against the same computed
        // strings from TITLE_RULES, never bare names.
        const AUTO_TITLES = [...TITLE_RULES.map((r) => `${r.icon} ${r.name}`), null, undefined, ""];
        const isAutoTitle = AUTO_TITLES.includes(student.title ?? null);
        if (!isAutoTitle) {
          if (autoRule.id !== "genius" && autoRule.id !== "champion") return;
        }
        if (student.title === autoTitle) return; // لا تغيير
        const oldTitle = student.title;
        set((s) => ({
          students: s.students.map((st) => (st.id === studentId ? { ...st, title: autoTitle } : st)),
          currentlyCalledStudent:
            s.currentlyCalledStudent?.id === studentId
              ? { ...s.currentlyCalledStudent, title: autoTitle }
              : s.currentlyCalledStudent,
        }));
        dbSync.syncStudentSetTitle(studentId, autoTitle);
        // ===== الإعلان الصوتي =====
        announce("title-changed", {
          studentName: student.name,
          oldTitle: oldTitle ?? undefined,
          newTitle: autoTitle,
        });
      },
      recordStudentActivity: (studentId, activity) => {
        // Record activity as a badge (for profile display) + award points if specified
        const state = get();
        const student = state.students.find((s) => s.id === studentId);
        if (!student) return;
        // Add a badge representing the activity
        const badgeType = activity.type as StudentBadge["type"];
        const newPoints = activity.points ? student.points + activity.points : student.points;
        set((s) => ({
          students: s.students.map((st) =>
            st.id === studentId
              ? {
                  ...st,
                  calledInSession: true,
                  lastCalled: new Date().toISOString(),
                  points: newPoints,
                  badges: [
                    ...st.badges,
                    { type: badgeType, awardedAt: new Date().toISOString(), note: activity.description },
                  ],
                }
              : st
          ),
        }));
        // Sync to DB (use syncStudentUpdate for points, syncStudentAwardBadge for badge)
        if (activity.points) {
          dbSync.syncStudentUpdate(studentId, { points: newPoints });
        }
        dbSync.syncStudentAwardBadge(studentId, badgeType);
      },

      // ----- Random Picker -----
      currentlyCalledStudent: null,
      isPicking: false,
      pickRandomStudent: () => {
        const { students } = get();
        if (students.length === 0) return;
        set({ isPicking: true });
        setTimeout(() => {
          const available = students.filter((s) => !s.calledInSession);
          if (available.length === 0) {
            set((s) => ({
              students: s.students.map((st) => ({ ...st, calledInSession: false })),
            }));
            // C41 (P2 fix): sync rotation reset to DB.
            dbSync.syncStudentsResetSession(get().activeClassId || undefined);
          }
          const picked = pickFairStudent(get().students);
          if (!picked) {
            set({ isPicking: false });
            return;
          }
          set((s) => ({
            students: s.students.map((st) =>
              st.id === picked.id
                ? {
                    ...st,
                    calledInSession: true,
                    lastCalled: new Date().toISOString(),
                  }
                : st
            ),
            currentlyCalledStudent: { ...picked, calledInSession: true },
            isPicking: false,
          }));
          // ===== الإعلان الصوتي =====
          announce("student-picked", { studentName: picked.name });
        }, 200);
      },
      clearCurrentStudent: () => set({ currentlyCalledStudent: null }),
      ideaSelectionHistory: {},
      recordIdeaSelection: (ideaId, studentId) => set((s) => ({ ideaSelectionHistory: { ...s.ideaSelectionHistory, [ideaId]: [...(s.ideaSelectionHistory[ideaId] || []), studentId] } })),
      lessonAttemptsByStudent: {},
      lessonCorrectByStudent: {},
      lessonWrongByStudent: {},
      lastAskedAtByStudent: {},
      performanceByIdea: {},
      fairnessLog: [],
      recordAnswerForIdea: (studentId, ideaId, isCorrect) => {
        const normalizedIdeaId = ideaId || "general";
        const now = Date.now();
        set((s) => {
          const current = s.performanceByIdea[normalizedIdeaId]?.[studentId] || { attempts: 0, correct: 0, wrong: 0, updatedAt: now };
          const nextPerformance: IdeaPerformance = {
            attempts: current.attempts + 1,
            correct: current.correct + (isCorrect ? 1 : 0),
            wrong: current.wrong + (isCorrect ? 0 : 1),
            updatedAt: now,
          };
          return {
            performanceByIdea: {
              ...s.performanceByIdea,
              [normalizedIdeaId]: {
                ...(s.performanceByIdea[normalizedIdeaId] || {}),
                [studentId]: nextPerformance,
              },
            },
            lessonCorrectByStudent: {
              ...s.lessonCorrectByStudent,
              [studentId]: (s.lessonCorrectByStudent[studentId] || 0) + (isCorrect ? 1 : 0),
            },
            lessonWrongByStudent: {
              ...s.lessonWrongByStudent,
              [studentId]: (s.lessonWrongByStudent[studentId] || 0) + (isCorrect ? 0 : 1),
            },
          };
        });
      },
      isStrugglingInIdea: (studentId, ideaId) => {
        const performance = get().performanceByIdea[ideaId]?.[studentId];
        return Boolean(performance && performance.attempts > 0 && performance.wrong / performance.attempts >= 0.5);
      },
      getIdeaPerformance: (studentId, ideaId) => get().performanceByIdea[ideaId]?.[studentId] || null,
      getLessonFairnessScore: (studentId, ideaId) => {
        const state = get();
        const present = state.students.filter((student) => !student.isAbsent);
        const attempts = state.lessonAttemptsByStudent[studentId] || 0;
        const maxAttempts = Math.max(0, ...present.map((student) => state.lessonAttemptsByStudent[student.id] || 0));
        const deprivation = maxAttempts === 0 ? 1 : 1 - attempts / Math.max(1, maxAttempts);
        const ideaPerformance = ideaId ? state.performanceByIdea[ideaId]?.[studentId] : undefined;
        const ideaStruggling = ideaPerformance && ideaPerformance.attempts > 0 && ideaPerformance.wrong / ideaPerformance.attempts >= 0.5 ? 1 : 0;
        const student = state.students.find((item) => item.id === studentId);
        const overallStruggling = student && student.attempts > 0 && student.wrongAnswers / student.attempts >= 0.5 ? 1 : 0;
        const lastAsked = state.lastAskedAtByStudent[studentId];
        const elapsed = lastAsked ? Date.now() - lastAsked : Number.POSITIVE_INFINITY;
        const recency = lastAsked ? Math.min(1, elapsed / (5 * 60 * 1000)) : 1;
        const fatigue = elapsed < 2 * 60 * 1000 ? 1 : 0;
        const reentry = student?.lastAbsentAt && Date.now() - Date.parse(student.lastAbsentAt) < 10 * 60 * 1000 ? 1 : 0;
        return 100 * deprivation + 50 * ideaStruggling + 30 * overallStruggling + 20 * recency - 20 * fatigue + 15 * reentry;
      },
      resetLessonStats: () => set((s) => ({
        students: s.students.map((student) => ({ ...student, calledInSession: false })),
        currentlyCalledStudent: null,
        isPicking: false,
        lessonAttemptsByStudent: {},
        lessonCorrectByStudent: {},
        lessonWrongByStudent: {},
        lastAskedAtByStudent: {},
        performanceByIdea: {},
        fairnessLog: [],
        ideaSelectionHistory: {},
      })),
      resetIdeaStats: (ideaId) => set((s) => {
        const performanceByIdea = { ...s.performanceByIdea };
        delete performanceByIdea[ideaId];
        const ideaSelectionHistory = { ...s.ideaSelectionHistory };
        delete ideaSelectionHistory[ideaId];
        return { performanceByIdea, ideaSelectionHistory };
      }),
      pickFairStudentsBatch: (count) => {
        const { students } = get();
        const present = students.filter((s) => !s.isAbsent);
        if (present.length === 0) return [];
        let available = present.filter((s) => !s.calledInSession);
        // Not enough remaining for a full fair batch — reset the rotation
        // (mirrors pickFairStudent's single-pick behavior).
        if (available.length < Math.min(count, present.length)) {
          set((s) => ({
            students: s.students.map((st) => ({ ...st, calledInSession: false })),
          }));
          available = get().students.filter((s) => !s.isAbsent);
        }
        const shuffled = [...available].sort(() => Math.random() - 0.5);
        const picked = shuffled.slice(0, count);
        const pickedIds = new Set(picked.map((s) => s.id));
        set((s) => ({
          students: s.students.map((st) =>
            pickedIds.has(st.id) ? { ...st, calledInSession: true } : st
          ),
        }));
        return picked;
      },

      // ----- Group fairness -----
      calledGroupIds: [],
      pickFairGroups: (pool, count) => {
        if (pool.length === 0) return [];
        const { calledGroupIds } = get();
        let available = pool.filter((g) => !calledGroupIds.includes(g.id));
        // Not enough remaining groups for a fair pick — everyone's had a
        // turn, so reset the pool and start a fresh rotation.
        if (available.length < Math.min(count, pool.length)) {
          available = pool;
          set({ calledGroupIds: [] });
        }
        const shuffled = [...available].sort(() => Math.random() - 0.5);
        const picked = shuffled.slice(0, count);
        set((s) => ({ calledGroupIds: [...s.calledGroupIds, ...picked.map((g) => g.id)] }));
        return picked;
      },

      // ----- Lessons -----
      lessons: [],
      activeLessonId: null,
      addLesson: (lesson) => {
        set((s) => ({ lessons: [...s.lessons, lesson] }));
        dbSync.syncLessonUpsert(lesson);
      },
      removeLesson: (id) => {
        set((s) => {
          const removingActive = s.activeLessonId === id;
          return {
            lessons: s.lessons.filter((l) => l.id !== id),
            activeLessonId: removingActive ? null : s.activeLessonId,
            manifest: removingActive ? null : s.manifest,
            lessonQuestions: removingActive ? [] : s.lessonQuestions,
            currentIdeaId: removingActive ? null : s.currentIdeaId,
            currentStep: removingActive ? 1 : s.currentStep,
            askedQuestionIds: removingActive ? new Set<string>() : s.askedQuestionIds,
            aiQuestionPool: removingActive ? [] : s.aiQuestionPool,
          };
        });
        dbSync.syncLessonDelete(id);
      },
      setActiveLesson: (id) => {
        set({ activeLessonId: id });
        get().resetLessonStats();
        // Local imported lessons may not implement the iframe MANIFEST
        // handshake. Their persisted manifest is still authoritative for
        // navigation, analysis, and curriculum-local game questions.
        const lessonManifest = get().lessons.find((lesson) => lesson.id === id)?.manifest;
        if (lessonManifest) {
          get().setManifest(lessonManifest);
        } else {
          set({
            manifest: null,
            lessonQuestions: [],
            currentIdeaId: null,
            currentStep: 1,
            askedQuestionIds: new Set<string>(),
            aiQuestionPool: [],
          });
        }
      },

      // ----- Manifest & Navigation -----
      manifest: null,
      currentStep: 1,
      currentIdeaId: null,
      setManifest: (m) => {
        const firstIdea = m?.ideas?.[0]?.id || null;
        const initialStep = m?.currentStep || 1;
        // استخراج الأسئلة من المنهج تلقائياً
        const questions = m ? extractAllQuestions(m) : [];
        // C54: auto-enable virtual comments if the lesson manifest has a
        // virtualComments array. Per USER_GUIDE.md and SLIDE_CONFIGURATION.md,
        // "النظام بيتفعل تلقائياً لو الـ manifest فيه virtualComments".
        // Previously this was only documented but not implemented — the teacher
        // had to manually toggle Shift+V even when the lesson declared comments.
        const hasVC = Array.isArray(m?.virtualComments) && (m!.virtualComments!.length > 0);
        const currentEnabled = get().virtualCommentsEnabled;
        // Only auto-enable if the teacher hasn't explicitly disabled it via settings.
        // We check settings.virtualCommentsEnabled: if it's explicitly false, respect that.
        const explicitSetting = get().settings?.virtualCommentsEnabled;
        const shouldEnable = hasVC && explicitSetting !== false;
        set({
          manifest: m,
          currentStep: initialStep,
          currentIdeaId: firstIdea,
          lessonQuestions: questions,
          aiQuestionPool: [],
          // P1-3 fix: clear any active virtual comment + pending nav when switching lessons.
          // Without this, a comment from the previous lesson hangs over the new lesson's first slide.
          // P2 fix: also clear virtualCommentCalledIds so students who received a comment in the
          // previous lesson aren't excluded in the new lesson until all are called.
          currentVirtualComment: null,
          virtualCommentPendingNav: null,
          virtualCommentCalledIds: [],
          // C54: auto-enable VC for lessons that declare them (unless teacher disabled).
          virtualCommentsEnabled: shouldEnable ? true : currentEnabled,
        });

        // Questions may be stored separately from the imported slide manifest.
        // Hydrate them after the manifest arrives so curriculum games can use
        // the lesson's local DB question bank without changing the student view.
        if (m?.lessonId) {
          // ImportedLesson.id is the local SQLite FK, while manifest.lessonId
          // is the lesson's curriculum/external key. Resolve the local id first
          // so the hydrated bank carries real question IDs into reports/games.
          const activeLesson = get().lessons.find((lesson) => lesson.id === get().activeLessonId || lesson.manifest?.lessonId === m.lessonId);
          const lessonId = activeLesson?.id || m.lessonId;
          void localDb.questions.listByLesson(lessonId).then((rows) => {
            if (get().manifest?.lessonId !== m.lessonId) return;
            const dbQuestions = rows
              .map((row) => normalizeDbLessonQuestion(row, lessonId))
              .filter((question): question is LessonQuestion => question !== null);
            if (dbQuestions.length > 0) set({ lessonQuestions: dbQuestions });
          }).catch((error) => {
            console.warn("[shell-store] lesson question hydration failed:", error);
          });
        }
      },
      setCurrentStep: (step) => set({ currentStep: step }),
      setCurrentIdea: (ideaId) => set({ currentIdeaId: ideaId }),
      goToStep: (step, ideaId) =>
        set((s) => ({
          currentStep: step,
          currentIdeaId: ideaId ?? s.currentIdeaId,
        })),
      nextStep: () => {
        const s = get();
        const { currentStep, manifest, currentIdeaId } = s;
        if (!manifest) return;

        // ===== وضع الخطوة البينية للتعليقات الافتراضية =====
        // السلوك (محدّث):
        // 1) لو الميزة مفعّلة والخطوة *الجاية* (نفس الفكرة أو أول خطوة في الفكرة التالية)
        //    فيها تعليق → أول ضغطة تعرض التعليق فقط (بدون تحريك الشريحة)
        // 2) ثاني ضغطة → انتقل فعلياً للخطوة التالية
        // 3) لو الخطوة التالية ليس لها تعليق → انتقل مباشرة
        if (s.virtualCommentsEnabled) {
          // لو كنا في حالة "التعليق ظاهر" → امسحه وانتقل للشريحة فعلاً
          if (s.virtualCommentPendingNav === "show-comment") {
            set({ virtualCommentPendingNav: null, currentVirtualComment: null });
            // ونسّق التنقّل الطبيعي تحت
          } else {
            // احسب الخطوة التالية (قد تكون في نفس الفكرة أو الفكرة التالية)
            const stepsNow = getCurrentSteps(manifest, currentIdeaId || undefined);
            let nextStepNum: number | null = null;
            let nextIdeaId: string | null = currentIdeaId;

            if (stepsNow.length > 0 && currentStep < stepsNow.length) {
              // نفس الفكرة — الخطوة التالية
              nextStepNum = currentStep + 1;
              nextIdeaId = currentIdeaId;
            } else if (stepsNow.length > 0 && currentStep >= stepsNow.length && manifest.ideas) {
              // آخر خطوة في الفكرة — انتقل لأول خطوة في الفكرة التالية
              const currentIdx = manifest.ideas.findIndex((i) => i.id === currentIdeaId);
              if (currentIdx < manifest.ideas.length - 1) {
                const nextIdea = manifest.ideas[currentIdx + 1];
                nextStepNum = 1;
                nextIdeaId = nextIdea.id;
              }
            } else if (stepsNow.length === 0) {
              // flat mode
              nextStepNum = currentStep + 1;
            }

            // لو الخطوة التالية لها تعليق → اعرض التعليق كخطوة مستقلة
            if (
              nextStepNum !== null &&
              nextIdeaId &&
              get().hasVirtualCommentAt(nextStepNum, nextIdeaId) &&
              s.virtualCommentPendingNav === null
            ) {
              get().triggerVirtualComment(nextStepNum, nextIdeaId ?? undefined);
              // اقرأ الحالة بعد trigger (triggerVirtualComment يحدّث currentVirtualComment)
              const after = get();
              if (after.currentVirtualComment) {
                set({ virtualCommentPendingNav: "show-comment" });
                return;
              }
            }
            // لو مفيش تعليق → انتقل مباشرة (نسّق التنقّل الطبيعي تحت)
          }
        }

        const steps = getCurrentSteps(manifest, currentIdeaId || undefined);
        if (steps.length === 0) {
          // flat mode
          const total = getTotalSteps(manifest);
          set({ currentStep: Math.min(currentStep + 1, total) });
          return;
        }
        // ideas mode
        if (currentStep < steps.length) {
          set({ currentStep: currentStep + 1 });
        } else {
          // move to next idea
          if (manifest.ideas) {
            const currentIdx = manifest.ideas.findIndex((i) => i.id === currentIdeaId);
            if (currentIdx < manifest.ideas.length - 1) {
              const nextIdea = manifest.ideas[currentIdx + 1];
              set({ currentIdeaId: nextIdea.id, currentStep: 1 });
            }
          }
        }
      },
      prevStep: () => {
        const s = get();
        const { currentStep, manifest, currentIdeaId } = s;
        if (!manifest) return;

        // لو فيه تعليق ظاهر دلوقتي → الرجوع يمشّيه ويرجّعنا من غير ما نحرك الشريحة
        if (s.virtualCommentPendingNav === "show-comment" || s.currentVirtualComment) {
          set({ virtualCommentPendingNav: null, currentVirtualComment: null });
          return;
        }

        if (currentStep > 1) {
          set({ currentStep: currentStep - 1 });
          return;
        }
        // move to previous idea's last step
        if (manifest.ideas && currentIdeaId) {
          const currentIdx = manifest.ideas.findIndex((i) => i.id === currentIdeaId);
          if (currentIdx > 0) {
            const prevIdea = manifest.ideas[currentIdx - 1];
            set({
              currentIdeaId: prevIdea.id,
              currentStep: prevIdea.steps.length,
            });
          }
        }
      },
      goToIdea: (ideaId, step = 1) =>
        set({ currentIdeaId: ideaId, currentStep: step }),

      // ----- UI Panels -----
      activePanel: null,
      setActivePanel: (p) => set({ activePanel: p }),
      togglePanel: (p) =>
        set((s) => ({ activePanel: s.activePanel === p ? null : p })),

      studentLiveStatuses: {},
      setStudentLiveStatuses: (statuses) => set({ studentLiveStatuses: statuses }),
      clearStudentLiveStatuses: () => set({ studentLiveStatuses: {} }),

      // ----- Whiteboard -----
      whiteboardTool: "select",
      whiteboardColor: "blue",
      whiteboardThickness: 2,
      whiteboardShape: "circle",
      setWhiteboardTool: (t) =>
        // Switching to any non-select tool cancels the active stamp.
        // This ensures a single drawing tool is active at a time (mutual exclusion).
        set((s) => ({
          whiteboardTool: t,
          settings: t !== "select" ? { ...s.settings, whiteboardEnabled: true } : s.settings,
          selectedStamp: t === "select" ? s.selectedStamp : null,
        })),
      setWhiteboardColor: (c) => set({ whiteboardColor: c }),
      setWhiteboardThickness: (t) => set({ whiteboardThickness: t }),
      setWhiteboardShape: (s) => set({ whiteboardShape: s }),
      clearWhiteboard: () =>
        set((s) => ({ whiteboardClearSignal: s.whiteboardClearSignal + 1 })),
      undoWhiteboard: () =>
        set((s) => ({ whiteboardUndoSignal: s.whiteboardUndoSignal + 1 })),
      whiteboardClearSignal: 0,
      whiteboardUndoSignal: 0,
      whiteboardRedoSignal: 0,
      whiteboardHistoryCount: { index: 0, total: 0 },
      setWhiteboardHistoryCount: (v) => set({ whiteboardHistoryCount: v }),
      redoWhiteboard: () =>
        set((s) => ({ whiteboardRedoSignal: s.whiteboardRedoSignal + 1 })),

      // ----- Advanced Whiteboard Tools (v9) -----
      laserColor: "#ef4444",
      laserSize: 8,
      textFormat: { bold: false, italic: false, underline: false },
      setLaserColor: (c) => set({ laserColor: c }),
      setLaserSize: (s) => set({ laserSize: s }),
      setTextFormat: (f) => set((s) => ({ textFormat: { ...s.textFormat, ...f } })),

      // ----- Stage (fullscreen) -----
      requestFullscreenToggle: () =>
        set((s) => ({ fullscreenToggleSignal: s.fullscreenToggleSignal + 1 })),
      fullscreenToggleSignal: 0,
      appFullscreenKeepPanels: false,
      // 🟢 v2: track asked questions across games in this session
      askedQuestionIds: new Set<string>(),
      markQuestionAsked: (stableId: string) => {
        set((s) => {
          if (s.askedQuestionIds.has(stableId)) return s;
          const next = new Set(s.askedQuestionIds);
          next.add(stableId);
          return { askedQuestionIds: next };
        });
      },
      clearAskedQuestions: () => set({ askedQuestionIds: new Set<string>() }),

      // ----- Confirm / Prompt dialogs -----
      confirmDialog: null,
      requestConfirm: (message, opts) =>
        new Promise<boolean>((resolve) => {
          // C4: if a previous confirm was still pending (dialog re-named / replaced
          // before user responded), settle it with `false` so its Promise doesn't leak.
          settleConfirm(false);
          confirmResolver = resolve;
          set({ confirmDialog: { message, title: opts?.title, danger: opts?.danger } });
        }),
      resolveConfirm: (result) => {
        set({ confirmDialog: null });
        settleConfirm(result);
      },
      promptDialog: null,
      requestPrompt: (message, opts) =>
        new Promise<string | null>((resolve) => {
          // C4: settle any previously-pending prompt so its Promise doesn't leak.
          settlePrompt(null);
          promptResolver = resolve;
          set({
            promptDialog: {
              message,
              title: opts?.title,
              defaultValue: opts?.defaultValue,
              inputType: opts?.inputType,
            },
          });
        }),
      resolvePrompt: (result) => {
        set({ promptDialog: null });
        settlePrompt(result);
      },

      // ----- Effects -----
      triggerConfetti: () =>
        set((s) => ({ confettiSignal: s.confettiSignal + 1 })),
      confettiSignal: 0,
      triggerRedFlash: () =>
        set((s) => ({ redFlashSignal: s.redFlashSignal + 1 })),
      redFlashSignal: 0,
      triggerGreenFlash: () =>
        set((s) => ({ greenFlashSignal: s.greenFlashSignal + 1 })),
      greenFlashSignal: 0,
      playSound: (type: string) => {
        const { settings } = get();
        if (settings.muted || settings.audioMixerEnabled === false) return;
        const channel = type.includes("tts") || type.includes("announce") ? "tts" : type.includes("ambiance") ? "ambient" : type.includes("music") ? "music" : "effects";
        const channelState = settings.audioChannels?.[channel];
        if (channelState?.muted) return;
        const volume = Math.max(0, Math.min(1, (settings.audioMasterVolume ?? settings.volume) * (channelState?.volume ?? 1)));
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("play-sound", { detail: { type, channel, volume, ambiance: settings.ambianceType || "none" } })
          );
        }
      },

      // ----- Helper Asset Viewer -----
      viewingHelperAsset: null,
      setViewingHelperAsset: (asset) => set({ viewingHelperAsset: asset }),

      // ----- Teleprompter -----
      highlightedSentence: null,
      setHighlightedSentence: (i) => set({ highlightedSentence: i }),

      // ===== v10 NEW STATE IMPLEMENTATIONS =====
      activeClassId: null,
      setActiveClassId: (id) => set({ activeClassId: id }),

      activeGame: null,
      setActiveGame: (g) => set({ activeGame: g }),
      gameActivityActive: false,
      setGameActivityActive: (v) => set({ gameActivityActive: v }),

      gameParticipants: [],
      setGameParticipants: (p) => set({ gameParticipants: p }),

      wheelResult: null,
      setWheelResult: (r) => set({ wheelResult: r }),

      luckyWheelResult: null,
      setLuckyWheelResult: (r) => set({ luckyWheelResult: r }),

      diceResult: null,
      setDiceResult: (r) => set({ diceResult: r }),

      reactionBestMs: null,
      setReactionBestMs: (ms) => set({ reactionBestMs: ms }),

      tugOfWarState: { leftScore: 0, rightScore: 0, winner: null },
      setTugOfWarState: (s) => set({ tugOfWarState: s }),

      quizShowState: { currentQuestion: null, options: [], correctIdx: -1, scores: {} },
      setQuizShowState: (s) => set({ quizShowState: s }),

      awardedGiftDisplay: null,
      setAwardedGiftDisplay: (g) => set({ awardedGiftDisplay: g }),

      leaderboardVisible: false,
      setLeaderboardVisible: (v) => set({ leaderboardVisible: v }),

      selectedStamp: null,
      setSelectedStamp: (s) =>
        // Activating a stamp cancels any active drawing tool (sets it to select).
        // The SmartWhiteboard detects `selectedStamp` and treats it as a stamp tool,
        // so whiteboardTool="select" prevents double-tool state.
        set((state) => ({
          selectedStamp: s,
          whiteboardTool: s ? "select" : state.whiteboardTool,
        })),

      // ===== Virtual Comments (نظام التعليقات الافتراضية) =====
      virtualCommentsEnabled: false,
      virtualCommentCalledIds: [],
      currentVirtualComment: null,
      virtualCommentPendingNav: null,
      hasVirtualCommentAt: (step, ideaId) => {
        const m = get().manifest;
        if (!m?.virtualComments) return false;
        return m.virtualComments.some(
          (vc) => vc.step === step && (!vc.ideaId || vc.ideaId === ideaId || !ideaId)
        );
      },
      setVirtualCommentsEnabled: (v) => {
        set({ virtualCommentsEnabled: v });
        try {
          const updated = { ...get().settings, virtualCommentsEnabled: v };
          dbSync.syncSettings(updated);
        } catch {}
      },
      dismissVirtualComment: () => set({ currentVirtualComment: null }),
      resetVirtualCommentRound: () => set({ virtualCommentCalledIds: [] }),
      triggerVirtualComment: (step, ideaId) => {
        const state = get();
        const manifest = state.manifest;
        if (!manifest?.virtualComments) return;
        const comment = manifest.virtualComments.find(
          (vc) => vc.step === step && (!vc.ideaId || vc.ideaId === ideaId)
        );
        if (!comment) {
          set({ currentVirtualComment: null });
          return;
        }

        const present = state.students.filter((s) => !s.isAbsent);

        let picked: typeof present[0] | null = null;

        // إصلاح: لو في studentHint.name → استخدمه لمطابقة طالب موجود
        if (comment.studentHint?.name) {
          const nameLower = comment.studentHint.name.trim().toLowerCase();
          picked = present.find((s) => s.name.trim().toLowerCase() === nameLower) ?? null;
        }
        // إصلاح: لو مفيش studentHint بس في studentName في التعليق → جرّب مطابقته
        if (!picked && (comment as any).studentName) {
          const nameLower = ((comment as any).studentName as string).trim().toLowerCase();
          picked = present.find((s) => s.name.trim().toLowerCase() === nameLower) ?? null;
        }

        if (!picked) {
          let available = present.filter((s) => !state.virtualCommentCalledIds.includes(s.id));
          if (available.length === 0) {
            set({ virtualCommentCalledIds: [] });
            available = present;
          }
          if (available.length === 0) {
            // إصلاح: لو مفيش طلاب، استخدم اسم من التعليق (studentName) أو اسم افتراضي
            const fallbackName = (comment as any).studentName || comment.studentHint?.name || "طالب";
            const fallbackGender = comment.studentHint?.gender;
            set({
              currentVirtualComment: {
                student: { id: `fallback_${Date.now()}`, name: fallbackName, gender: fallbackGender },
                text: comment.text,
                tone: comment.tone,
                commentId: `vc-${step}-${ideaId ?? "flat"}-${Date.now()}`,
                step,
              },
            });
            return;
          }
          picked = available[Math.floor(Math.random() * available.length)];
        }

        if (picked) {
          set({ virtualCommentCalledIds: [...state.virtualCommentCalledIds, picked.id] });
          set({
            currentVirtualComment: {
              student: { id: picked.id, name: picked.name, gender: comment.studentHint?.gender },
              text: comment.text,
              tone: comment.tone,
              commentId: `vc-${step}-${ideaId ?? "flat"}-${Date.now()}`,
              step,
            },
          });
        }
      },

      celebrationType: null,
      celebrationCounter: 0,
      celebrations: DEFAULT_CELEBRATIONS, // overridden by loadCelebrationsFromDb on mount
      setCelebrationsList: (list) => set({ celebrations: list }),
      loadCelebrationsFromDb: async () => {
        try {
          const { getAllCelebrationsFromDb } = await import("./celebrations");
          const all = await getAllCelebrationsFromDb();
          if (all.length > 0) set({ celebrations: all });
        } catch (e) {
          console.warn("[shell-store] loadCelebrationsFromDb failed:", e);
        }
      },
      setCelebrationType: (c) =>
        c === null
          ? set({ celebrationType: null })
          : set((s) => ({ celebrationType: c, celebrationCounter: s.celebrationCounter + 1 })),
      triggerCelebration: (type) => {
        set((s) => ({ celebrationType: type, celebrationCounter: s.celebrationCounter + 1 }));
        // ===== تسجيل في CelebrationEvent + StudentActivity =====
        const sessionId = get().currentSessionId;
        const currentlyCalled = get().currentlyCalledStudent;
        const studentId = currentlyCalled?.id ?? null;
        // احصل على الـ label و icon و sound من قائمة الاحتفالات المحملة من DB.
        // fallback إلى DEFAULT_CELEBRATIONS_MAP عند عدم التوفّر (للأمان).
        const fromDb = get().celebrations.find((c) => c.id === type);
        const meta = fromDb ?? getCelebrationMetaOrDefault(type);
        logCelebrationEvent(studentId, sessionId, type, meta.label, meta.icon);
        if (studentId) {
          logStudentActivity(studentId, sessionId, "celebration", 0, `احتفال: ${meta.label}`, { celebrationId: type, celebrationLabel: meta.label });
        }
        // ===== الإعلان الصوتي — استخدم الـ label وليس الـ id =====
        announce("celebration-fired", { celebrationLabel: meta.label });
        // ===== تشغيل الصوت — triggerCelebration هو المالك الوحيد للصوت =====
        // (يمنع double-sound: لا حاجة لـ playSound في CelebrationsOverlay أو FloatingSideRail أو CelebrationsPanel)
        get().playSound(meta.sound);
      },

      sessionStats: { totalQuestions: 0, correctAnswers: 0, participationCount: 0 },
      incrementSessionStat: (key) =>
        set((s) => ({
          sessionStats: {
            ...s.sessionStats,
            [key]: s.sessionStats[key] + 1,
          },
        })),
      resetSessionStats: () =>
        set({ sessionStats: { totalQuestions: 0, correctAnswers: 0, participationCount: 0 } }),

      classLeaderboardSnapshot: [],
      setClassLeaderboardSnapshot: (s) => set({ classLeaderboardSnapshot: s }),

      // 16. الجلسة النشطة (محفوظة في SQLite عبر localDb.sessions)
      currentSessionId: null,
      setCurrentSessionId: (id) => set({ currentSessionId: id }),
      startNewSession: async (name) => {
        try {
          const session = await dbSync.syncSessionStart(get().activeClassId, name);
          if (session?.id) {
            set({ currentSessionId: session.id });
            return session.id;
          }
        } catch (e) {
          console.warn("[shell-store] startNewSession failed:", e);
        }
        return null;
      },
      endCurrentSession: async () => {
        const id = get().currentSessionId;
        if (!id) return;
        // P1-4 fix: pass sessionStats to syncSessionEnd so statsJson is written.
        const stats = get().sessionStats;
        let succeeded = false;
        try {
          await dbSync.syncSessionEnd(id, stats);
          succeeded = true;
        } catch (e) {
          console.warn("[shell-store] endCurrentSession failed:", e);
        }
        // C3 fix (2026-AUG): verify the session hasn't changed during await.
        // If a new session was started while we were ending the old one,
        // don't clobber the new currentSessionId.
        if (succeeded && get().currentSessionId === id) {
          void fetch("/api/telegram", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sendSessionReports", sessionId: id, autoOnly: true }) }).catch((error) => console.warn("[telegram] automatic reports skipped:", error));
          // 🟢 v2: clear the asked-questions pool when the session ends so a
          // new session starts with a fresh question pool.
          set({
            currentSessionId: null,
            sessionStats: { totalQuestions: 0, correctAnswers: 0, participationCount: 0 },
            askedQuestionIds: new Set<string>(),
            aiQuestionPool: [],
          });
          get().resetLessonStats();
        }
      },

      soundVolume: 0.7,
      setSoundVolume: (v) => set({ soundVolume: v }),

      awardGiftToStudent: (studentId, studentName, giftId, giftName, giftImage) => {
        set({
          awardedGiftDisplay: { studentId, studentName, giftId, giftName, giftImage },
        });
        // ===== تسجيل في StudentActivity =====
        const sessionId = get().currentSessionId;
        logStudentActivity(studentId, sessionId, "gift", 0, `هدية: ${giftName}`, { giftId, giftName });
        // P1-9 fix: persist StudentGift to DB (was missing — gifts from QuickGiftPanel were lost on reload)
        dbSync.syncGiftAward(studentId, giftId, giftName, giftImage);
        // صوت ظهور الهدية؛ playSound يحترم mute/volume ويدعم fallback القديم.
        get().playSound("bisalasa-gift-reveal");
        // ===== الإعلان الصوتي =====
        announce("gift-awarded", {
          studentName,
          giftName,
        });
      },

      // ===== v18: Lesson Questions + Game System =====
      lessonQuestions: [],
      setLessonQuestions: (q) => set({ lessonQuestions: q }),
      aiQuestionPool: [],
      setAiQuestionPool: (q) => set({ aiQuestionPool: q }),
      clearAiQuestionPool: () => set({ aiQuestionPool: [] }),
      currentGameQuestion: null,
      setCurrentGameQuestion: (q) => set({ currentGameQuestion: q }),
      gameMode: null,
      setGameMode: (m) => set({ gameMode: m }),
    }),
    {
      // v7.2: DISABLE localStorage persist — SQLite is now the SINGLE source of truth.
      // We still use persist middleware for settings (UI-only state), but NOT for students/lessons
      // (those are managed by SQLite via db-sync.ts).
      name: "bisalasa-shell-store-v10",
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
        return localStorage;
      }),
      partialize: (state) => ({
        // ONLY persist UI settings — NOT students/lessons (SQLite handles those)
        settings: state.settings,
        whiteboardTool: state.whiteboardTool,
        whiteboardColor: state.whiteboardColor,
        whiteboardThickness: state.whiteboardThickness,
        whiteboardShape: state.whiteboardShape,
        soundVolume: state.soundVolume,
        reactionBestMs: state.reactionBestMs,
        // لا نحفظ الطلاب أو الطالب المستدعى في localStorage؛ SQLite هو المصدر
        // الوحيد للحقيقة، ومنع cache قديم هنا يمنع ظهور طالب محذوف لحظيًا بعد reload.
        // الجلسة النشطة تُحفظ أيضاً حتى تعود بعد إعادة التحميل.
        currentSessionId: state.currentSessionId,
        // v8.0.1: remember which lesson/step was active so an accidental
        // reload mid-class doesn't send the teacher back to step 1. The
        // manifest itself is NOT persisted (it's re-derived from the live
        // iframe via the existing MANIFEST handshake) — see IframeStage.tsx.
        activeLessonId: state.activeLessonId,
        currentStep: state.currentStep,
        currentIdeaId: state.currentIdeaId,
        virtualCommentsEnabled: state.virtualCommentsEnabled,
      }),
    }
  )
);

// ====================================================================
//  Helper Hooks
// ====================================================================
export function useCurrentStepData(): SlideStep | null {
  const manifest = useShellStore((s) => s.manifest);
  const currentStep = useShellStore((s) => s.currentStep);
  const currentIdeaId = useShellStore((s) => s.currentIdeaId);
  if (!manifest) return null;
  const steps = getCurrentSteps(manifest, currentIdeaId || undefined);
  return steps[currentStep - 1] || steps.find((s) => s.step === currentStep) || null;
}

export function useLeaderboard() {
  const students = useShellStore((s) => s.students);
  return [...students].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.correctAnswers - a.correctAnswers;
  });
}
