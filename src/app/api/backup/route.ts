// ====================================================================
//  /api/backup - Backup & Restore API for Bisalasa v6.0
//    GET  /api/backup            → download a JSON dump of all data
//    POST /api/backup            → upload a JSON dump to restore
//    POST /api/backup?action=sql → download the .db file directly
// ====================================================================
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { promises as fs } from "fs";
import path from "path";

// Database file: Prisma resolves relative paths from the schema directory (prisma/),
// so the real SQLite file lives at prisma/db/custom.db (not db/custom.db).
// We try multiple candidate paths to be resilient to different deployment layouts.
function resolveDbPath(): string {
  const candidates = [
    path.join(process.cwd(), "prisma", "db", "custom.db"),
    path.join(process.cwd(), "db", "custom.db"),
    path.join(process.cwd(), "custom.db"),
  ];
  // Return the first existing path; fall back to the prisma one if none found.
  return candidates.find(p => {
    try { return require("fs").existsSync(p); } catch { return false; }
  }) || candidates[0];
}
const DB_FILE_PATH = resolveDbPath();

// ---------- Helpers ----------
async function dumpAll() {
  // Use select to ensure flat shape (no nested relations) so createMany works on restore
  // P0-4 fix: added 4 missing tables — celebration (catalog), celebrationEvent (history),
  // studentNote (teacher notes), studentActivity (activity log). Without these, backup→restore
  // silently lost all celebration history + teacher notes.
  const [
    classes, students, badges, studentGifts, groups,
    attendance, lessons, questions, sessions, sessionSnapshots,
    gameResults, gameParticipants, gameQuestions,
    prizes, giftCatalog, customSounds, settings, backupHistory,
    celebrationCatalog, celebrationEvents, studentNotes, studentActivities,
    curriculumFactoryDrafts, curriculumPromptTemplates, curriculumDraftVersions,
  ] = await Promise.all([
    db.classRoom.findMany(),
    db.student.findMany({
      select: { id: true, classId: true, name: true, points: true, correctAnswers: true, wrongAnswers: true, attempts: true, title: true, isAbsent: true, lastCalled: true, createdAt: true, updatedAt: true },
    }),
    db.studentBadge.findMany({
      select: { id: true, studentId: true, type: true, note: true, awardedAt: true },
    }),
    db.studentGift.findMany({
      select: { id: true, studentId: true, giftId: true, giftName: true, giftImage: true, awardedAt: true },
    }),
    db.studentGroup.findMany({
      select: { id: true, classId: true, name: true, color: true, groupPoints: true, studentIds: true, createdAt: true, updatedAt: true },
    }),
    db.attendanceRecord.findMany({
      select: { id: true, classId: true, date: true, absentStudentIds: true, createdAt: true },
    }),
    db.importedLesson.findMany({
      select: { id: true, lessonId: true, fileName: true, title: true, subtitle: true, content: true, manifestJson: true, importedAt: true, updatedAt: true },
    }),
    db.lessonQuestion.findMany({
      select: { id: true, lessonId: true, externalRefId: true, ideaId: true, ideaTitle: true, stepNumber: true, text: true, correctAnswer: true, optionsJson: true, rewardPoints: true, difficulty: true, tags: true, gameReady: true, createdAt: true },
    }),
    db.session.findMany({
      select: { id: true, classId: true, name: true, startedAt: true, endedAt: true, notes: true, statsJson: true },
    }),
    db.sessionStudentSnapshot.findMany({
      select: { id: true, sessionId: true, studentId: true, pointsStart: true, correctStart: true, wrongStart: true, attemptsStart: true, badgesCountStart: true },
    }),
    db.gameResult.findMany({
      select: { id: true, sessionId: true, gameType: true, gameMode: true, startedAt: true, endedAt: true, durationMs: true, ideaId: true, questionCount: true, configJson: true },
    }),
    db.gameResultParticipant.findMany({
      select: { id: true, gameResultId: true, studentId: true, studentName: true, pointsEarned: true, correctCount: true, wrongCount: true, isWinner: true },
    }),
    db.gameResultQuestion.findMany({
      select: { id: true, gameResultId: true, questionId: true, questionText: true, studentId: true, studentAnswer: true, isCorrect: true, pointsEarned: true, answeredAt: true },
    }),
    db.prize.findMany(),
    db.gift.findMany(),
    db.customSound.findMany(),
    db.appSettings.findMany(),
    db.backupHistory.findMany(),
    // P0-4: 4 previously-missing tables
    db.celebration.findMany(),
    db.celebrationEvent.findMany(),
    db.studentNote.findMany(),
    db.studentActivity.findMany(),
    db.curriculumFactoryDraft.findMany(),
    db.curriculumPromptTemplate.findMany(),
    db.curriculumDraftVersion.findMany(),
  ]);

  return {
    __version: "6.0",
    __exportedAt: new Date().toISOString(),
    tables: {
      classes,
      students,
      badges,
      studentGifts,
      groups,
      attendance,
      lessons,
      questions,
      sessions,
      sessionSnapshots,
      gameResults,
      gameParticipants,
      gameQuestions,
      prizes,
      giftCatalog,
      customSounds,
      settings,
      backupHistory,
      // P0-4: 4 previously-missing tables
      celebrationCatalog,
      celebrationEvents,
      studentNotes,
      studentActivities,
      curriculumFactoryDrafts,
      curriculumPromptTemplates,
      curriculumDraftVersions,
    },
  };
}

