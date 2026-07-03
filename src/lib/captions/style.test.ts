import { describe, expect, it } from "vitest";

import {
  BASE_FONT_SIZE_BY_PRESET,
  BASE_TEXT_COLOR,
  DEFAULT_CAPTION_STYLE,
  EMPHASIS_EXTRUDE,
  EMPHASIS_ITALIC,
  EMPHASIS_OVERLAP_RATIO,
  EMPHASIS_RISE_RATIO,
  EMPHASIS_SCALE,
  ENTRANCE_BLUR_RATIO,
  ENTRANCE_SECONDS,
  FONT_FAMILY,
  FONT_WEIGHT,
  HIGHLIGHT_PALETTE,
  MAX_CHARS_PER_LINE,
  MAX_WORDS_PER_LINE,
  OUTLINE_RATIO,
  SAFE_MARGIN_BOTTOM,
  SAFE_MARGIN_X,
  SCRIM,
  SHADOW,
} from "./style";

// These tests pin the PrimeClip constants to the tables in PROJECT_SPEC.md §5.
// If a value changes here, the spec must change in the same PR
// (DEVELOPMENT_RULES.md §3 "Spec is law").
describe("PrimeClip style constants (PROJECT_SPEC.md §5)", () => {
  it("encodes the §5.4 size presets as fractions of frame height", () => {
    expect(BASE_FONT_SIZE_BY_PRESET.sm).toBe(0.03);
    expect(BASE_FONT_SIZE_BY_PRESET.md).toBe(0.036);
    expect(BASE_FONT_SIZE_BY_PRESET.lg).toBe(0.048);
  });

  it("encodes the §5.3 emphasis treatment (own line, 1.7x, italic)", () => {
    expect(EMPHASIS_SCALE).toBe(1.7);
    expect(EMPHASIS_ITALIC).toBe(true);
  });

  it("encodes the §5.3.1 word entrance animation", () => {
    expect(ENTRANCE_SECONDS).toBe(0.18);
    expect(ENTRANCE_BLUR_RATIO).toBe(0.25);
    expect(EMPHASIS_RISE_RATIO).toBe(0.5);
  });

  it("encodes the §5.2 backdrop scrim", () => {
    expect(SCRIM).toEqual({ maxOpacity: 0.45, heightRatio: 0.28 });
  });

  it("encodes the §5.1 overlap and §5.3 3D layer for the emphasis word", () => {
    expect(EMPHASIS_OVERLAP_RATIO).toBe(0.18);
    expect(EMPHASIS_EXTRUDE).toEqual({
      color: "rgba(0, 0, 0, 0.85)",
      offsetRatio: 0.06,
      steps: 3,
    });
  });

  it("encodes the §5.2 base text treatment", () => {
    expect(BASE_TEXT_COLOR).toBe("#FFFFFF");
    expect(FONT_WEIGHT).toBe(800);
    expect(FONT_FAMILY.startsWith("Montserrat")).toBe(true);
    // No stroke (§5.2) — legibility comes from the soft black shadow.
    expect(OUTLINE_RATIO).toBe(0);
    expect(SHADOW.color).toBe("rgba(0, 0, 0, 0.7)");
    expect(SHADOW.offsetXRatio).toBe(0);
    expect(SHADOW.offsetYRatio).toBe(0.05);
    expect(SHADOW.blurRatio).toBe(0.15);
  });

  it("encodes the §5.1 layout limits and safe margins", () => {
    expect(SAFE_MARGIN_BOTTOM).toBe(0.08);
    expect(SAFE_MARGIN_X).toBe(0.06);
    expect(MAX_CHARS_PER_LINE).toBe(18);
    expect(MAX_WORDS_PER_LINE).toBe(3);
  });

  it("encodes the §5.3 highlight palette", () => {
    expect(HIGHLIGHT_PALETTE).toEqual({
      lime: "#D3DB42",
      green: "#4ADE80",
      red: "#F87171",
      blue: "#60A5FA",
    });
  });

  it("defaults to bottom / lime / md (§5.6)", () => {
    expect(DEFAULT_CAPTION_STYLE).toEqual({
      position: "bottom",
      highlightColor: HIGHLIGHT_PALETTE.lime,
      sizePreset: "md",
    });
  });
});
