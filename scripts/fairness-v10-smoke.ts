import assert from "node:assert/strict";
import { useShellStore } from "../src/lib/shell-store.ts";
import { pickStudentFair } from "../src/lib/game-utils.ts";

(globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = (async () => new Response(JSON.stringify({ ok: true, data: null }), { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch;

const students = ["a", "b", "c", "d", "e"].map((id, index) => ({
  id,
  name: `طالب ${index + 1}`,
  points: 0,
  correctAnswers: 0,
  wrongAnswers: 0,
  attempts: 0,
  badges: [],
  isAbsent: false,
  calledInSession: false,
  createdAt: new Date().toISOString(),
}));

useShellStore.setState({
  students,
  currentIdeaId: "addition",
  settings: { ...useShellStore.getState().settings, fairnessMode: "soft" },
  ideaSelectionHistory: {},
  lessonAttemptsByStudent: {},
  lessonCorrectByStudent: {},
  lessonWrongByStudent: {},
  lastAskedAtByStudent: {},
  performanceByIdea: {},
  fairnessLog: [],
});

const firstRound = Array.from({ length: 5 }, () => pickStudentFair({ ideaId: "addition", source: "quickfire" }));
assert.equal(new Set(firstRound.filter(Boolean).map((student) => student!.id)).size, 5, "idea rotation must not repeat before all students are asked");
assert.equal(useShellStore.getState().fairnessLog.length, 5);
assert.deepEqual(Object.values(useShellStore.getState().lessonAttemptsByStudent).sort((a, b) => a - b), [1, 1, 1, 1, 1]);

useShellStore.setState({
  currentIdeaId: "subtraction",
  ideaSelectionHistory: { subtraction: ["a", "b", "c", "d", "e"] },
  lessonAttemptsByStudent: { a: 1, b: 1, c: 1, d: 1, e: 1 },
});
useShellStore.getState().recordAnswerForIdea("a", "subtraction", false);
useShellStore.getState().recordAnswerForIdea("a", "subtraction", false);
useShellStore.getState().recordAnswerForIdea("b", "subtraction", true);
const strugglingPick = pickStudentFair({ ideaId: "subtraction", source: "mathchallenge" });
assert.equal(strugglingPick?.id, "a", "idea-level struggling student must be prioritised on the same idea");
assert.equal(useShellStore.getState().performanceByIdea.subtraction.a.wrong, 2);

useShellStore.setState({
  settings: { ...useShellStore.getState().settings, fairnessMode: "strict" },
  currentIdeaId: "multiplication",
  ideaSelectionHistory: { multiplication: ["a", "b", "c", "d", "e"] },
  lessonAttemptsByStudent: { a: 4, b: 0, c: 0, d: 0, e: 0 },
  performanceByIdea: {},
});
const balancedPick = pickStudentFair({ ideaId: "multiplication", source: "wheel" });
assert.notEqual(balancedPick?.id, "a", "strict mode must defer an over-selected student when alternatives exist");
const rejectedManual = pickStudentFair({ ideaId: "multiplication", source: "manual", manualStudentId: "a" });
assert.equal(rejectedManual, null, "strict mode must reject a materially unfair manual repeat");

useShellStore.setState({ settings: { ...useShellStore.getState().settings, fairnessMode: "soft" } });
const softManual = pickStudentFair({ ideaId: "multiplication", source: "manual", manualStudentId: "a" });
assert.equal(softManual?.id, "a", "soft mode keeps teacher decision while logging the choice");

useShellStore.setState({ students: useShellStore.getState().students.map((student) => student.id === "e" ? { ...student, isAbsent: true } : student) });
const absentPick = pickStudentFair({ ideaId: "multiplication", source: "teleprompter", excludeStudentIds: ["a", "b", "c", "d"] });
assert.equal(absentPick, null, "absent and excluded students must never be auto-selected");

const log = useShellStore.getState().fairnessLog;
assert.ok(log.every((entry) => entry.ideaId && entry.source && Number.isFinite(entry.score)));
assert.equal(useShellStore.getState().lessonAttemptsByStudent.a, 5);

useShellStore.getState().resetLessonStats();
assert.deepEqual(useShellStore.getState().lessonAttemptsByStudent, {});
assert.deepEqual(useShellStore.getState().performanceByIdea, {});
assert.equal(useShellStore.getState().students.some((student) => student.calledInSession), false);

console.log(JSON.stringify({ ok: true, suite: "fairness-v10-smoke", checks: 11, failed: 0 }, null, 2));
