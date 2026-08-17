import { db } from "@/lib/db";
import type {
  ClassReportAggregate,
  ClassReportRow,
  ReportActivityMetric,
  ReportIdeaMetric,
  ReportRecentEvent,
  ReportSourceQuality,
  ReportFairness,
  ReportHomeworkSnapshot,
  StudentReportAggregate,
} from "@/lib/report-contract";

const STALE_AFTER_MS = 36 * 60 * 60 * 1000;
// Reports are assembled from many read-only SQLite queries. A short in-process
// cache collapses duplicate requests from the live dashboard and derived reports
// while keeping classroom changes visible within well under one second.
const REPORT_CACHE_TTL_MS = 750;

type Scope = { sessionId?: string | null; classId?: string | null };
type ReportCacheEntry<T> = { expiresAt: number; promise: Promise<T> };
const studentReportCache = new Map<string, ReportCacheEntry<StudentReportAggregate | null>>();
const classReportCache = new Map<string, ReportCacheEntry<ClassReportAggregate>>();

function scopeKey(scope: Scope) {
  return `${scope.classId ?? ""}|${scope.sessionId ?? ""}`;
}

function getCached<T>(cache: Map<string, ReportCacheEntry<T>>, key: string, factory: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const existing = cache.get(key);
  if (existing && existing.expiresAt > now) return existing.promise;
  const promise = factory().catch((error) => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, { expiresAt: now + REPORT_CACHE_TTL_MS, promise });
  return promise;
}
type MetricAccumulator = { total: number; answered: number; unanswered: number; correct: number; wrong: number; points: number };

function safeJson(value: string | null | undefined): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function pct(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 10000) / 100 : null;
}

function emptyMetric(): MetricAccumulator {
  return { total: 0, answered: 0, unanswered: 0, correct: 0, wrong: 0, points: 0 };
}

function toIdeaMetrics(groups: Map<string, MetricAccumulator>): ReportIdeaMetric[] {
  return [...groups.entries()]
    .map(([ideaKey, row]) => ({ ideaKey, ...row, accuracyPct: pct(row.correct, row.answered), completionPct: row.total ? Math.round((row.answered / row.total) * 10000) / 100 : 0 }))
    .sort((a, b) => a.ideaKey.localeCompare(b.ideaKey, "ar"));
}

function addMetric(groups: Map<string, MetricAccumulator>, ideaKey: string | null | undefined, values: Partial<MetricAccumulator>) {
  const key = ideaKey || "lesson_unmapped";
  const row = groups.get(key) ?? emptyMetric();
  row.total += values.total ?? 0;
  row.answered += values.answered ?? 0;
  row.unanswered += values.unanswered ?? 0;
  row.correct += values.correct ?? 0;
  row.wrong += values.wrong ?? 0;
  row.points += values.points ?? 0;
  groups.set(key, row);
}

function toIso(value: Date | null | undefined) { return value ? value.toISOString() : null; }

function qualityStatus(source: ReportSourceQuality["source"], label: string, value: number, updatedAt?: Date | null, notLinked = false): ReportSourceQuality {
  if (notLinked) return { source, status: "not-linked", label, detail: "لا يوجد ربط بهذا المصدر" };
  if (!value) return { source, status: "missing", label, detail: "لا توجد سجلات واردة" };
  if (updatedAt && Date.now() - updatedAt.getTime() > STALE_AFTER_MS) return { source, status: "stale", label, detail: "آخر تحديث أقدم من 36 ساعة" };
  return { source, status: "ok", label, detail: "البيانات متاحة ومحدثة" };
}

