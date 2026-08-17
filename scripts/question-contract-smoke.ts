import assert from "node:assert/strict";
import { parseQuestionOptions, validateQuestionInput } from "../src/lib/question-contract.ts";

const validJson = validateQuestionInput({
  lessonId: "lesson-1",
  text: "ما قيمة 1/2؟",
  optionsJson: '["0.25","0.5","1"]',
  correctAnswer: "0.5",
  tags: ["fractions", "fractions"],
  rewardPoints: 4,
  difficulty: "easy",
});
assert.equal(validJson.ok, true);
assert.deepEqual(JSON.parse(validJson.value!.optionsJson), ["0.25", "0.5", "1"]);
assert.deepEqual(JSON.parse(validJson.value!.tags), ["fractions"]);
assert.deepEqual(parseQuestionOptions(validJson.value!.optionsJson), ["0.25", "0.5", "1"]);

const badAnswer = validateQuestionInput({ lessonId: "lesson-1", text: "سؤال", options: ["أ", "ب"], correctAnswer: "ج" });
assert.equal(badAnswer.ok, false);
assert.ok(badAnswer.errors.some((error) => error.includes("correctAnswer")));

const malformedOptions = validateQuestionInput({ lessonId: "lesson-1", text: "سؤال", optionsJson: "not-json", correctAnswer: "أ" });
assert.equal(malformedOptions.ok, false);
assert.ok(malformedOptions.errors.some((error) => error.includes("خيارين")));

const oversized = validateQuestionInput({ lessonId: "lesson-1", text: "سؤال", options: ["أ", "ب"], correctAnswer: "أ", rewardPoints: 1000, stepNumber: 0 });
assert.equal(oversized.ok, false);
assert.ok(oversized.errors.some((error) => error.includes("stepNumber")));

console.log("SUMMARY question-contract: 4 scenarios passed, 0 failed");
