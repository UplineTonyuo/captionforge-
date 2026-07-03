"use client";

import * as React from "react";
import { Player } from "@remotion/player";
import {
  Captions,
  Clapperboard,
  Download,
  FileVideo,
  Loader2,
  UploadCloud,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DEFAULT_CAPTION_STYLE } from "@/lib/captions/style";
import {
  ACCEPTED_VIDEO_MIME_TYPES,
  formatBytes,
  isAcceptedVideoType,
  MAX_UPLOAD_BYTES,
} from "@/lib/video/constants";
import type {
  CaptionSegment,
  RenderStatusResponse,
  TranscribeResponse,
} from "@/lib/video/types";
import { CaptionedVideo } from "@/remotion/captioned-video";

const PREVIEW_FPS = 30;

interface LoadedVideo {
  file: File;
  objectUrl: string;
  durationSeconds: number;
  width: number;
  height: number;
}

type PreviewState =
  | { phase: "idle" }
  | { phase: "loading"; file: File }
  | { phase: "ready"; video: LoadedVideo }
  | { phase: "error"; message: string };

type CaptionTrackState =
  | { phase: "none" }
  | { phase: "uploading"; progress: number }
  | { phase: "transcribing" }
  | { phase: "ready"; segments: CaptionSegment[]; language: string }
  | { phase: "error"; message: string };

type ExportState =
  | { phase: "idle" }
  | { phase: "uploading"; progress: number }
  | { phase: "rendering"; progress: number }
  | { phase: "done"; renderId: string }
  | { phase: "error"; message: string };

const RENDER_POLL_MS = 1000;

/** Read intrinsic duration/dimensions from a video object URL. */
function probeVideo(
  objectUrl: string
): Promise<{ durationSeconds: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const el = document.createElement("video");
    el.preload = "metadata";
    el.onloadedmetadata = () =>
      resolve({
        durationSeconds: el.duration,
        width: el.videoWidth,
        height: el.videoHeight,
      });
    el.onerror = () => reject(new Error("Could not read video metadata."));
    el.src = objectUrl;
  });
}

