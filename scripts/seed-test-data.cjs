#!/usr/bin/env node
if (!process.env.DATABASE_URL) process.env.DATABASE_URL = "file:" + require("node:path").join(require("node:os").tmpdir(), "bisalasa-v10-suite.db").replace(/\\\\/g, "/");
const { PrismaClient } = require("@prisma/client");

const db = new PrismaClient();
const classes = [
  { id: "v10-class-4A", name: "4A", color: "#0142A0" },
  { id: "v10-class-4B", name: "4B", color: "#DA151C" },
  { id: "v10-class-4C", name: "4C", color: "#0f766e" },
];

async function main() {
  const now = new Date("2026-08-15T00:00:00.000Z");
  for (const item of classes) {
    await db.classRoom.upsert({
      where: { id: item.id },
      update: { name: item.name, description: "V10 deterministic QA class", color: item.color },
      create: { id: item.id, name: item.name, description: "V10 deterministic QA class", color: item.color },
    });
  }

  for (let classIndex = 0; classIndex < classes.length; classIndex += 1) {
    const classId = classes[classIndex].id;
    for (let studentIndex = 0; studentIndex < 25; studentIndex += 1) {
      const number = classIndex * 25 + studentIndex + 1;
      const id = `v10-student-${String(number).padStart(3, "0")}`;
      await db.student.upsert({
        where: { id },
        update: { classId, name: `طالب V10 ${number}`, studentCode: `V10-${String(number).padStart(3, "0")}`, isAbsent: false },
        create: { id, classId, name: `طالب V10 ${number}`, studentCode: `V10-${String(number).padStart(3, "0")}`, isAbsent: false },
      });
    }
  }

  const lessonIds = [];
  for (let lessonIndex = 0; lessonIndex < 5; lessonIndex += 1) {
    const id = `v10-lesson-${lessonIndex + 1}`;
    lessonIds.push(id);
    await db.importedLesson.upsert({
      where: { id },
      update: {
        lessonId: id,
        fileName: `${id}.html`,
        title: `درس V10 الكسور ${lessonIndex + 1}`,
        subtitle: "بيانات اختبار محلية",
        content: `<section><h1>درس الكسور ${lessonIndex + 1}</h1><p>محتوى اختبار محلي.</p></section>`,
        manifestJson: JSON.stringify({ lessonId: id, title: `درس V10 الكسور ${lessonIndex + 1}`, currentStep: 1, totalSteps: 1, ideas: [{ id: `v10-idea-${lessonIndex + 1}`, title: "الفكرة الأساسية", steps: [] }] }),
      },
      create: {
        id,
        lessonId: id,
        fileName: `${id}.html`,
        title: `درس V10 الكسور ${lessonIndex + 1}`,
        subtitle: "بيانات اختبار محلية",
        content: `<section><h1>درس الكسور ${lessonIndex + 1}</h1><p>محتوى اختبار محلي.</p></section>`,
        manifestJson: JSON.stringify({ lessonId: id, title: `درس V10 الكسور ${lessonIndex + 1}`, currentStep: 1, totalSteps: 1, ideas: [{ id: `v10-idea-${lessonIndex + 1}`, title: "الفكرة الأساسية", steps: [] }] }),
      },
    });
    for (let questionIndex = 0; questionIndex < 10; questionIndex += 1) {
      const qid = `v10-question-${lessonIndex + 1}-${questionIndex + 1}`;
      const options = ["1", "2", "3", "4"];
      await db.lessonQuestion.upsert({
        where: { id: qid },
        update: { lessonId: id, ideaId: `v10-idea-${lessonIndex + 1}`, ideaTitle: "الفكرة الأساسية", stepNumber: 1, text: `ما ناتج السؤال ${questionIndex + 1} في الدرس ${lessonIndex + 1}؟`, correctAnswer: "2", optionsJson: JSON.stringify(options), questionType: "mcq", rewardPoints: 3, difficulty: questionIndex % 3 === 0 ? "easy" : questionIndex % 3 === 1 ? "medium" : "hard", tags: JSON.stringify(["v10", "كسور"]), solutionStepsJson: JSON.stringify(["حدد المعطيات", "طبّق القاعدة", "راجع الناتج"]), solutionScript: "حل خطوة بخطوة", gameReady: true },
        create: { id: qid, lessonId: id, ideaId: `v10-idea-${lessonIndex + 1}`, ideaTitle: "الفكرة الأساسية", stepNumber: 1, text: `ما ناتج السؤال ${questionIndex + 1} في الدرس ${lessonIndex + 1}؟`, correctAnswer: "2", optionsJson: JSON.stringify(options), questionType: "mcq", rewardPoints: 3, difficulty: questionIndex % 3 === 0 ? "easy" : questionIndex % 3 === 1 ? "medium" : "hard", tags: JSON.stringify(["v10", "كسور"]), solutionStepsJson: JSON.stringify(["حدد المعطيات", "طبّق القاعدة", "راجع الناتج"]), solutionScript: "حل خطوة بخطوة", gameReady: true },
      });
    }
  }

  for (const classItem of classes) {
    for (let sessionIndex = 0; sessionIndex < 3; sessionIndex += 1) {
      const id = `v10-session-${classItem.id}-${sessionIndex + 1}`;
      await db.session.upsert({
        where: { id },
        update: { classId: classItem.id, name: `V10 ${classItem.name} جلسة ${sessionIndex + 1}`, startedAt: new Date(now.getTime() + sessionIndex * 60_000), endedAt: sessionIndex === 2 ? new Date(now.getTime() + sessionIndex * 60_000 + 30_000) : null, statsJson: JSON.stringify({ totalQuestions: 10, correctAnswers: 7, participationCount: 25 }) },
        create: { id, classId: classItem.id, name: `V10 ${classItem.name} جلسة ${sessionIndex + 1}`, startedAt: new Date(now.getTime() + sessionIndex * 60_000), endedAt: sessionIndex === 2 ? new Date(now.getTime() + sessionIndex * 60_000 + 30_000) : null, statsJson: JSON.stringify({ totalQuestions: 10, correctAnswers: 7, participationCount: 25 }) },
      });
    }
  }

  const counts = {
    classes: await db.classRoom.count({ where: { id: { startsWith: "v10-class-" } } }),
    students: await db.student.count({ where: { id: { startsWith: "v10-student-" } } }),
    lessons: await db.importedLesson.count({ where: { id: { startsWith: "v10-lesson-" } } }),
    questions: await db.lessonQuestion.count({ where: { id: { startsWith: "v10-question-" } } }),
    sessions: await db.session.count({ where: { id: { startsWith: "v10-session-" } } }),
  };
  console.log(JSON.stringify({ ok: true, counts }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
