import * as React from "react";

import {
  BASE_TEXT_COLOR,
  CAPTION_FONT_FAMILY,
  CAPTION_FONT_WEIGHT,
  CAPTION_ITALIC,
  captionFontSize,
  DEFAULT_CAPTION_STYLE,
  DIM_OPACITY,
  LINE_HEIGHT,
  SAFE_MARGIN_BOTTOM,
  SAFE_MARGIN_X,
  SCRIM,
  WORD_EXTRUDE,
  WORD_GAP_RATIO,
  WORD_REVEAL,
  WORD_SOFT_SHADOW,
} from "@/lib/captions/style";
import { getActiveSegment, isWordEmphasized } from "@/lib/captions/timing";
import type { CaptionSegment, CaptionStyle } from "@/lib/video/types";

/**
 * Renders the PrimeClip caption style (PROJECT_SPEC.md §5) for one point in
 * time, absolutely positioned over a video frame.
 *
 * Layout per §5.1: the active segment's words flow **inline**, wrapping on
 * word boundaries into 2–3-word lines. All words are heavy italic Inter at a
 * single size (no per-word scaling, so the line never reflows). Colour is the
 * emphasis, not size: the currently-spoken word is the highlight colour
 * (karaoke), words already spoken are white, and upcoming words sit dimmed.
 * Each word reveals with a fade + blur as it is spoken (§5.3.1), and every
 * glyph carries a per-character black 3D depth (§5.2). Every value is a pure
 * function of `t − word.start`, so the browser preview and the server-side
 * export are frame-identical (TR-3).
 */
export interface CaptionRendererProps {
  segments: CaptionSegment[];
  /** Playback position in seconds; drives visibility and animation. */
  currentTimeSeconds: number;
  /** Rendered frame dimensions in px; all sizing derives from these. */
  frameWidth: number;
  frameHeight: number;
  style?: CaptionStyle;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function CaptionRenderer({
  segments,
  currentTimeSeconds,
  frameWidth,
  frameHeight,
  style = DEFAULT_CAPTION_STYLE,
}: CaptionRendererProps) {
  const segment = getActiveSegment(segments, currentTimeSeconds);
  if (!segment) return null;

  const fontSize = captionFontSize(style.sizePreset, frameHeight);

  // Per-character 3D depth: hard dark copies stepped down-right under the fill
  // (rising from the bottom), then a soft shadow deepest. Shared by every word.
  const textShadow = [
    ...Array.from({ length: WORD_EXTRUDE.steps }, (_, i) => {
      const k = (i + 1) / WORD_EXTRUDE.steps;
      return `${WORD_EXTRUDE.offsetXRatio * k * fontSize}px ${
        WORD_EXTRUDE.offsetYRatio * k * fontSize
      }px 0 ${WORD_EXTRUDE.color}`;
    }),
    `0 ${WORD_SOFT_SHADOW.offsetYRatio * fontSize}px ${
      WORD_SOFT_SHADOW.blurRatio * fontSize
    }px ${WORD_SOFT_SHADOW.color}`,
  ].join(", ");

  const wordBase: React.CSSProperties = {
    fontFamily: CAPTION_FONT_FAMILY,
    fontWeight: CAPTION_FONT_WEIGHT,
    fontStyle: CAPTION_ITALIC ? "italic" : "normal",
    fontSize,
    lineHeight: LINE_HEIGHT,
    textShadow,
    whiteSpace: "pre",
    display: "inline-block",
  };

  const vertical: React.CSSProperties =
    style.position === "top"
      ? { top: SAFE_MARGIN_BOTTOM * frameHeight, alignItems: "flex-start" }
      : style.position === "center"
        ? { top: 0, bottom: 0, alignItems: "center" }
        : { bottom: SAFE_MARGIN_BOTTOM * frameHeight, alignItems: "flex-end" };

  // Backdrop scrim (§5.2): follows the segment's entrance so it never pops;
  // anchored to the caption edge, omitted for center position.
  const scrimEase = clamp01(
    (currentTimeSeconds - segment.startSeconds) / WORD_REVEAL.seconds
  );
  const scrimEdge: React.CSSProperties | null =
    style.position === "bottom"
      ? {
          bottom: 0,
          backgroundImage: `linear-gradient(to top, rgba(0,0,0,${SCRIM.maxOpacity}), rgba(0,0,0,0))`,
        }
      : style.position === "top"
        ? {
            top: 0,
            backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,${SCRIM.maxOpacity}), rgba(0,0,0,0))`,
          }
        : null;

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {scrimEdge && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            height: SCRIM.heightRatio * frameHeight,
            opacity: scrimEase,
            ...scrimEdge,
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          left: SAFE_MARGIN_X * frameWidth,
          right: SAFE_MARGIN_X * frameWidth,
          display: "flex",
          justifyContent: "center",
          ...vertical,
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "baseline",
            columnGap: WORD_GAP_RATIO * fontSize,
            rowGap: 0.08 * fontSize,
            textAlign: "center",
          }}
        >
          {segment.words.map((word, i) => {
            const started = currentTimeSeconds >= word.startSeconds;
            // Fade + blur reveal from the word's own start (§5.3.1).
            const reveal = started
              ? clamp01(
                  (currentTimeSeconds - word.startSeconds) / WORD_REVEAL.seconds
                )
              : 0;
            const opacity = started
              ? DIM_OPACITY + (1 - DIM_OPACITY) * reveal
              : DIM_OPACITY;
            const blurPx = started
              ? (1 - reveal) * WORD_REVEAL.blurRatio * fontSize
              : 0;
            // Karaoke: the currently-spoken word (or a manual override) is the
            // highlight colour; past and upcoming words are white.
            const highlighted = isWordEmphasized(word, currentTimeSeconds);
            return (
              <span
                key={`${segment.id}-${i}`}
                style={{
                  ...wordBase,
                  color: highlighted ? style.highlightColor : BASE_TEXT_COLOR,
                  opacity,
                  filter: blurPx > 0.05 ? `blur(${blurPx}px)` : undefined,
                }}
              >
                {word.word}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
