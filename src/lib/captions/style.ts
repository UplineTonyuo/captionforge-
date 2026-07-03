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

/**
 * Caption font stack: Inter (800, italic) with Geist/system fallbacks. The
 * weight is vendored in public/fonts and registered by
 * src/remotion/load-fonts.ts so the preview Player and the server render
 * resolve the exact same font (TR-3).
 */
export const CAPTION_FONT_FAMILY =
  "Inter, var(--font-geist-sans, Geist), sans-serif";

/** Every caption word is heavy italic (§5.2). */
export const CAPTION_FONT_WEIGHT = 800;
export const CAPTION_ITALIC = true;

/** Fill for spoken/past words (§5.2). */
export const BASE_TEXT_COLOR = "#FFFFFF";

/** Frame height (px) the caption size is authored against (§5.4). */
export const REFERENCE_FRAME_HEIGHT = 1080;

/** Caption font size in px on a REFERENCE_FRAME_HEIGHT-tall frame (§5.2). */
export const CAPTION_FONT_PX = 68;

/**
 * Size-preset multiplier (§5.4/§5.6). `md` is the authored reference; `sm`/`lg`
 * scale the caption up or down while keeping the inline layout.
 */
export const SIZE_PRESET_SCALE: Record<CaptionSizePreset, number> = {
  sm: 0.83,
  md: 1,
  lg: 1.33,
};

/**
 * Rendered px font size at a preset and frame height. Pure and
 * resolution-independent: (CAPTION_FONT_PX / 1080) * presetScale * frameHeight.
 * One size for every word — the emphasis is color + depth, not scale, so the
 * line never reflows as the active word moves.
 */
export function captionFontSize(
  sizePreset: CaptionSizePreset,
  frameHeight: number
): number {
  return (
    (CAPTION_FONT_PX / REFERENCE_FRAME_HEIGHT) *
    SIZE_PRESET_SCALE[sizePreset] *
    frameHeight
  );
}

/**
 * Per-word karaoke reveal (§5.3.1): a word fades in with blur as it is spoken.
 * Upcoming (not-yet-spoken) words sit dimmed; when a word's time arrives it
 * pops from `DIM_OPACITY` to full and its blur clears over `seconds`.
 */
export const WORD_REVEAL = {
  seconds: 0.25,
  /** Starting blur at the word's own start time, as a fraction of font size. */
  blurRatio: 0.12,
} as const;

/** Opacity of upcoming (not-yet-spoken) words (§5.2). */
export const DIM_OPACITY = 0.35;

/**
 * Per-character black 3D depth (§5.2): hard dark copies stepped down and to the
 * right (rising from the bottom toward the mid-right of each glyph), then a
 * soft shadow deepest. Applied to every word — white and highlighted.
 */
export const WORD_EXTRUDE = {
  color: "rgba(0, 0, 0, 0.9)",
  steps: 4,
  /** Total offsets at the deepest layer, as fractions of font size. */
  offsetXRatio: 0.05,
  offsetYRatio: 0.06,
} as const;

export const WORD_SOFT_SHADOW = {
  color: "rgba(0, 0, 0, 0.55)",
  offsetYRatio: 0.08,
  blurRatio: 0.05,
} as const;

/**
 * No stroke (§5.2): legibility comes from the shadow. Kept as a ratio so a
 * future variant can reintroduce it without touching the renderer.
 */
export const OUTLINE_RATIO = 0;
export const OUTLINE_COLOR = "#000000";

/** Safe margins as fractions of frame dimensions (§5.1). */
export const SAFE_MARGIN_BOTTOM = 0.08; // of frame height
export const SAFE_MARGIN_X = 0.06; // of frame width

/** Word-space between words, as a fraction of font size. */
export const WORD_GAP_RATIO = 0.28;

/** Line height for the inline wrapped caption (§5.1 "tight"). */
export const LINE_HEIGHT = 1.02;

/** Target maximum characters per rendered line (§5.1). */
export const MAX_CHARS_PER_LINE = 18;

/** Maximum words per line (§5.1). */
export const MAX_WORDS_PER_LINE = 3;

/**
 * Selectable highlight palette (§5.3/§5.6). The picker offers lime/orange/blue;
 * green/red remain valid values for backward compatibility.
 */
export const HIGHLIGHT_PALETTE = {
  lime: "#F6FF4D",
  orange: "#FB923C",
  blue: "#60A5FA",
  green: "#4ADE80",
  red: "#F87171",
} as const;

export type HighlightColorName = keyof typeof HIGHLIGHT_PALETTE;

/** The highlight colors offered in the export color picker, in order (§5.6). */
export const HIGHLIGHT_CHOICES: ReadonlyArray<{
  name: HighlightColorName;
  label: string;
  value: string;
}> = [
  { name: "lime", label: "Lime", value: HIGHLIGHT_PALETTE.lime },
  { name: "orange", label: "Orange", value: HIGHLIGHT_PALETTE.orange },
  { name: "blue", label: "Blue", value: HIGHLIGHT_PALETTE.blue },
];

/** Default user-tunable style (§5.6 defaults). */
export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  position: "bottom",
  highlightColor: HIGHLIGHT_PALETTE.lime,
  sizePreset: "md",
};

/**
 * Backdrop scrim (§5.2): dark gradient behind the caption edge of the frame
 * that keeps text legible on bright footage.
 */
export const SCRIM = {
  maxOpacity: 0.45,
  /** Gradient span, as a fraction of frame height. */
  heightRatio: 0.28,
} as const;
