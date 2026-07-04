import { describe, expect, it } from "vitest";

import {
  EMPHASIS_OVERLAP_RATIO,
  HIGHLIGHT_ENTRANCE,
  HIGHLIGHT_EXTRUDE,
  HIGHLIGHT_SHADOW,
  STACKED_ROLES,
  stackedFontSize,
  THIN_ENTRANCE,
} from "./stacked-style";

// Pins the "stacked" (v11) template constants (PROJECT_SPEC.md §5.6).
describe("stacked caption template constants", () => {
  it("encodes the thin/highlight roles", () => {
    expect(STACKED_ROLES.thin).toEqual({
      weight: 100,
      italic: false,
      sizePx: 50,
    });
    expect(STACKED_ROLES.highlight).toEqual({
      weight: 700,
      italic: true,
      sizePx: 100,
    });
  });

  it("sizes roles as px on a 1080 reference frame, scaling with height", () => {
    expect(stackedFontSize("thin", "md", 1080)).toBeCloseTo(50, 5);
    expect(stackedFontSize("highlight", "md", 1080)).toBeCloseTo(100, 5);
    expect(stackedFontSize("highlight", "md", 2160)).toBeCloseTo(200, 5);
    expect(stackedFontSize("thin", "lg", 1080)).toBeCloseTo(50 * 1.33, 5);
  });

  it("encodes the entrance and depth constants", () => {
    expect(THIN_ENTRANCE).toEqual({ seconds: 0.45, blurRatio: 0.35 });
    expect(HIGHLIGHT_ENTRANCE).toEqual({
      seconds: 0.5,
      riseRatio: 0.28,
      blurRatio: 0.08,
    });
    expect(EMPHASIS_OVERLAP_RATIO).toBe(0.14);
    expect(HIGHLIGHT_EXTRUDE).toEqual({
      color: "rgba(0, 0, 0, 0.8)",
      offsetRatio: 0.05,
      steps: 3,
    });
    expect(HIGHLIGHT_SHADOW).toEqual({
      color: "rgba(0, 0, 0, 0.55)",
      offsetYRatio: 0.06,
      blurRatio: 0.05,
    });
  });
});