async function restoreAll(dump: any) {
  if (!dump || typeof dump !== "object") {
    throw new Error("Invalid backup format: not an object");
  }
  if (!dump.tables || typeof dump.tables !== "object") {
    throw new Error("Invalid backup format: missing tables");
  }
  // C16 fix (2026-AUG): validate structure before touching the DB.
  // Previously restoreAll accepted any JSON and ran createMany directly —
  // a malicious or corrupt file could inject arbitrary rows, oversized
  // payloads could OOM the server, and wrong schema versions could
  // silently corrupt the DB.
  const MAX_ROWS_PER_TABLE = 100_000;
  const MAX_TOTAL_ROWS = 500_000;
  const t = dump.tables;
  let totalRows = 0;
  const ALLOWED_TABLES = new Set([
    "classes","students","badges","studentGifts","groups","attendance",
    "lessons","questions","sessions","sessionSnapshots","gameResults",
    "gameParticipants","gameQuestions","prizes","giftCatalog","customSounds",
    "celebrationCatalog","celebrationEvents","studentNotes","studentActivities",
    "curriculumPromptTemplates","curriculumFactoryDrafts","curriculumDraftVersions",
    "settings","backupHistory"
  ]);
  for (const [key, rows] of Object.entries(t)) {
    if (!ALLOWED_TABLES.has(key)) {
      throw new Error(`Unknown table in backup: ${key}`);
    }
    if (!Array.isArray(rows)) {
      throw new Error(`Table ${key} is not an array`);
    }
    if (rows.length > MAX_ROWS_PER_TABLE) {
      throw new Error(`Table ${key} has too many rows: ${rows.length} (max ${MAX_ROWS_PER_TABLE})`);
    }
    // Validate each row is a plain object (not a string/number/array)
    for (const row of rows) {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        throw new Error(`Table ${key} contains a non-object row`);
      }
    }
    totalRows += rows.length;
  }
  if (totalRows > MAX_TOTAL_ROWS) {
    throw new Error(`Backup too large: ${totalRows} total rows (max ${MAX_TOTAL_ROWS})`);
  }

  // C3: Wrap BOTH the wipe and the re-inserts in a SINGLE interactive
  // transaction. Previously only the wipe was transactional — if any
  // createMany failed, the DB was left half-restored. Now a failure rolls
  // everything back to the state before restore was attempted.
  //
  // Order matters: parents before children to satisfy FK constraints.
  await db.$transaction(async (tx) => {
    // Step 1: Wipe all data (in reverse FK order)
    // P0-4: added 4 missing tables (celebration catalog + 3 history tables)
    await tx.studentActivity.deleteMany();
    await tx.studentNote.deleteMany();
    await tx.curriculumFactoryDraft.deleteMany();
    await tx.curriculumPromptTemplate.deleteMany();
    await tx.curriculumDraftVersion.deleteMany();
    await tx.celebrationEvent.deleteMany();
    await tx.celebration.deleteMany();
    await tx.gameResultQuestion.deleteMany();
    await tx.gameResultParticipant.deleteMany();
    await tx.gameResult.deleteMany();
    await tx.sessionStudentSnapshot.deleteMany();
    await tx.session.deleteMany();
    await tx.lessonQuestion.deleteMany();
    await tx.importedLesson.deleteMany();
    await tx.attendanceRecord.deleteMany();
    await tx.studentGroup.deleteMany();
    await tx.studentGift.deleteMany();
    await tx.studentBadge.deleteMany();
    await tx.student.deleteMany();
    await tx.classRoom.deleteMany();
    await tx.prize.deleteMany();
    await tx.gift.deleteMany();
    await tx.customSound.deleteMany();
    await tx.appSettings.deleteMany();
    await tx.backupHistory.deleteMany();

    // Step 2: Re-insert in FK order — any failure throws → full rollback
    // P0-4: celebration catalog BEFORE celebrationEvent (events reference celebrations)
    if (t.classes?.length) await tx.classRoom.createMany({ data: t.classes });
    if (t.students?.length) await tx.student.createMany({ data: t.students });
    if (t.badges?.length) await tx.studentBadge.createMany({ data: t.badges });
    if (t.studentGifts?.length) await tx.studentGift.createMany({ data: t.studentGifts });
    if (t.groups?.length) await tx.studentGroup.createMany({ data: t.groups });
    if (t.attendance?.length) await tx.attendanceRecord.createMany({ data: t.attendance });
    if (t.lessons?.length) await tx.importedLesson.createMany({ data: t.lessons });
    if (t.questions?.length) await tx.lessonQuestion.createMany({ data: t.questions });
    if (t.sessions?.length) await tx.session.createMany({ data: t.sessions });
    if (t.sessionSnapshots?.length) await tx.sessionStudentSnapshot.createMany({ data: t.sessionSnapshots });
    if (t.gameResults?.length) await tx.gameResult.createMany({ data: t.gameResults });
    if (t.gameParticipants?.length) await tx.gameResultParticipant.createMany({ data: t.gameParticipants });
    if (t.gameQuestions?.length) await tx.gameResultQuestion.createMany({ data: t.gameQuestions });
    if (t.prizes?.length) await tx.prize.createMany({ data: t.prizes });
    if (t.giftCatalog?.length) await tx.gift.createMany({ data: t.giftCatalog });
    if (t.customSounds?.length) await tx.customSound.createMany({ data: t.customSounds });
    // P0-4: 4 previously-missing tables — catalog before events
    if (t.celebrationCatalog?.length) await tx.celebration.createMany({ data: t.celebrationCatalog });
    if (t.celebrationEvents?.length) await tx.celebrationEvent.createMany({ data: t.celebrationEvents });
    if (t.studentNotes?.length) await tx.studentNote.createMany({ data: t.studentNotes });
    if (t.studentActivities?.length) await tx.studentActivity.createMany({ data: t.studentActivities });
    if (t.curriculumPromptTemplates?.length) await tx.curriculumPromptTemplate.createMany({ data: t.curriculumPromptTemplates });
    if (t.curriculumFactoryDrafts?.length) await tx.curriculumFactoryDraft.createMany({ data: t.curriculumFactoryDrafts });
    if (t.curriculumDraftVersions?.length) await tx.curriculumDraftVersion.createMany({ data: t.curriculumDraftVersions });
    if (t.settings?.length) await tx.appSettings.createMany({ data: t.settings });
    if (t.backupHistory?.length) await tx.backupHistory.createMany({ data: t.backupHistory });
  }, {
    // SQLite can take a moment on slow disks / large dumps — give the tx room.
    maxWait: 30_000,
    timeout: 60_000,
  });

  return {
    restored: {
      classes: t.classes?.length || 0,
      students: t.students?.length || 0,
      lessons: t.lessons?.length || 0,
      questions: t.questions?.length || 0,
      sessions: t.sessions?.length || 0,
      gameResults: t.gameResults?.length || 0,
    },
  };
}

