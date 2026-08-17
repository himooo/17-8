// ====================================================================
//  Unified DB Access API - Bisalasa v6.0
//  POST /api/db/[operation] with body = { args: [...] }
//  All operations are server-side; client calls go through /lib/local-db.ts
// ====================================================================
import { NextRequest, NextResponse } from "next/server";
import { db, dbReady } from "@/lib/db";
import { buildClassReport, buildStudentReport } from "@/lib/report-aggregator";
import { buildAttendanceAnalytics, buildComparativeReport, buildGamesAnalytics, buildTeacherReflection, DEFAULT_REPORT_TEMPLATES, normalizeReportTemplate, parentSections } from "@/lib/reports-telegram-v10";
import { Prisma } from "@prisma/client";
import { validateQuestionInput } from "@/lib/question-contract";
import crypto from "node:crypto";

class ApiInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiInputError";
  }
}

// This route fronts mutable classroom data. Caching a GET response here can
// leave the UI permanently stale after a create/update/delete operation.
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Whitelist of allowed operations to prevent arbitrary execution
type OpName =
  | "classes.list"
  | "classes.create"
  | "classes.update"
  | "classes.delete"
  | "students.list"
  | "students.listByClass"
  | "students.findByName"
  | "students.findByNameInClass"
  | "students.upsert"
  | "students.update"
  | "students.delete"
  | "students.awardPoints"
  | "students.awardCorrect"
  | "students.awardWrong"
  | "students.awardGoodTry"
  | "students.awardBadge"
  | "students.resetSession"
  | "students.setAbsent"
  | "students.setTitle"
  | "groups.list"
  | "groups.save"
  | "groups.delete"
  | "groups.addPoints"
  | "groups.autoSplit"
  | "lessons.list"
  | "lessons.upsert"
  | "lessons.delete"
  | "curriculumFactoryDrafts.list"
  | "curriculumFactoryDrafts.get"
  | "curriculumFactoryDrafts.upsert"
  | "curriculumFactoryDrafts.delete"
  | "curriculumFactoryDrafts.versions"
  | "curriculumFactoryDrafts.restoreVersion"
  | "curriculumFactoryDrafts.bake"
  | "curriculumPromptTemplates.list"
  | "curriculumPromptTemplates.save"
  | "curriculumPromptTemplates.seedDefaults"
  | "questionTemplates.list"
  | "questionTemplates.save"
  | "questionTemplates.seedDefaults"
  | "lessonTemplates.list"
  | "lessonTemplates.save"
  | "questions.list"
  | "questions.listByLesson"
  | "questions.listByIdea"
  | "questions.create"
  | "questions.bulkCreate"
  | "prizes.list"
  | "prizes.save"
  | "prizes.delete"
  | "gifts.list"
  | "gifts.save"
  | "gifts.delete"
  | "gifts.awardToStudent"
  | "gifts.listByStudent"
  | "customBadges.list"
  | "customBadges.save"
  | "customBadges.delete"
  | "badgeProgress.upsert"
  | "achievements.list"
  | "achievements.save"
  | "achievements.delete"
  | "achievements.unlock"
  | "giftCombos.list"
  | "giftCombos.save"
  | "giftCombos.delete"
  | "giftCombos.award"
  | "celebrationSequences.list"
  | "celebrationSequences.save"
  | "celebrationSequences.delete"
  | "audioProfiles.get"
  | "audioProfiles.save"
  | "rewardEvents.listByStudent"
  | "attendance.save"
  | "attendance.list"
  | "sessions.start"
  | "sessions.end"
  | "sessions.list"
  | "sessions.snapshotStudents"
  | "sessions.getStudentDelta"
  | "gameTemplates.list"
  | "gameTemplates.save"
  | "gameTemplates.delete"
  | "tournaments.list"
  | "tournaments.save"
  | "tournaments.delete"
  | "gameResults.create"
  | "gameResults.addParticipant"
  | "gameResults.addQuestion"
  | "gameResults.complete"
  | "gameResults.listRecent"
  | "sounds.list"
  | "sounds.save"
  | "sounds.delete"
  | "celebrations.list"
  | "celebrations.save"
  | "celebrations.delete"
  | "celebrations.seedDefaults"
  | "celebrationEvents.create"
  | "celebrationEvents.listByStudent"
  | "celebrationEvents.listBySession"
  | "studentNotes.create"
  | "studentNotes.listByStudent"
  | "studentNotes.listBySession"
  | "studentNotes.search"
  | "studentNotes.markShared"
  | "studentActivities.create"
  | "studentActivities.listByStudent"
  | "studentActivities.listBySession"
  | "studentActivities.aggregateByType"
  | "students.timeline"
  | "settings.get"
  | "settings.set"
  | "settings.profiles.list"
  | "settings.profiles.save"
  | "settings.profiles.delete"
  | "ai.conversations.list"
  | "ai.conversations.create"
  | "ai.conversations.message"
  | "ai.conversations.delete"
  | "ai.memory.list"
  | "ai.memory.upsert"
  | "ai.memory.delete"
  | "ai.retry.list"
  | "ai.retry.enqueue"
  | "ai.retry.claim"
  | "ai.retry.complete"
  | "ai.retry.fail"
  | "ai.prompts.list"
  | "ai.prompts.save"
  | "ai.prompts.delete"
  | "ai.embeddings.upsert"
  | "ai.embeddings.list"
  | "webhooks.list"
  | "webhooks.save"
  | "webhooks.delete"
  | "backup.list"
  | "backup.record"
  | "stats.summary"
  | "moodleMappings.list"
  | "moodleMappings.saveCurriculum"
  | "moodleMappings.saveLesson"
  | "moodleMappings.saveIdea"
  | "moodleMappings.saveCourse"
  | "moodleMappings.saveSection"
  | "moodleMappings.saveGroup"
  | "moodleMappings.saveStudent"
  | "moodleMappings.saveActivity"
  | "moodleMappings.saveQuestion"
  | "moodleMappings.saveHomework"
  | "moodleMappings.saveCursor"
  | "moodleResults.ideaRunCreate"
  | "moodleResults.ideaAttemptUpsert"
  | "moodleResults.homeworkSnapshotUpsert"
  | "moodleResults.homeworkQuestionUpsert"
  | "moodleResults.studentSummary"
  | "moodleResults.classSummary"
  | "reports.student"
  | "reports.class"
  | "reports.compare"
  | "reports.attendance"
  | "reports.games"
  | "reports.teacher"
  | "reports.templates.list"
  | "reports.templates.save"
  | "reports.templates.delete"
  | "reports.schedules.list"
  | "reports.schedules.save"
  | "reports.schedules.delete"
  | "reports.schedules.claim"
  | "reports.schedules.complete"
  | "reports.schedules.fail"
  | "telegram.preferences.get"
  | "telegram.preferences.save"
  | "telegram.templates.list"
  | "telegram.templates.save"
  | "telegram.templates.delete"
  | "telegram.queue.list"
  | "telegram.queue.enqueue"
  | "telegram.queue.claim"
  | "telegram.queue.complete"
  | "telegram.queue.fail"
;

const ALLOWED: Set<OpName> = new Set<OpName>([
  "classes.list","classes.create","classes.update","classes.delete",
  "students.list","students.listByClass","students.findByName","students.findByNameInClass","students.upsert","students.update","students.delete",
  "students.awardPoints","students.awardCorrect","students.awardWrong","students.awardGoodTry","students.awardBadge","students.resetSession","students.setAbsent","students.setTitle",
  "groups.list","groups.save","groups.delete","groups.addPoints","groups.autoSplit",
  "lessons.list","lessons.upsert","lessons.delete",
  "curriculumFactoryDrafts.list","curriculumFactoryDrafts.get","curriculumFactoryDrafts.upsert","curriculumFactoryDrafts.delete","curriculumFactoryDrafts.versions","curriculumFactoryDrafts.restoreVersion","curriculumFactoryDrafts.bake",
  "curriculumPromptTemplates.list","curriculumPromptTemplates.save","curriculumPromptTemplates.seedDefaults",
  "questionTemplates.list","questionTemplates.save","questionTemplates.seedDefaults","lessonTemplates.list","lessonTemplates.save",
  "questions.list","questions.listByLesson","questions.listByIdea","questions.create","questions.bulkCreate",
  "prizes.list","prizes.save","prizes.delete",
  "gifts.list","gifts.save","gifts.delete","gifts.awardToStudent","gifts.listByStudent",
  "customBadges.list","customBadges.save","customBadges.delete","badgeProgress.upsert",
  "achievements.list","achievements.save","achievements.delete","achievements.unlock",
  "giftCombos.list","giftCombos.save","giftCombos.delete","giftCombos.award",
  "celebrationSequences.list","celebrationSequences.save","celebrationSequences.delete",
  "audioProfiles.get","audioProfiles.save","rewardEvents.listByStudent",
  "attendance.save","attendance.list",
  "sessions.start","sessions.end","sessions.list","sessions.snapshotStudents","sessions.getStudentDelta",
  "gameTemplates.list","gameTemplates.save","gameTemplates.delete",
  "tournaments.list","tournaments.save","tournaments.delete",
  "gameResults.create","gameResults.addParticipant","gameResults.addQuestion","gameResults.complete","gameResults.listRecent",
  "sounds.list","sounds.save","sounds.delete",
  "celebrations.list","celebrations.save","celebrations.delete","celebrations.seedDefaults",
  "celebrationEvents.create","celebrationEvents.listByStudent","celebrationEvents.listBySession",
  "studentNotes.create","studentNotes.listByStudent","studentNotes.listBySession","studentNotes.search","studentNotes.markShared",
  "studentActivities.create","studentActivities.listByStudent","studentActivities.listBySession","studentActivities.aggregateByType","students.timeline",
  "settings.get","settings.set","settings.profiles.list","settings.profiles.save","settings.profiles.delete",
  "ai.conversations.list","ai.conversations.create","ai.conversations.message","ai.conversations.delete",
  "ai.memory.list","ai.memory.upsert","ai.memory.delete",
  "ai.retry.list","ai.retry.enqueue","ai.retry.claim","ai.retry.complete","ai.retry.fail",
  "ai.prompts.list","ai.prompts.save","ai.prompts.delete","ai.embeddings.upsert","ai.embeddings.list",
  "webhooks.list","webhooks.save","webhooks.delete",
  "backup.list","backup.record",
  "stats.summary",
  "moodleMappings.list","moodleMappings.saveCurriculum","moodleMappings.saveLesson","moodleMappings.saveIdea",
  "moodleMappings.saveCourse","moodleMappings.saveSection","moodleMappings.saveGroup","moodleMappings.saveStudent","moodleMappings.saveActivity",
  "moodleMappings.saveQuestion","moodleMappings.saveHomework","moodleMappings.saveCursor",
  "moodleResults.ideaRunCreate","moodleResults.ideaAttemptUpsert","moodleResults.homeworkSnapshotUpsert","moodleResults.homeworkQuestionUpsert",
  "moodleResults.studentSummary","moodleResults.classSummary",
  "reports.student","reports.class","reports.compare","reports.attendance","reports.games","reports.teacher",
  "reports.templates.list","reports.templates.save","reports.templates.delete",
  "reports.schedules.list","reports.schedules.save","reports.schedules.delete","reports.schedules.claim","reports.schedules.complete","reports.schedules.fail",
  "telegram.preferences.get","telegram.preferences.save","telegram.templates.list","telegram.templates.save","telegram.templates.delete","telegram.queue.list","telegram.queue.enqueue","telegram.queue.claim","telegram.queue.complete","telegram.queue.fail",
]);

// ====================================================================
//  Historical student references
// ====================================================================
// Some historical tables intentionally keep records after a student is
// removed. Detach the student id before the FK-cascading delete so reports
// remain readable without pointing at a non-existent student.
async function detachStudentHistory(tx: Prisma.TransactionClient, studentIds: string[]) {
  if (studentIds.length === 0) return;
  // H1 fix (2026-AUG): detach ALL historical references where studentId is nullable.
  // Tables where studentId is String? (nullable) — use updateMany to set null.
  // Tables where studentId is String (non-nullable) — use deleteMany to remove
  // the records (they're useless without the student anyway).
  await Promise.all([
    // Nullable studentId — set to null (preserves historical record for reports)
    tx.gameResultQuestion.updateMany({ where: { studentId: { in: studentIds } }, data: { studentId: null } }),
    tx.celebrationEvent.updateMany({ where: { studentId: { in: studentIds } }, data: { studentId: null } }),
    tx.studentNote.updateMany({ where: { studentId: { in: studentIds } }, data: { studentId: null } }),
    tx.studentActivity.updateMany({ where: { studentId: { in: studentIds } }, data: { studentId: null } }),
    tx.teacherInteraction.updateMany({ where: { studentId: { in: studentIds } }, data: { studentId: null } }),
    // Non-nullable studentId — delete the records (can't keep them without a student)
    tx.gameResultParticipant.deleteMany({ where: { studentId: { in: studentIds } } }).catch(() => undefined),
    tx.studentBadge.deleteMany({ where: { studentId: { in: studentIds } } }).catch(() => undefined),
    tx.studentGift.deleteMany({ where: { studentId: { in: studentIds } } }).catch(() => undefined),
    tx.studentBadgeProgress.deleteMany({ where: { studentId: { in: studentIds } } }).catch(() => undefined),
    tx.studentAchievement.deleteMany({ where: { studentId: { in: studentIds } } }).catch(() => undefined),
    tx.sessionStudentSnapshot.deleteMany({ where: { studentId: { in: studentIds } } }).catch(() => undefined),
    tx.rewardEvent.deleteMany({ where: { studentId: { in: studentIds } } }).catch(() => undefined),
  ]);
}

