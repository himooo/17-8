/**
 * Math engine for Bisalasa's teacher-controlled mathematics workspace.
 * Pure functions only: safe to use from games, the whiteboard and reports.
 */

export interface FractionValue {
  numerator: number;
  denominator: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface GeometrySummary {
  area: number;
  perimeter: number;
  label: string;
}

const MAX_ABS = 1_000_000_000;

function assertFinite(value: number, label: string): number {
  if (!Number.isFinite(value) || Math.abs(value) > MAX_ABS) {
    throw new Error(`${label} غير صالح`);
  }
  return value;
}

export function gcd(a: number, b: number): number {
  let x = Math.abs(Math.trunc(a));
  let y = Math.abs(Math.trunc(b));
  while (y !== 0) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1;
}

export function normalizeFraction(value: FractionValue): FractionValue {
  assertFinite(value.numerator, "البسط");
  assertFinite(value.denominator, "المقام");
  if (!Number.isInteger(value.numerator) || !Number.isInteger(value.denominator)) {
    throw new Error("البسط والمقام يجب أن يكونا عددين صحيحين");
  }
  if (value.denominator === 0) throw new Error("لا يمكن أن يساوي المقام صفراً");
  const sign = value.denominator < 0 ? -1 : 1;
  const divisor = gcd(value.numerator, value.denominator);
  return {
    numerator: (sign * value.numerator) / divisor,
    denominator: (sign * value.denominator) / divisor,
  };
}

export function parseFraction(input: string): FractionValue {
  const raw = input.trim();
  if (!raw) throw new Error("أدخل قيمة للكسر");
  const mixed = raw.match(/^(-?\d+)(?:\s+|\+)(\d+)\/(\d+)$/);
  if (mixed && mixed[1] && mixed[2] && mixed[3]) {
    const whole = Number(mixed[1]);
    const numerator = Number(mixed[2]);
    const denominator = Number(mixed[3]);
    const sign = whole < 0 ? -1 : 1;
    return normalizeFraction({ numerator: whole * denominator + sign * numerator, denominator });
  }
  const normalized = raw.replace(/\s+/g, "");
  const simple = normalized.match(/^(-?\d+)\/(\d+)$/);
  if (simple && simple[1] && simple[2]) {
    return normalizeFraction({ numerator: Number(simple[1]), denominator: Number(simple[2]) });
  }
  const decimal = Number(normalized);
  if (Number.isFinite(decimal)) {
    const text = normalized.replace("-", "");
    const digits = text.includes(".") ? text.split(".")[1]?.length ?? 0 : 0;
    const denominator = 10 ** digits;
    return normalizeFraction({ numerator: Math.round(decimal * denominator), denominator });
  }
  throw new Error("صيغة الكسر غير صحيحة");
}

export function fractionToString(value: FractionValue): string {
  const fraction = normalizeFraction(value);
  if (fraction.denominator === 1) return String(fraction.numerator);
  return `${fraction.numerator}/${fraction.denominator}`;
}

export function fractionToMixed(value: FractionValue): string {
  const fraction = normalizeFraction(value);
  if (Math.abs(fraction.numerator) < fraction.denominator) return fractionToString(fraction);
  const whole = Math.trunc(fraction.numerator / fraction.denominator);
  const remainder = Math.abs(fraction.numerator % fraction.denominator);
  if (remainder === 0) return String(whole);
  return `${whole} ${remainder}/${fraction.denominator}`;
}

export function fractionToDecimal(value: FractionValue, precision = 6): number {
  return Number((normalizeFraction(value).numerator / normalizeFraction(value).denominator).toFixed(precision));
}

export function addFractions(a: FractionValue, b: FractionValue): FractionValue {
  const left = normalizeFraction(a);
  const right = normalizeFraction(b);
  return normalizeFraction({
    numerator: left.numerator * right.denominator + right.numerator * left.denominator,
    denominator: left.denominator * right.denominator,
  });
}

export function subtractFractions(a: FractionValue, b: FractionValue): FractionValue {
  return addFractions(a, { numerator: -b.numerator, denominator: b.denominator });
}

export function multiplyFractions(a: FractionValue, b: FractionValue): FractionValue {
  return normalizeFraction({ numerator: a.numerator * b.numerator, denominator: a.denominator * b.denominator });
}

export function divideFractions(a: FractionValue, b: FractionValue): FractionValue {
  if (b.numerator === 0) throw new Error("لا يمكن القسمة على صفر");
  return multiplyFractions(a, { numerator: b.denominator, denominator: b.numerator });
}

export function percentOf(percent: number, amount: number): number {
  assertFinite(percent, "النسبة");
  assertFinite(amount, "القيمة");
  return Number(((percent / 100) * amount).toFixed(8));
}

export function solveLinearEquation(a: number, b: number, c: number): number | null {
  assertFinite(a, "المعامل a");
  assertFinite(b, "المعامل b");
  assertFinite(c, "المعامل c");
  if (a === b) return null;
  return Number(((c - b) / (a - b)).toFixed(8));
}

export function rectangleGeometry(width: number, height: number): GeometrySummary {
  assertFinite(width, "العرض");
  assertFinite(height, "الارتفاع");
  if (width < 0 || height < 0) throw new Error("الأبعاد لا يمكن أن تكون سالبة");
  return { area: width * height, perimeter: 2 * (width + height), label: "مستطيل" };
}

export function circleGeometry(radius: number): GeometrySummary {
  assertFinite(radius, "نصف القطر");
  if (radius < 0) throw new Error("نصف القطر لا يمكن أن يكون سالباً");
  return {
    area: Number((Math.PI * radius * radius).toFixed(8)),
    perimeter: Number((2 * Math.PI * radius).toFixed(8)),
    label: "دائرة",
  };
}

export function triangleGeometry(base: number, height: number, sideA?: number, sideB?: number, sideC?: number): GeometrySummary {
  assertFinite(base, "القاعدة");
  assertFinite(height, "الارتفاع");
  if (base < 0 || height < 0) throw new Error("أبعاد المثلث لا يمكن أن تكون سالبة");
  const sides = [sideA, sideB, sideC].filter((side): side is number => side !== undefined).map((side) => assertFinite(side, "الضلع"));
  if (sides.some((side) => side < 0)) throw new Error("الأضلاع لا يمكن أن تكون سالبة");
  if (sides.length === 3 && (sides[0]! + sides[1]! <= sides[2]! || sides[0]! + sides[2]! <= sides[1]! || sides[1]! + sides[2]! <= sides[0]!)) {
    throw new Error("أضلاع المثلث غير متوافقة");
  }
  const perimeter = sides.length === 3 ? sides.reduce((sum, side) => sum + side, 0) : 0;
  return { area: Number((base * height / 2).toFixed(8)), perimeter, label: "مثلث" };
}

export function mean(values: number[]): number {
  if (values.length === 0) throw new Error("أدخل قيمة واحدة على الأقل");
  values.forEach((value) => assertFinite(value, "القيمة"));
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(8));
}

