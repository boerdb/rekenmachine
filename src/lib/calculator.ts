import { all, create, type MathJsInstance } from "mathjs";

export type AngleMode = "deg" | "rad";

const math = create(all, {
  number: "number",
  precision: 14,
});

const toRadians = (value: number) => (value * Math.PI) / 180;
const toDegrees = (value: number) => (value * 180) / Math.PI;

// Exacte waarden bij veelvouden van 90°, zodat sin(180) echt 0 is en tan(90) ongedefinieerd.
function quarterTurn(value: number) {
  const turns = (((value % 360) + 360) % 360) / 90;
  return Number.isInteger(turns) ? turns : null;
}

const degreeTrig = {
  sin: (value: number) => {
    const quarter = quarterTurn(value);
    return quarter === null ? Math.sin(toRadians(value)) : [0, 1, 0, -1][quarter];
  },
  cos: (value: number) => {
    const quarter = quarterTurn(value);
    return quarter === null ? Math.cos(toRadians(value)) : [1, 0, -1, 0][quarter];
  },
  tan: (value: number) => {
    const quarter = quarterTurn(value);
    if (quarter === null) return Math.tan(toRadians(value));
    return quarter % 2 === 0 ? 0 : Number.NaN;
  },
  asin: (value: number) => toDegrees(Math.asin(value)),
  acos: (value: number) => toDegrees(Math.acos(value)),
  atan: (value: number) => toDegrees(Math.atan(value)),
};

// In radialen ruis rond kπ wegpoetsen (sin(pi) ≈ 1e-16) en tan(pi/2) als ongedefinieerd zien.
const snap = (result: number, input: number) =>
  Math.abs(result) < 1e-15 && Math.abs(input) > 1e-6 ? 0 : result;

const radianTrig = {
  sin: (value: number) => snap(Math.sin(value), value),
  cos: (value: number) => snap(Math.cos(value), value),
  tan: (value: number) => {
    const result = Math.tan(value);
    return Math.abs(result) > 1e15 ? Number.NaN : snap(result, value);
  },
};

function scopeFor(mode: AngleMode, extra: Record<string, number> = {}) {
  return { ...extra, ...(mode === "deg" ? degreeTrig : radianTrig) };
}

export function normalizeExpression(expression: string) {
  return expression
    .replaceAll("×", "*")
    .replaceAll("÷", "/")
    .replaceAll("−", "-")
    .replaceAll("π", "pi")
    .replaceAll("√", "sqrt")
    .replace(/\blog\b/g, "log10")
    .replace(/\bln\b/g, "log")
    .trim();
}

/** Begint de invoer met een operator, dan rekenen we verder met het vorige antwoord. */
export function withAnswer(expression: string) {
  return /^\s*[+×÷*/^!]/.test(expression) ? `Ans${expression.trimStart()}` : expression;
}

export function evaluateExpression(
  expression: string,
  mode: AngleMode,
  extra: Record<string, number> = {},
) {
  if (!expression.trim()) throw new Error("empty");
  const value = math.evaluate(
    normalizeExpression(expression),
    scopeFor(mode, extra),
  );
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("invalid");
  }
  return value;
}

export function compileExpression(expression: string, mode: AngleMode) {
  const compiled = math.compile(normalizeExpression(expression));
  return (x: number) => {
    const value = compiled.evaluate(scopeFor(mode, { x }));
    return typeof value === "number" && Number.isFinite(value)
      ? value
      : Number.NaN;
  };
}

export function formatResult(value: number) {
  const absolute = Math.abs(value);
  if ((absolute !== 0 && absolute < 1e-9) || absolute >= 1e12) {
    return value.toExponential(8).replace(/\.?0+e/, "e");
  }
  return Number(value.toPrecision(12)).toString();
}

export function getMathInstance(): MathJsInstance {
  return math;
}