// ====================================================================
//  Dispatcher
// ====================================================================
async function dispatch(op: string, args: any[]): Promise<any> {
  // C36 fix: ensure SQLite pragmas (foreign_keys, WAL, busy_timeout) are applied
  await dbReady;
  if (!ALLOWED.has(op as OpName)) {
    throw new ApiInputError(`Operation not allowed: ${op}`);
  }

  switch (op as OpName) {
    // ---------- Classes ----------
    case "classes.list": {
      return db.classRoom.findMany({ orderBy: { createdAt: "desc" } });
    }
    case "classes.create": {
      // P1 fix: accept an optional `id` so callers can use a deterministic id
      // when creating a class (e.g., the "default class" auto-created from
      // StudentsPanel). When omitted, Prisma still generates a cuid.
      const [id, name, description, color] = args;
      const data: any = { name: name || "صف", description: description || "", color: color || "#0142A0" };
      if (id) data.id = id;
      return db.classRoom.create({ data });
    }
    case "classes.update": {
      const [id, patch] = args;
      const allowed = ["name", "description", "color"];
      const safe: Record<string, unknown> = {};
      for (const k of allowed) if (k in (patch || {})) safe[k] = patch[k];
      return db.classRoom.update({ where: { id }, data: safe as any });
    }
    case "classes.delete": {
      const [id] = args;
      const students = await db.student.findMany({ where: { classId: id }, select: { id: true } });
      return db.$transaction(async (tx) => {
        await detachStudentHistory(tx, students.map((student) => student.id));
        return tx.classRoom.delete({ where: { id } });
      });
    }

    // ---------- Students ----------
    case "students.list": {
      return db.student.findMany({
        orderBy: { name: "asc" },
        include: { badges: true, gifts: true },
      });
    }
    case "students.listByClass": {
      const [classId] = args;
      return db.student.findMany({
        where: { classId },
        orderBy: { name: "asc" },
        include: { badges: true, gifts: true },
      });
    }
    case "students.findByName": {
      // P2 fix: now accepts an optional classId to scope the search.
      // Without classId, the search is global (legacy behavior, used by
      // the legacy imports path).
      const [name, classId] = args;
      const where: any = { name };
      if (classId) where.classId = classId;
      return db.student.findFirst({
        where,
        include: { badges: true, gifts: true },
      });
    }
    case "students.findByNameInClass": {
      // P2 fix: strict duplicate check — case-insensitive, trimmed.
      // Returns the matching student or null. Used by data-store.studentExistsInClass.
      const [name, classId] = args;
      if (!name || !classId) return null;
      // SQLite doesn't support mode: 'insensitive' on its own; we use a
      // case-insensitive LIKE as a portable fallback. Trim on both sides.
      const trimmed = String(name).trim();
      const existing = await db.student.findFirst({
        where: {
          classId,
          // SQLite does not support Prisma's `mode: "insensitive"` filter.
          // Its default LIKE comparison is case-insensitive for ordinary text,
          // while the exact branch keeps the common path index-friendly.
          name: { contains: trimmed },
        },
        select: { id: true, name: true },
      });
      return existing;
    }
    case "students.upsert": {
      const [studentId, classId, data] = args;
      if (typeof studentId !== "string" || !studentId.trim()) throw new ApiInputError("studentId مطلوب");
      // C20 + H13 fix (2026-AUG): removed parentTelegramChatId, parentTelegramUsername,
      // parentPhone (must go through Telegram link flow) and points, correctAnswers,
      // wrongAnswers, attempts (must go through awardPoints/awardCorrect/awardWrong
      // which use atomic increments and create audit trail). lastCalled removed too —
      // must go through pickStudentManual. This prevents privilege escalation and
      // bypass of the fairness/audit system.
      const allowed = ["name", "studentCode", "title", "isAbsent", "lastAbsentAt", "moodleUserId", "moodleUsername", "moodleCourseId"];
      const safe: Record<string, unknown> = {};
      for (const k of allowed) if (k in (data || {})) safe[k] = data[k];
      // C21 fix: validate name length
      if ("name" in safe && typeof safe.name === "string") safe.name = safe.name.trim().slice(0, 200);
      const existing = await db.student.findUnique({ where: { id: studentId }, select: { id: true } });
      if (!existing && (typeof safe.name !== "string" || !safe.name.trim())) throw new ApiInputError("اسم الطالب مطلوب");
      if ("name" in safe && (typeof safe.name !== "string" || !safe.name.trim())) throw new ApiInputError("اسم الطالب غير صالح");
      if (typeof safe.studentCode === "string") {
        const studentCode = safe.studentCode.trim();
        safe.studentCode = studentCode || null;
        const duplicate = studentCode ? await db.student.findUnique({ where: { studentCode }, select: { id: true } }) : null;
        if (duplicate && duplicate.id !== studentId) throw new ApiInputError("studentCode مستخدم بالفعل لطالب آخر");
      }
      try {
        return await db.student.upsert({
          where: { id: studentId },
          create: { id: studentId, classId, ...safe } as any,
          update: safe as any,
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ApiInputError("بيانات الطالب مكررة");
        throw error;
      }
    }
    case "students.update": {
      const [studentId, patch] = args;
      // C20 + H13 + M5 fix (2026-AUG): removed points, correctAnswers, wrongAnswers,
      // attempts (must use awardPoints/awardCorrect/awardWrong for atomic increments
      // + audit trail), lastCalled (must use pickStudentManual), and parentTelegram*
      // fields (must use Telegram link flow). Only allow safe metadata updates here.
      const allowedPatch: Record<string, unknown> = {};
      const allowedFields = [
        "name", "title", "isAbsent", "lastAbsentAt", "classId", "studentCode",
        "moodleUserId", "moodleUsername", "moodleCourseId",
      ];
      for (const key of Object.keys(patch || {})) {
        if (allowedFields.includes(key)) {
          allowedPatch[key] = (patch as Record<string, unknown>)[key];
        }
      }
      // If the student doesn't exist in SQLite (e.g., it's an IndexedDB-only student),
      // silently skip — the Zustand store already has the correct state.
      const existing = await db.student.findUnique({ where: { id: studentId }, select: { id: true } });
      if (!existing) {
        return { skipped: true, reason: "student_not_in_sqlite" };
      }
      if (Object.keys(allowedPatch).length === 0) {
        return { skipped: true, reason: "no_valid_fields" };
      }
      return db.student.update({ where: { id: studentId }, data: allowedPatch });
    }
    case "students.delete": {
      const [studentId] = args;
      const student = await db.student.findUnique({ where: { id: studentId }, select: { classId: true } });
      if (!student) return { skipped: true, reason: "student_not_found" };
      return db.$transaction(async (tx) => {
        await detachStudentHistory(tx, [studentId]);
        const deleted = await tx.student.delete({ where: { id: studentId } });
        if (student.classId) {
          const groups = await tx.studentGroup.findMany({ where: { classId: student.classId } });
          for (const group of groups) {
            let ids: string[] = [];
            try {
              const parsed = JSON.parse(group.studentIds || "[]");
              ids = Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
            } catch {
              ids = [];
            }
            if (ids.includes(studentId)) {
              await tx.studentGroup.update({
                where: { id: group.id },
                data: { studentIds: JSON.stringify(ids.filter((id) => id !== studentId)) },
              });
            }
          }
        }
        return deleted;
      });
    }
    case "students.awardPoints": {
      const [studentId, points] = args;
      // H3 fix (2026-AUG): validate points is a reasonable integer.
      // Previously any number (including -999999 or NaN) was accepted.
      const pts = Number(points);
      if (!Number.isInteger(pts) || Math.abs(pts) > 100) {
        throw new ApiInputError("نقاط غير صالحة: يجب أن تكون عدداً صحيحاً بين -100 و100");
      }
      const existing = await db.student.findUnique({ where: { id: studentId }, select: { id: true, points: true } });
      if (!existing) return { skipped: true, reason: "student_not_in_db" };
      // Prevent negative total points (allow decrement but not below zero)
      const newTotal = existing.points + pts;
      if (newTotal < 0) {
        return db.student.update({
          where: { id: studentId },
          data: { points: 0 },
        });
      }
      return db.student.update({
        where: { id: studentId },
        data: { points: { increment: pts } },
      });
    }
    case "students.awardCorrect": {
      const [studentId, points = 3] = args;
      // Verify student exists first; if not, skip silently (legacy cache student not yet migrated)
      const existing = await db.student.findUnique({ where: { id: studentId }, select: { id: true } });
      if (!existing) {
        return { skipped: true, reason: "student_not_in_db" };
      }
      const [updated] = await db.$transaction([
        db.student.update({
          where: { id: studentId },
          data: {
            points: { increment: points },
            correctAnswers: { increment: 1 },
            attempts: { increment: 1 },
          },
        }),
        db.studentBadge.create({
          data: { studentId, type: "correct" },
        }),
      ]);
      return updated;
    }
    case "students.awardWrong": {
      const [studentId] = args;
      const existing = await db.student.findUnique({ where: { id: studentId }, select: { id: true } });
      if (!existing) return { skipped: true, reason: "student_not_in_db" };
      const [updated] = await db.$transaction([
        db.student.update({
          where: { id: studentId },
          data: { wrongAnswers: { increment: 1 }, attempts: { increment: 1 } },
        }),
        db.studentBadge.create({ data: { studentId, type: "wrong" } }),
      ]);
      return updated;
    }
    case "students.awardGoodTry": {
      const [studentId] = args;
      const existing = await db.student.findUnique({ where: { id: studentId }, select: { id: true } });
      if (!existing) return { skipped: true, reason: "student_not_in_db" };
      const [updated] = await db.$transaction([
        db.student.update({
          where: { id: studentId },
          data: { attempts: { increment: 1 }, points: { increment: 1 } },
        }),
        db.studentBadge.create({ data: { studentId, type: "good-try" } }),
      ]);
      return updated;
    }
    case "students.awardBadge": {
      const [studentId, type, note] = args;
      const existing = await db.student.findUnique({ where: { id: studentId }, select: { id: true } });
      if (!existing) return { skipped: true, reason: "student_not_in_db" };
      return db.studentBadge.create({ data: { studentId, type, note } });
    }
    case "students.resetSession": {
      const [classId] = args;
      // Mark all students as not called this session (reset lastCalled)
      return db.student.updateMany({
        where: classId ? { classId } : {},
        data: { lastCalled: null },
      });
    }
    case "students.setAbsent": {
      const [studentId, isAbsent] = args;
      // C36 (P2 fix): existence check (same pattern as awardPoints) so we don't
      // surface a Prisma P2025 error when the student only lives in IndexedDB.
      const existing = await db.student.findUnique({ where: { id: studentId }, select: { id: true } });
      if (!existing) return { skipped: true, reason: "student_not_in_db" };
      return db.student.update({ where: { id: studentId }, data: { isAbsent } });
    }
    case "students.setTitle": {
      const [studentId, title] = args;
      // C36 (P2 fix): existence check (same pattern as awardPoints) so we don't
      // surface a Prisma P2025 error when the student only lives in IndexedDB.
      const existing = await db.student.findUnique({ where: { id: studentId }, select: { id: true } });
      if (!existing) return { skipped: true, reason: "student_not_in_db" };
      return db.student.update({ where: { id: studentId }, data: { title } });
    }

    // ---------- Groups ----------
    case "groups.list": {
      const [classId] = args;
      return db.studentGroup.findMany({ where: { classId }, orderBy: { createdAt: "asc" } });
    }
    case "groups.save": {
      const [group] = args;
      const id = group?.id;
      if (!id) throw new ApiInputError("groups.save: missing id");
      const allowed = ["classId", "name", "color", "groupPoints", "studentIds"];
      const safe: Record<string, unknown> = { id };
      for (const k of allowed) if (k in group) safe[k] = group[k];
      return db.studentGroup.upsert({ where: { id }, create: safe as any, update: safe as any });
    }
    case "groups.delete": {
      const [id] = args;
      return db.studentGroup.delete({ where: { id } });
    }
    case "groups.addPoints": {
      const [groupId, points] = args;
      return db.studentGroup.update({
        where: { id: groupId },
        data: { groupPoints: { increment: points } },
      });
    }
    case "groups.autoSplit": {
      const [classId, requestedNumGroups = 4] = args;
      const parsedNumGroups = Number(requestedNumGroups);
      if (!classId || !Number.isInteger(parsedNumGroups) || parsedNumGroups < 1 || parsedNumGroups > 32) {
        throw new ApiInputError("groups.autoSplit: عدد المجموعات يجب أن يكون بين 1 و32");
      }
      const students = await db.student.findMany({ where: { classId, isAbsent: false }, select: { id: true } });
      if (students.length === 0) return [];
      const numGroups = Math.min(parsedNumGroups, students.length);
      // H8 fix: use crypto.randomInt for unbiased shuffle (Math.random PRNG is biased)
      const shuffled = [...students];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const colors = ["#0142A0","#DA151C","#10b981","#f59e0b","#a855f7","#06b6d4","#ec4899","#92400e"];
      const names = ["المجموعة الزرقاء","المجموعة الحمراء","المجموعة الخضراء","المجموعة الصفراء","المجموعة البنفسجية","المجموعة السماوية","المجموعة الوردية","المجموعة البنية"];
      // C12 fix: wrap all group creations in a single transaction.
      // Previously if creation failed midway, half the groups would be created
      // with no cleanup, leaving the class in an inconsistent state.
      return db.$transaction(async (tx) => {
        const created: any[] = [];
        for (let i = 0; i < numGroups; i++) {
          const ids = shuffled.filter((_, idx) => idx % numGroups === i).map(s => s.id);
          const g = await tx.studentGroup.create({
            data: {
              classId,
              name: names[i] || `المجموعة ${i+1}`,
              color: colors[i % colors.length],
              studentIds: JSON.stringify(ids),
              groupPoints: 0,
            },
          });
          created.push(g);
        }
        return created;
      });
    }

    // ---------- Lessons ----------
    case "lessons.list": {
      return db.importedLesson.findMany({
        orderBy: { importedAt: "desc" },
        include: { _count: { select: { questions: true } } },
      });
    }
    case "lessons.upsert": {
      const [lesson] = args;
      const existing = await db.importedLesson.findFirst({ where: { lessonId: lesson.lessonId } });
      if (existing) {
        return db.importedLesson.update({
          where: { id: existing.id },
          data: {
            fileName: lesson.fileName,
            title: lesson.title,
            subtitle: lesson.subtitle || "",
            content: lesson.content,
            manifestJson: lesson.manifestJson,
          },
        });
      }
      return db.importedLesson.create({
        data: {
          lessonId: lesson.lessonId,
          fileName: lesson.fileName,
          title: lesson.title,
          subtitle: lesson.subtitle || "",
          content: lesson.content,
          manifestJson: lesson.manifestJson,
        },
      });
    }
    case "lessons.delete": {
      const [id] = args;
      return db.importedLesson.delete({ where: { id } });
    }

    // ---------- Curriculum Factory ----------
    case "curriculumFactoryDrafts.list": {
      const [requestedLimit = 30] = args;
      const limit = Math.max(1, Math.min(100, Number(requestedLimit) || 30));
      return db.curriculumFactoryDraft.findMany({ orderBy: { updatedAt: "desc" }, take: limit });
    }
    case "curriculumFactoryDrafts.get": {
      const [id] = args;
      if (typeof id !== "string" || !id.trim()) throw new ApiInputError("draft id is required");
      return db.curriculumFactoryDraft.findUnique({ where: { id } });
    }
    case "curriculumFactoryDrafts.upsert": {
      const [input] = args;
      if (!input || typeof input !== "object") throw new ApiInputError("factory draft requires an object");
      const item = input as Record<string, unknown>;
      const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : undefined;
      const bounded = (value: unknown, fallback: string, max: number, label: string) => {
        if (value === undefined || value === null) return fallback;
        if (typeof value !== "string") throw new ApiInputError(`${label} must be a string`);
        if (value.length > max) throw new ApiInputError(`${label} يتجاوز الحد المسموح (${max} حرف)`);
        return value;
      };
      const text = bounded(item.sourceText, "", 120_000, "sourceText");
      const manifestJson = bounded(item.manifestJson, "{}", 250_000, "manifestJson");
      const questionsJson = bounded(item.questionsJson, "[]", 250_000, "questionsJson");
      const sourceImagesJson = bounded(item.sourceImagesJson, "[]", 100_000, "sourceImagesJson");
      const metadataJson = bounded(item.metadataJson, "{}", 100_000, "metadataJson");
      const jsonFields: Array<[string, string]> = [["manifestJson", manifestJson], ["questionsJson", questionsJson], ["sourceImagesJson", sourceImagesJson], ["metadataJson", metadataJson]];
      for (const [label, raw] of jsonFields) {
        try { JSON.parse(raw); } catch { throw new ApiInputError(`${label} must be valid JSON`); }
        if (raw.length > 250_000) throw new ApiInputError(`${label} is too large`);
      }
      const data = {
        title: typeof item.title === "string" ? item.title.trim().slice(0, 240) : "",
        grade: typeof item.grade === "string" ? item.grade.trim().slice(0, 80) : "",
        subject: typeof item.subject === "string" ? item.subject.trim().slice(0, 120) : "",
        academicYear: typeof item.academicYear === "string" ? item.academicYear.trim().slice(0, 80) : "",
        curriculumKey: typeof item.curriculumKey === "string" ? item.curriculumKey.trim().slice(0, 160) : "",
        lessonKey: typeof item.lessonKey === "string" ? item.lessonKey.trim().slice(0, 160) : "",
        sourceText: text,
        sourceImagesJson,
        stage: Math.max(1, Math.min(5, Number.isInteger(item.stage) ? Number(item.stage) : 1)),
        status: typeof item.status === "string" && ["draft", "review", "baked", "archived"].includes(item.status) ? item.status : "draft",
        manifestJson,
        questionsJson,
        metadataJson,
      };
      return db.$transaction(async (tx) => {
        const saved = id
          ? await tx.curriculumFactoryDraft.upsert({ where: { id }, create: { id, ...data }, update: data })
          : await tx.curriculumFactoryDraft.create({ data });
        const latest = await tx.curriculumDraftVersion.findFirst({ where: { draftId: saved.id }, orderBy: { version: "desc" }, select: { version: true } });
        await tx.curriculumDraftVersion.create({ data: { draftId: saved.id, version: (latest?.version ?? 0) + 1, manifestJson, questionsJson, reason: "save" } });
        return saved;
      });
    }
    case "curriculumFactoryDrafts.delete": {
      const [id] = args;
      if (typeof id !== "string" || !id.trim()) throw new ApiInputError("draft id is required");
      await db.curriculumDraftVersion.deleteMany({ where: { draftId: id } });
      return db.curriculumFactoryDraft.delete({ where: { id } });
    }
    case "curriculumFactoryDrafts.versions": {
      const [draftId] = args;
      if (typeof draftId !== "string" || !draftId.trim()) throw new ApiInputError("draft id is required");
      return db.curriculumDraftVersion.findMany({ where: { draftId }, orderBy: { version: "desc" }, take: 100 });
    }
    case "curriculumFactoryDrafts.restoreVersion": {
      const [input] = args;
      const draftId = typeof input?.draftId === "string" ? input.draftId.trim() : "";
      const versionId = typeof input?.versionId === "string" ? input.versionId.trim() : "";
      if (!draftId || !versionId) throw new ApiInputError("draftId وversionId مطلوبان");
      return db.$transaction(async (tx) => {
        const version = await tx.curriculumDraftVersion.findFirst({ where: { id: versionId, draftId } });
        if (!version) throw new ApiInputError("الإصدار غير موجود");
        const draft = await tx.curriculumFactoryDraft.update({ where: { id: draftId }, data: { manifestJson: version.manifestJson, questionsJson: version.questionsJson, stage: 3, status: "review" } });
        const latest = await tx.curriculumDraftVersion.findFirst({ where: { draftId }, orderBy: { version: "desc" }, select: { version: true } });
        await tx.curriculumDraftVersion.create({ data: { draftId, version: (latest?.version ?? 0) + 1, manifestJson: version.manifestJson, questionsJson: version.questionsJson, reason: `restore:${version.version}` } });
        return draft;
      });
    }
    case "curriculumFactoryDrafts.bake": {
      const [input] = args;
      if (!input || typeof input !== "object") throw new ApiInputError("bake input requires an object");
      const item = input as Record<string, unknown>;
      const draftId = typeof item.draftId === "string" ? item.draftId.trim() : "";
      if (!draftId) throw new ApiInputError("draftId is required");
      const draft = await db.curriculumFactoryDraft.findUnique({ where: { id: draftId } });
      if (!draft) throw new ApiInputError("factory draft not found");
      let manifest: Record<string, unknown>;
      let questions: Array<Record<string, unknown>>;
      try { manifest = JSON.parse(draft.manifestJson) as Record<string, unknown>; } catch { throw new ApiInputError("draft manifest is invalid JSON"); }
      try { questions = JSON.parse(draft.questionsJson) as Array<Record<string, unknown>>; } catch { throw new ApiInputError("draft questions are invalid JSON"); }
      if (!manifest.lessonId || !manifest.title) throw new ApiInputError("manifest lessonId and title are required before baking");
      const html = typeof item.content === "string" ? item.content.slice(0, 500_000) : `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${String(manifest.title)}</title></head><body><script type="application/json" id="slide-manifest">${JSON.stringify(manifest)}</script></body></html>`;
      const lesson = await db.$transaction(async (tx) => {
        const existing = await tx.importedLesson.findFirst({ where: { lessonId: String(manifest.lessonId) } });
        const saved = existing
          ? await tx.importedLesson.update({ where: { id: existing.id }, data: { fileName: `${String(manifest.lessonId)}.html`, title: String(manifest.title), subtitle: typeof manifest.subtitle === "string" ? manifest.subtitle : "", content: html, manifestJson: JSON.stringify(manifest) } })
          : await tx.importedLesson.create({ data: { lessonId: String(manifest.lessonId), fileName: `${String(manifest.lessonId)}.html`, title: String(manifest.title), subtitle: typeof manifest.subtitle === "string" ? manifest.subtitle : "", content: html, manifestJson: JSON.stringify(manifest) } });
        await tx.lessonQuestion.deleteMany({ where: { lessonId: saved.id } });
        if (questions.length > 0) {
          await tx.lessonQuestion.createMany({ data: questions.slice(0, 500).map((q, index) => ({
            lessonId: saved.id,
            externalRefId: typeof q.externalRefId === "string" ? q.externalRefId : `${String(manifest.lessonId)}-q-${index + 1}`,
            ideaId: typeof q.ideaId === "string" ? q.ideaId : null,
            ideaTitle: typeof q.ideaTitle === "string" ? q.ideaTitle : null,
            stepNumber: Number.isInteger(q.stepNumber) ? Number(q.stepNumber) : index + 1,
            text: String(q.text || "").slice(0, 4000),
            correctAnswer: q.correctAnswer == null ? null : String(q.correctAnswer).slice(0, 1000),
            optionsJson: JSON.stringify(Array.isArray(q.options) ? q.options.filter((v): v is string => typeof v === "string").slice(0, 12) : []),
            questionType: ["mcq", "true-false", "essay", "cloze", "drag-drop"].includes(String(q.questionType || q.type)) ? String(q.questionType || q.type) : "mcq",
            solutionStepsJson: JSON.stringify(Array.isArray(q.solutionSteps) ? q.solutionSteps.filter((v): v is string => typeof v === "string").slice(0, 20) : []),
            solutionScript: typeof q.solutionScript === "string" ? q.solutionScript.slice(0, 4000) : typeof q.explanation === "string" ? q.explanation.slice(0, 4000) : "",
            imageJson: JSON.stringify(Array.isArray(q.images) ? q.images.slice(0, 8) : []),
            rewardPoints: Number.isFinite(Number(q.rewardPoints)) ? Math.max(0, Math.min(100, Math.round(Number(q.rewardPoints)))) : 3,
            difficulty: ["easy", "medium", "hard"].includes(String(q.difficulty)) ? String(q.difficulty) : "medium",
            tags: JSON.stringify(Array.from(new Set([...(Array.isArray(q.tags) ? q.tags.filter((v): v is string => typeof v === "string").slice(0, 30) : []), ...(Array.isArray(q.usage) ? q.usage.filter((v): v is string => typeof v === "string").map((v) => `bisalasa:usage:${v}`) : []), ...(Array.isArray(q.imageRefs) ? q.imageRefs.filter((v): v is string => typeof v === "string").map((v) => `bisalasa:asset:${v}`) : [])])).slice(0, 60)),
            gameReady: q.gameReady !== false,
          })) as any });
        }
        return saved;
      });
      const updated = await db.curriculumFactoryDraft.update({ where: { id: draftId }, data: { status: "baked", stage: 5 } });
      return { draft: updated, lesson, questionsCount: questions.length };
    }
    case "curriculumPromptTemplates.list": {
      return db.curriculumPromptTemplate.findMany({ orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }] });
    }
    case "curriculumPromptTemplates.save": {
      const [input] = args;
      if (!input || typeof input !== "object") throw new ApiInputError("prompt template requires an object");
      const item = input as Record<string, unknown>;
      const key = typeof item.key === "string" ? item.key.trim().slice(0, 100) : "";
      const label = typeof item.label === "string" ? item.label.trim().slice(0, 160) : "";
      const content = typeof item.content === "string" ? item.content.slice(0, 20_000) : "";
      const examplesJson = JSON.stringify(Array.isArray(item.examples) ? item.examples.slice(0, 20) : []);
      const variablesJson = JSON.stringify(Array.isArray(item.variables) ? item.variables.slice(0, 40) : []);
      if (!/^[a-z0-9._-]{2,100}$/i.test(key) || !label || !content) throw new ApiInputError("valid prompt key, label and content are required");
      return db.curriculumPromptTemplate.upsert({ where: { key }, create: { key, label, content, examplesJson, variablesJson, isDefault: item.isDefault === true }, update: { label, content, examplesJson, variablesJson, isDefault: item.isDefault === true } });
    }
    case "curriculumPromptTemplates.seedDefaults": {
      const defaults = [
        { key: "structure-lesson", label: "هيكلة الدرس والسكريبت", content: "حوّل النص الخام إلى درس عربي مبسط بأسلوب مدرس مصري. الصف: {grade}، المادة: {subject}، العام: {academicYear}. قسّم المحتوى إلى أفكار وخطوات قصيرة، وأضف script وnotes ومعادلات LaTeX. لا تخترع معلومات خارج المصدر.", examplesJson: JSON.stringify([{ input: "تعريف الكسر", output: "فكرة: معنى الكسر وخطوتان مع مثال" }]), variablesJson: JSON.stringify([{ name: "subject", description: "المادة" }, { name: "grade", description: "الصف" }, { name: "academicYear", description: "العام الدراسي" }, { name: "title", description: "عنوان الدرس" }]), isDefault: true },
        { key: "generate-questions", label: "توليد أسئلة مرتبطة بالفكرة", content: "ولّد أسئلة رياضيات من السياق فقط. كل سؤال يجب أن يحمل ideaId وdifficulty وoptions وcorrectAnswer وsolutionSteps وsolutionScript وtag. اجعل correctAnswer موجوداً داخل options.", examplesJson: JSON.stringify([{ input: "2+2", output: "سؤال MCQ بإجابة 4 وثلاثة بدائل" }]), variablesJson: JSON.stringify([{ name: "subject", description: "المادة" }, { name: "grade", description: "الصف" }, { name: "ideaTitle", description: "عنوان الفكرة" }]), isDefault: true },
        { key: "teacher-review", label: "مراجعة تربوية قبل الخَبز", content: "راجع الدرس والأسئلة بحثاً عن أخطاء رياضية أو تسرب خارج المصدر أو غموض في الإجابات، وأعد قائمة أخطاء قابلة للإصلاح دون تطبيق تلقائي.", examplesJson: "[]", variablesJson: JSON.stringify([{ name: "title", description: "عنوان الدرس" }, { name: "questionsCount", description: "عدد الأسئلة" }]), isDefault: true },
      ];
      let seeded = 0;
      for (const item of defaults) { const existing = await db.curriculumPromptTemplate.findUnique({ where: { key: item.key } }); if (!existing) { await db.curriculumPromptTemplate.create({ data: item }); seeded += 1; } }
      return { seeded };
    }
    case "questionTemplates.list": {
      const [filters] = args;
      const subject = typeof filters?.subject === "string" ? filters.subject : undefined;
      const grade = typeof filters?.grade === "string" ? filters.grade : undefined;
      const questionType = typeof filters?.questionType === "string" ? filters.questionType : undefined;
      return db.questionTemplate.findMany({ where: { ...(subject ? { subject } : {}), ...(grade ? { grade } : {}), ...(questionType ? { questionType } : {}) }, orderBy: { updatedAt: "desc" }, take: 100 });
    }
    case "questionTemplates.save": {
      const [input] = args;
      if (!input || typeof input !== "object") throw new ApiInputError("question template requires an object");
      const item = input as Record<string, unknown>;
      const id = typeof item.id === "string" ? item.id : undefined;
      const title = typeof item.title === "string" ? item.title.trim().slice(0, 160) : "";
      const textTemplate = typeof item.textTemplate === "string" ? item.textTemplate.slice(0, 4000) : "";
      if (!title || !textTemplate) throw new ApiInputError("question template title and textTemplate are required");
      const data = { title, subject: typeof item.subject === "string" ? item.subject.slice(0, 80) : "general", grade: typeof item.grade === "string" ? item.grade.slice(0, 120) : "general", questionType: typeof item.questionType === "string" ? item.questionType : "mcq", difficulty: typeof item.difficulty === "string" ? item.difficulty : "medium", textTemplate, optionsTemplateJson: JSON.stringify(Array.isArray(item.optionsTemplate) ? item.optionsTemplate.slice(0, 12) : []), correctAnswerTemplate: typeof item.correctAnswerTemplate === "string" ? item.correctAnswerTemplate.slice(0, 1000) : "", solutionStepsJson: JSON.stringify(Array.isArray(item.solutionSteps) ? item.solutionSteps.slice(0, 20) : []), solutionScript: typeof item.solutionScript === "string" ? item.solutionScript.slice(0, 4000) : "", tagsJson: JSON.stringify(Array.isArray(item.tags) ? item.tags.slice(0, 30) : []), isPublic: item.isPublic === true };
      return id ? db.questionTemplate.update({ where: { id }, data }) : db.questionTemplate.create({ data });
    }
    case "questionTemplates.seedDefaults": {
      const defaults = [
        { title: "مساحة دائرة", subject: "الرياضيات", grade: "الصف الرابع الابتدائي", questionType: "mcq", difficulty: "medium", textTemplate: "احسب مساحة دائرة نصف قطرها {radius} سم.", optionsTemplate: ["{pi} × {radius}²", "2 × {pi} × {radius}", "{radius}²", "{pi} + {radius}"], correctAnswerTemplate: "{pi} × {radius}²", solutionSteps: ["نستخدم القانون: المساحة = π × نق²", "نعوض قيمة نصف القطر"], tags: ["رياضيات", "هندسة", "مساحة"] },
        { title: "تحويل وحدات", subject: "الرياضيات", grade: "general", questionType: "mcq", difficulty: "easy", textTemplate: "حوّل {value} متر إلى سنتيمتر.", optionsTemplate: ["{answer}", "{wrong1}", "{wrong2}"], correctAnswerTemplate: "{answer}", solutionSteps: ["كل متر يساوي 100 سنتيمتر"], tags: ["وحدات", "تحويل"] },
      ];
      let seeded = 0;
      for (const item of defaults) { const exists = await db.questionTemplate.findFirst({ where: { title: item.title, subject: item.subject } }); if (!exists) { await db.questionTemplate.create({ data: { title: item.title, subject: item.subject, grade: item.grade, questionType: item.questionType, difficulty: item.difficulty, textTemplate: item.textTemplate, optionsTemplateJson: JSON.stringify(item.optionsTemplate), correctAnswerTemplate: item.correctAnswerTemplate, solutionStepsJson: JSON.stringify(item.solutionSteps), solutionScript: "", tagsJson: JSON.stringify(item.tags), isPublic: false } }); seeded += 1; } }
      return { seeded };
    }
    case "lessonTemplates.list": {
      const [filters] = args;
      return db.lessonTemplate.findMany({ where: { ...(typeof filters?.subject === "string" ? { subject: filters.subject } : {}), ...(typeof filters?.grade === "string" ? { grade: filters.grade } : {}) }, orderBy: { updatedAt: "desc" }, take: 100 });
    }
    case "lessonTemplates.save": {
      const [input] = args;
      if (!input || typeof input !== "object") throw new ApiInputError("lesson template requires an object");
      const item = input as Record<string, unknown>;
      const id = typeof item.id === "string" ? item.id : undefined;
      const title = typeof item.title === "string" ? item.title.trim().slice(0, 160) : "";
      if (!title || !item.manifestJson) throw new ApiInputError("lesson template title and manifestJson are required");
      const data = { title, subject: typeof item.subject === "string" ? item.subject.slice(0, 80) : "general", grade: typeof item.grade === "string" ? item.grade.slice(0, 120) : "general", description: typeof item.description === "string" ? item.description.slice(0, 1000) : "", manifestJson: typeof item.manifestJson === "string" ? item.manifestJson.slice(0, 500_000) : JSON.stringify(item.manifestJson), questionsJson: typeof item.questionsJson === "string" ? item.questionsJson.slice(0, 500_000) : JSON.stringify(item.questionsJson ?? []), isPublic: item.isPublic === true };
      return id ? db.lessonTemplate.update({ where: { id }, data }) : db.lessonTemplate.create({ data });
    }

    // ---------- Questions ----------
    case "questions.list": {
      return db.lessonQuestion.findMany({ orderBy: [{ lessonId: "asc" }, { ideaId: "asc" }, { stepNumber: "asc" }] });
    }
    case "questions.listByLesson": {
      const [lessonId] = args;
      return db.lessonQuestion.findMany({ where: { lessonId }, orderBy: [{ ideaId: "asc" }, { stepNumber: "asc" }] });
    }
    case "questions.listByIdea": {
      const [lessonId, ideaId] = args;
      return db.lessonQuestion.findMany({ where: { lessonId, ideaId }, orderBy: { stepNumber: "asc" } });
    }
    case "questions.create": {
      const [q] = args;
      const validated = validateQuestionInput((q || {}) as Record<string, unknown>);
      if (!validated.ok || !validated.value) {
        throw new ApiInputError(`questions.create: ${validated.errors.join("؛ ")}`);
      }
      return db.lessonQuestion.create({ data: validated.value as any });
    }
    case "questions.bulkCreate": {
      const [questions] = args;
      if (!Array.isArray(questions) || questions.length === 0 || questions.length > 500) {
        throw new ApiInputError("questions.bulkCreate: يجب إرسال 1 إلى 500 سؤال");
      }
      const normalized = questions.map((q, index) => {
        const validated = validateQuestionInput((q || {}) as Record<string, unknown>);
        if (!validated.ok || !validated.value) {
          throw new ApiInputError(`questions.bulkCreate[${index}]: ${validated.errors.join("؛ ")}`);
        }
        return validated.value;
      });
      return db.lessonQuestion.createMany({ data: normalized as any });
    }

    // ---------- Prizes ----------
    case "prizes.list": {
      const all = await db.prize.findMany({ orderBy: { createdAt: "asc" } });
      if (all.length === 0) {
        // Seed defaults
        const defaults = [
          { name: "عبقري", color: "#0142A0", points: 5, type: "title", icon: "🧠" },
          { name: "بيتزا", color: "#DA151C", points: 0, type: "gift", icon: "🍕" },
          { name: "10 نقاط", color: "#10b981", points: 10, type: "points", icon: "⭐" },
          { name: "بطل", color: "#f59e0b", points: 3, type: "title", icon: "🏆" },
          { name: "آيس كريم", color: "#a855f7", points: 0, type: "gift", icon: "🍦" },
          { name: "نجم", color: "#06b6d4", points: 7, type: "title", icon: "🌟" },
          { name: "حظ أوفر", color: "#ec4899", points: 0, type: "nothing", icon: "🎲" },
          { name: "شوكولاتة", color: "#92400e", points: 0, type: "gift", icon: "🍫" },
        ];
        await db.prize.createMany({ data: defaults });
        return db.prize.findMany({ orderBy: { createdAt: "asc" } });
      }
      return all;
    }
    case "prizes.save": {
      const [prize] = args;
      const id = prize?.id;
      if (!id) throw new ApiInputError("prizes.save: missing id");
      const allowed = ["name", "color", "points", "type", "icon"];
      const safe: Record<string, unknown> = { id };
      for (const k of allowed) if (k in prize) safe[k] = prize[k];
      return db.prize.upsert({ where: { id }, create: safe as any, update: safe as any });
    }
    case "prizes.delete": {
      const [id] = args;
      return db.prize.delete({ where: { id } });
    }

    // ---------- Gifts ----------
    case "gifts.list": {
      const all = await db.gift.findMany({ orderBy: { createdAt: "asc" } });
      if (all.length === 0) {
        const defaults = [
          { id: "g1", name: "بيتزا", category: "food", image: "/gifts/pizza.png", description: "بيتزا قطعة" },
          { id: "g2", name: "آيس كريم", category: "food", image: "/gifts/icecream.png", description: "آيس كريم كوب" },
          { id: "g3", name: "شوكولاتة", category: "food", image: "/gifts/chocolate.png", description: "لوح شوكولاتة" },
          { id: "g4", name: "كيك", category: "food", image: "/gifts/cake.png", description: "قطعة كيك" },
          { id: "g5", name: "حلوى", category: "food", image: "/gifts/candy.png", description: "حلوى ملونة" },
          { id: "g6", name: "عصير", category: "food", image: "/gifts/juice.png", description: "علبة عصير" },
          { id: "g7", name: "عبقري", category: "title", image: "/gifts/brain.png", description: "لقب عبقري" },
          { id: "g8", name: "بطل", category: "title", image: "/gifts/trophy.png", description: "لقب بطل" },
          { id: "g9", name: "نجم", category: "title", image: "/gifts/star2.png", description: "لقب نجم" },
          { id: "g10", name: "دورية حرة", category: "activity", image: "/gifts/free.png", description: "دورية حرة" },
          { id: "g11", name: "اختيار النشاط", category: "activity", image: "/gifts/choice.png", description: "اختيار نشاط الفصل" },
          { id: "g12", name: "نجمة ذهبية", category: "toy", image: "/gifts/star.png", description: "نجمة ذهبية" },
          { id: "g13", name: "كرة", category: "toy", image: "/gifts/ball.png", description: "كرة صغيرة" },
          { id: "g14", name: "لغز", category: "toy", image: "/gifts/puzzle.png", description: "لغز تركيبي" },
          { id: "g15", name: "قلم ملون", category: "stationery", image: "/gifts/pen.png", description: "قلم ملون" },
          { id: "g16", name: "أقلام", category: "stationery", image: "/gifts/pencil-set.png", description: "طقم أقلام" },
          { id: "g17", name: "دفتر", category: "stationery", image: "/gifts/notebook.png", description: "دفتر ملاحظات" },
          { id: "g18", name: "كتاب", category: "book", image: "/gifts/book-gift.png", description: "كتاب مفيد" },
          { id: "g19", name: "ميدالية", category: "other", image: "/gifts/medal.png", description: "ميدالية شرف" },
          { id: "g20", name: "ستيكر", category: "other", image: "/gifts/sticker.png", description: "ستيكر ملون" },
          { id: "g21", name: "صاروخ النجمة", category: "toy", image: "/gifts/rocket-star.png", description: "انطلاقة إنجاز جديدة" },
          { id: "g22", name: "ميدالية قوس قزح", category: "other", image: "/gifts/rainbow-medal.png", description: "تقدم يستحق الاحتفال" },
          { id: "g23", name: "الكتاب السحري", category: "book", image: "/gifts/magic-book.png", description: "اكتشاف وفكرة جديدة" },
          { id: "g24", name: "كأس الرياضيات", category: "title", image: "/gifts/math-trophy.png", description: "إتقان فكرة رياضية" },
          { id: "g25", name: "القلم الخارق", category: "stationery", image: "/gifts/super-pencil.png", description: "محاولة قوية ومثابرة" },
          { id: "g26", name: "مصباح الفكرة", category: "other", image: "/gifts/idea-lamp.png", description: "لحظة فهم وإلهام" },
          { id: "g27", name: "ستيكر المذنب", category: "other", image: "/gifts/comet-sticker.png", description: "تقدم لامع وسريع" },
          { id: "g28", name: "التاج الذهبي", category: "title", image: "/gifts/golden-crown.png", description: "إنجاز شخصي مميز" },
          { id: "g29", name: "شارة الفريق", category: "other", image: "/gifts/team-badge.png", description: "تعاون ومساعدة زملاء" },
          { id: "g30", name: "صندوق المفاجأة", category: "other", image: "/gifts/confetti-box.png", description: "مفاجأة احتفالية" },
          { id: "g31", name: "لغز الكوكب", category: "toy", image: "/gifts/planet-puzzle.png", description: "حل تحدٍ جديد" },
          { id: "g32", name: "قلب التشجيع", category: "other", image: "/gifts/heart-encouragement.png", description: "تشجيع على إعادة المحاولة" },
        ];
        await db.gift.createMany({ data: defaults });
        return db.gift.findMany({ orderBy: { createdAt: "asc" } });
      }
      return all;
    }
    case "gifts.save": {
      const [gift] = args;
      const id = gift?.id;
      if (!id) throw new ApiInputError("gifts.save: missing id");
      const allowed = ["name", "category", "image", "description"];
      const safe: Record<string, unknown> = { id };
      for (const k of allowed) if (k in gift) safe[k] = gift[k];
      return db.gift.upsert({ where: { id }, create: safe as any, update: safe as any });
    }
    case "gifts.delete": {
      const [id] = args;
      return db.gift.delete({ where: { id } });
    }
    case "gifts.awardToStudent": {
      const [studentId, giftId, giftName, giftImage] = args;
      return db.studentGift.create({ data: { studentId, giftId, giftName, giftImage } });
    }
    case "gifts.listByStudent": {
      const [studentId] = args;
      return db.studentGift.findMany({ where: { studentId }, orderBy: { awardedAt: "desc" } });
    }

    // ---------- Game templates and tournament planning ----------
    case "gameTemplates.list": {
      return db.gameTemplate.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
    }
    case "gameTemplates.save": {
      const [template] = args;
      const id = String(template?.id || `game-template-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      return db.gameTemplate.upsert({
        where: { id },
        create: { id, name: String(template?.name || "لعبة مخصصة"), type: String(template?.type || "quiz"), configJson: typeof template?.configJson === "string" ? template.configJson : JSON.stringify(template?.config || {}), isPublic: template?.isPublic === true, isActive: template?.isActive !== false },
        update: { name: String(template?.name || "لعبة مخصصة"), type: String(template?.type || "quiz"), configJson: typeof template?.configJson === "string" ? template.configJson : JSON.stringify(template?.config || {}), isPublic: template?.isPublic === true, isActive: template?.isActive !== false },
      });
    }
    case "gameTemplates.delete": {
      const [id] = args;
      return db.gameTemplate.update({ where: { id: String(id) }, data: { isActive: false } });
    }
    case "tournaments.list": {
      return db.tournament.findMany({ orderBy: { updatedAt: "desc" }, take: 50 });
    }
    case "tournaments.save": {
      const [tournament] = args;
      const id = String(tournament?.id || `tournament-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      return db.tournament.upsert({
        where: { id },
        create: { id, name: String(tournament?.name || "بطولة جديدة"), status: String(tournament?.status || "draft"), participantsJson: typeof tournament?.participantsJson === "string" ? tournament.participantsJson : JSON.stringify(tournament?.participants || []), roundsJson: typeof tournament?.roundsJson === "string" ? tournament.roundsJson : JSON.stringify(tournament?.rounds || []), currentRound: Math.max(0, Number(tournament?.currentRound) || 0) },
        update: { name: String(tournament?.name || "بطولة جديدة"), status: String(tournament?.status || "draft"), participantsJson: typeof tournament?.participantsJson === "string" ? tournament.participantsJson : JSON.stringify(tournament?.participants || []), roundsJson: typeof tournament?.roundsJson === "string" ? tournament.roundsJson : JSON.stringify(tournament?.rounds || []), currentRound: Math.max(0, Number(tournament?.currentRound) || 0) },
      });
    }
    case "tournaments.delete": {
      const [id] = args;
      return db.tournament.delete({ where: { id: String(id) } });
    }

    // ---------- Rewards V10: custom badges, levels, achievements, combos ----------
    case "customBadges.list": {
      return db.customBadge.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
    }
    case "customBadges.save": {
      const [badge] = args;
      const id = String(badge?.id || `badge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      const allowed = ["name", "icon", "color", "description", "condition", "metric", "threshold", "isActive"];
      const safe: Record<string, unknown> = { id, name: String(badge?.name || "شارة جديدة") };
      for (const key of allowed) if (key in (badge || {})) safe[key] = badge[key];
      return db.customBadge.upsert({ where: { id }, create: safe as any, update: safe as any });
    }
    case "customBadges.delete": {
      const [id] = args;
      return db.customBadge.update({ where: { id: String(id) }, data: { isActive: false } });
    }
    case "badgeProgress.upsert": {
      const [studentId, badgeId, level = "bronze", count = 1] = args;
      return db.studentBadgeProgress.upsert({
        where: { studentId_badgeId: { studentId: String(studentId), badgeId: String(badgeId) } },
        create: { studentId: String(studentId), badgeId: String(badgeId), level: String(level), count: Math.max(1, Number(count) || 1) },
        update: { level: String(level), count: Math.max(1, Number(count) || 1) },
      });
    }
    case "achievements.list": {
      return db.achievement.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
    }
    case "achievements.save": {
      const [achievement] = args;
      const id = String(achievement?.id || `achievement-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      const safe: Record<string, unknown> = {
        id,
        name: String(achievement?.name || "إنجاز جديد"),
        description: String(achievement?.description || ""),
        icon: String(achievement?.icon || "achievement"),
        metric: String(achievement?.metric || "correctStreak"),
        threshold: Math.max(1, Number(achievement?.threshold) || 1),
        rewardPoints: Math.max(0, Number(achievement?.rewardPoints) || 0),
        badgeId: achievement?.badgeId ? String(achievement.badgeId) : null,
        isActive: achievement?.isActive !== false,
      };
      return db.achievement.upsert({ where: { id }, create: safe as any, update: safe as any });
    }
    case "achievements.delete": {
      const [id] = args;
      return db.achievement.update({ where: { id: String(id) }, data: { isActive: false } });
    }
    case "achievements.unlock": {
      const [studentId, achievementId, sessionId = null] = args;
      const achievement = await db.achievement.findUnique({ where: { id: String(achievementId) } });
      if (!achievement) throw new ApiInputError("achievements.unlock: unknown achievement");
      return db.$transaction(async (tx) => {
        const existing = await tx.studentAchievement.findUnique({ where: { studentId_achievementId: { studentId: String(studentId), achievementId: String(achievementId) } } });
        if (existing) return { unlocked: false, achievement: existing };
        const unlocked = await tx.studentAchievement.create({ data: { studentId: String(studentId), achievementId: String(achievementId), rewardApplied: achievement.rewardPoints <= 0 } });
        if (achievement.rewardPoints > 0) {
          await tx.student.update({ where: { id: String(studentId) }, data: { points: { increment: achievement.rewardPoints } } });
        }
        await tx.rewardEvent.create({ data: { eventKey: `achievement:${studentId}:${achievementId}`, studentId: String(studentId), sessionId: sessionId ? String(sessionId) : null, kind: "achievement", points: achievement.rewardPoints, badgeId: achievement.badgeId, metadataJson: JSON.stringify({ achievementId }) } });
        return { unlocked: true, achievement: unlocked };
      });
    }
    case "giftCombos.list": {
      return db.giftCombo.findMany({ where: { enabled: true }, orderBy: { createdAt: "asc" } });
    }
    case "giftCombos.save": {
      const [combo] = args;
      const id = String(combo?.id || `combo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      const safe: Record<string, unknown> = {
        id,
        name: String(combo?.name || "حزمة جديدة"),
        giftId: String(combo?.giftId || ""),
        celebrationId: String(combo?.celebrationId || ""),
        badgeId: combo?.badgeId ? String(combo.badgeId) : null,
        points: Math.max(0, Number(combo?.points) || 0),
        enabled: combo?.enabled !== false,
      };
      if (!safe.giftId || !safe.celebrationId) throw new ApiInputError("giftCombos.save: giftId and celebrationId are required");
      return db.giftCombo.upsert({ where: { id }, create: safe as any, update: safe as any });
    }
    case "giftCombos.delete": {
      const [id] = args;
      return db.giftCombo.update({ where: { id: String(id) }, data: { enabled: false } });
    }
    case "giftCombos.award": {
      const [studentId, comboId, sessionId = null, requestedEventKey = null] = args;
      const combo = await db.giftCombo.findUnique({ where: { id: String(comboId) } });
      if (!combo || !combo.enabled) throw new ApiInputError("giftCombos.award: combo unavailable");
      const eventKey = String(requestedEventKey || `combo:${studentId}:${comboId}:${sessionId || "session"}`);
      return db.$transaction(async (tx) => {
        const existing = await tx.rewardEvent.findUnique({ where: { eventKey } });
        if (existing) return { awarded: false, idempotent: true, event: existing };
        const gift = await tx.gift.findUnique({ where: { id: combo.giftId } });
        const giftRecord = await tx.studentGift.create({ data: { studentId: String(studentId), giftId: combo.giftId, giftName: gift?.name || combo.name, giftImage: gift?.image || "" } });
        if (combo.points > 0) await tx.student.update({ where: { id: String(studentId) }, data: { points: { increment: combo.points } } });
        const event = await tx.rewardEvent.create({ data: { eventKey, studentId: String(studentId), sessionId: sessionId ? String(sessionId) : null, kind: "gift-combo", points: combo.points, giftId: combo.giftId, badgeId: combo.badgeId, celebrationId: combo.celebrationId, metadataJson: JSON.stringify({ comboId: combo.id, giftRecordId: giftRecord.id }) } });
        return { awarded: true, idempotent: false, event, gift: giftRecord };
      });
    }
    // ---------- Celebration sequences and audio profiles ----------
    case "celebrationSequences.list": {
      return db.celebrationSequence.findMany({ where: { enabled: true }, orderBy: { createdAt: "asc" } });
    }
    case "celebrationSequences.save": {
      const [sequence] = args;
      const id = String(sequence?.id || `sequence-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      const safe: Record<string, unknown> = {
        id,
        name: String(sequence?.name || "تسلسل جديد"),
        enabled: sequence?.enabled !== false,
        durationMs: Math.max(100, Number(sequence?.durationMs) || 3000),
        stepsJson: typeof sequence?.stepsJson === "string" ? sequence.stepsJson : JSON.stringify(sequence?.steps || []),
        isDefault: sequence?.isDefault === true,
      };
      return db.celebrationSequence.upsert({ where: { id }, create: safe as any, update: safe as any });
    }
    case "celebrationSequences.delete": {
      const [id] = args;
      return db.celebrationSequence.update({ where: { id: String(id) }, data: { enabled: false } });
    }
    case "audioProfiles.get": {
      return db.audioProfile.findFirst({ orderBy: { updatedAt: "desc" } });
    }
    case "audioProfiles.save": {
      const [profile] = args;
      const id = String(profile?.id || "audio-profile-default");
      const safe: Record<string, unknown> = {
        id,
        name: String(profile?.name || "الإعداد الافتراضي"),
        enabled: profile?.enabled !== false,
        masterVolume: Math.max(0, Math.min(1, Number(profile?.masterVolume) || 0.7)),
        channelsJson: typeof profile?.channelsJson === "string" ? profile.channelsJson : JSON.stringify(profile?.channels || {}),
        ambiance: String(profile?.ambiance || "none"),
        haptics: profile?.haptics === true,
        ttsProvider: profile?.ttsProvider ? String(profile.ttsProvider) : null,
        ttsVoice: profile?.ttsVoice ? String(profile.ttsVoice) : null,
      };
      return db.audioProfile.upsert({ where: { id }, create: safe as any, update: safe as any });
    }
    case "rewardEvents.listByStudent": {
      const [studentId, limit = 100] = args;
      return db.rewardEvent.findMany({ where: { studentId: String(studentId) }, orderBy: { createdAt: "desc" }, take: Math.min(500, Math.max(1, Number(limit) || 100)) });
    }

    // ---------- Attendance ----------
    case "attendance.save": {
      const [classId, date, absentStudentIds] = args;
      const existing = await db.attendanceRecord.findFirst({ where: { classId, date } });
      if (existing) {
        return db.attendanceRecord.update({
          where: { id: existing.id },
          data: { absentStudentIds: JSON.stringify(absentStudentIds) },
        });
      }
      return db.attendanceRecord.create({
        data: { classId, date, absentStudentIds: JSON.stringify(absentStudentIds) },
      });
    }
    case "attendance.list": {
      const [classId] = args;
      return db.attendanceRecord.findMany({ where: { classId }, orderBy: { date: "desc" } });
    }

    // ---------- Sessions ----------
    case "sessions.start": {
      const [classId, name = "جلسة جديدة"] = args;
      // Verify the class exists in SQLite before creating the session.
      // If classId is from IndexedDB (legacy) and doesn't exist in SQLite,
      // set classId to null so the FK constraint isn't violated.
      let effectiveClassId: string | null = null;
      if (classId) {
        const cls = await db.classRoom.findUnique({ where: { id: classId }, select: { id: true } });
        if (cls) {
          effectiveClassId = classId;
        } else {
          // Class exists in IndexedDB but not SQLite — create it silently
          try {
            await db.classRoom.create({ data: { id: classId, name: "صف مستورد" } });
            effectiveClassId = classId;
          } catch {
            // If creation fails (e.g., race condition), proceed without classId
            effectiveClassId = null;
          }
        }
      }
      const session = await db.session.create({ data: { classId: effectiveClassId, name } });
      // C37 (P2 fix): only snapshot when there's an active class. Previously,
      // a null effectiveClassId fell through to `db.student.findMany()` with no
      // filter — snapshotting ALL students across every class. Skip entirely
      // when no class is active.
      if (effectiveClassId) {
        const students = await db.student.findMany({ where: { classId: effectiveClassId } });
        if (students.length > 0) {
          await db.sessionStudentSnapshot.createMany({
            data: students.map(s => ({
              sessionId: session.id,
              studentId: s.id,
              pointsStart: s.points,
              correctStart: s.correctAnswers,
              wrongStart: s.wrongAnswers,
              attemptsStart: s.attempts,
              badgesCountStart: 0,
            })),
          });
        }
      }
      return session;
    }
    case "sessions.end": {
      // P1-4 fix: write statsJson (was only setting endedAt before — stats thrown away)
      const [sessionId, stats] = args;
      const data: any = { endedAt: new Date() };
      if (stats && typeof stats === "object") {
        data.statsJson = JSON.stringify(stats);
      }
      // Idempotent by design: a browser may retain a stale session id after
      // a local DB reset or after another tab already ended the session.
      // updateMany preserves statsJson while avoiding a noisy P2025 error.
      const id = typeof sessionId === "string" ? sessionId : "";
      const updated = await db.session.updateMany({ where: { id }, data });
      if (!updated.count) return null;
      return db.session.findUnique({ where: { id } });
    }
    case "sessions.list": {
      const [classId] = args;
      return db.session.findMany({
        where: classId ? { classId } : {},
        orderBy: { startedAt: "desc" },
        take: 50,
      });
    }
    case "sessions.snapshotStudents": {
      const [sessionId] = args;
      return db.sessionStudentSnapshot.findMany({ where: { sessionId } });
    }
    case "sessions.getStudentDelta": {
      const [sessionId, studentId] = args;
      const snap = await db.sessionStudentSnapshot.findUnique({
        where: { sessionId_studentId: { sessionId, studentId } },
      });
      if (!snap) return null;
      const student = await db.student.findUnique({
        where: { id: studentId },
        include: { badges: true, gifts: true },
      });
      if (!student) return null;
      return {
        snapshot: snap,
        current: student,
        delta: {
          points: student.points - snap.pointsStart,
          correct: student.correctAnswers - snap.correctStart,
          wrong: student.wrongAnswers - snap.wrongStart,
          attempts: student.attempts - snap.attemptsStart,
        },
      };
    }

    // ---------- Game Results ----------
    case "gameResults.create": {
      const [data] = args;
      const allowed = ["sessionId", "gameType", "gameMode", "ideaId", "questionCount", "configJson", "startedAt", "durationMs", "endedAt"];
      const safe: Record<string, unknown> = {};
      for (const k of allowed) if (k in (data || {})) safe[k] = data[k];
      return db.gameResult.create({ data: safe as any });
    }
    case "gameResults.addParticipant": {
      const [data] = args;
      const allowed = ["gameResultId", "studentId", "studentName", "pointsEarned", "correctCount", "wrongCount", "isWinner"];
      const safe: Record<string, unknown> = {};
      for (const k of allowed) if (k in (data || {})) safe[k] = data[k];
      return db.gameResultParticipant.create({ data: safe as any });
    }
    case "gameResults.addQuestion": {
      const [data] = args;
      const allowed = ["gameResultId", "questionId", "questionText", "studentId", "studentAnswer", "isCorrect", "pointsEarned"];
      const safe: Record<string, unknown> = {};
      for (const k of allowed) if (k in (data || {})) safe[k] = data[k];
      return db.gameResultQuestion.create({ data: safe as any });
    }
    case "gameResults.complete": {
      const [data] = args;
      const allowed = ["id", "endedAt", "durationMs"];
      const safe: Record<string, unknown> = {};
      for (const k of allowed) if (k in (data || {})) safe[k] = data[k];
      const id = typeof safe.id === "string" ? safe.id : "";
      if (!id) throw new Error("gameResults.complete requires id");
      delete safe.id;
      return db.gameResult.update({ where: { id }, data: safe as any });
    }
    case "gameResults.listRecent": {
      const [requestedLimit = 20] = args;
      const limit = Math.max(1, Math.min(100, Number(requestedLimit) || 20));
      return db.gameResult.findMany({
        orderBy: { startedAt: "desc" },
        take: limit,
        include: { participants: true, questions: true },
      });
    }

    // ---------- Custom Sounds ----------
    case "sounds.list": {
      return db.customSound.findMany({ orderBy: { createdAt: "desc" } });
    }
    case "sounds.save": {
      const [sound] = args;
      const id = sound?.id;
      if (!id) throw new ApiInputError("sounds.save: missing id");
      const allowed = ["name", "filePath", "celebrationType"];
      const safe: Record<string, unknown> = { id };
      for (const k of allowed) if (k in sound) safe[k] = sound[k];
      return db.customSound.upsert({ where: { id }, create: safe as any, update: safe as any });
    }
    case "sounds.delete": {
      const [id] = args;
      return db.customSound.delete({ where: { id } });
    }

    // ---------- Celebrations (كتالوج الاحتفالات - تعديل/حذف) ----------
    case "celebrations.list": {
      return db.celebration.findMany({
        orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      });
    }
    case "celebrations.save": {
      const [celeb] = args;
      const allowed = ["label","icon","color","color2","tagline","hype","sound","renderMode","isDefault","isCustom","sortOrder"];
      const safe: Record<string, unknown> = {};
      for (const k of allowed) if (k in (celeb || {})) safe[k] = celeb[k];
      const id = celeb.id || `custom_${Date.now()}`;
      return db.celebration.upsert({
        where: { id },
        create: { id, ...safe } as any,
        update: safe as any,
      });
    }
    case "celebrations.delete": {
      const [id] = args;
      const existing = await db.celebration.findUnique({ where: { id } });
      if (existing?.isDefault) {
        throw new ApiInputError("Cannot delete default celebration");
      }
      return db.celebration.delete({ where: { id } });
    }
    case "celebrations.seedDefaults": {
      const [defaults] = args as [Array<{ id: string; label: string; icon: string; color: string; color2: string; tagline: string; hype: string; sound: string; renderMode?: "confetti" | "particles" | "both"; sortOrder: number }>];
      const results: any[] = [];
      for (const c of defaults) {
        const exists = await db.celebration.findUnique({ where: { id: c.id } });
        if (!exists) {
          const created = await db.celebration.create({
            data: {
              id: c.id,
              label: c.label,
              icon: c.icon,
              color: c.color,
              color2: c.color2,
              tagline: c.tagline,
              hype: c.hype,
              sound: c.sound,
              renderMode: c.renderMode ?? "confetti",
              isDefault: true,
              isCustom: false,
              sortOrder: c.sortOrder ?? 0,
            },
          });
          results.push(created);
        }
      }
      return { seeded: results.length };
    }

    // ---------- Moodle + curriculum mappings ----------
    case "moodleMappings.list": {
      const [scope] = args;
      const where = scope && typeof scope === "object" ? scope as Record<string, unknown> : {};
      const [curricula, lessons, ideas, courses, sections, groups, students, activities, questions, homeworks, cursors] = await Promise.all([
        db.curriculumMap.findMany({ orderBy: [{ academicYear: "desc" }, { grade: "asc" }, { subject: "asc" }] }),
        db.curriculumLesson.findMany({ where: typeof where.curriculumKey === "string" ? { curriculumKey: where.curriculumKey } : undefined, orderBy: [{ curriculumKey: "asc" }, { orderIndex: "asc" }] }),
        db.curriculumIdea.findMany({ where: typeof where.lessonKey === "string" ? { lessonKey: where.lessonKey } : undefined, orderBy: [{ lessonKey: "asc" }, { orderIndex: "asc" }] }),
        db.moodleCourseMap.findMany({ orderBy: { updatedAt: "desc" } }),
        db.moodleSectionMap.findMany({ orderBy: [{ courseMapId: "asc" }, { orderIndex: "asc" }] }),
        db.moodleGroupMap.findMany({ orderBy: { updatedAt: "desc" } }),
        db.moodleStudentMap.findMany({ orderBy: { displayName: "asc" }, take: 5000 }),
        db.moodleActivityMap.findMany({ orderBy: { updatedAt: "desc" } }),
        db.moodleQuestionMap.findMany({ orderBy: [{ lessonKey: "asc" }, { questionOrder: "asc" }] }),
        db.moodleHomeworkMap.findMany({ orderBy: { updatedAt: "desc" } }),
        db.moodleSyncCursor.findMany({ orderBy: { updatedAt: "desc" } }),
      ]);
      return { curricula, lessons, ideas, courses, sections, groups, students, activities, questions, homeworks, cursors };
    }
    case "moodleMappings.saveCurriculum": {
      const [input] = args;
      if (!input || typeof input !== "object") throw new ApiInputError("curriculum mapping requires an object");
      const item = input as Record<string, unknown>;
      const curriculumKey = String(item.curriculumKey || "").trim();
      if (!curriculumKey) throw new ApiInputError("curriculumKey is required");
      const allowed = ["academicYear", "grade", "subject", "title", "metadataJson"];
      const data: Record<string, unknown> = { curriculumKey };
      for (const key of allowed) if (key in item) data[key] = item[key];
      return db.curriculumMap.upsert({ where: { curriculumKey }, create: data as any, update: data as any });
    }
    case "moodleMappings.saveLesson": {
      const [input] = args;
      if (!input || typeof input !== "object") throw new ApiInputError("lesson mapping requires an object");
      const item = input as Record<string, unknown>;
      const curriculumKey = String(item.curriculumKey || "").trim();
      const lessonKey = String(item.lessonKey || "").trim();
      if (!curriculumKey || !lessonKey) throw new ApiInputError("curriculumKey and lessonKey are required");
      const data = { curriculumKey, lessonKey, title: String(item.title || lessonKey), orderIndex: Number.isInteger(item.orderIndex) ? Number(item.orderIndex) : 0, metadataJson: typeof item.metadataJson === "string" ? item.metadataJson : "{}" };
      return db.curriculumLesson.upsert({ where: { curriculumKey_lessonKey: { curriculumKey, lessonKey } }, create: data, update: data });
    }
    case "moodleMappings.saveIdea": {
      const [input] = args;
      if (!input || typeof input !== "object") throw new ApiInputError("idea mapping requires an object");
      const item = input as Record<string, unknown>;
      const curriculumKey = String(item.curriculumKey || "").trim();
      const lessonKey = String(item.lessonKey || "").trim();
      const ideaKey = String(item.ideaKey || "").trim();
      if (!curriculumKey || !lessonKey || !ideaKey) throw new ApiInputError("curriculumKey, lessonKey and ideaKey are required");
      const data = { curriculumKey, lessonKey, ideaKey, title: String(item.title || ideaKey), orderIndex: Number.isInteger(item.orderIndex) ? Number(item.orderIndex) : 0, skillKey: typeof item.skillKey === "string" ? item.skillKey : null, metadataJson: typeof item.metadataJson === "string" ? item.metadataJson : "{}" };
      return db.curriculumIdea.upsert({ where: { curriculumKey_lessonKey_ideaKey: { curriculumKey, lessonKey, ideaKey } }, create: data, update: data });
    }
    case "moodleMappings.saveCourse": {
      const [input] = args;
      if (!input || typeof input !== "object") throw new ApiInputError("course mapping requires an object");
      const item = input as Record<string, unknown>;
      const moodleCourseId = Number(item.moodleCourseId);
      const curriculumKey = String(item.curriculumKey || "").trim();
      if (!Number.isInteger(moodleCourseId) || moodleCourseId <= 0 || !curriculumKey) throw new ApiInputError("valid moodleCourseId and curriculumKey are required");
      const data = { moodleCourseId, curriculumKey, label: String(item.label || ""), enabled: item.enabled !== false, metadataJson: typeof item.metadataJson === "string" ? item.metadataJson : "{}" };
      return db.moodleCourseMap.upsert({ where: { moodleCourseId_curriculumKey: { moodleCourseId, curriculumKey } }, create: data, update: data });
    }
    case "moodleMappings.saveSection": {
      const [input] = args;
      if (!input || typeof input !== "object") throw new ApiInputError("section mapping requires an object");
      const item = input as Record<string, unknown>;
      const courseMapId = String(item.courseMapId || "").trim();
      const moodleSectionId = Number(item.moodleSectionId);
      const sectionKey = String(item.sectionKey || "").trim();
      if (!courseMapId || !Number.isInteger(moodleSectionId) || moodleSectionId < 0 || !sectionKey) throw new ApiInputError("valid courseMapId, moodleSectionId and sectionKey are required");
      const data = { courseMapId, moodleSectionId, sectionKey, name: String(item.name || sectionKey), orderIndex: Number.isInteger(item.orderIndex) ? Number(item.orderIndex) : 0, visible: item.visible === true, lastSeenAt: new Date(), metadataJson: typeof item.metadataJson === "string" ? item.metadataJson : "{}" };
      return db.moodleSectionMap.upsert({ where: { courseMapId_moodleSectionId: { courseMapId, moodleSectionId } }, create: data, update: data });
    }
    case "moodleMappings.saveGroup": {
      const [input] = args;
      if (!input || typeof input !== "object") throw new ApiInputError("group mapping requires an object");
      const item = input as Record<string, unknown>;
      const courseMapId = String(item.courseMapId || "").trim();
      const moodleGroupId = Number(item.moodleGroupId);
      if (!courseMapId || !Number.isInteger(moodleGroupId) || moodleGroupId <= 0) throw new ApiInputError("valid courseMapId and moodleGroupId are required");
      const data = { courseMapId, moodleGroupId, classId: typeof item.classId === "string" ? item.classId : null, className: String(item.className || ""), enabled: item.enabled !== false, metadataJson: typeof item.metadataJson === "string" ? item.metadataJson : "{}" };
      return db.moodleGroupMap.upsert({ where: { courseMapId_moodleGroupId: { courseMapId, moodleGroupId } }, create: data, update: data });
    }
    case "moodleMappings.saveStudent": {
      const [input] = args;
      if (!input || typeof input !== "object") throw new ApiInputError("student mapping requires an object");
      const item = input as Record<string, unknown>;
      const courseMapId = String(item.courseMapId || "").trim();
      const moodleUserId = Number(item.moodleUserId);
      if (!courseMapId || !Number.isInteger(moodleUserId) || moodleUserId <= 0) throw new ApiInputError("valid courseMapId and moodleUserId are required");
      const data = { courseMapId, moodleUserId, moodleGroupId: Number.isInteger(item.moodleGroupId) ? Number(item.moodleGroupId) : null, studentId: typeof item.studentId === "string" ? item.studentId : null, classId: typeof item.classId === "string" ? item.classId : null, moodleUsername: typeof item.moodleUsername === "string" ? item.moodleUsername : null, displayName: String(item.displayName || ""), enabled: item.enabled !== false, metadataJson: typeof item.metadataJson === "string" ? item.metadataJson : "{}" };
      return db.moodleStudentMap.upsert({ where: { courseMapId_moodleUserId: { courseMapId, moodleUserId } }, create: data, update: data });
    }
    case "moodleMappings.saveActivity": {
      const [input] = args;
      if (!input || typeof input !== "object") throw new ApiInputError("activity mapping requires an object");
      const item = input as Record<string, unknown>;
      const courseMapId = String(item.courseMapId || "").trim();
      const moodleActivityId = Number(item.moodleActivityId);
      const curriculumKey = String(item.curriculumKey || "").trim();
      const lessonKey = String(item.lessonKey || "").trim();
      if (!courseMapId || !Number.isInteger(moodleActivityId) || moodleActivityId <= 0 || !curriculumKey || !lessonKey) throw new ApiInputError("courseMapId, moodleActivityId, curriculumKey and lessonKey are required");
      const confidence = typeof item.confidence === "number" && Number.isFinite(item.confidence) ? Math.max(0, Math.min(1, item.confidence)) : null;
      const data = { courseMapId, sectionMapId: typeof item.sectionMapId === "string" ? item.sectionMapId : null, moodleSectionId: Number.isInteger(item.moodleSectionId) ? Number(item.moodleSectionId) : null, moodleActivityId, activityType: String(item.activityType || "quiz"), curriculumKey, lessonKey, ideaKey: typeof item.ideaKey === "string" ? item.ideaKey : null, externalKey: typeof item.externalKey === "string" ? item.externalKey : null, name: String(item.name || ""), visible: item.visible === true, mappingMode: String(item.mappingMode || "manual"), confidence, needsReview: item.needsReview === true, sourceFingerprint: typeof item.sourceFingerprint === "string" ? item.sourceFingerprint : null, orderIndex: Number.isInteger(item.orderIndex) ? Number(item.orderIndex) : 0, dueAt: item.dueAt ? new Date(String(item.dueAt)) : null, lastSeenAt: new Date(), metadataJson: typeof item.metadataJson === "string" ? item.metadataJson : "{}" };
      return db.moodleActivityMap.upsert({ where: { courseMapId_moodleActivityId_activityType: { courseMapId, moodleActivityId, activityType: data.activityType } }, create: data, update: data });
    }
    case "moodleMappings.saveQuestion": {
      const [input] = args;
      if (!input || typeof input !== "object") throw new ApiInputError("question mapping requires an object");
      const item = input as Record<string, unknown>;
      const activityMapId = String(item.activityMapId || "").trim();
      const moodleQuestionId = Number(item.moodleQuestionId);
      const curriculumKey = String(item.curriculumKey || "").trim();
      const lessonKey = String(item.lessonKey || "").trim();
      if (!activityMapId || !Number.isInteger(moodleQuestionId) || moodleQuestionId <= 0 || !curriculumKey || !lessonKey) throw new ApiInputError("activityMapId, moodleQuestionId, curriculumKey and lessonKey are required");
      const data = { activityMapId, moodleQuestionId, curriculumKey, lessonKey, ideaKey: typeof item.ideaKey === "string" ? item.ideaKey : null, tag: typeof item.tag === "string" ? item.tag : null, externalKey: typeof item.externalKey === "string" ? item.externalKey : null, questionOrder: Number.isInteger(item.questionOrder) ? Number(item.questionOrder) : null, isPlayable: item.isPlayable !== false, metadataJson: typeof item.metadataJson === "string" ? item.metadataJson : "{}" };
      return db.moodleQuestionMap.upsert({ where: { activityMapId_moodleQuestionId: { activityMapId, moodleQuestionId } }, create: data, update: data });
    }
    case "moodleMappings.saveHomework": {
      const [input] = args;
      if (!input || typeof input !== "object") throw new ApiInputError("homework mapping requires an object");
      const item = input as Record<string, unknown>;
      const courseMapId = String(item.courseMapId || "").trim();
      const moodleActivityId = Number(item.moodleActivityId);
      const curriculumKey = String(item.curriculumKey || "").trim();
      const lessonKey = String(item.lessonKey || "").trim();
      if (!courseMapId || !Number.isInteger(moodleActivityId) || moodleActivityId <= 0 || !curriculumKey || !lessonKey) throw new ApiInputError("courseMapId, moodleActivityId, curriculumKey and lessonKey are required");
      const data = { courseMapId, moodleActivityId, activityType: String(item.activityType || "assignment"), curriculumKey, lessonKey, externalKey: typeof item.externalKey === "string" ? item.externalKey : null, name: String(item.name || ""), dueAt: item.dueAt ? new Date(String(item.dueAt)) : null, enabled: item.enabled !== false, metadataJson: typeof item.metadataJson === "string" ? item.metadataJson : "{}" };
      return db.moodleHomeworkMap.upsert({ where: { courseMapId_moodleActivityId_activityType: { courseMapId, moodleActivityId, activityType: data.activityType } }, create: data, update: data });
    }
    case "moodleMappings.saveCursor": {
      const [input] = args;
      if (!input || typeof input !== "object") throw new ApiInputError("cursor requires an object");
      const item = input as Record<string, unknown>;
      const scopeKey = String(item.scopeKey || "").trim();
      if (!scopeKey) throw new ApiInputError("scopeKey is required");
      const data = { scopeKey, courseMapId: typeof item.courseMapId === "string" ? item.courseMapId : null, lastCursor: typeof item.lastCursor === "string" ? item.lastCursor : null, lastSyncAt: item.lastSyncAt ? new Date(String(item.lastSyncAt)) : new Date(), lastSuccessAt: item.lastSuccessAt ? new Date(String(item.lastSuccessAt)) : null, status: String(item.status || "never"), error: typeof item.error === "string" ? item.error : null, syncedCount: Number.isInteger(item.syncedCount) ? Number(item.syncedCount) : 0, changedCount: Number.isInteger(item.changedCount) ? Number(item.changedCount) : 0, skippedCount: Number.isInteger(item.skippedCount) ? Number(item.skippedCount) : 0, requestCount: Number.isInteger(item.requestCount) ? Number(item.requestCount) : 0, nextPollMs: Number.isInteger(item.nextPollMs) ? Math.max(1000, Math.min(120000, Number(item.nextPollMs))) : 5000, lastChangedAt: item.lastChangedAt ? new Date(String(item.lastChangedAt)) : null, metadataJson: typeof item.metadataJson === "string" ? item.metadataJson : "{}" };
      return db.moodleSyncCursor.upsert({ where: { scopeKey }, create: data, update: data });
    }

    // ---------- Moodle results and homework aggregation ----------
    case "moodleResults.ideaRunCreate": {
      const [input] = args;
      if (!input || typeof input !== "object") throw new ApiInputError("idea run requires an object");
      const item = input as Record<string, unknown>;
      const curriculumKey = String(item.curriculumKey || "").trim();
      const lessonKey = String(item.lessonKey || "").trim();
      const ideaKey = String(item.ideaKey || "").trim();
      if (!curriculumKey || !lessonKey || !ideaKey) throw new ApiInputError("curriculumKey, lessonKey and ideaKey are required");
      const existing = await db.ideaRun.findFirst({ where: { sessionId: typeof item.sessionId === "string" ? item.sessionId : null, curriculumKey, lessonKey, ideaKey, status: "active" }, orderBy: { startedAt: "desc" } });
      if (existing) return existing;
      return db.ideaRun.create({ data: { sessionId: typeof item.sessionId === "string" ? item.sessionId : null, curriculumKey, lessonKey, ideaKey, activityMapId: typeof item.activityMapId === "string" ? item.activityMapId : null, status: "active", statsJson: typeof item.statsJson === "string" ? item.statsJson : "{}" } });
    }
    case "moodleResults.ideaAttemptUpsert": {
      const [input] = args;
      if (!input || typeof input !== "object") throw new ApiInputError("idea attempt requires an object");
      const item = input as Record<string, unknown>;
      const ideaRunId = String(item.ideaRunId || "").trim();
      const moodleUserId = Number(item.moodleUserId);
      const moodleQuestionId = Number(item.moodleQuestionId);
      if (!ideaRunId || !Number.isInteger(moodleUserId) || !Number.isInteger(moodleQuestionId)) throw new ApiInputError("ideaRunId, moodleUserId and moodleQuestionId are required");
      const data = { ideaRunId, questionMapId: typeof item.questionMapId === "string" ? item.questionMapId : null, studentId: typeof item.studentId === "string" ? item.studentId : null, moodleUserId, moodleAttemptId: Number.isInteger(item.moodleAttemptId) ? Number(item.moodleAttemptId) : 0, moodleQuestionId, studentAnswer: typeof item.studentAnswer === "string" ? item.studentAnswer : null, isCorrect: typeof item.isCorrect === "boolean" ? item.isCorrect : null, pointsEarned: typeof item.pointsEarned === "number" ? item.pointsEarned : 0, status: typeof item.status === "string" ? item.status : "answered", startedAt: item.startedAt ? new Date(String(item.startedAt)) : null, submittedAt: item.submittedAt ? new Date(String(item.submittedAt)) : null, metadataJson: typeof item.metadataJson === "string" ? item.metadataJson : "{}" };
      return db.ideaQuestionAttempt.upsert({ where: { ideaRunId_moodleUserId_moodleQuestionId_moodleAttemptId: { ideaRunId, moodleUserId, moodleQuestionId, moodleAttemptId: data.moodleAttemptId } }, create: data, update: data });
    }
    case "moodleResults.homeworkSnapshotUpsert": {
      const [input] = args;
      if (!input || typeof input !== "object") throw new ApiInputError("homework snapshot requires an object");
      const item = input as Record<string, unknown>;
      const homeworkMapId = String(item.homeworkMapId || "").trim();
      const moodleUserId = Number(item.moodleUserId);
      if (!homeworkMapId || !Number.isInteger(moodleUserId)) throw new ApiInputError("homeworkMapId and moodleUserId are required");
      const totalQuestions = Math.max(0, Number(item.totalQuestions) || 0);
      const answeredQuestions = Math.max(0, Number(item.answeredQuestions) || 0);
      const correctQuestions = Math.max(0, Number(item.correctQuestions) || 0);
      const wrongQuestions = Math.max(0, Number(item.wrongQuestions) || 0);
      const completionPct = totalQuestions ? Math.round((answeredQuestions / totalQuestions) * 10000) / 100 : 0;
      const successOnAnsweredPct = answeredQuestions ? Math.round((correctQuestions / answeredQuestions) * 10000) / 100 : null;
      const successOnTotalPct = totalQuestions ? Math.round((correctQuestions / totalQuestions) * 10000) / 100 : null;
      const data = { homeworkMapId, studentId: typeof item.studentId === "string" ? item.studentId : null, moodleUserId, moodleSubmissionId: Number.isInteger(item.moodleSubmissionId) ? Number(item.moodleSubmissionId) : null, status: typeof item.status === "string" ? item.status : "unknown", totalQuestions, answeredQuestions, unansweredQuestions: Math.max(0, totalQuestions - answeredQuestions), correctQuestions, wrongQuestions, completionPct, successOnAnsweredPct, successOnTotalPct, moodleGrade: typeof item.moodleGrade === "number" ? item.moodleGrade : null, moodleMaxGrade: typeof item.moodleMaxGrade === "number" ? item.moodleMaxGrade : null, submittedAt: item.submittedAt ? new Date(String(item.submittedAt)) : null, dueAt: item.dueAt ? new Date(String(item.dueAt)) : null, sourceUpdatedAt: item.sourceUpdatedAt ? new Date(String(item.sourceUpdatedAt)) : new Date(), metadataJson: typeof item.metadataJson === "string" ? item.metadataJson : "{}" };
      return db.homeworkSnapshot.upsert({ where: { homeworkMapId_moodleUserId: { homeworkMapId, moodleUserId } }, create: data, update: data });
    }
    case "moodleResults.homeworkQuestionUpsert": {
      const [input] = args;
      if (!input || typeof input !== "object") throw new ApiInputError("homework question requires an object");
      const item = input as Record<string, unknown>;
      const snapshotId = String(item.snapshotId || "").trim();
      const moodleQuestionId = Number(item.moodleQuestionId);
      if (!snapshotId || !Number.isInteger(moodleQuestionId)) throw new ApiInputError("snapshotId and moodleQuestionId are required");
      const data = { snapshotId, questionMapId: typeof item.questionMapId === "string" ? item.questionMapId : null, moodleQuestionId, curriculumKey: String(item.curriculumKey || ""), lessonKey: String(item.lessonKey || ""), ideaKey: typeof item.ideaKey === "string" ? item.ideaKey : null, studentAnswer: typeof item.studentAnswer === "string" ? item.studentAnswer : null, isAnswered: item.isAnswered === true, isCorrect: typeof item.isCorrect === "boolean" ? item.isCorrect : null, pointsEarned: typeof item.pointsEarned === "number" ? item.pointsEarned : 0, answeredAt: item.answeredAt ? new Date(String(item.answeredAt)) : null, metadataJson: typeof item.metadataJson === "string" ? item.metadataJson : "{}" };
      return db.homeworkQuestionResult.upsert({ where: { snapshotId_moodleQuestionId: { snapshotId, moodleQuestionId } }, create: data, update: data });
    }
    case "moodleResults.studentSummary": {
      const [input] = args;
      const item = input && typeof input === "object" ? input as Record<string, unknown> : {};
      const studentId = typeof item.studentId === "string" ? item.studentId : null;
      const moodleUserId = Number.isInteger(item.moodleUserId) ? Number(item.moodleUserId) : null;
      if (!studentId && !moodleUserId) throw new ApiInputError("studentId or moodleUserId is required");
      const snapshots = await db.homeworkSnapshot.findMany({ where: studentId ? { studentId } : { moodleUserId: moodleUserId as number }, orderBy: { updatedAt: "desc" } });
      const snapshotIds = snapshots.map((snapshot) => snapshot.id);
      const homeworkQuestions = snapshotIds.length ? await db.homeworkQuestionResult.findMany({ where: { snapshotId: { in: snapshotIds } }, orderBy: { answeredAt: "desc" } }) : [];
      const attempts = await db.ideaQuestionAttempt.findMany({ where: studentId ? { studentId } : { moodleUserId: moodleUserId as number }, orderBy: { submittedAt: "desc" }, take: 5000 });
      const interactions = studentId ? await db.teacherInteraction.findMany({ where: { studentId }, orderBy: { createdAt: "desc" }, take: 500 }) : [];
      return { snapshots, homeworkQuestions, attempts, interactions };
    }
    case "moodleResults.classSummary": {
      const [input] = args;
      const item = input && typeof input === "object" ? input as Record<string, unknown> : {};
      const studentIds = Array.isArray(item.studentIds) ? item.studentIds.filter((value): value is string => typeof value === "string") : [];
      if (!studentIds.length) return { snapshots: [], byStudent: [], byIdea: [] };
      const snapshots = await db.homeworkSnapshot.findMany({ where: { studentId: { in: studentIds } }, orderBy: { updatedAt: "desc" } });
      const byStudent = studentIds.map((studentId) => { const rows = snapshots.filter((snapshot) => snapshot.studentId === studentId); const latest = rows[0] ?? null; return { studentId, latest, submissions: rows.length }; });
      const ids = snapshots.map((snapshot) => snapshot.id);
      const questions = ids.length ? await db.homeworkQuestionResult.findMany({ where: { snapshotId: { in: ids } } }) : [];
      const ideaKeys = [...new Set(questions.map((question) => question.ideaKey || "lesson_unmapped"))];
      const byIdea = ideaKeys.map((ideaKey) => { const rows = questions.filter((question) => (question.ideaKey || "lesson_unmapped") === ideaKey); const answered = rows.filter((question) => question.isAnswered).length; const correct = rows.filter((question) => question.isCorrect === true).length; return { ideaKey, total: rows.length, answered, correct, completionPct: rows.length ? Math.round((answered / rows.length) * 10000) / 100 : 0, successPct: answered ? Math.round((correct / answered) * 10000) / 100 : null }; });
      return { snapshots, byStudent, byIdea };
    }

    // ---------- Unified reports ----------
    case "reports.student": {
      const [input] = args;
      const item = input && typeof input === "object" ? input as Record<string, unknown> : {};
      const studentId = typeof item.studentId === "string" ? item.studentId.trim() : "";
      if (!studentId) throw new ApiInputError("reports.student requires studentId");
      return buildStudentReport(studentId, { sessionId: typeof item.sessionId === "string" ? item.sessionId : null, classId: typeof item.classId === "string" ? item.classId : null });
    }
    case "reports.class": {
      const [input] = args;
      const item = input && typeof input === "object" ? input as Record<string, unknown> : {};
      return buildClassReport({ sessionId: typeof item.sessionId === "string" ? item.sessionId : null, classId: typeof item.classId === "string" ? item.classId : null });
    }
    case "reports.compare": {
      const [input] = args;
      const item = input && typeof input === "object" ? input as Record<string, unknown> : {};
      const classAId = typeof item.classAId === "string" ? item.classAId : "";
      const classBId = typeof item.classBId === "string" ? item.classBId : "";
      if (!classAId || !classBId || classAId === classBId) throw new ApiInputError("classAId وclassBId مختلفان مطلوبان");
      const [a, b] = await Promise.all([buildClassReport({ classId: classAId, sessionId: typeof item.sessionId === "string" ? item.sessionId : null }), buildClassReport({ classId: classBId, sessionId: typeof item.sessionId === "string" ? item.sessionId : null })]);
      return buildComparativeReport(a, b);
    }
    case "reports.attendance": {
      const [input] = args;
      const item = input && typeof input === "object" ? input as Record<string, unknown> : {};
      const classId = typeof item.classId === "string" ? item.classId : "";
      const start = typeof item.start === "string" ? item.start.slice(0, 10) : "0000-01-01";
      const end = typeof item.end === "string" ? item.end.slice(0, 10) : "9999-12-31";
      if (!classId) throw new ApiInputError("classId مطلوب");
      const [students, records] = await Promise.all([db.student.findMany({ where: { classId }, select: { id: true, name: true }, orderBy: { name: "asc" } }), db.attendanceRecord.findMany({ where: { classId, date: { gte: start, lte: end } }, orderBy: { date: "asc" } })]);
      const rows = records.flatMap((record) => { let absent: string[] = []; try { const parsed = JSON.parse(record.absentStudentIds); if (Array.isArray(parsed)) absent = parsed.filter((id): id is string => typeof id === "string"); } catch {} return students.map((student) => ({ studentId: student.id, name: student.name, date: record.date, status: absent.includes(student.id) ? "absent" as const : "present" as const })); });
      return buildAttendanceAnalytics(rows, { start, end });
    }
    case "reports.games": {
      const [input] = args;
      const item = input && typeof input === "object" ? input as Record<string, unknown> : {};
      const report = await buildClassReport({ classId: typeof item.classId === "string" ? item.classId : null, sessionId: typeof item.sessionId === "string" ? item.sessionId : null });
      return buildGamesAnalytics(report.rows);
    }
    case "reports.teacher": {
      const [input] = args;
      const item = input && typeof input === "object" ? input as Record<string, unknown> : {};
      const report = await buildClassReport({ classId: typeof item.classId === "string" ? item.classId : null, sessionId: typeof item.sessionId === "string" ? item.sessionId : null });
      return buildTeacherReflection(report);
    }
    case "reports.templates.list": {
      const [input] = args;
      const item = input && typeof input === "object" ? input as Record<string, unknown> : {};
      const rows = await db.reportTemplate.findMany({ where: { ...(typeof item.kind === "string" ? { kind: item.kind } : {}), ...(typeof item.classId === "string" ? { OR: [{ scopeClassId: item.classId }, { scopeClassId: null }] } : {}) }, orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }], take: 200 });
      return rows.length ? rows : DEFAULT_REPORT_TEMPLATES;
    }
    case "reports.templates.save": {
      const [input] = args;
      const item = input && typeof input === "object" ? input as Record<string, unknown> : {};
      const normalized = normalizeReportTemplate(item);
      const sectionsJson = JSON.stringify(normalized.sections);
      const data = { name: normalized.name, kind: normalized.kind, language: normalized.language, sectionsJson, scopeClassId: typeof item.scopeClassId === "string" ? item.scopeClassId : null, isDefault: normalized.isDefault, enabled: normalized.enabled };
      if (typeof item.id === "string" && item.id) {
        const existing = await db.reportTemplate.findUnique({ where: { id: item.id } });
        if (!existing) throw new ApiInputError("قالب التقرير غير موجود");
        if (Number.isInteger(item.revision) && Number(item.revision) !== existing.revision) return { conflict: true, current: existing };
        return db.reportTemplate.update({ where: { id: item.id }, data: { ...data, revision: { increment: 1 } } });
      }
      return db.reportTemplate.create({ data });
    }
    case "reports.templates.delete": {
      const [id] = args;
      if (typeof id !== "string" || !id) throw new ApiInputError("template id مطلوب");
      return db.reportTemplate.delete({ where: { id } });
    }
    case "reports.schedules.list": {
      const [classId] = args;
      return db.reportSchedule.findMany({ where: typeof classId === "string" && classId ? { classId } : undefined, orderBy: [{ enabled: "desc" }, { nextRunAt: "asc" }], take: 100 });
    }
    case "reports.schedules.save": {
      const [input] = args;
      const item = input && typeof input === "object" ? input as Record<string, unknown> : {};
      const frequency = ["daily", "weekly", "monthly"].includes(String(item.frequency)) ? String(item.frequency) : "weekly";
      const data = { kind: typeof item.kind === "string" ? item.kind.slice(0, 40) : "telegram-report", enabled: item.enabled === true, classId: typeof item.classId === "string" ? item.classId : null, templateId: typeof item.templateId === "string" ? item.templateId : null, frequency, timezone: typeof item.timezone === "string" ? item.timezone.slice(0, 80) : "Africa/Cairo", nextRunAt: item.nextRunAt ? new Date(String(item.nextRunAt)) : null, configJson: typeof item.configJson === "string" ? item.configJson.slice(0, 20_000) : "{}" };
      if (typeof item.id === "string" && item.id) {
        const existing = await db.reportSchedule.findUnique({ where: { id: item.id } });
        if (!existing) throw new ApiInputError("جدول التقرير غير موجود");
        if (Number.isInteger(item.revision) && Number(item.revision) !== existing.revision) return { conflict: true, current: existing };
        return db.reportSchedule.update({ where: { id: item.id }, data: { ...data, revision: { increment: 1 } } });
      }
      return db.reportSchedule.create({ data });
    }
    case "reports.schedules.delete": {
      const [id] = args;
      if (typeof id !== "string" || !id) throw new ApiInputError("schedule id مطلوب");
      return db.reportSchedule.delete({ where: { id } });
    }
    case "reports.schedules.claim": {
      // C25 fix (2026-AUG): use updateMany with optimistic lock to prevent
      // double-claim when two workers race. Previously findFirst + update
      // was non-atomic: both workers could find the same row, then both
      // "claim" it (the second update silently overwrote the first).
      const now = new Date();
      const row = await db.reportSchedule.findFirst({ where: { enabled: true, nextRunAt: { lte: now } }, orderBy: { nextRunAt: "asc" } });
      if (!row) return null;
      // Atomic claim: only succeeds if enabled is still true (no other worker claimed it)
      const claimed = await db.reportSchedule.updateMany({
        where: { id: row.id, enabled: true },
        data: { enabled: false, lastRunAt: now, lastStatus: "claimed" },
      });
      if (claimed.count === 0) return null; // someone else got it
      return db.reportSchedule.findUnique({ where: { id: row.id } });
    }
    case "reports.schedules.complete": {
      const [input] = args;
      const item = input && typeof input === "object" ? input as Record<string, unknown> : {};
      if (typeof item.id !== "string" || !item.id) throw new ApiInputError("schedule id مطلوب");
      return db.reportSchedule.update({ where: { id: item.id }, data: { enabled: item.enabled !== false, nextRunAt: item.nextRunAt ? new Date(String(item.nextRunAt)) : null, lastStatus: "ok", lastError: null } });
    }
    case "reports.schedules.fail": {
      const [input] = args;
      const item = input && typeof input === "object" ? input as Record<string, unknown> : {};
      if (typeof item.id !== "string" || !item.id) throw new ApiInputError("schedule id مطلوب");
      return db.reportSchedule.update({ where: { id: item.id }, data: { enabled: item.retry === true, nextRunAt: item.nextRunAt ? new Date(String(item.nextRunAt)) : null, lastStatus: "error", lastError: typeof item.error === "string" ? item.error.slice(0, 1000) : "فشل التقرير" } });
    }

    // ---------- Settings ----------
    case "settings.get": {
      const s = await db.appSettings.findUnique({ where: { id: "singleton" } });
      if (!s) return {};
      try {
        const parsed = JSON.parse(s.settingsJson);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
      } catch {
        return {};
      }
    }
    case "settings.set": {
      const [settings] = args;
      const incoming = settings && typeof settings === "object" && !Array.isArray(settings) ? settings as Record<string, unknown> : {};
      const existing = await db.appSettings.findUnique({ where: { id: "singleton" }, select: { settingsJson: true } });
      let current: Record<string, unknown> = {};
      try {
        const parsed = existing?.settingsJson ? JSON.parse(existing.settingsJson) : {};
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) current = parsed;
      } catch {}
      // C18 fix (2026-AUG): whitelist of settings keys the client is allowed
      // to write. Sensitive namespaces (moodle.*, telegram.*, ai.keys.*,
      // webhookSecret, apiToken) must go through their dedicated endpoints
      // which perform proper validation. Without this, any client could
      // hijack Telegram/Moodle/AI credentials by posting a settings patch.
      const ALLOWED_SETTINGS_KEYS = new Set([
        "muted","volume","teleprompterFontSize","teleprompterSize","teleprompterHidden",
        "teleprompterHeight","teleprompterPosX","teleprompterPosY","teleprompterWidth",
        "notesOverlayOpen","whiteboardEnabled","autoClearOnStepChange","presentationMode",
        "theme","penThickness","penColor","iframeDevice","iframeZoom","iframeOrientation",
        "iframeAspect","stageScale","precisionMode","precisionScale","whiteboardBackground",
        "workspaceMode","aiEnabled","aiModel","aiTemperature","aiMaxOutputTokens",
        "ttsEnabled","ttsRate","ttsSpeakStudentName","ttsSpeakPoints","ttsSpeakCelebrations",
        "ttsSpeakGifts","hapticsEnabled","virtualCommentsEnabled","celebrationsEnabled",
        "leaderboardVisible","rewardsV10Enabled","curriculumFactoryEnabled",
        "liveSyncEnabled","customSyncEnabled","moodleLiveSyncEnabled",
        "telegramEnabled","reportsEnabled","fairnessEnabled","gamesEnabled",
        "lastLessonId","lastSlideKey","lastStep","lastIdeaId","recentColors",
        "recentThicknesses","recentStamps","recentShapes","favoriteSounds",
        "studentCardLayout","gradeReportFormat","backupAutoEnabled","backupAutoInterval",
        "defaultClassId","defaultSessionName","locale","timezone",
      ]);
      const safe: Record<string, unknown> = {};
      for (const key of Object.keys(incoming)) {
        if (ALLOWED_SETTINGS_KEYS.has(key)) {
          safe[key] = incoming[key];
        } else {
          console.warn(`[settings.set] rejected key: ${key}`);
        }
      }
      const merged = { ...current, ...safe };
      return db.appSettings.upsert({
        where: { id: "singleton" },
        create: { id: "singleton", settingsJson: JSON.stringify(merged) },
        update: { settingsJson: JSON.stringify(merged) },
      });
    }
    case "settings.profiles.list": {
      const [classId] = args;
      return db.settingsProfile.findMany({ where: typeof classId === "string" && classId ? { classId } : undefined, orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }] });
    }
    case "settings.profiles.save": {
      const [input] = args;
      const item = input && typeof input === "object" ? input as Record<string, unknown> : {};
      const name = typeof item.name === "string" ? item.name.trim().slice(0, 120) : "";
      const settingsJson = typeof item.settingsJson === "string" ? item.settingsJson.slice(0, 100_000) : "";
      if (!name || !settingsJson) throw new ApiInputError("اسم وsettingsJson مطلوبان");
      const id = typeof item.id === "string" && item.id ? item.id : undefined;
      if (id) {
        const existing = await db.settingsProfile.findUnique({ where: { id } });
        if (!existing) throw new ApiInputError("profile غير موجود");
        const expectedRevision = Number(item.revision);
        if (Number.isInteger(expectedRevision) && expectedRevision !== existing.revision) return { conflict: true, current: existing };
        return db.settingsProfile.update({ where: { id }, data: { name, classId: typeof item.classId === "string" ? item.classId : null, settingsJson, revision: { increment: 1 }, isDefault: item.isDefault === true } });
      }
      return db.settingsProfile.create({ data: { name, classId: typeof item.classId === "string" ? item.classId : null, settingsJson, isDefault: item.isDefault === true } });
    }
    case "settings.profiles.delete": {
      const [id] = args;
      if (typeof id !== "string" || !id) throw new ApiInputError("profile id مطلوب");
      return db.settingsProfile.delete({ where: { id } });
    }
    case "ai.conversations.list": {
      const [input] = args;
      const item = input && typeof input === "object" ? input as Record<string, unknown> : {};
      return db.aiConversation.findMany({ where: { ...(typeof item.lessonId === "string" ? { lessonId: item.lessonId } : {}), ...(typeof item.ideaId === "string" ? { ideaId: item.ideaId } : {}) }, include: { messages: { orderBy: { createdAt: "asc" }, take: 100 } }, orderBy: { updatedAt: "desc" }, take: 20 });
    }
    case "ai.conversations.create": {
      const [input] = args;
      const item = input && typeof input === "object" ? input as Record<string, unknown> : {};
      return db.aiConversation.create({ data: { title: typeof item.title === "string" ? item.title.slice(0, 160) : "محادثة AI", scope: typeof item.scope === "string" ? item.scope.slice(0, 40) : "teacher", lessonId: typeof item.lessonId === "string" ? item.lessonId : null, ideaId: typeof item.ideaId === "string" ? item.ideaId : null } });
    }
    case "ai.conversations.message": {
      const [input] = args;
      const item = input && typeof input === "object" ? input as Record<string, unknown> : {};
      const conversationId = typeof item.conversationId === "string" ? item.conversationId : "";
      const content = typeof item.content === "string" ? item.content.trim().slice(0, 20_000) : "";
      const role = ["system", "user", "assistant", "tool"].includes(String(item.role)) ? String(item.role) : "user";
      if (!conversationId || !content) throw new ApiInputError("conversationId وcontent مطلوبان");
      return db.aiConversationMessage.create({ data: { conversationId, role, content, provider: typeof item.provider === "string" ? item.provider.slice(0, 80) : null, model: typeof item.model === "string" ? item.model.slice(0, 160) : null, inputTokens: Number.isInteger(item.inputTokens) ? Number(item.inputTokens) : null, outputTokens: Number.isInteger(item.outputTokens) ? Number(item.outputTokens) : null } });
    }
    case "ai.conversations.delete": {
      const [id] = args;
      if (typeof id !== "string" || !id) throw new ApiInputError("conversation id مطلوب");
      return db.aiConversation.delete({ where: { id } });
    }
    case "ai.memory.list": {
      const [input] = args;
      const item = input && typeof input === "object" ? input as Record<string, unknown> : {};
      return db.aiMemory.findMany({ where: { ...(typeof item.lessonId === "string" ? { lessonId: item.lessonId } : {}), ...(typeof item.ideaId === "string" ? { ideaId: item.ideaId } : {}) }, orderBy: { updatedAt: "desc" }, take: 200 });
    }
    case "ai.memory.upsert": {
      const [input] = args;
      const item = input && typeof input === "object" ? input as Record<string, unknown> : {};
      const key = typeof item.key === "string" ? item.key.trim().slice(0, 120) : "";
      const value = typeof item.value === "string" ? item.value.slice(0, 10_000) : "";
      if (!key || !value) throw new ApiInputError("memory key/value مطلوبان");
      const lessonId = typeof item.lessonId === "string" ? item.lessonId : "";
      const ideaId = typeof item.ideaId === "string" ? item.ideaId : "";
      return db.aiMemory.upsert({ where: { lessonId_ideaId_key: { lessonId, ideaId, key } }, create: { lessonId, ideaId, key, value, ttlUntil: item.ttlUntil ? new Date(String(item.ttlUntil)) : null }, update: { value, ttlUntil: item.ttlUntil ? new Date(String(item.ttlUntil)) : null } });
    }
    case "ai.memory.delete": {
      const [id] = args;
      if (typeof id !== "string" || !id) throw new ApiInputError("memory id مطلوب");
      return db.aiMemory.delete({ where: { id } });
    }
    case "ai.retry.list": {
      const [status] = args;
      return db.aiRetryQueue.findMany({ where: typeof status === "string" && status ? { status } : undefined, orderBy: { nextRetryAt: "asc" }, take: 100 });
    }
    case "ai.retry.enqueue": {
      const [input] = args;
      const item = input && typeof input === "object" ? input as Record<string, unknown> : {};
      const operation = typeof item.operation === "string" ? item.operation.slice(0, 80) : "assistant";
      const requestInput = typeof item.input === "string" ? item.input.slice(0, 20_000) : "";
      if (!requestInput) throw new ApiInputError("retry input مطلوب");
      return db.aiRetryQueue.create({ data: { operation, input: requestInput, optionsJson: typeof item.optionsJson === "string" ? item.optionsJson.slice(0, 20_000) : "{}", maxRetries: Number.isInteger(item.maxRetries) ? Math.max(1, Math.min(8, Number(item.maxRetries))) : 3 } });
    }
    case "ai.retry.claim": {
      // C25 fix: atomic claim via updateMany
      const row = await db.aiRetryQueue.findFirst({ where: { status: "pending", nextRetryAt: { lte: new Date() } }, orderBy: { nextRetryAt: "asc" } });
      if (!row) return null;
      const claimed = await db.aiRetryQueue.updateMany({
        where: { id: row.id, status: "pending" },
        data: { status: "retrying", retryCount: { increment: 1 } },
      });
      if (claimed.count === 0) return null;
      return db.aiRetryQueue.findUnique({ where: { id: row.id } });
    }
    case "ai.retry.complete": {
      const [id] = args;
      if (typeof id !== "string" || !id) throw new ApiInputError("retry id مطلوب");
      return db.aiRetryQueue.update({ where: { id }, data: { status: "success", lastError: null } });
    }
    case "ai.retry.fail": {
      const [input] = args;
      const item = input && typeof input === "object" ? input as Record<string, unknown> : {};
      const id = typeof item.id === "string" ? item.id : "";
      if (!id) throw new ApiInputError("retry id مطلوب");
      const row = await db.aiRetryQueue.findUnique({ where: { id } });
      if (!row) throw new ApiInputError("retry غير موجود");
      const dead = row.retryCount >= row.maxRetries;
      return db.aiRetryQueue.update({ where: { id }, data: { status: dead ? "dead" : "pending", lastError: typeof item.error === "string" ? item.error.slice(0, 1000) : "فشل AI", nextRetryAt: new Date(Date.now() + Math.min(3_600_000, 2 ** row.retryCount * 10_000)) } });
    }
    case "ai.prompts.list": {
      const [category] = args;
      return db.promptLibrary.findMany({ where: typeof category === "string" && category ? { category } : undefined, orderBy: { updatedAt: "desc" }, take: 200 });
    }
    case "ai.prompts.save": {
      const [input] = args;
      const item = input && typeof input === "object" ? input as Record<string, unknown> : {};
      const title = typeof item.title === "string" ? item.title.trim().slice(0, 160) : "";
      const prompt = typeof item.prompt === "string" ? item.prompt.trim().slice(0, 20_000) : "";
      if (!title || !prompt) throw new ApiInputError("prompt title/prompt مطلوبان");
      const data = { title, prompt, category: typeof item.category === "string" ? item.category.slice(0, 60) : "general", variablesJson: typeof item.variablesJson === "string" ? item.variablesJson.slice(0, 5000) : "[]", tagsJson: typeof item.tagsJson === "string" ? item.tagsJson.slice(0, 5000) : "[]", isPublic: item.isPublic === true };
      return typeof item.id === "string" && item.id ? db.promptLibrary.update({ where: { id: item.id }, data }) : db.promptLibrary.create({ data });
    }
    case "ai.prompts.delete": {
      const [id] = args;
      if (typeof id !== "string" || !id) throw new ApiInputError("prompt id مطلوب");
      return db.promptLibrary.delete({ where: { id } });
    }
    case "ai.embeddings.upsert": {
      const [input] = args;
      const item = input && typeof input === "object" ? input as Record<string, unknown> : {};
      const lessonId = typeof item.lessonId === "string" ? item.lessonId : "";
      const model = typeof item.model === "string" ? item.model.slice(0, 160) : "";
      const embeddingJson = typeof item.embeddingJson === "string" ? item.embeddingJson.slice(0, 500_000) : "";
      const dimensions = Number(item.dimensions);
      if (!lessonId || !model || !embeddingJson || !Number.isInteger(dimensions) || dimensions < 1 || dimensions > 20_000) throw new ApiInputError("embedding data غير مكتمل");
      return db.lessonEmbedding.upsert({ where: { lessonId_model: { lessonId, model } }, create: { lessonId, model, embeddingJson, dimensions }, update: { embeddingJson, dimensions } });
    }
    case "ai.embeddings.list": {
      const [lessonId] = args;
      return db.lessonEmbedding.findMany({ where: typeof lessonId === "string" && lessonId ? { lessonId } : undefined, take: 500 });
    }
    case "webhooks.list": {
      return db.externalWebhookTarget.findMany({ orderBy: { updatedAt: "desc" }, take: 100, select: { id: true, label: true, url: true, eventsJson: true, enabled: true, retryCount: true, lastStatus: true, lastError: true, lastDeliveredAt: true, createdAt: true, updatedAt: true } });
    }
    case "webhooks.save": {
      const [input] = args;
      const item = input && typeof input === "object" ? input as Record<string, unknown> : {};
      const label = typeof item.label === "string" ? item.label.trim().slice(0, 120) : "";
      const url = typeof item.url === "string" ? item.url.trim().slice(0, 500) : "";
      const secretEncrypted = typeof item.secretEncrypted === "string" ? item.secretEncrypted.slice(0, 2000) : "";
      if (!label || !url || !secretEncrypted) throw new ApiInputError("webhook label/url/secret مطلوبون");
      const data = { label, url, secretEncrypted, eventsJson: typeof item.eventsJson === "string" ? item.eventsJson.slice(0, 5000) : "[]", enabled: item.enabled !== false, retryCount: Number.isInteger(item.retryCount) ? Math.max(0, Math.min(8, Number(item.retryCount))) : 3 };
      return typeof item.id === "string" && item.id ? db.externalWebhookTarget.update({ where: { id: item.id }, data }) : db.externalWebhookTarget.create({ data });
    }
    case "webhooks.delete": {
      const [id] = args;
      if (typeof id !== "string" || !id) throw new ApiInputError("webhook id مطلوب");
      return db.externalWebhookTarget.delete({ where: { id } });
    }
    case "telegram.preferences.get": {
      const [studentId] = args;
      if (typeof studentId !== "string" || !studentId) throw new ApiInputError("studentId مطلوب");
      const row = await db.telegramParentPreference.findUnique({ where: { studentId } });
      if (!row) return null;
      let savedSections: unknown[] = []; try { savedSections = JSON.parse(row.sectionsJson); } catch {}
      return { ...row, ...parentSections({ language: row.language as "ar" | "en", sections: savedSections as never, frequency: row.frequency as never, liveEvents: row.liveEvents, reminders: row.reminders }) };
    }
    case "telegram.preferences.save": {
      const [input] = args;
      const item = input && typeof input === "object" ? input as Record<string, unknown> : {};
      const studentId = typeof item.studentId === "string" ? item.studentId : "";
      const chatId = typeof item.chatId === "string" ? item.chatId.trim().slice(0, 120) : "";
      if (!studentId || !chatId) throw new ApiInputError("studentId وchatId مطلوبان");
      const prefs = parentSections({ language: item.language === "en" ? "en" : "ar", sections: Array.isArray(item.sections) ? item.sections : [], frequency: item.frequency as never, liveEvents: item.liveEvents === true, reminders: item.reminders === true });
      const existing = await db.telegramParentPreference.findUnique({ where: { studentId } });
      if (existing && Number.isInteger(item.revision) && Number(item.revision) !== existing.revision) return { conflict: true, current: existing };
      const data = { chatId, language: prefs.language, sectionsJson: JSON.stringify(prefs.sections), frequency: prefs.frequency, liveEvents: prefs.liveEvents, reminders: prefs.reminders };
      const saved = existing ? await db.telegramParentPreference.update({ where: { studentId }, data: { ...data, revision: { increment: 1 } } }) : await db.telegramParentPreference.create({ data: { studentId, ...data } });
      return { ...saved, ...prefs };
    }
    case "telegram.templates.list": {
      const [input] = args;
      const item = input && typeof input === "object" ? input as Record<string, unknown> : {};
      return db.telegramMessageTemplate.findMany({ where: { ...(typeof item.type === "string" ? { type: item.type } : {}), ...(typeof item.language === "string" ? { language: item.language } : {}) }, orderBy: [{ enabled: "desc" }, { updatedAt: "desc" }], take: 100 });
    }
    case "telegram.templates.save": {
      const [input] = args;
      const item = input && typeof input === "object" ? input as Record<string, unknown> : {};
      const name = typeof item.name === "string" ? item.name.trim().slice(0, 120) : "";
      const template = typeof item.template === "string" ? item.template.trim().slice(0, 4000) : "";
      if (!name || !template) throw new ApiInputError("اسم وقالب رسالة Telegram مطلوبان");
      const data = { type: typeof item.type === "string" ? item.type.slice(0, 60) : "summary", language: item.language === "en" ? "en" : "ar", name, template, variablesJson: typeof item.variablesJson === "string" ? item.variablesJson.slice(0, 5000) : "[]", enabled: item.enabled !== false };
      if (typeof item.id === "string" && item.id) {
        const existing = await db.telegramMessageTemplate.findUnique({ where: { id: item.id } });
        if (!existing) throw new ApiInputError("قالب رسالة Telegram غير موجود");
        if (Number.isInteger(item.revision) && Number(item.revision) !== existing.revision) return { conflict: true, current: existing };
        return db.telegramMessageTemplate.update({ where: { id: item.id }, data: { ...data, revision: { increment: 1 } } });
      }
      return db.telegramMessageTemplate.create({ data });
    }
    case "telegram.templates.delete": {
      const [id] = args;
      if (typeof id !== "string" || !id) throw new ApiInputError("telegram template id مطلوب");
      return db.telegramMessageTemplate.delete({ where: { id } });
    }
    case "telegram.queue.list": {
      const [status] = args;
      return db.telegramMessageQueue.findMany({ where: typeof status === "string" && status ? { status } : undefined, orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }], take: 200, select: { id: true, chatId: true, studentId: true, kind: true, method: true, idempotencyKey: true, status: true, attempts: true, maxAttempts: true, nextAttemptAt: true, lastError: true, createdAt: true, sentAt: true } });
    }
    case "telegram.queue.enqueue": {
      const [input] = args;
      const item = input && typeof input === "object" ? input as Record<string, unknown> : {};
      const idempotencyKey = typeof item.idempotencyKey === "string" ? item.idempotencyKey.trim().slice(0, 240) : "";
      const chatId = typeof item.chatId === "string" ? item.chatId.trim().slice(0, 120) : "";
      const payloadJson = typeof item.payloadJson === "string" ? item.payloadJson.slice(0, 200_000) : "{}";
      if (!idempotencyKey || !chatId) throw new ApiInputError("idempotencyKey وchatId مطلوبان");
      const existing = await db.telegramMessageQueue.findUnique({ where: { idempotencyKey } });
      if (existing) return existing;
      return db.telegramMessageQueue.create({ data: { chatId, studentId: typeof item.studentId === "string" ? item.studentId : null, kind: typeof item.kind === "string" ? item.kind.slice(0, 60) : "report", method: typeof item.method === "string" ? item.method.slice(0, 40) : "sendMessage", payloadJson, idempotencyKey, maxAttempts: Number.isInteger(item.maxAttempts) ? Math.max(1, Math.min(8, Number(item.maxAttempts))) : 5 } });
    }
    case "telegram.queue.claim": {
      // C25 fix: atomic claim via updateMany
      const row = await db.telegramMessageQueue.findFirst({ where: { status: "pending", nextAttemptAt: { lte: new Date() }, attempts: { lt: 8 } }, orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }] });
      if (!row) return null;
      const claimed = await db.telegramMessageQueue.updateMany({
        where: { id: row.id, status: "pending" },
        data: { status: "sending", attempts: { increment: 1 } },
      });
      if (claimed.count === 0) return null;
      return db.telegramMessageQueue.findUnique({ where: { id: row.id } });
    }
    case "telegram.queue.complete": {
      const [id] = args;
      if (typeof id !== "string" || !id) throw new ApiInputError("queue id مطلوب");
      return db.telegramMessageQueue.update({ where: { id }, data: { status: "sent", sentAt: new Date(), lastError: null } });
    }
    case "telegram.queue.fail": {
      const [input] = args;
      const item = input && typeof input === "object" ? input as Record<string, unknown> : {};
      const id = typeof item.id === "string" ? item.id : "";
      if (!id) throw new ApiInputError("queue id مطلوب");
      const row = await db.telegramMessageQueue.findUnique({ where: { id } });
      if (!row) throw new ApiInputError("queue غير موجود");
      const dead = row.attempts >= row.maxAttempts;
      const delay = Math.min(6 * 60 * 60 * 1000, 30_000 * (2 ** Math.min(8, row.attempts)));
      return db.telegramMessageQueue.update({ where: { id }, data: { status: dead ? "dead" : "pending", nextAttemptAt: new Date(Date.now() + delay), lastError: typeof item.error === "string" ? item.error.slice(0, 1000) : "فشل إرسال Telegram" } });
    }

    // ---------- Backup History ----------
    case "backup.list": {
      return db.backupHistory.findMany({ orderBy: { createdAt: "desc" }, take: 30 });
    }
    case "backup.record": {
      const [filename, fileSize, reason = "manual"] = args;
      return db.backupHistory.create({ data: { filename, fileSize, reason } });
    }

    // ---------- Stats Summary ----------
    case "stats.summary": {
      const [classId] = args;
      const where = classId ? { classId } : {};
      const [students, lessons, sessions, gameResults] = await Promise.all([
        db.student.count({ where }),
        db.importedLesson.count(),
        db.session.count({ where: classId ? { classId } : {} }),
        db.gameResult.count({ where: classId ? { session: { classId } } : undefined }),
      ]);
      return { students, lessons, sessions, gameResults };
    }

    // ---------- Celebration Events (سجل الاحتفالات) ----------
    case "celebrationEvents.create": {
      const [data] = args;
      const allowed = ["studentId","sessionId","celebrationId","celebrationLabel","celebrationIcon","note"];
      const safe: Record<string, unknown> = {};
      for (const k of allowed) if (k in (data || {})) safe[k] = data[k];
      return db.celebrationEvent.create({ data: safe as any });
    }
    case "celebrationEvents.listByStudent": {
      const [studentId, sessionId] = args;
      const where: any = { studentId };
      if (sessionId) where.sessionId = sessionId;
      return db.celebrationEvent.findMany({ where, orderBy: { firedAt: "desc" } });
    }
    case "celebrationEvents.listBySession": {
      const [sessionId] = args;
      return db.celebrationEvent.findMany({ where: { sessionId }, orderBy: { firedAt: "desc" } });
    }

    // ---------- Student Notes (ملاحظات المعلم) ----------
    case "studentNotes.create": {
      const [data] = args;
      const allowed = ["studentId","sessionId","text","isShared"];
      const safe: Record<string, unknown> = {};
      for (const k of allowed) if (k in (data || {})) safe[k] = data[k];
      return db.studentNote.create({ data: safe as any });
    }
    case "studentNotes.listByStudent": {
      const [studentId, sessionId] = args;
      const where: any = { studentId };
      if (sessionId) where.sessionId = sessionId;
      return db.studentNote.findMany({ where, orderBy: { createdAt: "desc" } });
    }
    case "studentNotes.listBySession": {
      const [sessionId] = args;
      return db.studentNote.findMany({ where: { sessionId }, orderBy: { createdAt: "desc" } });
    }
    case "studentNotes.search": {
      const [input] = args;
      const item = input && typeof input === "object" ? input as Record<string, unknown> : {};
      const query = typeof item.query === "string" ? item.query.trim().slice(0, 120) : "";
      const studentId = typeof item.studentId === "string" ? item.studentId : undefined;
      const rows = await db.studentNote.findMany({ where: { ...(studentId ? { studentId } : {}), ...(item.sharedOnly === true ? { isShared: true } : {}), ...(query ? { text: { contains: query } } : {}) }, orderBy: { createdAt: "desc" }, take: Math.max(1, Math.min(500, Number.isInteger(item.limit) ? Number(item.limit) : 100)) });
      return rows;
    }
    case "studentNotes.markShared": {
      const [id] = args;
      return db.studentNote.update({ where: { id }, data: { isShared: true } });
    }

    // ---------- Student Activities (سجل موحد) ----------
    case "studentActivities.create": {
      const [data] = args;
      const allowed = ["studentId","sessionId","type","pointsDelta","description","metadataJson"];
      const safe: Record<string, unknown> = {};
      for (const k of allowed) if (k in (data || {})) safe[k] = data[k];
      return db.studentActivity.create({ data: safe as any });
    }
    case "studentActivities.listByStudent": {
      const [studentId, sessionId] = args;
      const where: any = { studentId };
      if (sessionId) where.sessionId = sessionId;
      return db.studentActivity.findMany({ where, orderBy: { createdAt: "desc" } });
    }
    case "studentActivities.listBySession": {
      const [sessionId] = args;
      return db.studentActivity.findMany({ where: { sessionId }, orderBy: { createdAt: "desc" } });
    }
    case "students.timeline": {
      const [input] = args;
      const item = input && typeof input === "object" ? input as Record<string, unknown> : {};
      const studentId = typeof item.studentId === "string" ? item.studentId : "";
      if (!studentId) throw new ApiInputError("studentId مطلوب");
      const limit = Math.max(1, Math.min(500, Number.isInteger(item.limit) ? Number(item.limit) : 100));
      const [activities, notes, badges, gifts] = await Promise.all([
        db.studentActivity.findMany({ where: { studentId }, orderBy: { createdAt: "desc" }, take: limit }),
        db.studentNote.findMany({ where: { studentId }, orderBy: { createdAt: "desc" }, take: Math.min(limit, 100) }),
        db.studentBadge.findMany({ where: { studentId }, orderBy: { awardedAt: "desc" }, take: Math.min(limit, 100) }),
        db.studentGift.findMany({ where: { studentId }, orderBy: { awardedAt: "desc" }, take: Math.min(limit, 100) }),
      ]);
      return [...activities.map((row) => ({ id: row.id, kind: "activity", type: row.type, text: row.description, pointsDelta: row.pointsDelta, createdAt: row.createdAt, metadataJson: row.metadataJson })), ...notes.map((row) => ({ id: row.id, kind: "note", type: "note", text: row.text, pointsDelta: 0, createdAt: row.createdAt, isShared: row.isShared })), ...badges.map((row) => ({ id: row.id, kind: "badge", type: row.type, text: row.note ?? "شارة", pointsDelta: 0, createdAt: row.awardedAt })), ...gifts.map((row) => ({ id: row.id, kind: "gift", type: row.giftName, text: row.giftName, pointsDelta: 0, createdAt: row.awardedAt }))].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, limit);
    }
    case "studentActivities.aggregateByType": {
      const [studentId, sessionId] = args;
      const where: any = { studentId };
      if (sessionId) where.sessionId = sessionId;
      const grouped = await db.studentActivity.groupBy({
        by: ["type"],
        where,
        _count: { type: true },
        _sum: { pointsDelta: true },
      });
      return grouped.map((g: any) => ({ type: g.type, count: g._count.type, pointsDelta: g._sum.pointsDelta ?? 0 }));
    }

    default:
      throw new Error(`Unhandled operation: ${op}`);
  }
}

