import { describe, expect, it } from "vitest";
import {
  compileExpression,
  evaluateExpression,
  formatResult,
  normalizeExpression,
  withAnswer,
} from "./calculator";

describe("calculator", () => {
  it("normalizes calculator symbols", () => {
    expect(normalizeExpression("2 × π − 1")).toBe("2 * pi - 1");
  });

  it("evaluates scientific expressions", () => {
    expect(evaluateExpression("sqrt(81) + 2^3", "rad")).toBe(17);
  });

  it("uses the selected angle mode", () => {
    expect(evaluateExpression("sin(90)", "deg")).toBeCloseTo(1);
    expect(evaluateExpression("sin(pi / 2)", "rad")).toBeCloseTo(1);
  });

  it("treats log as base 10 and ln as natural log", () => {
    expect(evaluateExpression("log(1000)", "rad")).toBeCloseTo(3);
    expect(evaluateExpression("ln(e)", "rad")).toBeCloseTo(1);
    expect(evaluateExpression("log10(100)", "rad")).toBeCloseTo(2);
  });

  it("gives exact trig values at multiples of 90 degrees", () => {
    expect(evaluateExpression("sin(180)", "deg")).toBe(0);
    expect(evaluateExpression("cos(90)", "deg")).toBe(0);
    expect(evaluateExpression("cos(-180)", "deg")).toBe(-1);
    expect(() => evaluateExpression("tan(90)", "deg")).toThrow();
    expect(evaluateExpression("sin(pi)", "rad")).toBe(0);
    expect(() => evaluateExpression("tan(pi / 2)", "rad")).toThrow();
  });

  it("continues from the previous answer", () => {
    expect(withAnswer("× 2")).toBe("Ans× 2");
    expect(withAnswer("−3")).toBe("−3");
    expect(evaluateExpression(withAnswer("×2"), "rad", { Ans: 21 })).toBe(42);
  });

  it("supports square root symbol and factorial", () => {
    expect(evaluateExpression("√(16) + 4!", "rad")).toBe(28);
  });

  it("compiles functions with x", () => {
    const graph = compileExpression("x^2 - 4", "rad");
    expect(graph(3)).toBe(5);
  });

  it("formats large and regular results", () => {
    expect(formatResult(1 / 3)).toBe("0.333333333333");
    expect(formatResult(1e13)).toContain("e+13");
  });
});
