import * as React from "react";

import {
  BASE_TEXT_COLOR,
  CAPTION_FONT_FAMILY,
  OUTLINE_COLOR,
  OUTLINE_RATIO,
  SAFE_MARGIN_BOTTOM,
  SAFE_MARGIN_X,
  SCRIM,
  WORD_GAP_RATIO,
} from "@/lib/captions/style";
import {
  EMPHASIS_OVERLAP_RATIO,
  HIGHLIGHT_ENTRANCE,
  HIGHLIGHT_EXTRUDE,
  HIGHLIGHT_SHADOW,
  STACKED_LINE_HEIGHT,
  STACKED_ROLES,
  STACKED_SHADOW,
  stackedFontSize,
  THIN_ENTRANCE,
} from "@/lib/captions/stacked-style";
import { getActiveSegment, pickEmphasisIndex } from "@/lib/captions/timing";
import type { CaptionSegment, CaptionStyle, CaptionWord } from "@/lib/video/types";

/**
 * The "stacked" caption template (the v11 look): normal words render thin, and
 * the one pop word per segment (manual override, else the longest word) sits
 * alone on its own line, larger, in italic Inter 700 and the highlight colour,
 * painted on top of the neighbouring rows. Each word fades in with blur; the
 * pop word additionally rises from below. Every value is a pure function of
 * `t − word.start`, so preview and export are frame-identical (TR-3).
 */
export interface StackedCaptionProps {
  segments: CaptionSegment[];
  currentTimeSeconds: number;
  frameWidth: number;
  frameHeight: number;
  style: CaptionStyle;
}

/** Cubic ease-out of an entrance `elapsed` seconds in, over `durationSeconds`. */
function entranceEase(elapsedSeconds: number, durationSeconds: number): number {
  const p = Math.min(1, Math.max(0, elapsedSeconds / durationSeconds));
  return 1 - (1 - p) ** 3;
}

export function StackedCaption({
  segments,
  currentTimeSeconds,
  frameWidth,
  frameHeight,
  style,
}: StackedCaptionProps) {
  const segment = getActiveSegment(segments, currentTimeSeconds);
  if (!segment) return null;

  const baseFontSize = stackedFontSize("thin", style.sizePreset, frameHeight);
  const strokeWidth = 2 * OUTLINE_RATIO * baseFontSize;
  const shadow = `${STACKED_SHADOW.offsetXRatio * baseFontSize}px ${
    STACKED_SHADOW.offsetYRatio * baseFontSize
  }px ${STACKED_SHADOW.blurRatio * baseFontSize}px ${STACKED_SHADOW.color}`;

  const textBase: React.CSSProperties = {
    fontFamily: CAPTION_FONT_FAMILY,
    fontWeight: STACKED_ROLES.thin.weight,
    lineHeight: STACKED_LINE_HEIGHT,
    ...(strokeWidth > 0
      ? {
          WebkitTextStroke: `${strokeWidth}px ${OUTLINE_COLOR}`,
          paintOrder: "stroke fill" as const,
        }
      : {}),
    textShadow: shadow,
    whiteSpace: "pre",
  };

  const vertical: React.CSSProperties =
    style.position === "top"
      ? { top: SAFE_MARGIN_BOTTOM * frameHeight, alignItems: "flex-start" }
      : style.position === "center"
        ? { top: 0, bottom: 0, alignItems: "center" }
        : { bottom: SAFE_MARGIN_BOTTOM * frameHeight, alignItems: "flex-end" };

  const pop = pickEmphasisIndex(segment.words);
  const before = pop >= 0 ? segment.words.slice(0, pop) : segment.words;
  const after = pop >= 0 ? segment.words.slice(pop + 1) : [];
  const popWord = pop >= 0 ? segment.words[pop] : null;

  const isVisible = (word: CaptionWord) =>
    currentTimeSeconds >= word.startSeconds;

  const wordEntrance = (word: CaptionWord) =>
    entranceEase(currentTimeSeconds - word.startSeconds, THIN_ENTRANCE.seconds);

  const wordRow = (words: CaptionWord[], key: string) => {
    const visible = words.filter(isVisible);
    if (visible.length === 0) return null;
    return (
      <p
        key={key}
        style={{
          margin: 0,
          position: "relative",
          zIndex: 0,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          columnGap: WORD_GAP_RATIO * baseFontSize,
          textAlign: "center",
          fontSize: baseFontSize,
          color: BASE_TEXT_COLOR,
          ...textBase,
        }}
      >
        {visible.map((word, i) => {
          const eased = wordEntrance(word);
          const blurPx = (1 - eased) * THIN_ENTRANCE.blurRatio * baseFontSize;
          return (
            <span
              key={`${key}-${i}`}
              style={{
                display: "inline-block",
                opacity: eased,
                filter: blurPx > 0.05 ? `blur(${blurPx}px)` : undefined,
              }}
            >
              {word.word}
            </span>
          );
        })}
      </p>
    );
  };

  const popEased =
    popWord && isVisible(popWord)
      ? entranceEase(
          currentTimeSeconds - popWord.startSeconds,
          HIGHLIGHT_ENTRANCE.seconds
        )
      : 0;
  const popFontSize = stackedFontSize("highlight", style.sizePreset, frameHeight);
  const popBlurPx = (1 - popEased) * HIGHLIGHT_ENTRANCE.blurRatio * popFontSize;
  const popRisePx = (1 - popEased) * HIGHLIGHT_ENTRANCE.riseRatio * popFontSize;
  const popOverlapPx = EMPHASIS_OVERLAP_RATIO * popFontSize;

  const popShadow = [
    ...Array.from({ length: HIGHLIGHT_EXTRUDE.steps }, (_, i) => {
      const offset =
        ((i + 1) / HIGHLIGHT_EXTRUDE.steps) *
        HIGHLIGHT_EXTRUDE.offsetRatio *
        popFontSize;
      return `0 ${offset}px 0 ${HIGHLIGHT_EXTRUDE.color}`;
    }),
    `0 ${HIGHLIGHT_SHADOW.offsetYRatio * popFontSize}px ${
      HIGHLIGHT_SHADOW.blurRatio * popFontSize
    }px ${HIGHLIGHT_SHADOW.color}`,
  ].join(", ");

  const scrimEase = entranceEase(
    currentTimeSeconds - segment.startSeconds,
    THIN_ENTRANCE.seconds
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
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {wordRow(before, `${segment.id}-before`)}
          {popWord && isVisible(popWord) && (
            <p
              style={{
                margin: `${-popOverlapPx}px 0`,
                position: "relative",
                zIndex: 2,
                textAlign: "center",
                fontSize: popFontSize,
                color: style.highlightColor,
                opacity: popEased,
                filter: popBlurPx > 0.05 ? `blur(${popBlurPx}px)` : undefined,
                transform:
                  popRisePx > 0.05 ? `translateY(${popRisePx}px)` : undefined,
                ...textBase,
                fontWeight: STACKED_ROLES.highlight.weight,
                fontStyle: STACKED_ROLES.highlight.italic ? "italic" : "normal",
                textShadow: popShadow,
              }}
            >
              {popWord.word}
            </p>
          )}
          {wordRow(after, `${segment.id}-after`)}
        </div>
      </div>
    </div>
  );
}