// ====================================================================
//  GET: download backup (JSON only — raw .db download removed for security)
// ====================================================================
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") || "json";
  const reason = searchParams.get("reason") || "manual";

  // C17 fix (2026-AUG): the "sql" format used to stream the raw .db file
  // directly, which exposes ALL encrypted secrets (AI keys, Telegram token,
  // Moodle token, webhook secrets) and PII (parent phone numbers, chat IDs).
  // Even though the secrets are encrypted at rest, the encryption key is
  // derived from a server-side env var — anyone with the .db file and the
  // env var can decrypt everything. Removing this endpoint closes the hole.
  if (format === "sql") {
    return NextResponse.json(
      { ok: false, error: "تنزيل قاعدة البيانات الخام معطّل للأمان. استخدم format=json بدلاً من ذلك." },
      { status: 403 }
    );
  }

  // JSON format
  try {
    const dump = await dumpAll();
    const json = JSON.stringify(dump, null, 2);
    // M4: name backup files using Cairo local time (Africa/Cairo), not UTC
    const cairoStamp = new Date().toLocaleString("sv-SE", { timeZone: "Africa/Cairo" }).replace(/[: ]/g, "-").replace(",", "");
    // Record backup history
    await db.backupHistory.create({
      data: {
        filename: `bisalasa-${cairoStamp}.json`,
        fileSize: new TextEncoder().encode(json).length,
        reason,
      },
    });
    return new NextResponse(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="bisalasa-backup-${Date.now()}.json"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// ====================================================================
//  POST: restore from JSON backup
// ====================================================================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body || !body.tables) {
      return NextResponse.json(
        { ok: false, error: "Invalid backup file: missing 'tables' field" },
        { status: 400 }
      );
    }
    const result = await restoreAll(body);
    return NextResponse.json({ ok: true, data: result });
  } catch (err: any) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json({ ok: false, error: err.message, code: err.code }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

// ====================================================================
//  DELETE: factory reset (wipe all data)
//  ⚠️ SAFETY: requires { confirmPhrase: "WIPE-ALL-DATA" } in the body
//  to prevent accidental / automated wipes. No auth system exists on
//  this LAN-hosted app, so the phrase is the last line of defence.
// ====================================================================
export async function DELETE(req: NextRequest) {
  try {
    // ---- Confirmation gate (C3 fix) ----
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // no body — definitely no confirmation
    }
    if (!body || body.confirmPhrase !== "WIPE-ALL-DATA") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "تأكيد مطلوب: أرسل body يحتوي { confirmPhrase: 'WIPE-ALL-DATA' } لتأكيد مسح كل البيانات نهائياً.",
          code: "CONFIRMATION_REQUIRED",
        },
        { status: 400 }
      );
    }

    await db.$transaction([
      // P0-4: added 4 missing tables (celebration catalog + 3 history tables)
      db.studentActivity.deleteMany(),
      db.studentNote.deleteMany(),
      db.celebrationEvent.deleteMany(),
      db.celebration.deleteMany(),
      db.gameResultQuestion.deleteMany(),
      db.gameResultParticipant.deleteMany(),
      db.gameResult.deleteMany(),
      db.sessionStudentSnapshot.deleteMany(),
      db.session.deleteMany(),
      db.lessonQuestion.deleteMany(),
      db.importedLesson.deleteMany(),
      db.attendanceRecord.deleteMany(),
      db.studentGroup.deleteMany(),
      db.studentGift.deleteMany(),
      db.studentBadge.deleteMany(),
      db.student.deleteMany(),
      db.classRoom.deleteMany(),
      db.prize.deleteMany(),
      db.gift.deleteMany(),
      db.customSound.deleteMany(),
      db.appSettings.deleteMany(),
      db.backupHistory.deleteMany(),
    ]);
    return NextResponse.json({ ok: true, data: { reset: true } });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
