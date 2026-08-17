"use client";

import type { ClassReportAggregate, StudentReportAggregate } from "@/lib/report-contract";
import type { AttendanceAnalytics, ComparativeReport, GamesAnalytics, ParentReportPreferences, ReportTemplate } from "@/lib/reports-telegram-v10";

/**
 * Typed client facade for the unified SQLite API.
 *
 * The application keeps its domain logic in Zustand and talks to SQLite through
 * /api/db/[operation]. Keeping this boundary in one module prevents components
 * from duplicating fetch/error handling and preserves the operation contract.
 */

export interface StudentBadge {
  id?: string;
  studentId?: string;
  type: string;
  note?: string | null;
  awardedAt: string;
}

export interface StudentGift {
  id: string;
  studentId: string;
  giftId: string;
  giftName: string;
  giftImage: string;
  awardedAt: string;
}

export interface Student {
  id: string;
  classId: string | null;
  name: string;
  studentCode?: string | null;
  parentTelegramChatId?: string | null;
  parentTelegramUsername?: string | null;
  parentPhone?: string | null;
  points: number;
  correctAnswers: number;
  wrongAnswers: number;
  attempts: number;
  title?: string | null;
  isAbsent: boolean;
  lastAbsentAt?: string | null;
  lastCalled?: string | null;
  moodleUserId?: number | null;
  moodleUsername?: string | null;
  moodleCourseId?: number | null;
  createdAt: string;
  updatedAt?: string;
  badges?: StudentBadge[];
  gifts?: StudentGift[];
}

export interface ClassRoom {
  id: string;
  name: string;
  description: string;
  color: string;
  createdAt: string;
  updatedAt?: string;
  studentIds?: string[];
}

export interface ImportedLesson {
  id: string;
  lessonId: string;
  fileName: string;
  title: string;
  subtitle: string;
  content: string;
  manifestJson: string;
  importedAt: string;
  updatedAt?: string;
}

export interface CurriculumFactoryDraft {
  id: string;
  title: string;
  grade: string;
  subject: string;
  academicYear: string;
  curriculumKey: string;
  lessonKey: string;
  sourceText: string;
  sourceImagesJson: string;
  stage: number;
  status: "draft" | "review" | "baked" | "archived" | string;
  manifestJson: string;
  questionsJson: string;
  metadataJson: string;
  createdAt: string;
  updatedAt: string;
}

