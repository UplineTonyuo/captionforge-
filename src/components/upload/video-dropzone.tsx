"use client";

import * as React from "react";
import { CheckCircle2, FileVideo, UploadCloud, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  ACCEPTED_VIDEO_EXTENSIONS,
  ACCEPTED_VIDEO_MIME_TYPES,
  formatBytes,
  isAcceptedVideoType,
  MAX_UPLOAD_BYTES,
} from "@/lib/video/constants";
import type { UploadedVideo, UploadResponse } from "@/lib/video/types";
import { cn } from "@/lib/utils";

type UploadState =
  | { phase: "idle" }
  | { phase: "selected"; file: File }
  | { phase: "uploading"; file: File; progress: number }
  | { phase: "done"; video: UploadedVideo }
  | { phase: "error"; message: string; file?: File };

function validateFile(file: File): string | null {
  if (!isAcceptedVideoType(file.type)) {
    return "Only MP4 videos are supported right now.";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `That file is ${formatBytes(file.size)} — the limit is ${formatBytes(
      MAX_UPLOAD_BYTES
    )}.`;
  }
  return null;
}

export function VideoDropzone() {
  const [state, setState] = React.useState<UploadState>({ phase: "idle" });
  const [isDragging, setIsDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const requestRef = React.useRef<XMLHttpRequest | null>(null);

  const acceptFile = React.useCallback((file: File) => {
    const error = validateFile(file);
    if (error) {
      setState({ phase: "error", message: error, file });
    } else {
      setState({ phase: "selected", file });
    }
  }, []);

  const reset = React.useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    if (inputRef.current) inputRef.current.value = "";
    setState({ phase: "idle" });
  }, []);

  const upload = React.useCallback((file: File) => {
    setState({ phase: "uploading", file, progress: 0 });

    // XMLHttpRequest instead of fetch so we can report upload progress.
    const xhr = new XMLHttpRequest();
    requestRef.current = xhr;
    const formData = new FormData();
    formData.append("file", file);

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        setState({
          phase: "uploading",
          file,
          progress: Math.round((event.loaded / event.total) * 100),
        });
      }
    });

    xhr.addEventListener("load", () => {
      requestRef.current = null;
      if (xhr.status >= 200 && xhr.status < 300) {
        const { video } = JSON.parse(xhr.responseText) as UploadResponse;
        setState({ phase: "done", video });
      } else {
        let message = "Upload failed. Please try again.";
        try {
          message = (JSON.parse(xhr.responseText) as { error: string }).error;
        } catch {
          // keep the generic message
        }
        setState({ phase: "error", message, file });
      }
    });

    xhr.addEventListener("error", () => {
      requestRef.current = null;
      setState({
        phase: "error",
        message: "Network error during upload. Please try again.",
        file,
      });
    });

    xhr.open("POST", "/api/upload");
    xhr.send(formData);
  }, []);

  React.useEffect(() => () => requestRef.current?.abort(), []);

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    if (state.phase === "uploading") return;
    const file = event.dataTransfer.files?.[0];
    if (file) acceptFile(file);
  };

  const isBusy = state.phase === "uploading";

  return (
    <Card>
      <CardHeader>
        <CardTitle>MP4 upload</CardTitle>
        <CardDescription>
          Up to {formatBytes(MAX_UPLOAD_BYTES)} per video.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div
          role="button"
          tabIndex={0}
          aria-label="Choose an MP4 video to upload"
          onClick={() => !isBusy && inputRef.current?.click()}
          onKeyDown={(event) => {
            if ((event.key === "Enter" || event.key === " ") && !isBusy) {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (!isBusy) setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-12 text-center transition-colors",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50",
            isBusy && "pointer-events-none opacity-60"
          )}
        >
          <UploadCloud className="size-10 text-muted-foreground" aria-hidden />
          <div>
            <p className="font-medium">
              Drag and drop your video here, or click to browse
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              MP4 only ({ACCEPTED_VIDEO_EXTENSIONS.join(", ")})
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_VIDEO_MIME_TYPES.join(",")}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) acceptFile(file);
            }}
          />
        </div>

        {state.phase !== "idle" && <Separator />}

        {state.phase === "selected" && (
          <div className="flex items-center gap-4">
            <FileVideo className="size-8 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{state.file.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatBytes(state.file.size)}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={reset} aria-label="Remove file">
              <X aria-hidden />
            </Button>
            <Button onClick={() => upload(state.file)}>Upload</Button>
          </div>
        )}

        {state.phase === "uploading" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="truncate font-medium">{state.file.name}</span>
              <span className="text-muted-foreground">{state.progress}%</span>
            </div>
            <Progress value={state.progress} />
            <Button variant="outline" size="sm" onClick={reset}>
              Cancel
            </Button>
          </div>
        )}

        {state.phase === "done" && (
          <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-green-600" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-medium">Upload complete</p>
              <p className="truncate text-sm text-muted-foreground">
                {state.video.originalName} ({formatBytes(state.video.sizeBytes)})
                — staged for captioning as{" "}
                <code className="font-mono text-xs">{state.video.id}</code>
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={reset}>
              Upload another
            </Button>
          </div>
        )}

        {state.phase === "error" && (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-destructive/50 bg-destructive/5 p-4">
            <p className="text-sm text-destructive">{state.message}</p>
            <Button variant="outline" size="sm" onClick={reset}>
              Try again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
