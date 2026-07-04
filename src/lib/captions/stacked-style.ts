import type { CaptionSizePreset } from "@/lib/video/types";
import { REFERENCE_FRAME_HEIGHT, SIZE_PRESET_SCALE } from "./style";

/**
 * Constants for the "stacked" caption template (the v11 look): normal words
 * render thin and the one pop word per segment sits alone on its own line,
 * larger, in italic and the highlight colour. Shared layout constants
 * (fonts, margins, scrim, gaps) come from ./style; this module only holds
 * what is specific to the stacked look.
 *
 * Isomorphic: no Node built-ins, no DOM, no React.
 */

export type StackedRole = "thin" | "highlight";

export interface StackedRoleTypography {
  weight: number;
  italic: boolean;
  /** Font size in px on a REFERENCE_FRAME_HEIGHT-tall frame. */
  sizePx: number;
}

export const STACKED_ROLES: Record<StackedRole, StackedRoleTypography> = {
  thin: { weight: 100, italic: false, sizePx: 50 },
  highlight: { weight: 700, italic: true, sizePx: 100 },
};

/** Rendered px font size for a stacked role at a preset and frame height. */
export function stackedFontSize(
  role: StackedRole,
  sizePreset: CaptionSizePreset,
  frameHeight: number
): number {
  return (
    (STACKED_ROLES[role].sizePx / REFERENCE_FRAME_HEIGHT) *
    SIZE_PRESET_SCALE[sizePreset] *
    frameHeight
  );
}

/** Soft black shadow for thin/white text (offset down, gentle blur). */
export const STACKED_SHADOW = {
  color: "rgba(0, 0, 0, 0.7)",
  offsetXRatio: 0,
  offsetYRatio: 0.05,
  blurRatio: 0.15,
} as const;

/** Thin word entrance: fade in with a strong initial blur that clears. */
export const THIN_ENTRANCE = {
  seconds: 0.45,
  blurRatio: 0.35,
} as const;

/** Highlight word entrance: slides up from below the baseline with a fade. */
export const HIGHLIGHT_ENTRANCE = {
  seconds: 0.5,
  riseRatio: 0.28,
  blurRatio: 0.08,
} as const;

/** The highlight line overlaps its neighbours by this fraction of its size. */
export const EMPHASIS_OVERLAP_RATIO = 0.14;

/** Crisp vertical depth beneath the highlight word (raised from the bottom). */
export const HIGHLIGHT_EXTRUDE = {
  color: "rgba(0, 0, 0, 0.8)",
  offsetRatio: 0.05,
  steps: 3,
} as const;

/** Soft shadow under the highlight word, scaled to its larger size. */
export const HIGHLIGHT_SHADOW = {
  color: "rgba(0, 0, 0, 0.55)",
  offsetYRatio: 0.06,
  blurRatio: 0.05,
} as const;

/** Line height for the stacked rows. */
export const STACKED_LINE_HEIGHT = 1.05;
