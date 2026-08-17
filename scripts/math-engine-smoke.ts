import assert from "node:assert/strict";
import {
  addFractions,
  circleGeometry,
  convertLength,
  distanceBetweenPoints,
  evaluateArithmetic,
  fractionToString,
  mean,
  median,
  mode,
  normalizeFraction,
  parseFraction,
  pythagoreanHypotenuse,
  rectangleGeometry,
  rectangularPrismVolume,
  triangleGeometry,
} from "../src/lib/math-engine.ts";

const checks: Array<[string, () => void]> = [
  ["fraction normalization", () => assert.deepEqual(normalizeFraction({ numerator: 6, denominator: 8 }), { numerator: 3, denominator: 4 })],
  ["fraction parsing", () => assert.deepEqual(parseFraction("1 1/4"), { numerator: 5, denominator: 4 })],
  ["negative mixed fraction parsing", () => assert.deepEqual(parseFraction("-1 1/2"), { numerator: -3, denominator: 2 })],
  ["fraction addition", () => assert.equal(fractionToString(addFractions(parseFraction("3/4"), parseFraction("1/2"))), "5/4")],
  ["safe arithmetic", () => assert.equal(evaluateArithmetic("(3+5)×2"), 16)],
  ["safe arithmetic precedence", () => assert.equal(evaluateArithmetic("10-2*3"), 4)],
  ["rectangle", () => assert.deepEqual(rectangleGeometry(8, 5), { area: 40, perimeter: 26, label: "مستطيل" })],
  ["circle", () => assert.equal(circleGeometry(1).label, "دائرة")],
  ["triangle", () => assert.equal(triangleGeometry(8, 5).area, 20)],
  ["reject invalid triangle sides", () => assert.throws(() => triangleGeometry(3, 4, 1, 2, 10))],
  ["pythagoras", () => assert.equal(pythagoreanHypotenuse(3, 4), 5)],
  ["volume", () => assert.equal(rectangularPrismVolume(2, 3, 4), 24)],
  ["length conversion", () => assert.equal(convertLength(150, "cm", "m"), 1.5)],
  ["mean", () => assert.equal(mean([2, 3, 3, 7, 10]), 5)],
  ["median", () => assert.equal(median([2, 3, 3, 7, 10]), 3)],
  ["mode", () => assert.equal(mode([2, 3, 3, 7, 10]), 3)],
  ["reject zero denominator", () => assert.throws(() => normalizeFraction({ numerator: 1, denominator: 0 }))],
  ["reject unsafe expression", () => assert.throws(() => evaluateArithmetic("alert(1)"))],
  ["reject division by zero", () => assert.throws(() => evaluateArithmetic("8/0"))],
  ["reject non-finite coordinates", () => assert.throws(() => distanceBetweenPoints({ x: Number.NaN, y: 0 }, { x: 1, y: 1 }))],
];

for (const [name, check] of checks) {
  check();
  console.log(`PASS ${name}`);
}
console.log(`SUMMARY ${checks.length} passed, 0 failed`);