export interface CurriculumPromptTemplate {
  id: string;
  key: string;
  label: string;
  content: string;
  examplesJson: string;
  variablesJson: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CurriculumDraftVersion {
  id: string;
  draftId: string;
  version: number;
  manifestJson: string;
  questionsJson: string;
  reason: string;
  savedAt: string;
}

export interface CurriculumBakeResult {
  draft: CurriculumFactoryDraft;
  lesson: ImportedLesson;
  questionsCount: number;
}

export interface QuestionTemplate {
  id: string;
  title: string;
  subject: string;
  grade: string;
  questionType: string;
  difficulty: string;
  textTemplate: string;
  optionsTemplateJson: string;
  correctAnswerTemplate: string;
  solutionStepsJson: string;
  solutionScript: string;
  tagsJson: string;
  isPublic: boolean;
}

export interface LessonTemplate {
  id: string;
  title: string;
  subject: string;
  grade: string;
  description: string;
  manifestJson: string;
  questionsJson: string;
  isPublic: boolean;
}

export interface Session {
  id: string;
  classId: string | null;
  name: string;
  startedAt: string;
  endedAt?: string | null;
  notes: string;
  statsJson: string;
}

export interface BackupHistoryEntry {
  id: string;
  filename: string;
  fileSize: number;
  reason: string;
  createdAt: string;
}

export interface StatsSummary {
  students: number;
  lessons: number;
  sessions: number;
  gameResults: number;
}

export interface SessionStudentSnapshot {
  id: string;
  sessionId: string;
  studentId: string;
  pointsStart: number;
  correctStart: number;
  wrongStart: number;
  attemptsStart: number;
  badgesCountStart: number;
}

export interface StudentDelta {
  snapshot: SessionStudentSnapshot;
  current: Student;
  delta: { points: number; correct: number; wrong: number; attempts: number };
}

export interface CelebrationRow {
  id: string;
  label: string;
  icon: string;
  color: string;
  color2: string;
  tagline: string;
  hype: string;
  sound: string;
  renderMode?: "confetti" | "particles" | "both";
  isDefault?: boolean;
  isCustom?: boolean;
  sortOrder?: number;
}

export interface StudentNote {
  id: string;
  studentId: string;
  sessionId?: string | null;
  text: string;
  isShared: boolean;
  createdAt: string;
}

export interface StudentActivity {
  id: string;
  studentId: string;
  sessionId?: string | null;
  type: string;
  pointsDelta: number;
  description: string;
  metadataJson: string;
  createdAt: string;
}

export interface CelebrationEvent {
  id: string;
  studentId?: string | null;
  sessionId?: string | null;
  celebrationId: string;
  celebrationLabel: string;
  celebrationIcon: string;
  firedAt: string;
  note?: string | null;
}

export type AiProvider = "google" | "groq" | "openai" | "mistral" | "custom" | "openrouter" | "anthropic" | "together" | "fireworks" | "deepseek" | "cohere" | "perplexity" | "replicate" | "huggingface" | string;
export type AiKeyStatus = "active" | "cooldown" | "failed" | "disabled" | "needs-check" | string;

export interface AiKeySummary {
  id: string;
  label: string;
  provider: AiProvider;
  apiKind?: "provider" | "openai-compatible" | string;
  baseUrl?: string | null;
  modelsUrl?: string | null;
  chatUrl?: string | null;
  keyHint: string;
  model: string;
  isActive: boolean;
  priority: number;
  status: AiKeyStatus;
  specialty?: string;
  scopesJson?: string;
  capabilitiesJson?: string;
  cooldownUntil?: string | null;
  rpmLimit?: number | null;
  dailyLimit?: number | null;
  maxConcurrency: number;
  inFlight: number;
  lastUsedAt?: string | null;
  lastSuccessAt?: string | null;
  lastErrorAt?: string | null;
  lastErrorCode?: string | null;
  lastError?: string | null;
  successCount: number;
  failureCount: number;
  consecutiveFailures: number;
  createdAt: string;
  updatedAt: string;
}

export interface AiDiscoveredModel {
  id: string;
  name: string;
  displayName: string;
  provider: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  ownedBy?: string;
  supportsTextGeneration?: boolean;
}

export interface AiUsageEvent {
  id: string;
  provider: string;
  model: string;
  operation: string;
  keyId?: string | null;
  ok: boolean;
  inputChars: number;
  outputChars: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  actualCostUsd?: number | null;
  requestId?: string | null;
  errorCode?: string | null;
  createdAt: string;
}

export interface MoodleMappingBundle {
  curricula: Array<Record<string, unknown>>;
  lessons: Array<Record<string, unknown>>;
  ideas: Array<Record<string, unknown>>;
  courses: Array<Record<string, unknown>>;
  sections: Array<Record<string, unknown>>;
  groups: Array<Record<string, unknown>>;
  students: Array<Record<string, unknown>>;
  activities: Array<Record<string, unknown>>;
  questions: Array<Record<string, unknown>>;
  homeworks: Array<Record<string, unknown>>;
  cursors: Array<Record<string, unknown>>;
}

export interface MoodleDiscoveryActivity {
  id: number;
  name: string;
  activityType: string;
  sectionId: number | null;
  sectionKey: string | null;
  lessonKey: string;
  ideaKey: string | null;
  mappingMode: "tag" | "metadata" | "order" | "review";
  confidence: number;
  needsReview: boolean;
  orderIndex: number;
  tags: string[];
}

export interface MoodleDiscoveryPayload {
  courseId: number;
  courses: unknown[];
  sections: Array<{ id: number; name: string; sectionKey: string; sectionIndex: number; visible: boolean; activities: MoodleDiscoveryActivity[] }>;
  activities: MoodleDiscoveryActivity[];
  groups: unknown[];
  users: unknown[];
  quizzes: { quizzes?: unknown[] } | unknown[];
  assignments: { courses?: unknown[] } | unknown[];
  tagStats?: { tagged: number; inferred: number; needsReview: number };
  failures: Array<{ resource: string; error: string }>;
  sampledAt: string;
}

export interface SyncSkip {
  skipped: true;
  reason: string;
}

async function apiCall<T = unknown>(
  operation: string,
  args: unknown[] = [],
  method: "POST" | "GET" = "POST",
): Promise<T> {
  const url = method === "GET"
    ? `/api/db/${operation}?_=${Date.now()}`
    : `/api/db/${operation}`;
  const response = await fetch(url, method === "POST"
    ? {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ args }),
      }
    : { method: "GET", cache: "no-store" });

  const payload = await response.json().catch(() => ({ ok: false, error: "Invalid JSON response" }));
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || `DB operation failed: ${operation}`);
  }
  return payload.data as T;
}

export function safeParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

const read = <T>(operation: string, args: unknown[] = []) => apiCall<T>(operation, args, "GET");
const post = <T>(operation: string, args: unknown[] = []) => apiCall<T>(operation, args, "POST");

