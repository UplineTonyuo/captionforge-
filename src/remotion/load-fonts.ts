import { continueRender, delayRender, staticFile } from "remotion";

/**
 * Loads the caption fonts (public/fonts/, OFL-licensed) for the server render
 * and the preview. Only the Inter weights the caption styles actually use are
 * loaded (§5.2 karaoke = Inter 800 italic; stacked = Inter 100 + Inter 700
 * italic; bold = Inter 800). Loading from staticFile makes the preview Player
 * and the render resolve the exact same font, which WYSIWYG depends on (TR-3).
 *
 * Robustness: font loading must NEVER fail an export. We hold a single
 * delayRender that is ALWAYS cleared — when the fonts finish, or after a hard
 * cap — and swallow per-font failures (Promise.allSettled). A slow or missing
 * font falls back to system sans instead of hanging delayRender for 28s and
 * killing the render (the earlier failure mode).
 */

interface CaptionFont {
  family: string;
  file: string;
  weight: string;
  style: "normal" | "italic";
}

const CAPTION_FONTS: CaptionFont[] = [
  { family: "Inter", file: "Inter-800.woff2", weight: "800", style: "normal" },
  { family: "Inter", file: "Inter-800-Italic.woff2", weight: "800", style: "italic" },
  { family: "Inter", file: "Inter-100.woff2", weight: "100", style: "normal" },
  { family: "Inter", file: "Inter-700-Italic.woff2", weight: "700", style: "italic" },
];

/** Hard cap on how long a render may wait for fonts before proceeding. */
const FONT_LOAD_CAP_MS = 10_000;

let loaded: Promise<void> | null = null;

async function loadOne(font: CaptionFont): Promise<void> {
  const face = new FontFace(
    font.family,
    `url(${staticFile(`fonts/${font.file}`)}) format("woff2")`,
    { weight: font.weight, style: font.style }
  );
  await face.load();
  document.fonts.add(face);
}

export function ensureCaptionFontsLoaded(): Promise<void> {
  // FontFace only exists in a browser/renderer context; SSR/Node skips.
  if (typeof document === "undefined" || typeof FontFace === "undefined") {
    return Promise.resolve();
  }
  loaded ??= (async () => {
    const handle = delayRender("Loading caption fonts", {
      timeoutInMilliseconds: FONT_LOAD_CAP_MS + 5_000,
    });
    try {
      await Promise.race([
        Promise.allSettled(CAPTION_FONTS.map(loadOne)),
        new Promise<void>((resolve) => setTimeout(resolve, FONT_LOAD_CAP_MS)),
      ]);
    } finally {
      // Always continue — a slow/failed font must never block the render.
      continueRender(handle);
    }
  })();
  return loaded;
}