// ====================================================================
//  Route handlers
// ====================================================================
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

/**
 * Resolve the browser-visible origin without trusting the internal URL that
 * Next may construct behind a reverse proxy. In production the proxy owns
 * x-forwarded-host/proto; locally the Host header is the canonical value.
 */
function trustedRequestOrigin(req: NextRequest): string {
  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || req.headers.get("host")?.trim();
  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto || req.nextUrl.protocol.replace(":", "") || "http";
  return host ? `${protocol}://${host}` : new URL(req.url).origin;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ operation: string }> }
) {
  try {
    const { operation } = await params;
    const origin = req.headers.get("origin");
    if (origin) {
      const requestOrigin = trustedRequestOrigin(req);
      if (origin !== requestOrigin) {
        return NextResponse.json({ ok: false, error: "مصدر الطلب غير مسموح" }, { status: 403, headers: NO_STORE_HEADERS });
      }
    }
    const body = await req.json().catch(() => ({}));
    const args: any[] = Array.isArray(body.args) ? body.args : [];
    const result = await dispatch(operation, args);
    return NextResponse.json({ ok: true, data: result }, { headers: NO_STORE_HEADERS });
  } catch (err: any) {
    // Prisma errors
    if (err instanceof ApiInputError || err instanceof Prisma.PrismaClientValidationError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 400, headers: NO_STORE_HEADERS });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json({ ok: false, error: err.message, code: err.code }, { status: 400, headers: NO_STORE_HEADERS });
    }
    return NextResponse.json({ ok: false, error: err.message || "Internal error" }, { status: 500, headers: NO_STORE_HEADERS });
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ operation: string }> }
) {
  // GET support for read-only operations (no args)
  try {
    const { operation } = await params;
    // C2: only allow read-only operations over GET.
    // Anything that writes/deletes/mutates must go through POST.
    const READ_ONLY_PREFIXES = [
      "classes.list",
      "students.list",
      "students.listByClass",
      "students.findByName",
      "groups.list",
      "lessons.list",
      "questions.list",
      "prizes.list",
      "gifts.list",
      "sounds.list",
      "settings.get",
      "attendance.list",
      "sessions.list",
      "gameResults.listRecent",
      "backup.list",
      "stats.summary",
      "celebrations.list",
    ];
    const isReadOnly = READ_ONLY_PREFIXES.includes(operation);
    if (!isReadOnly) {
      return NextResponse.json(
        { ok: false, error: "GET not allowed for non-read operations" },
        { status: 405, headers: NO_STORE_HEADERS }
      );
    }
    const result = await dispatch(operation, []);
    return NextResponse.json({ ok: true, data: result }, { headers: NO_STORE_HEADERS });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || "Internal error" }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