export const localDb = {
  classes: {
    list: () => read<ClassRoom[]>("classes.list"),
    create: (idOrName: string, nameOrDescription = "", descriptionOrColor = "", color?: string) => {
      // Current callers either pass (id, name, description, color) or the
      // legacy (name, description, color) shape. Argument count is safer than
      // guessing from the human-readable class name.
      if (color !== undefined) {
        return post<ClassRoom>("classes.create", [idOrName, nameOrDescription, descriptionOrColor, color]);
      }
      return post<ClassRoom>("classes.create", [undefined, idOrName, nameOrDescription, descriptionOrColor || "#0142A0"]);
    },
    update: (id: string, patch: Partial<ClassRoom>) => post<ClassRoom>("classes.update", [id, patch]),
    delete: (id: string) => post<void>("classes.delete", [id]),
  },

  students: {
    listByClass: (classId: string | null) => post<Student[]>("students.listByClass", [classId]),
    findByName: (name: string, classId?: string) => post<Student | null>("students.findByName", [name, classId]),
    findByNameInClass: (name: string, classId: string) => post<Pick<Student, "id" | "name"> | null>("students.findByNameInClass", [name, classId]),
    upsert: (studentId: string, classId: string | null, data: Partial<Student>) => post<Student>("students.upsert", [studentId, classId, data]),
    update: (studentId: string, patch: Partial<Student>) => post<Student | SyncSkip>("students.update", [studentId, patch]),
    delete: (studentId: string) => post<Student | SyncSkip>("students.delete", [studentId]),
    awardPoints: (studentId: string, points: number) => post<Student | SyncSkip>("students.awardPoints", [studentId, points]),
    awardCorrect: (studentId: string, points = 3) => post<Student | SyncSkip>("students.awardCorrect", [studentId, points]),
    awardWrong: (studentId: string) => post<Student | SyncSkip>("students.awardWrong", [studentId]),
    awardGoodTry: (studentId: string) => post<Student | SyncSkip>("students.awardGoodTry", [studentId]),
    awardBadge: (studentId: string, type: string, note?: string) => post<StudentBadge | SyncSkip>("students.awardBadge", [studentId, type, note]),
    resetSession: (classId?: string) => post<{ count: number }>("students.resetSession", [classId]),
    setAbsent: (studentId: string, isAbsent: boolean) => post<Student | SyncSkip>("students.setAbsent", [studentId, isAbsent]),
    setLastAbsentAt: (studentId: string, isoTimestamp: string | null) => post<Student | SyncSkip>("students.update", [studentId, { lastAbsentAt: isoTimestamp }]),
    setTitle: (studentId: string, title: string) => post<Student | SyncSkip>("students.setTitle", [studentId, title]),
  },

  groups: {
    list: (classId: string) => post<Array<Record<string, unknown>>>("groups.list", [classId]),
    save: (group: Record<string, unknown>) => post<Record<string, unknown>>("groups.save", [group]),
    delete: (id: string) => post<void>("groups.delete", [id]),
    addPoints: (id: string, points: number) => post<Record<string, unknown>>("groups.addPoints", [id, points]),
    autoSplit: (classId: string, numGroups = 4) => post<Array<Record<string, unknown>>>("groups.autoSplit", [classId, numGroups]),
  },

  lessons: {
    list: () => post<ImportedLesson[]>("lessons.list"),
    upsert: (lesson: Omit<ImportedLesson, "id" | "importedAt" | "updatedAt"> & Partial<Pick<ImportedLesson, "id">>) => post<ImportedLesson>("lessons.upsert", [lesson]),
    delete: (id: string) => post<void>("lessons.delete", [id]),
  },

  curriculumFactory: {
    listDrafts: (limit = 30) => post<CurriculumFactoryDraft[]>("curriculumFactoryDrafts.list", [limit]),
    getDraft: (id: string) => post<CurriculumFactoryDraft | null>("curriculumFactoryDrafts.get", [id]),
    upsertDraft: (draft: Partial<CurriculumFactoryDraft> & { manifestJson: string; questionsJson: string }) => post<CurriculumFactoryDraft>("curriculumFactoryDrafts.upsert", [draft]),
    deleteDraft: (id: string) => post<void>("curriculumFactoryDrafts.delete", [id]),
    listVersions: (draftId: string) => post<CurriculumDraftVersion[]>("curriculumFactoryDrafts.versions", [draftId]),
    restoreVersion: (draftId: string, versionId: string) => post<CurriculumFactoryDraft>("curriculumFactoryDrafts.restoreVersion", [{ draftId, versionId }]),
    bakeDraft: (draftId: string, content?: string) => post<CurriculumBakeResult>("curriculumFactoryDrafts.bake", [{ draftId, content }]),
    listPrompts: () => post<CurriculumPromptTemplate[]>("curriculumPromptTemplates.list"),
    savePrompt: (prompt: { key: string; label: string; content: string; examples?: Array<{ input: string; output: string }>; variables?: Array<{ name: string; description: string }>; isDefault?: boolean }) => post<CurriculumPromptTemplate>("curriculumPromptTemplates.save", [prompt]),
    seedPrompts: () => post<{ seeded: number }>("curriculumPromptTemplates.seedDefaults"),
    listQuestionTemplates: (filters?: { subject?: string; grade?: string; questionType?: string }) => post<QuestionTemplate[]>("questionTemplates.list", [filters ?? {}]),
    saveQuestionTemplate: (template: Record<string, unknown>) => post<QuestionTemplate>("questionTemplates.save", [template]),
    seedQuestionTemplates: () => post<{ seeded: number }>("questionTemplates.seedDefaults"),
    listLessonTemplates: (filters?: { subject?: string; grade?: string }) => post<LessonTemplate[]>("lessonTemplates.list", [filters ?? {}]),
    saveLessonTemplate: (template: Record<string, unknown>) => post<LessonTemplate>("lessonTemplates.save", [template]),
  },

  questions: {
    listByLesson: (lessonId: string) => post<Array<Record<string, unknown>>>("questions.listByLesson", [lessonId]),
    listByIdea: (lessonId: string, ideaId: string) => post<Array<Record<string, unknown>>>("questions.listByIdea", [lessonId, ideaId]),
    create: (question: Record<string, unknown>) => post<Record<string, unknown>>("questions.create", [question]),
    bulkCreate: (questions: Array<Record<string, unknown>>) => post<{ count: number }>("questions.bulkCreate", [questions]),
  },

  prizes: {
    list: () => read<Array<Record<string, unknown>>>("prizes.list"),
    save: (prize: Record<string, unknown>) => post<Record<string, unknown>>("prizes.save", [prize]),
    delete: (id: string) => post<void>("prizes.delete", [id]),
  },

  gifts: {
    list: () => read<Array<Record<string, unknown>>>("gifts.list"),
    save: (gift: Record<string, unknown>) => post<Record<string, unknown>>("gifts.save", [gift]),
    delete: (id: string) => post<void>("gifts.delete", [id]),
    awardToStudent: (studentId: string, giftId: string, giftName: string, giftImage: string) => post<StudentGift>("gifts.awardToStudent", [studentId, giftId, giftName, giftImage]),
    listByStudent: (studentId: string) => post<StudentGift[]>("gifts.listByStudent", [studentId]),
  },

  rewardsV10: {
    listCustomBadges: () => post<Array<Record<string, unknown>>>("customBadges.list"),
    saveCustomBadge: (badge: Record<string, unknown>) => post<Record<string, unknown>>("customBadges.save", [badge]),
    deleteCustomBadge: (id: string) => post<Record<string, unknown>>("customBadges.delete", [id]),
    upsertBadgeProgress: (studentId: string, badgeId: string, level: string, count: number) => post<Record<string, unknown>>("badgeProgress.upsert", [studentId, badgeId, level, count]),
    listAchievements: () => post<Array<Record<string, unknown>>>("achievements.list"),
    saveAchievement: (achievement: Record<string, unknown>) => post<Record<string, unknown>>("achievements.save", [achievement]),
    deleteAchievement: (id: string) => post<Record<string, unknown>>("achievements.delete", [id]),
    unlockAchievement: (studentId: string, achievementId: string, sessionId?: string | null) => post<Record<string, unknown>>("achievements.unlock", [studentId, achievementId, sessionId]),
    listGiftCombos: () => post<Array<Record<string, unknown>>>("giftCombos.list"),
    saveGiftCombo: (combo: Record<string, unknown>) => post<Record<string, unknown>>("giftCombos.save", [combo]),
    deleteGiftCombo: (id: string) => post<Record<string, unknown>>("giftCombos.delete", [id]),
    awardGiftCombo: (studentId: string, comboId: string, sessionId?: string | null, eventKey?: string) => post<Record<string, unknown>>("giftCombos.award", [studentId, comboId, sessionId, eventKey]),
    listSequences: () => post<Array<Record<string, unknown>>>("celebrationSequences.list"),
    saveSequence: (sequence: Record<string, unknown>) => post<Record<string, unknown>>("celebrationSequences.save", [sequence]),
    deleteSequence: (id: string) => post<Record<string, unknown>>("celebrationSequences.delete", [id]),
    getAudioProfile: () => post<Record<string, unknown> | null>("audioProfiles.get"),
    saveAudioProfile: (profile: Record<string, unknown>) => post<Record<string, unknown>>("audioProfiles.save", [profile]),
    listRewardEvents: (studentId: string, limit = 100) => post<Array<Record<string, unknown>>>("rewardEvents.listByStudent", [studentId, limit]),
  },

  attendance: {
    save: (classId: string, date: string, absentStudentIds: string[]) => post<Record<string, unknown>>("attendance.save", [classId, date, absentStudentIds]),
    list: (classId: string) => post<Array<Record<string, unknown>>>("attendance.list", [classId]),
  },

  sessions: {
    start: (classId: string | null, name = "جلسة جديدة") => post<Session>("sessions.start", [classId, name]),
    end: (sessionId: string, stats?: { totalQuestions: number; correctAnswers: number; participationCount: number }) => post<Session | null>("sessions.end", [sessionId, stats]),
    list: (classId?: string) => post<Session[]>("sessions.list", [classId]),
    snapshotStudents: (sessionId: string) => post<SessionStudentSnapshot[]>("sessions.snapshotStudents", [sessionId]),
    getStudentDelta: (sessionId: string, studentId: string) => post<StudentDelta | null>("sessions.getStudentDelta", [sessionId, studentId]),
  },

  gameTemplates: {
    list: () => post<Array<Record<string, unknown>>>("gameTemplates.list"),
    save: (template: Record<string, unknown>) => post<Record<string, unknown>>("gameTemplates.save", [template]),
    delete: (id: string) => post<Record<string, unknown>>("gameTemplates.delete", [id]),
  },

  tournaments: {
    list: () => post<Array<Record<string, unknown>>>("tournaments.list"),
    save: (tournament: Record<string, unknown>) => post<Record<string, unknown>>("tournaments.save", [tournament]),
    delete: (id: string) => post<Record<string, unknown>>("tournaments.delete", [id]),
  },

  gameResults: {
    create: (data: Record<string, unknown>) => post<Record<string, unknown>>("gameResults.create", [data]),
    addParticipant: (data: Record<string, unknown>) => post<Record<string, unknown>>("gameResults.addParticipant", [data]),
    addQuestion: (data: Record<string, unknown>) => post<Record<string, unknown>>("gameResults.addQuestion", [data]),
    complete: (data: Record<string, unknown>) => post<Record<string, unknown>>("gameResults.complete", [data]),
    listRecent: (limit = 20) => post<Array<Record<string, unknown>>>("gameResults.listRecent", [limit]),
  },

  sounds: {
    list: () => read<Array<Record<string, unknown>>>("sounds.list"),
    save: (sound: Record<string, unknown>) => post<Record<string, unknown>>("sounds.save", [sound]),
    delete: (id: string) => post<void>("sounds.delete", [id]),
  },

  celebration: {
    list: () => post<CelebrationRow[]>("celebrations.list"),
    save: (celebration: Record<string, unknown>) => post<Record<string, unknown>>("celebrations.save", [celebration]),
    delete: (id: string) => post<void>("celebrations.delete", [id]),
    seedDefaults: (defaults: Array<Record<string, unknown>>) => post<{ seeded: number }>("celebrations.seedDefaults", [defaults]),
  },

  celebrationEvents: {
    create: (data: Record<string, unknown>) => post<CelebrationEvent>("celebrationEvents.create", [data]),
    listByStudent: (studentId: string, sessionId?: string) => post<CelebrationEvent[]>("celebrationEvents.listByStudent", [studentId, sessionId]),
    listBySession: (sessionId: string) => post<CelebrationEvent[]>("celebrationEvents.listBySession", [sessionId]),
  },

  studentNotes: {
    create: (data: { studentId: string; sessionId?: string | null; text: string; isShared?: boolean }) => post<StudentNote>("studentNotes.create", [data]),
    listByStudent: (studentId: string, sessionId?: string) => post<StudentNote[]>("studentNotes.listByStudent", [studentId, sessionId]),
    listBySession: (sessionId: string) => post<StudentNote[]>("studentNotes.listBySession", [sessionId]),
    search: (data: { query?: string; studentId?: string; sharedOnly?: boolean; limit?: number }) => post<StudentNote[]>("studentNotes.search", [data]),
    markShared: (id: string) => post<StudentNote>("studentNotes.markShared", [id]),
  },

  studentActivities: {
    create: (data: Record<string, unknown>) => post<StudentActivity>("studentActivities.create", [data]),
    listByStudent: (studentId: string, sessionId?: string) => post<StudentActivity[]>("studentActivities.listByStudent", [studentId, sessionId]),
    listBySession: (sessionId: string) => post<StudentActivity[]>("studentActivities.listBySession", [sessionId]),
    aggregateByType: (studentId: string, sessionId?: string) => post<Array<{ type: string; count: number; pointsDelta: number }>>("studentActivities.aggregateByType", [studentId, sessionId]),
  },

  studentTimeline: {
    list: (studentId: string, limit = 100) => post<Array<{ id: string; kind: string; type: string; text: string; pointsDelta: number; createdAt: string; isShared?: boolean }>>("students.timeline", [{ studentId, limit }]),
  },

  settings: {
    get: () => post<Record<string, unknown>>("settings.get"),
    set: (settings: Record<string, unknown>) => post<Record<string, unknown>>("settings.set", [settings]),
    profilesList: (classId?: string | null) => post<Array<Record<string, unknown>>>("settings.profiles.list", [classId ?? null]),
    saveProfile: (profile: Record<string, unknown>) => post<Record<string, unknown> | { conflict: true; current: Record<string, unknown> }>("settings.profiles.save", [profile]),
    deleteProfile: (id: string) => post<Record<string, unknown>>("settings.profiles.delete", [id]),
  },
  aiV10: {
    listConversations: (filter?: { lessonId?: string; ideaId?: string }) => post<Array<Record<string, unknown>>>("ai.conversations.list", [filter ?? {}]),
    createConversation: (data: Record<string, unknown>) => post<Record<string, unknown>>("ai.conversations.create", [data]),
    addConversationMessage: (data: Record<string, unknown>) => post<Record<string, unknown>>("ai.conversations.message", [data]),
    deleteConversation: (id: string) => post<Record<string, unknown>>("ai.conversations.delete", [id]),
    listMemory: (filter?: { lessonId?: string; ideaId?: string }) => post<Array<Record<string, unknown>>>("ai.memory.list", [filter ?? {}]),
    upsertMemory: (data: Record<string, unknown>) => post<Record<string, unknown>>("ai.memory.upsert", [data]),
    deleteMemory: (id: string) => post<Record<string, unknown>>("ai.memory.delete", [id]),
    listRetry: (status?: string) => post<Array<Record<string, unknown>>>("ai.retry.list", [status]),
    enqueueRetry: (data: Record<string, unknown>) => post<Record<string, unknown>>("ai.retry.enqueue", [data]),
    claimRetry: () => post<Record<string, unknown> | null>("ai.retry.claim"),
    completeRetry: (id: string) => post<Record<string, unknown>>("ai.retry.complete", [id]),
    failRetry: (data: Record<string, unknown>) => post<Record<string, unknown>>("ai.retry.fail", [data]),
    listPrompts: (category?: string) => post<Array<Record<string, unknown>>>("ai.prompts.list", [category]),
    savePrompt: (data: Record<string, unknown>) => post<Record<string, unknown>>("ai.prompts.save", [data]),
    deletePrompt: (id: string) => post<Record<string, unknown>>("ai.prompts.delete", [id]),
    upsertEmbedding: (data: Record<string, unknown>) => post<Record<string, unknown>>("ai.embeddings.upsert", [data]),
    listEmbeddings: (lessonId?: string) => post<Array<Record<string, unknown>>>("ai.embeddings.list", [lessonId]),
    listWebhooks: () => post<Array<Record<string, unknown>>>("webhooks.list"),
    saveWebhook: (data: Record<string, unknown>) => post<Record<string, unknown>>("webhooks.save", [data]),
    deleteWebhook: (id: string) => post<Record<string, unknown>>("webhooks.delete", [id]),
  },

  backup: {
    list: () => post<BackupHistoryEntry[]>("backup.list"),
    record: (filename: string, fileSize: number, reason = "manual") => post<BackupHistoryEntry>("backup.record", [filename, fileSize, reason]),
  },

  stats: {
    summary: (classId?: string) => post<StatsSummary>("stats.summary", [classId]),
  },

  moodleResults: {
    ideaAttemptUpsert: (data: Record<string, unknown>) => post<Record<string, unknown>>("moodleResults.ideaAttemptUpsert", [data]),
    homeworkSnapshotUpsert: (data: Record<string, unknown>) => post<Record<string, unknown>>("moodleResults.homeworkSnapshotUpsert", [data]),
    homeworkQuestionUpsert: (data: Record<string, unknown>) => post<Record<string, unknown>>("moodleResults.homeworkQuestionUpsert", [data]),
    studentSummary: (data: Record<string, unknown>) => post<Record<string, unknown>>("moodleResults.studentSummary", [data]),
    classSummary: (data: Record<string, unknown>) => post<Record<string, unknown>>("moodleResults.classSummary", [data]),
  },

  reports: {
    student: (data: { studentId: string; sessionId?: string | null; classId?: string | null }) => post<StudentReportAggregate | null>("reports.student", [data]),
    class: (data: { sessionId?: string | null; classId?: string | null }) => post<ClassReportAggregate>("reports.class", [data]),
    compare: (data: { classAId: string; classBId: string; sessionId?: string | null }) => post<ComparativeReport>("reports.compare", [data]),
    attendance: (data: { classId: string; start?: string; end?: string }) => post<AttendanceAnalytics>("reports.attendance", [data]),
    games: (data: { classId?: string | null; sessionId?: string | null }) => post<GamesAnalytics>("reports.games", [data]),
    teacher: (data: { classId?: string | null; sessionId?: string | null }) => post<Record<string, unknown>>("reports.teacher", [data]),
    listTemplates: (data: { kind?: string; classId?: string | null } = {}) => post<ReportTemplate[]>("reports.templates.list", [data]),
    saveTemplate: (data: Record<string, unknown>) => post<Record<string, unknown>>("reports.templates.save", [data]),
    deleteTemplate: (id: string) => post<Record<string, unknown>>("reports.templates.delete", [id]),
    listSchedules: (classId?: string | null) => post<Record<string, unknown>[]>("reports.schedules.list", [classId]),
    saveSchedule: (data: Record<string, unknown>) => post<Record<string, unknown>>("reports.schedules.save", [data]),
    deleteSchedule: (id: string) => post<Record<string, unknown>>("reports.schedules.delete", [id]),
    claimSchedule: () => post<Record<string, unknown> | null>("reports.schedules.claim"),
    completeSchedule: (data: Record<string, unknown>) => post<Record<string, unknown>>("reports.schedules.complete", [data]),
    failSchedule: (data: Record<string, unknown>) => post<Record<string, unknown>>("reports.schedules.fail", [data]),
  },

  telegramV10: {
    getPreferences: (studentId: string) => post<Record<string, unknown> | null>("telegram.preferences.get", [studentId]),
    savePreferences: (data: Partial<ParentReportPreferences> & { studentId: string; chatId: string; revision?: number }) => post<Record<string, unknown>>("telegram.preferences.save", [data]),
    listTemplates: (data: { type?: string; language?: string } = {}) => post<Record<string, unknown>[]>("telegram.templates.list", [data]),
    saveTemplate: (data: Record<string, unknown>) => post<Record<string, unknown>>("telegram.templates.save", [data]),
    deleteTemplate: (id: string) => post<Record<string, unknown>>("telegram.templates.delete", [id]),
    listQueue: (status?: string) => post<Record<string, unknown>[]>("telegram.queue.list", [status]),
    enqueue: (data: Record<string, unknown>) => post<Record<string, unknown>>("telegram.queue.enqueue", [data]),
    claim: () => post<Record<string, unknown> | null>("telegram.queue.claim"),
    complete: (id: string) => post<Record<string, unknown>>("telegram.queue.complete", [id]),
    fail: (data: Record<string, unknown>) => post<Record<string, unknown>>("telegram.queue.fail", [data]),
  },

  moodleMappings: {
    list: (scope?: { curriculumKey?: string; lessonKey?: string }) => post<MoodleMappingBundle>("moodleMappings.list", [scope ?? {}]),
    saveCurriculum: (data: Record<string, unknown>) => post<Record<string, unknown>>("moodleMappings.saveCurriculum", [data]),
    saveLesson: (data: Record<string, unknown>) => post<Record<string, unknown>>("moodleMappings.saveLesson", [data]),
    saveIdea: (data: Record<string, unknown>) => post<Record<string, unknown>>("moodleMappings.saveIdea", [data]),
    saveCourse: (data: Record<string, unknown>) => post<Record<string, unknown>>("moodleMappings.saveCourse", [data]),
    saveSection: (data: Record<string, unknown>) => post<Record<string, unknown>>("moodleMappings.saveSection", [data]),
    saveGroup: (data: Record<string, unknown>) => post<Record<string, unknown>>("moodleMappings.saveGroup", [data]),
    saveStudent: (data: Record<string, unknown>) => post<Record<string, unknown>>("moodleMappings.saveStudent", [data]),
    saveActivity: (data: Record<string, unknown>) => post<Record<string, unknown>>("moodleMappings.saveActivity", [data]),
    saveQuestion: (data: Record<string, unknown>) => post<Record<string, unknown>>("moodleMappings.saveQuestion", [data]),
    saveHomework: (data: Record<string, unknown>) => post<Record<string, unknown>>("moodleMappings.saveHomework", [data]),
    saveCursor: (data: Record<string, unknown>) => post<Record<string, unknown>>("moodleMappings.saveCursor", [data]),
  },
} as const;

