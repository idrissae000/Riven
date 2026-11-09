import { describe, expect, it } from "vitest";
import { fitWithin, padBox } from "./image-prep";

describe("padBox", () => {
  it("grows the box on every side by a fraction of its size", () => {
    const b = padBox({ x: 0.4, y: 0.2, w: 0.2, h: 0.5 }, 0.1);
    expect(b.x).toBeCloseTo(0.38); expect(b.y).toBeCloseTo(0.15); expect(b.w).toBeCloseTo(0.24); expect(b.h).toBeCloseTo(0.6);
  });
  it("never leaves the image", () => {
    const b = padBox({ x: 0, y: 0.5, w: 0.3, h: 0.5 }, 0.2);
    expect(b.x).toBe(0);
    expect(b.x + b.w).toBeLessThanOrEqual(1);
    expect(b.y + b.h).toBeLessThanOrEqual(1);
  });
});

describe("fitWithin (crops)", () => {
  it("keeps a small crop at native size so no detail is thrown away", () => {
    expect(fitWithin(700, 1100, 1568)).toEqual({ width: 700, height: 1100 });
  });
});
