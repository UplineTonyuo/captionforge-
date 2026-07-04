import { staticFile } from "remotion";

/**
 * Pure caption-font loading for the Remotion composition. Loads only the Inter
 * weights the caption styles use (§5.2 karaoke = Inter 800 italic; stacked =
 * Inter 100 + Inter 700 italic; bold = Inter 800). Loading from staticFile makes
 * the preview Player and the server render resolve the exact same font, which
 * WYSIWYG parity depends on (PROJECT_SPEC.md TR-3).
 *
 * This module owns NO render lifecycle: it does not call delayRender and holds
 * no module-level side effect. The component (captioned-video.tsx) drives the
 * delayRender/continueRender/cancelRender lifecycle around loadCaptionFonts().
 *
 * On any failure this rejects with the exact font filename and underlying
 * error — there is no silent fallback to system sans, so an export never
 * completes in the wrong font.
 */

export interface CaptionFontSpec {
  family: string;
  /** Filename under public/fonts. */
  file: string;
  weight: string;
  style: "normal" | "italic";
}

/** The exact fonts the caption renderer requires. */
export const CAPTION_FONTS: readonly CaptionFontSpec[] = [
  { family: "Inter", file: "Inter-800.woff2", weight: "800", style: "normal" },
  { family: "Inter", file: "Inter-800-Italic.woff2", weight: "800", style: "italic" },
  { family: "Inter", file: "Inter-100.woff2", weight: "100", style: "normal" },
  { family: "Inter", file: "Inter-700-Italic.woff2", weight: "700", style: "italic" },
];

async function loadCaptionFont(spec: CaptionFontSpec): Promise<void> {
  const url = staticFile(`fonts/${spec.file}`);
  const face = new FontFace(spec.family, `url(${url}) format("woff2")`, {
    weight: spec.weight,
    style: spec.style,
  });
  try {
    await face.load();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load caption font ${spec.file} (${url}): ${detail}`);
  }
  document.fonts.add(face);
}

/**
 * Load every required caption font. Resolves only when all fonts are ready;
 * rejects with the exact failing filename on the first failure (no fallback).
 */
export async function loadCaptionFonts(): Promise<void> {
  await Promise.all(CAPTION_FONTS.map(loadCaptionFont));
}
