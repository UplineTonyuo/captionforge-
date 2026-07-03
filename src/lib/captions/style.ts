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
 * Caption font stack. All three text roles use Inter (§5.2); the weights are
 * vendored in public/fonts and registered by src/remotion/load-fonts.ts so the
 * preview and the server render resolve the exact same fonts (TR-3). Geist and
 * system sans are metric-fallbacks only.
 */
export const CAPTION_FONT_FAMILY =
  "Inter, var(--font-geist-sans, Geist), sans-serif";

/** Base (non-highlight) text fill (§5.2). */
export const BASE_TEXT_COLOR = "#FFFFFF";

/**
 * The three caption text roles (§5.2). Sizes are px measured on a
 * REFERENCE_FRAME_HEIGHT-tall frame and scale proportionally to the rendered
 * frame height, so a caption looks identical at any output resolution.
 *
 * - `thin`      — normal spoken words (Inter 100, 50px).
 * - `bold`      — emphasized ALL-CAPS words (Inter 800, 60px). Available in the
 *                 style system; not auto-assigned by the current selector.
 * - `highlight` — the one "pop" word per segment (Inter 700 italic, 100px),
 *                 rendered in the user-selected highlight color.
 */
export type CaptionRole = "thin" | "bold" | "highlight";

export interface RoleTypography {
  weight: number;
  italic: boolean;
  uppercase: boolean;
  /** Font size in px on a REFERENCE_FRAME_HEIGHT-tall frame. */
  sizePx: number;
}

/** Frame height (px) the role sizes are authored against (§5.4). */
export const REFERENCE_FRAME_HEIGHT = 1080;

export const CAPTION_ROLES: Record<CaptionRole, RoleTypography> = {
  thin: { weight: 100, italic: false, uppercase: false, sizePx: 50 },
  bold: { weight: 800, italic: false, uppercase: true, sizePx: 60 },
  highlight: { weight: 700, italic: true, uppercase: false, sizePx: 100 },
};

/**
 * Size-preset multiplier applied to every role (§5.4/§5.6). `md` is the
 * authored reference; `sm`/`lg` scale all three roles together so the user's
 * size knob keeps working without changing role proportions.
 */
export const SIZE_PRESET_SCALE: Record<CaptionSizePreset, number> = {
  sm: 0.83,
  md: 1,
  lg: 1.33,
};

/**
 * Rendered px font size for a role at a preset and frame height. Pure and
 * resolution-independent: (sizePx / 1080) * presetScale * frameHeight.
 */
export function captionFontSize(
  role: CaptionRole,
  sizePreset: CaptionSizePreset,
  frameHeight: number
): number {
  return (
    (CAPTION_ROLES[role].sizePx / REFERENCE_FRAME_HEIGHT) *
    SIZE_PRESET_SCALE[sizePreset] *
    frameHeight
  );
}

/**
 * No stroke (§5.2): legibility comes from the shadow. Kept as a ratio so a
 * future style variant can reintroduce it without touching the renderer.
 */
export const OUTLINE_RATIO = 0;

export const OUTLINE_COLOR = "#000000";

/** Soft black shadow for thin/white text (§5.2: slight downward offset). */
export const SHADOW = {
  color: "rgba(0, 0, 0, 0.7)",
  offsetXRatio: 0, // of font size
  offsetYRatio: 0.05,
  blurRatio: 0.15,
} as const;

/**
 * Thin word entrance (§5.3.1): fade in with a strong initial blur that clears
 * as it fades. Slower and blurrier than the previous pass so it reads.
 */
export const THIN_ENTRANCE = {
  seconds: 0.45,
  /** Starting blur, as a fraction of the word's font size. */
  blurRatio: 0.35,
} as const;

/**
 * Highlight word entrance (§5.3.1): slides up from slightly below its baseline
 * with a gentle fade and only a whisper of blur — elegant, not exaggerated.
 */
export const HIGHLIGHT_ENTRANCE = {
  seconds: 0.5,
  /** Rise distance from below the baseline, as a fraction of font size. */
  riseRatio: 0.28,
  /** Subtle starting blur, as a fraction of font size. */
  blurRatio: 0.08,
} as const;

/**
 * The highlight line overlaps the lines above and below it by this fraction
 * of the highlight font size (§5.1) and stacks on top of them. Kept modest so
 * the highlight's descenders are never clipped by the line beneath.
 */
export const EMPHASIS_OVERLAP_RATIO = 0.14;

/**
 * Depth beneath the highlight word (§5.3): crisp (un-blurred) dark copies
 * stepped straight down so the word reads as raised from the bottom — depth,
 * not a glow.
 */
export const HIGHLIGHT_EXTRUDE = {
  color: "rgba(0, 0, 0, 0.8)",
  /** Total downward offset at the deepest layer, of the highlight font size. */
  offsetRatio: 0.05,
  steps: 3,
} as const;

/** Soft shadow under the highlight word, following its larger size (§5.3). */
export const HIGHLIGHT_SHADOW = {
  color: "rgba(0, 0, 0, 0.55)",
  offsetYRatio: 0.06,
  blurRatio: 0.05,
} as const;

/**
 * Crisp 3D extrusion for BOLD words (§5.2): dark copies stepped straight down,
 * no blur, so the shadow rises from the bottom toward the middle of the glyph.
 */
export const BOLD_EXTRUDE = {
  color: "rgba(0, 0, 0, 0.85)",
  offsetRatio: 0.05,
  steps: 3,
} as const;

/** Safe margins as fractions of frame dimensions (§5.1). */
export const SAFE_MARGIN_BOTTOM = 0.08; // of frame height
export const SAFE_MARGIN_X = 0.06; // of frame width

/** Target maximum characters per rendered line (§5.1). */
export const MAX_CHARS_PER_LINE = 18;

/** Maximum base words per line (§5.1). */
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
