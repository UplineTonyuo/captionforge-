import { describe, expect, it } from "vitest";

import {
  BASE_TEXT_COLOR,
  BOLD_EXTRUDE,
  CAPTION_FONT_FAMILY,
  CAPTION_ROLES,
  captionFontSize,
  DEFAULT_CAPTION_STYLE,
  EMPHASIS_OVERLAP_RATIO,
  HIGHLIGHT_CHOICES,
  HIGHLIGHT_ENTRANCE,
  HIGHLIGHT_EXTRUDE,
  HIGHLIGHT_PALETTE,
  HIGHLIGHT_SHADOW,
  MAX_CHARS_PER_LINE,
  MAX_WORDS_PER_LINE,
  OUTLINE_RATIO,
  REFERENCE_FRAME_HEIGHT,
  SAFE_MARGIN_BOTTOM,
  SAFE_MARGIN_X,
  SCRIM,
  SHADOW,
  SIZE_PRESET_SCALE,
  THIN_ENTRANCE,
} from "./style";

// These tests pin the PrimeClip constants to the tables in PROJECT_SPEC.md §5.
// If a value changes here, the spec must change in the same PR
// (DEVELOPMENT_RULES.md §3 "Spec is law").
describe("PrimeClip style constants (PROJECT_SPEC.md §5)", () => {
  it("encodes the §5.2 three text roles (Inter, weight/italic/case/size)", () => {
    expect(CAPTION_ROLES.thin).toEqual({
      weight: 100,
      italic: false,
      uppercase: false,
      sizePx: 50,
    });
    expect(CAPTION_ROLES.bold).toEqual({
      weight: 800,
      italic: false,
      uppercase: true,
      sizePx: 60,
    });
    expect(CAPTION_ROLES.highlight).toEqual({
      weight: 700,
      italic: true,
      uppercase: false,
      sizePx: 100,
    });
    expect(CAPTION_FONT_FAMILY.startsWith("Inter")).toBe(true);
    expect(BASE_TEXT_COLOR).toBe("#FFFFFF");
    // No stroke (§5.2) — legibility comes from the shadow.
    expect(OUTLINE_RATIO).toBe(0);
  });

  it("sizes roles as px on a 1080 reference frame, scaling with height (§5.4)", () => {
    expect(REFERENCE_FRAME_HEIGHT).toBe(1080);
    expect(SIZE_PRESET_SCALE).toEqual({ sm: 0.83, md: 1, lg: 1.33 });
    // md on a 1080-tall frame reproduces the authored px exactly.
    expect(captionFontSize("thin", "md", 1080)).toBeCloseTo(50, 5);
    expect(captionFontSize("bold", "md", 1080)).toBeCloseTo(60, 5);
    expect(captionFontSize("highlight", "md", 1080)).toBeCloseTo(100, 5);
    // Resolution-independent: double the frame height, double the px.
    expect(captionFontSize("highlight", "md", 2160)).toBeCloseTo(200, 5);
    // Preset multiplier applies to every role.
    expect(captionFontSize("thin", "lg", 1080)).toBeCloseTo(50 * 1.33, 5);
  });

  it("encodes the §5.3.1 thin entrance (slower fade + stronger blur)", () => {
    expect(THIN_ENTRANCE).toEqual({ seconds: 0.45, blurRatio: 0.35 });
  });

  it("encodes the §5.3.1 highlight entrance (slide up, gentle)", () => {
    expect(HIGHLIGHT_ENTRANCE).toEqual({
      seconds: 0.5,
      riseRatio: 0.28,
      blurRatio: 0.08,
    });
  });

  it("encodes the §5.2 backdrop scrim", () => {
    expect(SCRIM).toEqual({ maxOpacity: 0.45, heightRatio: 0.28 });
  });

  it("encodes the §5.3 highlight depth (vertical extrude + soft shadow)", () => {
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

  it("encodes the §5.2 bold 3D extrude (crisp, not blurry)", () => {
    expect(BOLD_EXTRUDE).toEqual({
      color: "rgba(0, 0, 0, 0.85)",
      offsetRatio: 0.05,
      steps: 3,
    });
  });

  it("encodes the §5.2 soft shadow for thin/white text", () => {
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

  it("encodes the §5.3/§5.6 highlight palette and picker choices", () => {
    expect(HIGHLIGHT_PALETTE).toEqual({
      lime: "#F6FF4D",
      orange: "#FB923C",
      blue: "#60A5FA",
      green: "#4ADE80",
      red: "#F87171",
    });
    // The picker offers exactly lime / orange / blue, in that order.
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
