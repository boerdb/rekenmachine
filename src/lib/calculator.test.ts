import { describe, expect, it } from "vitest";
import {
  compileExpression,
  evaluateExpression,
  formatResult,
  normalizeExpression,
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

  it("compiles functions with x", () => {
    const graph = compileExpression("x^2 - 4", "rad");
    expect(graph(3)).toBe(5);
  });

  it("formats large and regular results", () => {
    expect(formatResult(1 / 3)).toBe("0.333333333333");
    expect(formatResult(1e13)).toContain("e+13");
  });
});
