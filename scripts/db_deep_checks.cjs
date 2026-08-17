const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const [orphanEvents, sessions, lessons, settings, celebrations, usage] = await Promise.all([
    prisma.celebrationEvent.findMany({ where: { studentId: null, sessionId: null }, orderBy: { firedAt: 'desc' }, take: 20 }),
    prisma.session.findMany({ orderBy: { startedAt: 'desc' }, take: 30, select: { id: true, classId: true, startedAt: true, endedAt: true } }),
    prisma.importedLesson.findMany({ select: { lessonId: true, title: true, manifestJson: true } }),
    prisma.appSettings.findMany({ select: { id: true, settingsJson: true } }),
    prisma.celebration.findMany({ select: { id: true, label: true, renderMode: true, isDefault: true, isCustom: true } }),
    prisma.aiUsageEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 20, select: { provider: true, model: true, ok: true, createdAt: true } }),
  ]);
  const parsedSettings = settings.map((row) => {
    let value = {};
    try { value = JSON.parse(row.settingsJson); } catch {}
    const keys = Object.keys(value);
    return { id: row.id, keys, hasEncryptedSecrets: Object.values(value).some((v) => typeof v === 'string' && (v.includes('enc:') || v.includes('cipher') || v.length > 200)) };
  });
  console.log(JSON.stringify({ orphanEvents, sessions, lessonShapes: lessons.map((l) => ({ lessonId: l.lessonId, title: l.title, manifestKeys: (() => { try { return Object.keys(JSON.parse(l.manifestJson)); } catch { return []; } })() })), settings: parsedSettings, celebrations, usage }, null, 2));
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
