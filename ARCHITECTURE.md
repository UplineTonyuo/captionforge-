# CaptionForge — Architecture

> How the system is built. Requirements and style rules live in [PROJECT_SPEC.md](./PROJECT_SPEC.md); this document defines the structure that implements them. Sections marked **(current)** exist in the codebase today; everything else is **(planned)** and is the target design for TASKS.md.

## 1. System overview

CaptionForge is a single Next.js application with three long-running concerns — upload staging, transcription, and rendering — isolated behind service interfaces. The App Router serves both the UI (React Server Components + client islands) and the JSON API (route handlers). Long-running work is modeled as **jobs** persisted alongside **projects**; the UI polls job status.

```
┌────────────────────────────  Browser  ─────────────────────────────┐
│  Landing page   Upload page (dropzone)   Editor (preview overlay)  │
└───────┬───────────────┬───────────────────────┬────────────────────┘
        │ RSC/HTML      │ POST /api/upload      │ /api/projects/*  /api/jobs/*
┌───────▼───────────────▼───────────────────────▼────────────────────┐
│                    Next.js (App Router, Node runtime)              │
│  route handlers ──▶ services (lib/) ──▶ adapters                   │
│                                                                    │
│   ┌──────────────┐  ┌───────────────┐  ┌──────────────────────┐    │
│   │ StorageService│  │ Transcription │  │  RenderService       │    │
│   │ (local disk) │  │ Service       │  │  (ffmpeg subprocess) │    │
│   └──────┬───────┘  └──────┬────────┘  └─────────┬────────────┘    │
│          │                 │                     │                 │
│   .uploads/ .renders/   STT engine          caption-engine (shared │
│   (gitignored)          (whisper/API)       with browser preview)  │
└────────────────────────────────────────────────────────────────────┘
```

Design principles:

1. **One shared caption engine.** Segmenting and layout math compile for both browser and Node so the preview and the render can never drift (TR-3).
2. **Adapters at the edges.** Disk, STT, and ffmpeg are behind interfaces; product code imports the interface, never the implementation (TR-2).
3. **Types are the API.** Everything crossing a boundary is declared in `src/lib/video/types.ts` (TR-4).
4. **Jobs, not requests.** Anything slower than ~2 s is a job record with polled status, never a hanging HTTP request (FR-9).

## 2. Folder structure

Target structure. **(current)** marks what exists today.

```
captionforge/
├── PROJECT_SPEC.md / ARCHITECTURE.md / TASKS.md / DEVELOPMENT_RULES.md
├── components.json                  # shadcn/ui config            (current)
├── next.config.ts                                                (current)
├── package.json / tsconfig.json / eslint.config.mjs / postcss.config.mjs  (current)
├── public/                          # static assets
├── .uploads/                        # staged source videos (gitignored)   (current)
├── .renders/                        # render outputs (gitignored)
└── src/
    ├── app/
    │   ├── layout.tsx               # root layout, header/footer  (current)
    │   ├── page.tsx                 # landing                     (current)
    │   ├── globals.css              # Tailwind v4 + theme tokens  (current)
    │   ├── icon.svg                                              (current)
    │   ├── upload/page.tsx          # upload flow                 (current)
    │   ├── projects/
    │   │   └── [projectId]/page.tsx # editor (transcript + preview + export)
    │   └── api/
    │       ├── upload/route.ts      # POST upload                 (current)
    │       ├── projects/
    │       │   ├── route.ts                 # GET list
    │       │   └── [projectId]/
    │       │       ├── route.ts             # GET/PATCH/DELETE project
    │       │       ├── transcript/route.ts  # PUT edited transcript
    │       │       └── render/route.ts      # POST start render
    │       ├── jobs/[jobId]/route.ts        # GET job status
    │       └── files/[videoId]/route.ts     # GET stream source/render
    ├── components/
    │   ├── ui/                      # shadcn/ui primitives        (current)
    │   ├── site-header.tsx / site-footer.tsx                     (current)
    │   ├── upload/video-dropzone.tsx                             (current)
    │   └── editor/
    │       ├── editor-shell.tsx     # layout: player | transcript | style
    │       ├── video-player.tsx     # <video> + caption overlay
    │       ├── caption-overlay.tsx  # renders engine layout to DOM
    │       ├── transcript-panel.tsx # segment list, text editing
    │       ├── segment-row.tsx
    │       ├── style-panel.tsx      # §5.6 controls
    │       └── export-panel.tsx     # render trigger + job progress
    ├── hooks/
    │   ├── use-job.ts               # poll job status
    │   ├── use-project.ts           # load/mutate project
    │   └── use-playback-time.ts     # rAF-driven currentTime
    └── lib/
        ├── utils.ts                 # cn()                        (current)
        ├── api/
        │   ├── client.ts            # typed fetch wrappers for the browser
        │   └── errors.ts            # ApiError, error → HTTP mapping
        ├── captions/                # ★ shared caption engine (isomorphic)
        │   ├── segmenter.ts         # words → CaptionSegment[] (§5.5)
        │   ├── layout.ts            # segment + style + frame → CaptionFrameLayout
        │   ├── style.ts             # PrimeClip constants (§5.2–5.4)
        │   └── index.ts
        ├── projects/
        │   ├── store.ts             # ProjectStore interface + JSON-file impl
        │   └── service.ts           # create/get/update orchestration
        ├── jobs/
        │   ├── store.ts             # JobStore interface + impl
        │   ├── runner.ts            # in-process queue, retries, progress
        │   └── service.ts
        ├── transcription/
        │   ├── engine.ts            # TranscriptionEngine interface
        │   ├── local-whisper.ts     # default adapter
        │   └── service.ts           # job wiring
        └── video/
            ├── constants.ts         # limits, accepted types      (current)
            ├── types.ts             # domain types                (current)
            ├── storage.ts           # StorageService (local disk) (current)
            ├── probe.ts             # ffprobe → VideoMetadata
            ├── render.ts            # RenderService seam          (current, stub)
            └── ffmpeg-renderer.ts   # default RenderService adapter
```

