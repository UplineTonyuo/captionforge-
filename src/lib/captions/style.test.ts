import { describe, expect, it } from "vitest";

import {
  BASE_TEXT_COLOR,
  CAPTION_FONT_FAMILY,
  CAPTION_FONT_PX,
  CAPTION_FONT_WEIGHT,
  CAPTION_ITALIC,
  captionFontSize,
  DEFAULT_CAPTION_STYLE,
  DIM_OPACITY,
  HIGHLIGHT_CHOICES,
  HIGHLIGHT_PALETTE,
  MAX_CHARS_PER_LINE,
  MAX_WORDS_PER_LINE,
  OUTLINE_RATIO,
  REFERENCE_FRAME_HEIGHT,
  SAFE_MARGIN_BOTTOM,
  SAFE_MARGIN_X,
  SCRIM,
  SIZE_PRESET_SCALE,
  WORD_EXTRUDE,
  WORD_REVEAL,
  WORD_SOFT_SHADOW,
} from "./style";

// These tests pin the PrimeClip constants to the tables in PROJECT_SPEC.md §5.
// If a value changes here, the spec must change in the same PR
// (DEVELOPMENT_RULES.md §3 "Spec is law").
describe("PrimeClip style constants (PROJECT_SPEC.md §5)", () => {
  it("encodes the §5.2 word typography (Inter 800 italic, white)", () => {
    expect(CAPTION_FONT_FAMILY.startsWith("Inter")).toBe(true);
    expect(CAPTION_FONT_WEIGHT).toBe(800);
    expect(CAPTION_ITALIC).toBe(true);
    expect(BASE_TEXT_COLOR).toBe("#FFFFFF");
    // No stroke (§5.2) — legibility comes from the shadow.
    expect(OUTLINE_RATIO).toBe(0);
  });

  it("sizes captions as px on a 1080 reference frame, scaling with height (§5.4)", () => {
    expect(REFERENCE_FRAME_HEIGHT).toBe(1080);
    expect(CAPTION_FONT_PX).toBe(68);
    expect(SIZE_PRESET_SCALE).toEqual({ sm: 0.83, md: 1, lg: 1.33 });
    // md on a 1080-tall frame reproduces the authored px exactly.
    expect(captionFontSize("md", 1080)).toBeCloseTo(68, 5);
    // Resolution-independent: double the frame height, double the px.
    expect(captionFontSize("md", 2160)).toBeCloseTo(136, 5);
    // Preset multiplier.
    expect(captionFontSize("lg", 1080)).toBeCloseTo(68 * 1.33, 5);
  });

  it("encodes the §5.3.1 karaoke reveal (fade + blur) and dim state", () => {
    expect(WORD_REVEAL).toEqual({ seconds: 0.25, blurRatio: 0.12 });
    expect(DIM_OPACITY).toBe(0.35);
  });

  it("encodes the §5.2 per-character 3D depth", () => {
    expect(WORD_EXTRUDE).toEqual({
      color: "rgba(0, 0, 0, 0.9)",
      steps: 4,
      offsetXRatio: 0.05,
      offsetYRatio: 0.06,
    });
    expect(WORD_SOFT_SHADOW).toEqual({
      color: "rgba(0, 0, 0, 0.55)",
      offsetYRatio: 0.08,
      blurRatio: 0.05,
    });
  });

  it("encodes the §5.2 backdrop scrim", () => {
    expect(SCRIM).toEqual({ maxOpacity: 0.45, heightRatio: 0.28 });
  });

  it("encodes the §5.1 layout limits and safe margins", () => {
    expect(SAFE_MARGIN_BOTTOM).toBe(0.08);
    expect(SAFE_MARGIN_X).toBe(0.06);
    expect(MAX_CHARS_PER_LINE).toBe(18);
    expect(MAX_WORDS_PER_LINE).toBe(3);
  });

  it("encodes the §5.3/§5.6 highlight palette and picker choices", () => {
    expect(HIGHLIGHT_PALETTE).toEqual({
      lime: "#F6FF4D",
      orange: "#FB923C",
      blue: "#60A5FA",
      green: "#4ADE80",
      red: "#F87171",
    });
    expect(HIGHLIGHT_CHOICES.map((c) => c.name)).toEqual([
      "lime",
      "orange",
      "blue",
    ]);
    expect(HIGHLIGHT_CHOICES.map((c) => c.value)).toEqual([
      "#F6FF4D",
      "#FB923C",
      "#60A5FA",
    ]);
  });

  it("defaults to bottom / lime #F6FF4D / md (§5.6)", () => {
    expect(DEFAULT_CAPTION_STYLE).toEqual({
      position: "bottom",
      highlightColor: "#F6FF4D",
      sizePreset: "md",
    });
  });
});