function mapSnapshot(snapshot: any): ReportHomeworkSnapshot {
  return {
    id: snapshot.id,
    homeworkMapId: snapshot.homeworkMapId,
    status: snapshot.status,
    totalQuestions: snapshot.totalQuestions,
    answeredQuestions: snapshot.answeredQuestions,
    unansweredQuestions: snapshot.unansweredQuestions,
    correctQuestions: snapshot.correctQuestions,
    wrongQuestions: snapshot.wrongQuestions,
    completionPct: snapshot.completionPct,
    successOnAnsweredPct: snapshot.successOnAnsweredPct,
    successOnTotalPct: snapshot.successOnTotalPct,
    moodleGrade: snapshot.moodleGrade,
    moodleMaxGrade: snapshot.moodleMaxGrade,
    submittedAt: toIso(snapshot.submittedAt),
    dueAt: toIso(snapshot.dueAt),
    sourceUpdatedAt: toIso(snapshot.sourceUpdatedAt),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}

async function buildStudentReportUncached(studentId: string, scope: Scope = {}): Promise<StudentReportAggregate | null> {
  const classId = scope.classId ?? null;
  const sessionId = scope.sessionId ?? null;
  const student = await db.student.findUnique({ where: { id: studentId }, include: { badges: true } });
  if (!student) return null;
  const effectiveClassId = classId ?? student.classId ?? null;
  const sessionIdeaRunIds = sessionId
    ? (await db.ideaRun.findMany({ where: { sessionId }, select: { id: true } })).map((run) => run.id)
    : null;
  const [sessionCount, session, sessionSnapshot, snapshots, activities, celebrations, notes, attempts, interactions, games] = await Promise.all([
    db.session.count({ where: effectiveClassId ? { classId: effectiveClassId } : {} }),
    sessionId ? db.session.findUnique({ where: { id: sessionId } }) : Promise.resolve(null),
    sessionId ? db.sessionStudentSnapshot.findUnique({ where: { sessionId_studentId: { sessionId, studentId } } }) : Promise.resolve(null),
    db.homeworkSnapshot.findMany({ where: { studentId }, orderBy: { updatedAt: "desc" } }),
    db.studentActivity.findMany({ where: { studentId, ...(sessionId ? { sessionId } : {}) }, orderBy: { createdAt: "desc" }, take: 5000 }),
    db.celebrationEvent.findMany({ where: { studentId, ...(sessionId ? { sessionId } : {}) }, orderBy: { firedAt: "desc" }, take: 5000 }),
    db.studentNote.findMany({ where: { studentId, ...(sessionId ? { sessionId } : {}) }, orderBy: { createdAt: "desc" }, take: 500 }),
    db.ideaQuestionAttempt.findMany({ where: { studentId, ...(sessionId ? { ideaRunId: { in: sessionIdeaRunIds ?? [] } } : {}) }, orderBy: { submittedAt: "desc" }, take: 5000 }),
    db.teacherInteraction.findMany({ where: { studentId, ...(sessionId ? { sessionId } : {}) }, orderBy: { createdAt: "desc" }, take: 500 }),
    db.gameResult.findMany({ where: { ...(sessionId ? { sessionId } : {}), participants: { some: { studentId } } }, include: { participants: { where: { studentId } }, questions: { where: { studentId } } }, orderBy: { startedAt: "desc" }, take: 500 }),
  ]);
  const ideaRunIds = [...new Set(attempts.map((attempt) => attempt.ideaRunId))];
  const ideaRuns = ideaRunIds.length ? await db.ideaRun.findMany({ where: { id: { in: ideaRunIds } }, select: { id: true, ideaKey: true } }) : [];
  const ideaKeyByRun = new Map(ideaRuns.map((run) => [run.id, run.ideaKey]));
  const snapshotIds = snapshots.map((snapshot) => snapshot.id);
  const homeworkQuestions = snapshotIds.length ? await db.homeworkQuestionResult.findMany({ where: { snapshotId: { in: snapshotIds } }, orderBy: { answeredAt: "desc" } }) : [];
  const latestSnapshot = snapshots[0] ? mapSnapshot(snapshots[0]) : null;
  const snapshotQuestions = latestSnapshot ? homeworkQuestions.filter((question) => question.snapshotId === latestSnapshot.id) : [];

  const interactiveGroups = new Map<string, MetricAccumulator>();
  const liveRows = activities.filter((row) => row.description.startsWith("live-sync:"));
  for (const row of liveRows) {
    const metadata = safeJson(row.metadataJson);
    addMetric(interactiveGroups, typeof metadata.ideaId === "string" ? metadata.ideaId : null, { total: 1, answered: 1, correct: row.type === "correct" ? 1 : 0, wrong: row.type === "wrong" ? 1 : 0, points: row.pointsDelta });
  }
  if (!liveRows.length) {
    for (const attempt of attempts) {
      const ideaKey = ideaKeyByRun.get(attempt.ideaRunId);
      const answered = attempt.status === "answered" || attempt.status === "submitted" ? 1 : 0;
      addMetric(interactiveGroups, ideaKey, { total: 1, answered, unanswered: answered ? 0 : 1, correct: attempt.isCorrect === true ? 1 : 0, wrong: attempt.isCorrect === false ? 1 : 0, points: attempt.pointsEarned });
    }
  }
  const interactiveRows = toIdeaMetrics(interactiveGroups);
  const interactive = interactiveRows.reduce((sum, row) => ({ total: sum.total + row.total, answered: sum.answered + row.answered, unanswered: sum.unanswered + row.unanswered, correct: sum.correct + row.correct, wrong: sum.wrong + row.wrong, points: sum.points + row.points }), emptyMetric());

  const homeworkGroups = new Map<string, MetricAccumulator>();
  for (const question of snapshotQuestions) addMetric(homeworkGroups, question.ideaKey, { total: 1, answered: question.isAnswered ? 1 : 0, unanswered: question.isAnswered ? 0 : 1, correct: question.isCorrect === true ? 1 : 0, wrong: question.isCorrect === false ? 1 : 0, points: question.pointsEarned });

  const gameGroups = new Map<string, MetricAccumulator>();
  let gamePoints = 0;
  let gameCorrect = 0;
  let gameWrong = 0;
  let gameQuestions = 0;
  for (const game of games) {
    const participant = game.participants[0];
    const questionRows = game.questions;
    const fallback = { total: participant?.correctCount ? participant.correctCount + participant.wrongCount : 0, answered: participant?.correctCount ? participant.correctCount + participant.wrongCount : 0, correct: participant?.correctCount ?? 0, wrong: participant?.wrongCount ?? 0, points: participant?.pointsEarned ?? 0 };
    const values = questionRows.length ? { total: questionRows.length, answered: questionRows.filter((question) => question.isCorrect !== null).length, correct: questionRows.filter((question) => question.isCorrect === true).length, wrong: questionRows.filter((question) => question.isCorrect === false).length, points: questionRows.reduce((sum, question) => sum + question.pointsEarned, 0) } : fallback;
    addMetric(gameGroups, game.ideaId, values);
    gamePoints += values.points;
    gameCorrect += values.correct;
    gameWrong += values.wrong;
    gameQuestions += values.total;
  }

  const activityGroups = new Map<string, ReportActivityMetric>();
  for (const activity of activities) {
    const row = activityGroups.get(activity.type) ?? { type: activity.type, count: 0, pointsDelta: 0 };
    row.count += 1;
    row.pointsDelta += activity.pointsDelta;
    activityGroups.set(activity.type, row);
  }
  const fairnessGroups = new Map<string, { picks: number; manualPicks: number; sources: Map<string, number> }>();
  for (const activity of activities.filter((row) => row.type === "fair-pick")) {
    const metadata = safeJson(activity.metadataJson);
    const ideaKey = typeof metadata.ideaId === "string" ? metadata.ideaId : "lesson_unmapped";
    const source = typeof metadata.source === "string" ? metadata.source : "unknown";
    const row = fairnessGroups.get(ideaKey) ?? { picks: 0, manualPicks: 0, sources: new Map<string, number>() };
    row.picks += 1;
    if (metadata.manual === true || activity.description.includes("يدوي")) row.manualPicks += 1;
    row.sources.set(source, (row.sources.get(source) || 0) + 1);
    fairnessGroups.set(ideaKey, row);
  }
  const fairness: ReportFairness = {
    picks: [...fairnessGroups.values()].reduce((sum, row) => sum + row.picks, 0),
    manualPicks: [...fairnessGroups.values()].reduce((sum, row) => sum + row.manualPicks, 0),
    automaticPicks: [...fairnessGroups.values()].reduce((sum, row) => sum + row.picks - row.manualPicks, 0),
    byIdea: [...fairnessGroups.entries()].map(([ideaKey, row]) => ({ ideaKey, picks: row.picks, manualPicks: row.manualPicks, sources: [...row.sources.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count) })).sort((a, b) => b.picks - a.picks),
  };

  const recent: ReportRecentEvent[] = [
    ...activities.slice(0, 80).map((row) => ({ source: "activity" as const, type: row.type, label: row.description || row.type, points: row.pointsDelta, createdAt: row.createdAt.toISOString(), ideaKey: typeof safeJson(row.metadataJson).ideaId === "string" ? String(safeJson(row.metadataJson).ideaId) : null })),
    ...celebrations.slice(0, 40).map((row) => ({ source: "celebration" as const, type: "celebration", label: `${row.celebrationIcon} ${row.celebrationLabel}`, points: 0, createdAt: row.firedAt.toISOString() })),
    ...notes.slice(0, 20).map((row) => ({ source: "note" as const, type: "note", label: row.text, points: 0, createdAt: row.createdAt.toISOString(), shared: row.isShared })),
    ...games.slice(0, 20).map((row) => ({ source: "game" as const, type: row.gameType, label: `لعبة: ${row.gameType}`, points: row.participants[0]?.pointsEarned ?? 0, createdAt: row.startedAt.toISOString(), ideaKey: row.ideaId })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 40);

  const local = {
    points: sessionSnapshot ? Math.max(0, student.points - sessionSnapshot.pointsStart) : student.points,
    correct: sessionSnapshot ? Math.max(0, student.correctAnswers - sessionSnapshot.correctStart) : student.correctAnswers,
    wrong: sessionSnapshot ? Math.max(0, student.wrongAnswers - sessionSnapshot.wrongStart) : student.wrongAnswers,
    attempts: sessionSnapshot ? Math.max(0, student.attempts - sessionSnapshot.attemptsStart) : student.attempts,
  };
  const localTotal = local.correct + local.wrong;
  const latestUpdate = snapshots[0]?.sourceUpdatedAt ?? null;
  const quality: ReportSourceQuality[] = [
    qualityStatus("local", "النقاط المحلية", student.attempts),
    qualityStatus("moodle", "Moodle", snapshots.length, latestUpdate, !student.moodleUserId),
    qualityStatus("live-app", "التفاعل أثناء الحصة", interactive.total, liveRows[0]?.createdAt ?? null),
    qualityStatus("games", "الألعاب", games.length),
    qualityStatus("teacher", "تدخلات المعلم", interactions.length),
  ];
  return {
    generatedAt: new Date().toISOString(),
    scope: { sessionId, classId: effectiveClassId, moodleIndependentHomework: true },
    student: { id: student.id, name: student.name, classId: student.classId, moodleUserId: student.moodleUserId, moodleUsername: student.moodleUsername, points: student.points, correctAnswers: student.correctAnswers, wrongAnswers: student.wrongAnswers, attempts: student.attempts, accuracyPct: pct(local.correct, localTotal) ?? 0, title: student.title, isAbsent: student.isAbsent },
    session: { count: sessionCount, id: session?.id ?? sessionId, name: session?.name ?? null, startedAt: toIso(session?.startedAt) },
    local: { ...local, accuracyPct: pct(local.correct, localTotal) ?? 0 },
    interactive: { ...interactive, accuracyPct: pct(interactive.correct, interactive.answered), byIdea: interactiveRows, teacherInteractions: interactions.length },
    homework: { latest: latestSnapshot, historyCount: snapshots.length, byIdea: toIdeaMetrics(homeworkGroups) },
    games: { gameCount: games.length, points: gamePoints, correct: gameCorrect, wrong: gameWrong, questions: gameQuestions, byIdea: toIdeaMetrics(gameGroups) },
    activities: { total: activities.length, points: activities.reduce((sum, row) => sum + row.pointsDelta, 0), byType: [...activityGroups.values()].sort((a, b) => b.count - a.count), recent },
    fairness,
    celebrations: { total: celebrations.length, byType: [...celebrations.reduce((map, row) => { const current = map.get(row.celebrationLabel) ?? { label: row.celebrationLabel, icon: row.celebrationIcon, count: 0 }; current.count += 1; map.set(row.celebrationLabel, current); return map; }, new Map<string, { label: string; icon: string; count: number }>()).values()] },
    notes: { total: notes.length, shared: notes.filter((row) => row.isShared).length, recent: notes.slice(0, 10).map((row) => ({ text: row.text, createdAt: row.createdAt.toISOString(), isShared: row.isShared })) },
    quality,
  };
}

export function buildStudentReport(studentId: string, scope: Scope = {}): Promise<StudentReportAggregate | null> {
  return getCached(studentReportCache, `${studentId}|${scopeKey(scope)}`, () => buildStudentReportUncached(studentId, scope));
}

export function buildClassReport(scope: Scope = {}): Promise<ClassReportAggregate> {
  return getCached(classReportCache, scopeKey(scope), () => buildClassReportUncached(scope));
}

async function buildClassReportUncached(scope: Scope = {}): Promise<ClassReportAggregate> {
  const classId = scope.classId ?? null;
  const sessionId = scope.sessionId ?? null;
  const students = await db.student.findMany({ where: classId ? { classId } : {}, orderBy: { name: "asc" }, select: { id: true } });
  const reports = (await Promise.all(students.map((student) => buildStudentReport(student.id, { classId, sessionId })))).filter((row): row is StudentReportAggregate => Boolean(row));
  const sorted = reports.sort((a, b) => b.local.points - a.local.points || b.interactive.correct - a.interactive.correct || a.student.name.localeCompare(b.student.name, "ar"));
  const rows: ClassReportRow[] = sorted.map((row, index) => ({ ...row, rank: index + 1 }));
  const classRoom = classId ? await db.classRoom.findUnique({ where: { id: classId }, select: { name: true } }) : null;
  return {
    generatedAt: new Date().toISOString(),
    scope: { classId, sessionId, className: classRoom?.name ?? "كل الفصول" },
    rows,
    totals: {
      students: rows.length,
      localPoints: rows.reduce((sum, row) => sum + row.local.points, 0),
      localCorrect: rows.reduce((sum, row) => sum + row.local.correct, 0),
      localWrong: rows.reduce((sum, row) => sum + row.local.wrong, 0),
      interactiveAnswered: rows.reduce((sum, row) => sum + row.interactive.answered, 0),
      interactiveCorrect: rows.reduce((sum, row) => sum + row.interactive.correct, 0),
      homeworkGradeCount: rows.filter((row) => row.homework.latest?.moodleGrade != null).length,
      gamePoints: rows.reduce((sum, row) => sum + row.games.points, 0),
    },
  };
}