Rules: `app/` never contains business logic; `components/` never touch disk or subprocesses; `lib/` never imports React. `lib/captions/` must stay free of Node-only imports (it runs in the browser).

## 3. Frontend architecture

- **Server Components by default.** Pages are RSC; interactivity lives in client islands (`"use client"`) at the leaves — the dropzone today, the editor panels tomorrow.
- **State model.** Local UI state via discriminated unions (`UploadState` pattern **(current)**). Server data via small hooks (`use-project`, `use-job`) wrapping the typed API client; no global state library until proven necessary.
- **Editor data flow** (single downward flow, callbacks up):

```
  EditorShell (client, owns Project + dirty transcript + style)
  ├── VideoPlayer ── use-playback-time ──▶ currentTime
  │   └── CaptionOverlay(currentTime, segments, style)
  │         └── lib/captions/layout.ts  ← same math as renderer
  ├── TranscriptPanel(segments, onChange)
  │   └── SegmentRow (edit text, split, merge, mark emphasis)
  ├── StylePanel(style, onChange)         # §5.6 knobs only
  └── ExportPanel(projectId) ── use-job ──▶ progress → download link
```

- **Preview correctness.** `CaptionOverlay` positions absolutely inside the video's box using percentages returned by `lib/captions/layout.ts` — the same function the ffmpeg renderer uses to place drawtext/ASS events. No layout math in components.
- **Polling.** `use-job` polls `GET /api/jobs/:id` with backoff (1 s → 3 s) while status is non-terminal; stops on `completed`/`failed`.

## 4. Backend architecture

- **Route handlers are thin.** Parse/validate input → call a `lib/*` service → map result or `ApiError` to a typed JSON response. No business logic in `app/api`.
- **Services own orchestration.** e.g. upload service: stage file → probe metadata → create project → enqueue transcription job.
- **Persistence (v1).** `ProjectStore`/`JobStore` interfaces with a JSON-file implementation under `.data/` (atomic write-temp-then-rename). The interface is the contract; swapping to SQLite/Postgres later is an adapter change (TR-2). In-memory maps are acceptable only in tests.
- **Job runner (v1).** In-process async queue with configurable concurrency (default 1 render, 1 transcription), progress callbacks writing to the JobStore, and crash-safe semantics: jobs found `running` at boot are reset to `failed` with a retryable flag (TR-7).
- **Node runtime** is mandatory (`export const runtime = "nodejs"`) for any route touching disk, ffmpeg, or child processes.

## 5. Pipelines

### 5.1 Upload pipeline **(current, extended)**

```
Browser                        POST /api/upload                 lib/
  validate type+size  ──────▶  validate again (415/413)
  FormData + XHR progress      generateVideoId()
                               saveVideoStream() → .uploads/{id}.mp4
                               probe.ts → duration/fps/resolution      (planned)
                               projects.create({video, metadata})      (planned)
                               jobs.enqueue(transcription)             (planned)
  ◀── 201 { video, projectId, transcriptionJobId }
```

Contract today: `POST /api/upload` → `201 UploadResponse | 4xx UploadErrorResponse`. The planned fields are additive.

### 5.2 Transcription pipeline