export function median(values: number[]): number {
  if (values.length === 0) throw new Error("أدخل قيمة واحدة على الأقل");
  const sorted = [...values].map((value) => assertFinite(value, "القيمة")).sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return Number((sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2).toFixed(8));
}

export function mode(values: number[]): number | null {
  if (values.length === 0) return null;
  const counts = new Map<number, number>();
  for (const value of values) {
    assertFinite(value, "القيمة");
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const max = Math.max(...counts.values());
  if (max <= 1) return null;
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? null;
}

export function pythagoreanHypotenuse(a: number, b: number): number {
  assertFinite(a, "الضلع الأول");
  assertFinite(b, "الضلع الثاني");
  if (a < 0 || b < 0) throw new Error("الأضلاع لا يمكن أن تكون سالبة");
  return Number(Math.hypot(a, b).toFixed(8));
}

export function rectangularPrismVolume(length: number, width: number, height: number): number {
  assertFinite(length, "الطول");
  assertFinite(width, "العرض");
  assertFinite(height, "الارتفاع");
  if ([length, width, height].some((value) => value < 0)) throw new Error("الأبعاد لا يمكن أن تكون سالبة");
  return Number((length * width * height).toFixed(8));
}

export function convertLength(value: number, from: "mm" | "cm" | "m" | "km", to: "mm" | "cm" | "m" | "km"): number {
  assertFinite(value, "القيمة");
  const factors = { mm: 0.001, cm: 0.01, m: 1, km: 1000 } as const;
  return Number(((value * factors[from]) / factors[to]).toFixed(8));
}

export function distanceBetweenPoints(a: Point2D, b: Point2D): number {
  assertFinite(a.x, "إحداثي x للنقطة الأولى");
  assertFinite(a.y, "إحداثي y للنقطة الأولى");
  assertFinite(b.x, "إحداثي x للنقطة الثانية");
  assertFinite(b.y, "إحداثي y للنقطة الثانية");
  return Number(Math.hypot(b.x - a.x, b.y - a.y).toFixed(8));
}

export function midpoint(a: Point2D, b: Point2D): Point2D {
  assertFinite(a.x, "إحداثي x للنقطة الأولى");
  assertFinite(a.y, "إحداثي y للنقطة الأولى");
  assertFinite(b.x, "إحداثي x للنقطة الثانية");
  assertFinite(b.y, "إحداثي y للنقطة الثانية");
  return { x: Number(((a.x + b.x) / 2).toFixed(8)), y: Number(((a.y + b.y) / 2).toFixed(8)) };
}

/** Evaluates a deliberately small arithmetic grammar for classroom-safe calculations. */
export function evaluateArithmetic(input: string): number {
  const expression = input
    .trim()
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/٪/g, "%")
    .replace(/,/g, ".");
  if (!expression || !/^[0-9+\-*/().%\s]+$/.test(expression)) {
    throw new Error("المسموح أرقام وعمليات حسابية فقط");
  }
  const tokens = expression.match(/\d*\.?\d+|[+\-*/%()]\s*/g)?.map((token) => token.trim()).filter(Boolean) ?? [];
  let cursor = 0;
  const peek = () => tokens[cursor];
  const consume = () => tokens[cursor++];
  const primary = (): number => {
    const token = peek();
    if (token === "(") {
      consume();
      const value = sum();
      if (consume() !== ")") throw new Error("قوس غير مغلق");
      return value;
    }
    if (token === "+" || token === "-") {
      consume();
      const value = primary();
      return token === "-" ? -value : value;
    }
    const value = Number(consume());
    if (!Number.isFinite(value)) throw new Error("تعبير غير صالح");
    return value;
  };
  const product = (): number => {
    let value = primary();
    while (peek() === "*" || peek() === "/" || peek() === "%") {
      const operator = consume();
      const right = primary();
      if (operator === "*") value *= right;
      else if (operator === "/") {
        if (right === 0) throw new Error("لا يمكن القسمة على صفر");
        value /= right;
      } else value %= right;
    }
    return value;
  };
  const sum = (): number => {
    let value = product();
    while (peek() === "+" || peek() === "-") {
      const operator = consume();
      const right = product();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  };
  const result = sum();
  if (cursor !== tokens.length) throw new Error("تعبير غير مكتمل");
  return Number(assertFinite(result, "النتيجة").toFixed(10));
}
