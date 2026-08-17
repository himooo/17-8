FAIRNESS V10 GAP ANALYSIS
Generated: 2026-08-15

Existing state:
src/lib/game-utils.ts

Fairness panel files:
src/lib/useFairStudentPicker.ts

fairnessMode references:

Selection bypasses:
src/components/shell/HotPotatoGame.tsx:7:// 🟢 v2 fix: pickStudentManual لتعليم الفائز فقط بدل pickFairStudentsBatch(6)
src/components/shell/HotPotatoGame.tsx:49:  // 🟢 v2 fix: بقى pickFairStudentsBatch غير مستخدم — حذفناه لتجنب التضخيم.
src/components/shell/MemoryGame.tsx:355:                    // 🟢 v2 fix: picker.pickRandom يعلّم calledInSession داخلياً،
src/components/shell/MemoryGame.tsx:357:                    const picked = picker.pickRandom(studentId ? [studentId] : []);
src/components/shell/MemoryGame.tsx:374:                      // عند الاختيار اليدوي (نفس منطق picker.pickRandom).
src/components/shell/MysteryBoxGame.tsx:95:    // 🟢 v2 fix: picker.pickRandom يعلّم calledInSession داخلياً، لا حاجة لـ
src/components/shell/MysteryBoxGame.tsx:97:    const picked = picker.pickRandom(participantId ? [participantId] : []);
src/components/shell/MysteryBoxGame.tsx:246:                      // عند الاختيار اليدوي (نفس منطق picker.pickRandom).
src/components/shell/LuckyWheelGame.tsx:85:    // 🟢 v2 fix: استخدم picker.pickRandom([]) بدون exclude — الـ picker يعتمد
src/components/shell/LuckyWheelGame.tsx:87:    const picked = picker.pickRandom([]);
src/components/shell/LuckyWheelGame.tsx:238:                const picked = picker.pickRandom([]);
src/components/shell/QuestionChallengeGame.tsx:140:    const first = picker.pickRandom(excludeIds);
src/components/shell/QuestionChallengeGame.tsx:143:    const second = picker.pickRandom(excludeIds);
src/components/shell/QuestionChallengeGame.tsx:145:    // 🟢 v2 fix: removed recordStudentActivity(type:"star", points:0) calls — picker.pickRandom
src/components/shell/MathChallengeGame.tsx:316:                      const picked = picker.pickRandom(studentId ? [studentId] : []);
src/components/shell/MathChallengeGame.tsx:320:                        // 🟢 v2 fix: removed recordStudentActivity(type:"star", points:0) — picker.pickRandom
src/components/shell/RandomStudentWheel.tsx:39:    const picked = picker.pickRandom();
src/components/shell/QuickFireGame.tsx:193:    const picked = picker.pickRandom(participant ? [participant.id] : []);
src/components/shell/QuickFireGame.tsx:196:      // 🟢 v2 fix: removed recordStudentActivity(type:"star", points:0) — picker.pickRandom
src/components/shell/DiceRollGame.tsx:209:                    // 🟢 v2 fix: picker.pickRandom يعلّم calledInSession داخلياً.
src/components/shell/DiceRollGame.tsx:210:                    const picked = picker.pickRandom(studentId ? [studentId] : []);
src/components/shell/ReactionTimeGame.tsx:220:                    // 🟢 v2 fix: picker.pickRandom يعلّم calledInSession داخلياً.
src/components/shell/ReactionTimeGame.tsx:221:                    const picked = picker.pickRandom(studentId ? [studentId] : []);
src/components/shell/QuizShowGame.tsx:40:  const pickFairStudentsBatch = useShellStore((s) => s.pickFairStudentsBatch);
src/components/shell/QuizShowGame.tsx:66:      const picked = pickFairStudentsBatch(4);
src/components/shell/QuizShowGame.tsx:70:  }, [participants, pickFairStudentsBatch, presentStudents.length]);
src/components/shell/QuizShowGame.tsx:101:    const picked = picker.pickRandom(participants
src/components/shell/QuizShowGame.tsx:115:      // 🟢 v2 fix: removed recordStudentActivity(type:"star", points:0) — picker.pickRandom
src/lib/shell-store.ts:230:  pickFairStudentsBatch: (count: number) => Student[];
src/lib/shell-store.ts:937:      pickFairStudentsBatch: (count) => {

Persisted DB Student fields:
model Student {
  id                     String    @id @default(cuid())
  classId                String?
  name                   String
  studentCode            String?   @unique
  parentTelegramChatId   String?
  parentTelegramUsername String?
  parentPhone            String?
  points                 Int       @default(0)
  correctAnswers         Int       @default(0)
  wrongAnswers           Int       @default(0)
  attempts               Int       @default(0)
  title                  String? // اللقب الحالي (عبقري، بطل، نجم...)
  isAbsent               Boolean   @default(false)
  moodleUserId           Int?
  moodleUsername         String?
  moodleCourseId         Int?
  lastCalled             DateTime?
  createdAt              DateTime  @default(now())
  updatedAt              DateTime  @updatedAt

  class            ClassRoom?               @relation(fields: [classId], references: [id], onDelete: Cascade)
  badges           StudentBadge[]
  gifts            StudentGift[]
  gameResults      GameResultParticipant[]
  sessionSnapshots SessionStudentSnapshot[]

  @@index([classId])
  @@index([classId, name])
  @@index([name])
  @@index([moodleUserId])
  @@index([parentTelegramChatId])
  @@map("students")
}

Conclusion:
The current code has session/idea selection history and a generic picker, but no unified pickStudentFair contract, no lesson attempt/correct/wrong maps, no idea-level performance map, no fairness panel, no fairnessMode setting, and no lastAbsentAt persistence. Multiple games still call useGameStudentPicker.pickRandom directly.