```
jobs.runner picks job ─▶ TranscriptionEngine.transcribe(videoPath, onProgress)
                            │  (adapter: local whisper-class model or hosted API)
                            ▼
                     TranscriptWord[] (word, startSeconds, endSeconds, confidence)
                            ▼
                     captions/segmenter.ts → CaptionSegment[] (§5.5 rules)
                            ▼
                     projects.update(transcript, segments)   job → completed
```

- Audio is extracted to 16 kHz mono WAV via ffmpeg before STT (keeps the engine interface codec-agnostic).
- The raw `TranscriptWord[]` is stored verbatim and never mutated; user edits apply to `CaptionSegment[]` so re-segmentation stays possible.
- Engine failures mark the job `failed` with a message; retry re-enqueues with the same inputs (idempotent).

### 5.3 Rendering pipeline / video rendering workflow

> **Decision update (M0.5):** the render adapter is **Remotion**, not ffmpeg+libass/ASS.
> The `CaptionRenderer` React component (`src/components/captions/caption-renderer.tsx`)
> is the single visual source of truth: the `/preview` page plays it through
> `@remotion/player`, and the future render job will burn identical frames via
> `@remotion/renderer` using the `CaptionedVideo` composition registered in
> `src/remotion/root.tsx`. The `RenderEngine` interface and job workflow below are
> unchanged; steps 2–4 are replaced by a Remotion render of the same component.
> The ASS-specific text below is retained for historical context only.

```
POST /api/projects/:id/render
  └─ jobs.enqueue(render, {projectId})
       └─ runner ─▶ RenderService.render(job):
            1. load project (video path, segments, style)
            2. layout: for each segment, captions/layout.ts → positioned lines
            3. compile layout → ASS subtitle file (libass styles: 800-weight font,
               white fill, black outline ~4% em, shadow; emphasis events: italic,
               1.35×, highlight color) — one ASS event per word-timing window
            4. ffmpeg -i source.mp4 -vf "ass=captions.ass"
                 -c:v libx264 -preset medium -crf 18 -c:a copy
                 → .renders/{videoId}/{jobId}.tmp.mp4
            5. parse ffmpeg -progress pipe → job.progress (0–100 by out_time/duration)
            6. atomic rename → .renders/{videoId}/{jobId}.mp4 ; job → completed
```

- **ASS via libass** is the rendering strategy (word-accurate styling, italics, per-word colors — things `drawtext` handles poorly). The ASS generator lives next to the renderer but consumes only engine output, keeping §5 in one place.
- Frame accuracy: event times are snapped to the source frame rate from `probe.ts`.
- `GET /api/files/:videoId?kind=render` streams the completed file with `Content-Type: video/mp4` and range support (seekable download/preview).

### 5.4 Caption engine design

The heart of WYSIWYG parity. Pure, isomorphic, fully unit-tested.

```
lib/captions/
  style.ts      PRIMECLIP constants: sizes per preset, stroke ratio, shadow,
                emphasis scale 1.35, italic flag, palette — the encoding of §5.2–5.4
  segmenter.ts  segmentWords(words, opts) → CaptionSegment[]
                  · ≤4 words or ≤1.8 s per segment, break at punctuation
                  · ≥350 ms on screen (merge forward), +120 ms hang clamped
  layout.ts     layoutSegment(segment, style, frame, currentTime?) → CaptionFrameLayout
                  · wraps words into 1–2 balanced lines (≤ ~16 chars)
                  · computes block position from style.position + safe margins
                  · marks the active word (currentTime ∈ [start,end)) as emphasized
                  · returns everything in FRACTIONS of frame size (0–1), so the
                    DOM overlay multiplies by CSS pixels and the ASS generator
                    multiplies by video pixels — identical geometry
```

Text measurement is the one platform-dependent input: the engine accepts a `measure(text, style) → widthEm` function; browser passes canvas-based measurement, renderer passes a font-metrics table for the bundled font. The bundled render font and the preview font are the same family (TR-3).

## 6. API endpoints

All JSON, all typed in `types.ts`. Errors: `{ error: string }` with correct status (400/404/413/415/409/500).

| Method | Path                                   | Purpose                              | Status |
| ------ | -------------------------------------- | ------------------------------------ | ------ |
| POST   | `/api/upload`                           | Stage MP4, create project, queue STT | (current, extends) |
| GET    | `/api/projects`                         | List projects                        | planned |
| GET    | `/api/projects/:projectId`              | Project detail (video, transcript, style, jobs) | planned |
| PATCH  | `/api/projects/:projectId`              | Update style / title                 | planned |
| DELETE | `/api/projects/:projectId`              | Delete project + files               | planned |
| PUT    | `/api/projects/:projectId/transcript`   | Replace edited segments              | planned |
| POST   | `/api/projects/:projectId/render`       | Enqueue render job → `{ jobId }`     | planned |
| GET    | `/api/jobs/:jobId`                      | Job status/progress                  | planned |
| GET    | `/api/files/:videoId?kind=source\|render` | Stream video (range support)        | planned |