export const aiClient = {
  async listKeys(): Promise<{ keys: AiKeySummary[]; envConfigured: boolean }> {
    const response = await fetch(`/api/ai?resource=keys&_=${Date.now()}`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({ ok: false, error: "استجابة AI غير صالحة" }));
    if (!response.ok || !payload?.ok) throw new Error(payload?.error || "تعذر قراءة مفاتيح AI");
    return payload.data as { keys: AiKeySummary[]; envConfigured: boolean };
  },
  async listUsage(): Promise<AiUsageEvent[]> {
    const response = await fetch(`/api/ai?resource=usage&_=${Date.now()}`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({ ok: false, error: "استجابة AI غير صالحة" }));
    if (!response.ok || !payload?.ok) throw new Error(payload?.error || "تعذر قراءة استخدام AI");
    return payload.data as AiUsageEvent[];
  },
  async listModels(input: { provider: AiProvider; keyId?: string }) {
    const params = new URLSearchParams({ resource: "models", provider: input.provider });
    if (input.keyId) params.set("keyId", input.keyId);
    const response = await fetch(`/api/ai?${params.toString()}&_=${Date.now()}`, { cache: "no-store" });
    const payload = await response.json().catch(() => ({ ok: false, error: "استجابة النماذج غير صالحة" }));
    if (!response.ok || !payload?.ok) throw new Error(payload?.error || "تعذر جلب الموديلات");
    return payload.data as AiDiscoveredModel[];
  },
  async previewModels(input: { provider: AiProvider; key: string; baseUrl?: string; modelsUrl?: string; chatUrl?: string }) {
    return aiPost<AiDiscoveredModel[]>({ action: "keys.modelsPreview", ...input });
  },
  async createKey(input: { label: string; key: string; provider?: AiProvider | string; apiKind?: string; baseUrl?: string; modelsUrl?: string; chatUrl?: string; model?: string; specialty?: string; scopesJson?: string; capabilitiesJson?: string; priority?: number; isActive?: boolean; maxConcurrency?: number; rpmLimit?: number | null; dailyLimit?: number | null }) {
    return aiPost<{ id: string; label: string; provider: AiProvider; apiKind?: string; baseUrl?: string | null; modelsUrl?: string | null; keyHint: string; model: string; isActive: boolean; priority: number; status: AiKeyStatus }>({ action: "keys.create", ...input });
  },
  async updateKey(input: { id: string; label?: string; key?: string; provider?: AiProvider | string; apiKind?: string; baseUrl?: string | null; modelsUrl?: string | null; chatUrl?: string | null; model?: string; specialty?: string; scopesJson?: string; capabilitiesJson?: string; priority?: number; isActive?: boolean; maxConcurrency?: number; rpmLimit?: number | null; dailyLimit?: number | null }) {
    return aiPost<{ id: string; label: string; provider: AiProvider; apiKind?: string; baseUrl?: string | null; modelsUrl?: string | null; keyHint: string; model: string; isActive: boolean; priority: number; status: AiKeyStatus }>({ action: "keys.update", ...input });
  },
  async reactivateKey(id: string) {
    return aiPost<{ id: string; status: AiKeyStatus; isActive: boolean }>({ action: "keys.reactivate", id });
  },
  async deleteKey(id: string) {
    return aiPost<{ deleted: boolean }>({ action: "keys.delete", id });
  },
  async testKey(id?: string, model?: string) {
    return aiPost<{ connected: boolean; provider: AiProvider; model: string; keyId: string | null; preview: string }>({ action: "keys.test", id, model });
  },
  async generate(input: { input: string; systemInstruction?: string; model?: string; keyId?: string; temperature?: number; maxOutputTokens?: number; operation?: string; conversationId?: string; images?: Array<{ url: string; detail?: string }>; tools?: unknown[] }) {
    return aiPost<{ text: string; provider: AiProvider; model: string; keyId: string | null; usage?: { inputTokens: number; outputTokens: number; totalTokens: number; estimatedCostUsd: number } }>({ action: "generate", ...input });
  },
  async testPrompt(input: { prompt: string; sampleInput: string; model?: string; keyId?: string; temperature?: number; maxOutputTokens?: number }) {
    return aiPost<{ text: string; provider: AiProvider; model: string; keyId: string | null; usage?: { inputTokens: number; outputTokens: number; totalTokens: number; estimatedCostUsd: number } }>({ action: "promptTest", ...input });
  },
  async compareModels(input: { input: string; systemInstruction?: string; models: Array<{ model: string; keyId?: string }>; temperature?: number; maxOutputTokens?: number }) {
    return aiPost<Array<{ text: string; model: string; provider: AiProvider; keyId: string | null; usage?: { inputTokens: number; outputTokens: number; totalTokens: number; estimatedCostUsd: number } }>>({ action: "compare", ...input });
  },
  async stream(input: { input: string; systemInstruction?: string; model?: string; keyId?: string; temperature?: number; maxOutputTokens?: number; operation?: string; onChunk: (chunk: string) => void }) {
    const response = await fetch("/api/ai/stream", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, onChunk: undefined }) });
    if (!response.ok || !response.body) throw new Error("تعذر تشغيل الاستجابة التدريجية");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) { const { value, done } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const lines = buffer.split("\n"); buffer = lines.pop() ?? ""; for (const line of lines) { if (!line.startsWith("data: ")) continue; const data = JSON.parse(line.slice(6)); if (data.text) input.onChunk(String(data.text)); if (data.error) throw new Error(String(data.error)); } }
    return true;
  },
  async analyzeLesson(input: { input: string; model?: string; keyId?: string; temperature?: number; maxOutputTokens?: number }) {
    return aiPost<{ result: Record<string, unknown>; provider: AiProvider; model: string; keyId: string | null }>({ action: "analyzeLesson", ...input });
  },
  async generateQuestions(input: { input: string; lessonId?: string; count?: number; model?: string; keyId?: string; temperature?: number; maxOutputTokens?: number }) {
    return aiPost<{ questions: Array<Record<string, unknown>>; rejected: Array<{ errors: string[] }>; provider: AiProvider; model: string; keyId: string | null }>({ action: "generateQuestions", ...input });
  },
  async whiteboardAssist(input: { input: string; model?: string; keyId?: string; temperature?: number; maxOutputTokens?: number }) {
    return aiPost<{ result: Record<string, unknown>; provider: AiProvider; model: string; keyId: string | null }>({ action: "whiteboardAssist", ...input });
  },
};

async function aiPost<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({ ok: false, error: "استجابة AI غير صالحة" }));
  if (!response.ok || !payload?.ok) throw new Error(payload?.error || "فشل طلب AI");
  return payload.data as T;
}

