import type {
  CaptionSizePreset,
  CaptionStyle,
} from "@/lib/video/types";

/**
 * PrimeClip caption style constants — the encoding of PROJECT_SPEC.md §5.2–5.4.
 *
 * This module is the single place where the caption look is defined; the
 * browser preview and any server renderer must both derive their styling from
 * these values. Changing a value here requires a matching spec edit first
 * (DEVELOPMENT_RULES.md §3 "Spec is law").
 *
 * Isomorphic: no Node built-ins, no DOM, no React.
 */

/** Base font size per preset, as a fraction of frame height (§5.4). */
export const BASE_FONT_SIZE_BY_PRESET: Record<CaptionSizePreset, number> = {
  sm: 0.03,
  md: 0.036,
  lg: 0.048,
};

/** Emphasized ("pop") word scale relative to base font size (§5.3). */
export const EMPHASIS_SCALE = 1.7;

/** Emphasized words render italic (§5.3). */
export const EMPHASIS_ITALIC = true;

/** Base text fill (§5.2). */
export const BASE_TEXT_COLOR = "#FFFFFF";

/** Font weight for all caption text (§5.2). */
export const FONT_WEIGHT = 800;

/**
 * Caption font stack (§5.2: Montserrat 800). The first family must be
 * available to both the preview and the renderer so layout metrics agree
 * (TR-3); Montserrat and Inter are vendored in public/fonts and registered
 * by src/remotion/load-fonts.ts.
 */
export const FONT_FAMILY =
  "Montserrat, Inter, var(--font-geist-sans, Geist), sans-serif";

/**
 * No stroke (§5.2): legibility comes from the shadow. Kept as a ratio so a
 * future style variant can reintroduce it without touching the renderer.
 */
export const OUTLINE_RATIO = 0;

export const OUTLINE_COLOR = "#000000";

/** Soft black shadow (§5.2: slight downward offset, gentle blur). */
export const SHADOW = {
  color: "rgba(0, 0, 0, 0.7)",
  offsetXRatio: 0, // of font size
  offsetYRatio: 0.05,
  blurRatio: 0.15,
} as const;

/** Word entrance animation (§5.3.1): fade + blur from the word's start time. */
export const ENTRANCE_SECONDS = 0.18;

/** Starting blur of a word's entrance, as a fraction of font size. */
export const ENTRANCE_BLUR_RATIO = 0.25;

/** Emphasis word rises from below by this fraction of font size (§5.3.1). */
export const EMPHASIS_RISE_RATIO = 0.5;

/**
 * The emphasis line overlaps the lines above and below it by this fraction
 * of the emphasis font size (§5.1) and stacks on top of them.
 */
export const EMPHASIS_OVERLAP_RATIO = 0.18;

/** Layered "3D" extrusion behind the emphasis word (§5.3). */
export const EMPHASIS_EXTRUDE = {
  color: "rgba(0, 0, 0, 0.85)",
  /** Total down-right offset at the deepest layer, of emphasis font size. */
  offsetRatio: 0.06,
  steps: 3,
} as const;

/** Safe margins as fractions of frame dimensions (§5.1). */
export const SAFE_MARGIN_BOTTOM = 0.08; // of frame height
export const SAFE_MARGIN_X = 0.06; // of frame width

/** Target maximum characters per rendered line (§5.1). */
export const MAX_CHARS_PER_LINE = 18;

/** Maximum base words per line (§5.1). */
export const MAX_WORDS_PER_LINE = 3;

/** Selectable highlight palette (§5.3). */
export const HIGHLIGHT_PALETTE = {
  lime: "#D3DB42",
  green: "#4ADE80",
  red: "#F87171",
  blue: "#60A5FA",
} as const;

export type HighlightColorName = keyof typeof HIGHLIGHT_PALETTE;

/** Default user-tunable style (§5.6 defaults). */
export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  position: "bottom",
  highlightColor: HIGHLIGHT_PALETTE.lime,
  sizePreset: "md",
};

/**
 * Backdrop scrim (§5.2): dark gradient behind the caption edge of the frame
 * that keeps white text legible on bright footage.
 */
export const SCRIM = {
  maxOpacity: 0.45,
  /** Gradient span, as a fraction of frame height. */
  heightRatio: 0.28,
} as const;

/** Word-space between words, as a fraction of font size. */
export const WORD_GAP_RATIO = 0.25;

/** Line height multiplier for caption lines (§5.1 "tight"). */
export const LINE_HEIGHT = 1.05;