## 7. Service boundaries

| Service              | Interface (owner)                    | Default adapter          | Replaceable by            |
| -------------------- | ------------------------------------ | ------------------------ | ------------------------- |
| Storage              | `lib/video/storage.ts`               | Local disk `.uploads/`   | S3/GCS adapter            |
| Transcription        | `lib/transcription/engine.ts`        | Local whisper-class CLI  | Hosted STT API            |
| Rendering            | `lib/video/render.ts`                | ffmpeg + libass subprocess | Remote render farm      |
| Project persistence  | `lib/projects/store.ts`              | JSON files `.data/`      | SQLite/Postgres           |
| Job queue            | `lib/jobs/runner.ts`                 | In-process queue         | BullMQ/queue service      |

Boundary rule: components and route handlers import **services**; services import **interfaces**; only adapter files import SDKs/binaries/paths.

## 8. TypeScript interfaces

Canonical home: `src/lib/video/types.ts` (domain) plus per-service interface files. Existing types (`UploadedVideo`, `CaptionSegment`, `CaptionStyle`, `RenderJob*`, `UploadResponse`) remain; the planned additions:

```ts
// ── Media ────────────────────────────────────────────────
interface VideoMetadata {
  durationSeconds: number;
  width: number;
  height: number;
  frameRate: number;          // e.g. 29.97
  hasAudio: boolean;
}

// ── Transcript ───────────────────────────────────────────
interface TranscriptWord {
  word: string;
  startSeconds: number;
  endSeconds: number;
  confidence?: number;        // 0–1 from the STT engine
}
interface Transcript {
  language: string;           // BCP-47
  words: TranscriptWord[];    // immutable raw STT output
}

// CaptionSegment (existing) gains word-level detail:
interface CaptionWord extends TranscriptWord {
  emphasized?: boolean;       // manual override of karaoke emphasis
}
// CaptionSegment.text stays derived: words.map(w => w.word).join(" ")

// ── Style (§5) ───────────────────────────────────────────
type SizePreset = "sm" | "md" | "lg";
type HighlightColor = "#FACC15" | "#4ADE80" | "#F87171" | "#60A5FA";
// CaptionStyle (existing) is narrowed to the §5.6 surface:
//   { position; highlightColor: HighlightColor; sizePreset: SizePreset }

// ── Engine output ────────────────────────────────────────
interface LaidOutWord {
  text: string;
  emphasized: boolean;        // active (karaoke) or manual
  // fractions of frame dimensions, 0–1:
  x: number; y: number; fontSize: number; italic: boolean; color: string;
}
interface CaptionFrameLayout {
  segmentId: string;
  lines: LaidOutWord[][];
  blockX: number; blockY: number;   // anchor, fractions
}

// ── Projects & jobs ──────────────────────────────────────
interface Project {
  id: string;
  title: string;
  video: UploadedVideo;
  metadata: VideoMetadata;
  transcript?: Transcript;
  segments: CaptionSegment[];
  style: CaptionStyle;
  latestRender?: { jobId: string; path: string; renderedAt: string };
  createdAt: string; updatedAt: string;
}

type JobKind = "transcription" | "render";
interface Job {                       // generalizes existing RenderJob
  id: string; kind: JobKind; projectId: string;
  status: "queued" | "running" | "completed" | "failed";
  progress: number;                   // 0–100
  error?: string;
  createdAt: string; updatedAt: string;
}

// ── Service interfaces ───────────────────────────────────
interface TranscriptionEngine {
  transcribe(audioPath: string, onProgress: (pct: number) => void): Promise<Transcript>;
}
interface RenderEngine {
  render(input: { videoPath: string; metadata: VideoMetadata;
                  segments: CaptionSegment[]; style: CaptionStyle },
         onProgress: (pct: number) => void): Promise<{ outputPath: string }>;
}
interface ProjectStore {
  create(p: Project): Promise<void>;
  get(id: string): Promise<Project | null>;
  update(id: string, patch: Partial<Project>): Promise<Project>;
  list(): Promise<Project[]>;
  delete(id: string): Promise<void>;
}
interface JobStore { /* create/get/update(list by project) — same shape */ }
```

Migration note: today's `RenderJob` (with embedded segments/style) is superseded by `Job` + `Project` — segments and style belong to the project, jobs reference it. This keeps job records small and edits render-independent.
