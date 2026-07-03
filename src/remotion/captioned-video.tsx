import {
  AbsoluteFill,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { CaptionRenderer } from "@/components/captions/caption-renderer";
import { loopTime } from "@/lib/captions/timing";
import type { CaptionSegment, CaptionStyle } from "@/lib/video/types";
import { ensureCaptionFontsLoaded } from "./load-fonts";

void ensureCaptionFontsLoaded();

/**
 * The preview passes blob/http URLs; the server-side render pipeline stages
 * its input inside the bundle's public dir and passes a bare relative name,
 * which must resolve through staticFile.
 */
function resolveVideoSrc(videoSrc: string): string {
  return /^(blob:|https?:|data:)/.test(videoSrc)
    ? videoSrc
    : staticFile(videoSrc);
}

/**
 * The Remotion composition: source video with the PrimeClip caption overlay.
 *
 * Used by the in-browser <Player> on the preview page today; the same
 * composition is registered in src/remotion/root.tsx so a future render job
 * (TASKS.md M5) can burn identical output server-side — that shared usage is
 * the WYSIWYG guarantee (PROJECT_SPEC.md TR-3).
 */
// A type alias (not an interface) so it satisfies Remotion's
// Record<string, unknown> constraint on composition props.
export type CaptionedVideoProps = {
  /** Video source URL (object URL in the preview, staged file when rendering). */
  videoSrc: string;
  segments: CaptionSegment[];
  captionStyle: CaptionStyle;
  /**
   * Wrap playback time into the caption track duration so a short demo track
   * repeats over a longer video. Off for real transcripts.
   */
  loopCaptions?: boolean;
};

export function CaptionedVideo({
  videoSrc,
  segments,
  captionStyle,
  loopCaptions = false,
}: CaptionedVideoProps) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const timeSeconds = frame / fps;
  const captionTime = loopCaptions
    ? loopTime(segments, timeSeconds)
    : timeSeconds;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      {videoSrc !== "" && (
        <OffthreadVideo
          src={resolveVideoSrc(videoSrc)}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      )}
      <CaptionRenderer
        segments={segments}
        currentTimeSeconds={captionTime}
        frameWidth={width}
        frameHeight={height}
        style={captionStyle}
      />
    </AbsoluteFill>
  );
}
