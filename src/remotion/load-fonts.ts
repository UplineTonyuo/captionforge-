import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

/**
 * Registers the caption fonts (public/fonts/, OFL-licensed) for caption
 * text: the three Inter weights the §5.2 role system uses — Inter 100 (thin),
 * Inter 800 (bold), Inter 700 italic (highlight) — plus Montserrat and Geist
 * as fallbacks. Loading from staticFile makes the preview Player and the
 * server-side render resolve the exact same fonts, which the WYSIWYG guarantee
 * depends on (PROJECT_SPEC.md TR-3).
 */

let loaded: Promise<void> | null = null;

export function ensureCaptionFontsLoaded(): Promise<void> {
  // FontFace only exists in a browser/renderer context; SSR skips.
  if (typeof document === "undefined") return Promise.resolve();
  loaded ??= Promise.all([
    loadFont({
      family: "Montserrat",
      url: staticFile("fonts/Montserrat-800.woff2"),
      weight: "800",
      style: "normal",
    }),
    loadFont({
      family: "Montserrat",
      url: staticFile("fonts/Montserrat-800-Italic.woff2"),
      weight: "800",
      style: "italic",
    }),
    loadFont({
      family: "Inter",
      url: staticFile("fonts/Inter-800.woff2"),
      weight: "800",
      style: "normal",
    }),
    loadFont({
      family: "Inter",
      url: staticFile("fonts/Inter-100.woff2"),
      weight: "100",
      style: "normal",
    }),
    loadFont({
      family: "Inter",
      url: staticFile("fonts/Inter-700-Italic.woff2"),
      weight: "700",
      style: "italic",
    }),
    loadFont({
      family: "Geist",
      url: staticFile("fonts/Geist-Variable.woff2"),
      weight: "100 900",
      style: "normal",
    }),
    loadFont({
      family: "Geist",
      url: staticFile("fonts/Geist-Variable-Italic.woff2"),
      weight: "100 900",
      style: "italic",
    }),
  ]).then(() => undefined);
  return loaded;
}
