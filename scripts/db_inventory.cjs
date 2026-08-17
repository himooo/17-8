const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const tables = [
    ['ClassRoom', () => prisma.classRoom.count()],
    ['Student', () => prisma.student.count()],
    ['StudentGroup', () => prisma.studentGroup.count()],
    ['StudentBadge', () => prisma.studentBadge.count()],
    ['StudentGift', () => prisma.studentGift.count()],
    ['AttendanceRecord', () => prisma.attendanceRecord.count()],
    ['ImportedLesson', () => prisma.importedLesson.count()],
    ['LessonQuestion', () => prisma.lessonQuestion.count()],
    ['Session', () => prisma.session.count()],
    ['SessionStudentSnapshot', () => prisma.sessionStudentSnapshot.count()],
    ['GameResult', () => prisma.gameResult.count()],
    ['GameResultParticipant', () => prisma.gameResultParticipant.count()],
    ['GameResultQuestion', () => prisma.gameResultQuestion.count()],
    ['Prize', () => prisma.prize.count()],
    ['Gift', () => prisma.gift.count()],
    ['CustomSound', () => prisma.customSound.count()],
    ['Celebration', () => prisma.celebration.count()],
    ['AppSettings', () => prisma.appSettings.count()],
    ['BackupHistory', () => prisma.backupHistory.count()],
    ['CelebrationEvent', () => prisma.celebrationEvent.count()],
    ['StudentNote', () => prisma.studentNote.count()],
    ['StudentActivity', () => prisma.studentActivity.count()],
    ['AiProviderKey', () => prisma.aiProviderKey.count()],
    ['MoodleSyncEvent', () => prisma.moodleSyncEvent.count()],
    ['AiUsageEvent', () => prisma.aiUsageEvent.count()],
  ];
  const counts = {};
  for (const [name, fn] of tables) {
    try { counts[name] = await fn(); } catch (error) { counts[name] = { error: error instanceof Error ? error.message : String(error) }; }
  }
  const checks = {};
  checks.studentsMissingClass = await prisma.student.count({ where: { classId: null } });
  checks.studentsBlankName = await prisma.student.count({ where: { name: '' } });
  checks.questionsBlankText = await prisma.lessonQuestion.count({ where: { text: '' } });
  checks.gameResultsWithoutSession = await prisma.gameResult.count({ where: { sessionId: null } });
  checks.eventsWithoutStudentOrSession = await prisma.celebrationEvent.count({ where: { studentId: null, sessionId: null } });
  checks.activitiesWithoutSession = await prisma.studentActivity.count({ where: { sessionId: null } });
  const settings = await prisma.appSettings.findMany({ select: { id: true, settingsJson: true } });
  const settingsSummary = settings.map((row) => ({ id: row.id, bytes: row.settingsJson.length, hasCustomApp: row.settingsJson.includes('customApp'), hasMoodle: row.settingsJson.includes('moodle'), hasTelegram: row.settingsJson.includes('telegram'), hasPlainApiKey: /apiKey|token/i.test(row.settingsJson) }));
  const lessonSummaries = await prisma.importedLesson.findMany({ select: { lessonId: true, title: true, manifestJson: true }, orderBy: { updatedAt: 'desc' }, take: 20 });
  console.log(JSON.stringify({ counts, checks, settingsSummary, lessonSummaries: lessonSummaries.map((l) => ({ lessonId: l.lessonId, title: l.title, manifestBytes: l.manifestJson.length, manifestLooksJson: l.manifestJson.trim().startsWith('{') })) }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
