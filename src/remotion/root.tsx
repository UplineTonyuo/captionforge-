import { Composition } from "remotion";

import { DEMO_SEGMENTS } from "@/lib/captions/demo";
import { DEFAULT_CAPTION_STYLE } from "@/lib/captions/style";
import { captionTrackEnd } from "@/lib/captions/timing";
import { CaptionedVideo } from "./captioned-video";

/**
 * Remotion root: registers compositions for Remotion tooling (studio and the
 * future server-side render job, TASKS.md M5). The in-app preview page mounts
 * the composition component directly through <Player> and does not go through
 * this file.
 */

const FPS = 30;

export function RemotionRoot() {
  return (
    <Composition
      id="CaptionedVideo"
      component={CaptionedVideo}
      width={1080}
      height={1920}
      fps={FPS}
      durationInFrames={Math.ceil(captionTrackEnd(DEMO_SEGMENTS) * FPS)}
      defaultProps={{
        videoSrc: "",
        segments: DEMO_SEGMENTS,
        captionStyle: DEFAULT_CAPTION_STYLE,
        loopCaptions: false,
      }}
    />
  );
}
