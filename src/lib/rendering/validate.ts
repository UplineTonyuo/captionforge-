import { HIGHLIGHT_PALETTE } from "@/lib/captions/style";
import type {
  CaptionSegment,
  CaptionStyle,
  CaptionWord,
} from "@/lib/video/types";

/**
 * Runtime validation of client-supplied render payloads. Lightweight and
 * hand-rolled for the two shapes we accept; a schema library can replace
 * this wholesale in the hardening milestone (TASKS.md 6.2).
 */

export class InvalidRenderPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidRenderPayloadError";
  }
}

const POSITIONS = new Set(["top", "center", "bottom"]);
const SIZE_PRESETS = new Set(["sm", "md", "lg"]);
const TEMPLATES = new Set(["karaoke", "stacked"]);
const HIGHLIGHT_COLORS = new Set<string>(Object.values(HIGHLIGHT_PALETTE));

const MAX_SEGMENTS = 5000;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseWord(value: unknown): CaptionWord {
  const w = value as Partial<CaptionWord>;
  if (
    typeof w?.word !== "string" ||
    w.word.length === 0 ||
    w.word.length > 100 ||
    !isFiniteNumber(w.startSeconds) ||
    !isFiniteNumber(w.endSeconds) ||
    w.startSeconds < 0 ||
    w.endSeconds <= w.startSeconds
  ) {
    throw new InvalidRenderPayloadError("Malformed caption word.");
  }
  return {
    word: w.word,
    startSeconds: w.startSeconds,
    endSeconds: w.endSeconds,
    ...(w.emphasized === true ? { emphasized: true } : {}),
  };
}

export function parseSegments(json: string): CaptionSegment[] {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new InvalidRenderPayloadError("Caption segments are not valid JSON.");
  }
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_SEGMENTS) {
    throw new InvalidRenderPayloadError(
      "Caption segments must be a non-empty array."
    );
  }

  return raw.map((value, i) => {
    const s = value as Partial<CaptionSegment>;
    if (
      !Array.isArray(s?.words) ||
      s.words.length === 0 ||
      !isFiniteNumber(s.startSeconds) ||
      !isFiniteNumber(s.endSeconds) ||
      s.endSeconds <= s.startSeconds
    ) {
      throw new InvalidRenderPayloadError(`Malformed caption segment #${i + 1}.`);
    }
    const words = s.words.map(parseWord);
    return {
      id: typeof s.id === "string" && s.id.length > 0 ? s.id : `seg-${i + 1}`,
      startSeconds: s.startSeconds,
      endSeconds: s.endSeconds,
      words,
      text: words.map((w) => w.word).join(" "),
    };
  });
}

export function parseStyle(json: string): CaptionStyle {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new InvalidRenderPayloadError("Caption style is not valid JSON.");
  }
  const s = raw as Partial<CaptionStyle>;
  if (
    typeof s?.position !== "string" ||
    !POSITIONS.has(s.position) ||
    typeof s.highlightColor !== "string" ||
    !HIGHLIGHT_COLORS.has(s.highlightColor) ||
    typeof s.sizePreset !== "string" ||
    !SIZE_PRESETS.has(s.sizePreset) ||
    // template is optional (older clients omit it); reject only bad values.
    (s.template !== undefined &&
      (typeof s.template !== "string" || !TEMPLATES.has(s.template)))
  ) {
    throw new InvalidRenderPayloadError("Malformed caption style.");
  }
  return {
    position: s.position,
    highlightColor: s.highlightColor,
    sizePreset: s.sizePreset,
    template: s.template ?? "karaoke",
  };
}