export function VideoPreview() {
  const [state, setState] = React.useState<PreviewState>({ phase: "idle" });
  const [captions, setCaptions] = React.useState<CaptionTrackState>({
    phase: "none",
  });
  const [exportState, setExportState] = React.useState<ExportState>({
    phase: "idle",
  });
  const inputRef = React.useRef<HTMLInputElement>(null);
  const objectUrlRef = React.useRef<string | null>(null);
  const requestRef = React.useRef<XMLHttpRequest | null>(null);
  const exportRequestRef = React.useRef<XMLHttpRequest | null>(null);
  const pollTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const releaseObjectUrl = React.useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const abortTranscription = React.useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
  }, []);

  const abortExport = React.useCallback(() => {
    exportRequestRef.current?.abort();
    exportRequestRef.current = null;
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  React.useEffect(
    () => () => {
      releaseObjectUrl();
      abortTranscription();
      abortExport();
    },
    [releaseObjectUrl, abortTranscription, abortExport]
  );

  /** Poll the render status until it reaches a terminal state. */
  const pollRender = React.useCallback((renderId: string) => {
    const tick = async () => {
      let status: RenderStatusResponse;
      try {
        const response = await fetch(`/api/render/${renderId}`);
        if (!response.ok) {
          const { error } = (await response.json()) as { error: string };
          setExportState({ phase: "error", message: error });
          return;
        }
        status = (await response.json()) as RenderStatusResponse;
      } catch {
        setExportState({
          phase: "error",
          message: "Lost connection while exporting. Please try again.",
        });
        return;
      }

      if (status.status === "completed") {
        setExportState({ phase: "done", renderId });
      } else if (status.status === "failed") {
        setExportState({
          phase: "error",
          message: status.error ?? "Rendering failed. Please try again.",
        });
      } else {
        setExportState({ phase: "rendering", progress: status.progress });
        pollTimerRef.current = setTimeout(() => void tick(), RENDER_POLL_MS);
      }
    };
    pollTimerRef.current = setTimeout(() => void tick(), RENDER_POLL_MS);
  }, []);

  /** Send the video + captions to POST /api/render and follow progress. */
  const startExport = React.useCallback(
    (file: File, segments: CaptionSegment[]) => {
      abortExport();
      setExportState({ phase: "uploading", progress: 0 });

      const xhr = new XMLHttpRequest();
      exportRequestRef.current = xhr;
      const formData = new FormData();
      formData.append("file", file);
      formData.append("segments", JSON.stringify(segments));
      formData.append("style", JSON.stringify(DEFAULT_CAPTION_STYLE));

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          setExportState({
            phase: "uploading",
            progress: Math.round((event.loaded / event.total) * 100),
          });
        }
      });

      xhr.addEventListener("load", () => {
        exportRequestRef.current = null;
        if (xhr.status === 202) {
          try {
            const { renderId } = JSON.parse(
              xhr.responseText
            ) as RenderStatusResponse;
            setExportState({ phase: "rendering", progress: 0 });
            pollRender(renderId);
            return;
          } catch {
            // fall through to the generic error below
          }
        }
        let message = "Could not start the export. Please try again.";
        try {
          message = (JSON.parse(xhr.responseText) as { error: string }).error;
        } catch {
          // keep the generic message
        }
        setExportState({ phase: "error", message });
      });

      xhr.addEventListener("error", () => {
        exportRequestRef.current = null;
        setExportState({
          phase: "error",
          message: "Network error while starting the export. Please try again.",
        });
      });

      xhr.open("POST", "/api/render");
      xhr.send(formData);
    },
    [abortExport, pollRender]
  );

  /**
   * Upload the file to POST /api/transcribe and track byte progress; the
   * server extracts audio, runs the STT engine, and returns §5.5 segments.
   */
  const transcribe = React.useCallback(
    (file: File) => {
      abortTranscription();
      setCaptions({ phase: "uploading", progress: 0 });

      const xhr = new XMLHttpRequest();
      requestRef.current = xhr;
      const formData = new FormData();
      formData.append("file", file);

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setCaptions(
            progress >= 100
              ? { phase: "transcribing" }
              : { phase: "uploading", progress }
          );
        }
      });
      xhr.upload.addEventListener("load", () =>
        setCaptions({ phase: "transcribing" })
      );

      xhr.addEventListener("load", () => {
        requestRef.current = null;
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const { segments, language } = JSON.parse(
              xhr.responseText
            ) as TranscribeResponse;
            setCaptions({ phase: "ready", segments, language });
          } catch {
            setCaptions({
              phase: "error",
              message: "Received an unreadable transcription response.",
            });
          }
        } else {
          let message = "Transcription failed. Please try again.";
          try {
            message = (JSON.parse(xhr.responseText) as { error: string }).error;
          } catch {
            // keep the generic message
          }
          setCaptions({ phase: "error", message });
        }
      });

      xhr.addEventListener("error", () => {
        requestRef.current = null;
        setCaptions({
          phase: "error",
          message: "Network error while sending your video. Please try again.",
        });
      });

      xhr.open("POST", "/api/transcribe");
      xhr.send(formData);
    },
    [abortTranscription]
  );

  const selectFile = React.useCallback(
    async (file: File) => {
      if (!isAcceptedVideoType(file.type)) {
        setState({
          phase: "error",
          message: "Only MP4 videos are supported right now.",
        });
        return;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        setState({
          phase: "error",
          message: `That file is ${formatBytes(file.size)} — the limit is ${formatBytes(MAX_UPLOAD_BYTES)}.`,
        });
        return;
      }

      setState({ phase: "loading", file });
      setCaptions({ phase: "none" });
      setExportState({ phase: "idle" });
      abortTranscription();
      abortExport();
      releaseObjectUrl();
      const objectUrl = URL.createObjectURL(file);
      objectUrlRef.current = objectUrl;
      try {
        const meta = await probeVideo(objectUrl);
        setState({ phase: "ready", video: { file, objectUrl, ...meta } });
        transcribe(file);
      } catch {
        releaseObjectUrl();
        setState({
          phase: "error",
          message: "Could not read that video. Is it a valid MP4?",
        });
      }
    },
    [abortTranscription, abortExport, releaseObjectUrl, transcribe]
  );

  const openPicker = () => inputRef.current?.click();

  const segments =
    captions.phase === "ready" ? captions.segments : ([] as CaptionSegment[]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Caption preview</CardTitle>
        <CardDescription>
          Pick a local MP4. We transcribe the audio with word-level timestamps
          and render PrimeClip captions over your video.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_VIDEO_MIME_TYPES.join(",")}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void selectFile(file);
          }}
        />

        {state.phase === "idle" && (
          <div className="flex flex-col items-center gap-4 rounded-lg border-2 border-dashed border-muted-foreground/25 p-16 text-center">
            <Clapperboard
              className="size-10 text-muted-foreground"
              aria-hidden
            />
            <p className="text-sm text-muted-foreground">
              No video selected yet.
            </p>
            <Button onClick={openPicker}>
              <UploadCloud aria-hidden />
              Choose an MP4
            </Button>
          </div>
        )}

        {state.phase === "loading" && (
          <div className="flex items-center gap-3 rounded-lg border p-4 text-sm text-muted-foreground">
            <FileVideo className="size-5 shrink-0" aria-hidden />
            Reading {state.file.name}…
          </div>
        )}

        {state.phase === "error" && (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-destructive/50 bg-destructive/5 p-4">
            <p className="text-sm text-destructive">{state.message}</p>
            <Button variant="outline" size="sm" onClick={openPicker}>
              Choose another file
            </Button>
          </div>
        )}

        {state.phase === "ready" && (
          <div className="space-y-4">
            <div
              className="overflow-hidden rounded-lg border bg-black"
              data-testid="caption-player"
            >
              <Player
                component={CaptionedVideo}
                inputProps={{
                  videoSrc: state.video.objectUrl,
                  segments,
                  captionStyle: DEFAULT_CAPTION_STYLE,
                  loopCaptions: false,
                }}
                durationInFrames={Math.max(
                  1,
                  Math.ceil(state.video.durationSeconds * PREVIEW_FPS)
                )}
                fps={PREVIEW_FPS}
                compositionWidth={state.video.width || 1080}
                compositionHeight={state.video.height || 1920}
                style={{ width: "100%" }}
                controls
                loop
                autoPlay
                initiallyMuted
              />
            </div>

            {captions.phase === "uploading" && (
              <div className="space-y-2" data-testid="caption-status">
                <p className="text-sm text-muted-foreground">
                  Sending your video for transcription… {captions.progress}%
                </p>
                <Progress value={captions.progress} />
              </div>
            )}

            {captions.phase === "transcribing" && (
              <div
                className="flex items-center gap-2 text-sm text-muted-foreground"
                data-testid="caption-status"
              >
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Transcribing audio — this can take a moment for longer clips…
              </div>
            )}

            {captions.phase === "ready" && (
              <div
                className="flex items-center gap-2 text-sm text-muted-foreground"
                data-testid="caption-status"
              >
                <Captions className="size-4" aria-hidden />
                {captions.segments.length} caption segments · language:{" "}
                {captions.language}
              </div>
            )}

            {captions.phase === "error" && (
              <div
                className="flex items-start justify-between gap-3 rounded-lg border border-destructive/50 bg-destructive/5 p-4"
                data-testid="caption-status"
              >
                <p className="text-sm text-destructive">{captions.message}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => transcribe(state.video.file)}
                >
                  Retry transcription
                </Button>
              </div>
            )}

            {captions.phase === "ready" && (
              <div
                className="space-y-3 rounded-lg border p-4"
                data-testid="export-panel"
              >
                {exportState.phase === "idle" && (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                      Export your video with these captions burned in.
                    </p>
                    <Button
                      onClick={() =>
                        startExport(state.video.file, captions.segments)
                      }
                    >
                      <Download aria-hidden />
                      Export MP4
                    </Button>
                  </div>
                )}

                {exportState.phase === "uploading" && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Sending your video for rendering… {exportState.progress}%
                    </p>
                    <Progress value={exportState.progress} />
                  </div>
                )}

                {exportState.phase === "rendering" && (
                  <div className="space-y-2">
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Rendering captions into your video…{" "}
                      {exportState.progress}%
                    </p>
                    <Progress value={exportState.progress} />
                  </div>
                )}

                {exportState.phase === "done" && (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                      Export ready — downloads expire after 30 minutes.
                    </p>
                    <Button asChild>
                      <a
                        href={`/api/render/${exportState.renderId}/download`}
                        download
                      >
                        <Download aria-hidden />
                        Download MP4
                      </a>
                    </Button>
                  </div>
                )}

                {exportState.phase === "error" && (
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-destructive">
                      {exportState.message}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        startExport(state.video.file, captions.segments)
                      }
                    >
                      Retry export
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-sm text-muted-foreground">
                {state.video.file.name} · {formatBytes(state.video.file.size)}{" "}
                · {state.video.width}×{state.video.height}
              </p>
              <Button variant="outline" size="sm" onClick={openPicker}>
                Choose another file
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
