import { all, create, type MathJsInstance } from "mathjs";

export type AngleMode = "deg" | "rad";

const math = create(all, {
  number: "number",
  precision: 14,
});

function scopeFor(mode: AngleMode, extra: Record<string, number> = {}) {
  if (mode === "rad") return extra;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const toDegrees = (value: number) => (value * 180) / Math.PI;
  return {
    ...extra,
    sin: (value: number) => Math.sin(toRadians(value)),
    cos: (value: number) => Math.cos(toRadians(value)),
    tan: (value: number) => Math.tan(toRadians(value)),
    asin: (value: number) => toDegrees(Math.asin(value)),
    acos: (value: number) => toDegrees(Math.acos(value)),
    atan: (value: number) => toDegrees(Math.atan(value)),
  };
}

export function normalizeExpression(expression: string) {
  return expression
    .replaceAll("×", "*")
    .replaceAll("÷", "/")
    .replaceAll("−", "-")
    .replaceAll("π", "pi")
    .replace(/\bln\b/g, "log")
    .trim();
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
