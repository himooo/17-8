const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const KEY_FILE = path.join(process.cwd(), 'data', '.moodle-key-secret');
async function moodleSecret() {
  if (process.env.BISALASA_MOODLE_KEY_SECRET) return crypto.createHash('sha256').update(process.env.BISALASA_MOODLE_KEY_SECRET, 'utf8').digest();
  await fs.mkdir(path.dirname(KEY_FILE), { recursive: true });
  try { const existing = (await fs.readFile(KEY_FILE, 'utf8')).trim(); if (existing.length >= 64) return Buffer.from(existing, 'hex'); } catch {}
  const secret = crypto.randomBytes(32); await fs.writeFile(KEY_FILE, secret.toString('hex'), { mode: 0o600 }); return secret;
}
async function encryptMoodleToken(value) {
  const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', await moodleSecret(), iv); const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

async function main() {
  const tokenEncrypted = await encryptMoodleToken('moodle-token-qa');
  await prisma.appSettings.upsert({ where: { id: 'singleton' }, create: { id: 'singleton', settingsJson: JSON.stringify({ moodle: { enabled: true, baseUrl: 'http://127.0.0.1:3021/moodle', courseId: 77, curriculumKey: 'grade4-math-2026', tokenEncrypted } }) }, update: { settingsJson: JSON.stringify({ moodle: { enabled: true, baseUrl: 'http://127.0.0.1:3021/moodle', courseId: 77, curriculumKey: 'grade4-math-2026', tokenEncrypted } }) } });
  const course = await prisma.moodleCourseMap.upsert({
    where: { moodleCourseId_curriculumKey: { moodleCourseId: 77, curriculumKey: 'grade4-math-2026' } },
    create: { moodleCourseId: 77, curriculumKey: 'grade4-math-2026', label: 'Moodle QA baseline', enabled: true },
    update: { enabled: true, label: 'Moodle QA baseline' },
  });
  const activities = [
    { moodleActivityId: 701, activityType: 'quiz', lessonKey: 'lesson03', ideaKey: 'idea01', name: 'النشاط التفاعلي — الفكرة 1' },
    { moodleActivityId: 702, activityType: 'quiz', lessonKey: 'lesson03', ideaKey: null, name: 'واجب الدرس الكامل' },
    { moodleActivityId: 801, activityType: 'assignment', lessonKey: 'lesson03', ideaKey: null, name: 'واجب الدرس الكامل' },
  ];
  for (const item of activities) {
    const activity = await prisma.moodleActivityMap.upsert({
      where: { courseMapId_moodleActivityId_activityType: { courseMapId: course.id, moodleActivityId: item.moodleActivityId, activityType: item.activityType } },
      create: { courseMapId: course.id, moodleActivityId: item.moodleActivityId, activityType: item.activityType, curriculumKey: 'grade4-math-2026', lessonKey: item.lessonKey, ideaKey: item.ideaKey, name: item.name, visible: true, mappingMode: 'tag', confidence: 1, sourceFingerprint: `baseline-${item.moodleActivityId}` },
      update: { visible: true, lessonKey: item.lessonKey, ideaKey: item.ideaKey, name: item.name },
    });
    if (item.moodleActivityId === 702 || item.moodleActivityId === 801) {
      await prisma.moodleHomeworkMap.upsert({
        where: { courseMapId_moodleActivityId_activityType: { courseMapId: course.id, moodleActivityId: item.moodleActivityId, activityType: item.activityType } },
        create: { courseMapId: course.id, moodleActivityId: item.moodleActivityId, activityType: item.activityType, curriculumKey: 'grade4-math-2026', lessonKey: 'lesson03', externalKey: `bisalasa:homework:lesson03:${item.moodleActivityId}`, name: item.name, enabled: true },
        update: { lessonKey: 'lesson03', name: item.name, enabled: true },
      });
    }
    if (item.moodleActivityId === 701) {
      await prisma.moodleQuestionMap.upsert({
        where: { activityMapId_moodleQuestionId: { activityMapId: activity.id, moodleQuestionId: 7101 } },
        create: { activityMapId: activity.id, moodleQuestionId: 7101, curriculumKey: 'grade4-math-2026', lessonKey: 'lesson03', ideaKey: 'idea01', tag: 'bisalasa:idea:lesson03:idea01' },
        update: { ideaKey: 'idea01' },
      });
    }
  }
  for (const moodleUserId of [101, 102, 103]) {
    const studentId = `moodle-qa-student-${moodleUserId}`;
    await prisma.student.upsert({ where: { id: studentId }, create: { id: studentId, name: `QA ${moodleUserId}`, points: 0, correctAnswers: 0, wrongAnswers: 0, attempts: 0 }, update: { name: `QA ${moodleUserId}` } });
    await prisma.moodleStudentMap.upsert({
      where: { courseMapId_moodleUserId: { courseMapId: course.id, moodleUserId } },
      create: { courseMapId: course.id, moodleUserId, studentId, displayName: `QA ${moodleUserId}`, enabled: true },
      update: { studentId, enabled: true },
    });
  }
  console.log(JSON.stringify({ ok: true, courseMapId: course.id, students: 3, activities: activities.length }));
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
