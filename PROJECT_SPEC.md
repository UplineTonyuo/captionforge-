# CaptionForge — Project Specification

> Single source of truth for what CaptionForge is, who it serves, and what "done" means.
> Companion documents: [ARCHITECTURE.md](./ARCHITECTURE.md), [TASKS.md](./TASKS.md), [DEVELOPMENT_RULES.md](./DEVELOPMENT_RULES.md).

## 1. Product vision

CaptionForge turns raw talking-head and short-form videos into publish-ready clips with bold, word-timed, burned-in captions — the "PrimeClip" style that dominates TikTok, Reels, and Shorts. A creator uploads an MP4, gets an automatic transcript with word-level timestamps, tweaks the text and style, and exports a rendered video with captions baked in. No timeline editor, no subtitle files to babysit, no desktop software.

The product wins on three things:

1. **Speed to publish** — upload → styled captions → export in minutes.
2. **Caption quality** — timing accuracy and a visual style that actually drives retention.
3. **Zero learning curve** — one opinionated style system with a few knobs, not an editor with a thousand.

## 2. Goals

- Accept MP4 uploads up to 500 MB with a resilient, progress-reporting upload flow.
- Produce word-level-timed transcripts automatically (speech-to-text), editable by the user.
- Render captions in the PrimeClip style (§5) burned into the output video, server-side.
- Deliver a caption editor that previews the exact style the render will produce (WYSIWYG parity between the browser preview and the ffmpeg render).
- Keep every pipeline stage (upload → transcribe → edit → render → download) independently retryable and observable via job status.
- Ship as a deployable Next.js application with clear service seams so storage, transcription, and rendering backends can be swapped without touching product code.

## 3. Non-goals

These are deliberate exclusions. Do not build them without revising this spec first:

- **Not a general video editor.** No trimming, cutting, transitions, b-roll, or multi-track timelines.
- **No subtitle-file-first workflow.** SRT/VTT import/export may come later (roadmap), but the primary artifact is the burned-in render.
- **No multi-language translation** in v1. Transcription targets the spoken language only.
- **No team/collaboration features** (shared workspaces, comments, roles) in v1.
- **No mobile native apps.** Responsive web only.
- **No user-generated caption style marketplace.** One style system with parameterized options.
- **No live/streaming captioning.** Uploaded files only.

## 4. User flow

```
Landing (/)                Upload (/upload)             Editor (/projects/[id])            Export
    │                          │                              │                               │
    │  "Upload a video" CTA    │  drag & drop MP4             │  transcript ready             │
    ├─────────────────────────▶│  client-side validation      │  edit text / timing           │
    │                          │  progress bar (XHR)          │  pick style options           │
    │                          │  POST /api/upload            │  live preview on video        │
    │                          ├─────────────────────────────▶│  "Export" → render job        │
    │                          │  201 → project created,      ├──────────────────────────────▶│
    │                          │  transcription job queued    │  progress: queued →           │
    │                          │                              │  transcribing → rendering     │
    │                          │                              │            → completed        │
    │                          │                              │  download MP4                 │
```

Step by step:

1. **Land** — user reaches the landing page, understands the value proposition in one screen, clicks "Upload a video".
2. **Upload** — user drops an MP4. The client validates type/size, uploads with a progress bar, and can cancel/retry. On success the file is staged and a project is created.
3. **Transcribe** — a transcription job runs automatically after upload. The user sees job status; on completion the transcript (word-level timestamps) is attached to the project.
4. **Edit** — user corrects transcript text, merges/splits caption segments, and adjusts style options (position, highlight color, size preset). A preview overlays captions on the video element with the exact render style.
5. **Export** — user starts a render job. Status is polled until `completed`, then the burned-in MP4 is downloadable.
6. **Return** — projects persist; the user can come back, re-edit, and re-render.

Failure paths: every stage surfaces a human-readable error and a retry affordance; a failed transcription or render never destroys the uploaded source or the edited transcript.

## 5. Caption style specification ("PrimeClip" style)

This is the reference style, matching the attached PrimeClip sample frame. The renderer and the browser preview MUST both implement this spec exactly; the spec is the contract between them.

### 5.1 Layout

| Property            | Value                                                             |
| ------------------- | ----------------------------------------------------------------- |
| Position            | Bottom-center (default), lower third of frame; `top`/`center` as options |
| Horizontal align    | Centered                                                          |
| Safe margins        | ≥ 8% of frame height from bottom edge; ≥ 6% of frame width left/right |
| Block structure     | **Inline**: the segment's words flow in reading order and wrap onto 2–3-word lines; the highlighted (spoken) word stays **in place within the sentence**, distinguished by colour, not by isolation |
| Word reveal         | The whole segment is present; each word is **dimmed** until its own start time, then reveals in place (§5.3.1) |
| Words per line      | 2–3 words per line (target ~18 chars/line); never overflow safe area |
| Wrapping            | Break on word boundaries only; balance line lengths               |
| Line spacing        | Tight: ~1.02 line-height                                          |

### 5.2 Word typography

All caption text is **Inter 800, italic**, one size — the emphasis is **colour + depth, not scale**, so the line never reflows as the highlight moves. Size is px on a **1080-px-tall reference frame** and scales proportionally to the rendered frame height (§5.4), so a caption looks identical at any output resolution.

| Property       | Value                                                          |
| -------------- | -------------------------------------------------------------- |
| Font           | **Inter**, weight **800**, **italic** (Geist / system sans fallback) |
| Size           | **68px @1080** (scaled by frame height and size preset)        |
| Case           | As transcribed — never forced uppercase                        |
| Fill           | Spoken / past words `#FFFFFF`; the currently-spoken word the highlight colour (§5.3); upcoming words white at **35% opacity** (dimmed) |
| Stroke/contour | **None** — legibility comes from the depth shadow              |
| 3D depth       | **Per-character**: hard dark copies `rgba(0,0,0,0.9)` stepped **down and to the right** in 4 layers to ~5% × / ~6% ↓ of font size (rising from the bottom toward the mid-right of each glyph), then a soft `rgba(0,0,0,0.55)` shadow offset down ~8%, blur ~5%. Applied to **every** word |
| Backdrop scrim | While a caption is visible: a full-width black gradient behind the caption edge of the frame, from `rgba(0,0,0,0.45)` at the frame edge fading to transparent over 28% of frame height; follows the caption's entrance fade; flips to the top edge for `position: top`, omitted for `center` |

### 5.3 Highlight (the spoken word)

The **currently-spoken word** is the highlight (karaoke) — or a word the user manually marks. There is no separate highlight font or size; only its colour changes.

| Property   | Value                                                             |
| ---------- | ----------------------------------------------------------------- |
| Fill color | Highlight color, default `#F6FF4D` (lime); user-selectable (§5.6) |
| Selection  | The word whose `[start, end)` contains the current time (moves word-by-word as speech advances); a manually emphasized word is always highlighted |
| Placement  | **Inline**, in its natural position in the sentence (no isolation, no scaling) |

### 5.3.1 Word reveal animation

| Property        | Value                                                        |
| --------------- | ------------------------------------------------------------ |
| Dim state       | Before a word's start time it is present but dimmed (white at 35% opacity) |
| Reveal          | At its own start time a word **fades in with blur**: opacity 35%→100% and blur ~12%→0 of font size over **~250 ms**, from the word's own start time |
| Colour          | While a word is being spoken it is the highlight colour; once spoken it is white; upcoming words are dimmed white |
| Determinism     | Every value is a pure function of `t − word.start` so the browser preview and the server render are frame-identical |

### 5.4 Size presets

A single caption size, scaled by preset. `md` is the authored reference; the effective size is `(68 / 1080) × presetScale × frameHeight`.

| Preset | Scale | Use                 |
| ------ | ----- | ------------------- |
| `sm`   | 0.83  | Dense speech        |
| `md`   | 1.00  | Default             |
| `lg`   | 1.33  | Punchy short-form   |

### 5.5 Timing rules

- Caption segments are built from word timestamps: group words into segments of ≤ 6 words or ≤ 2.5 s, whichever comes first, breaking at punctuation when available.
- A segment is visible from its first word's `start` to its last word's `end` (+ 120 ms hang time, clamped to the next segment's start).
- No two segments are visible simultaneously.
- Minimum on-screen time per segment: 350 ms (merge shorter segments forward).
- All times are in seconds (float) relative to video start; the renderer must be frame-accurate at the video's native frame rate.

### 5.6 Style parameters exposed to users

Users may change only: position (`top`/`center`/`bottom`), highlight color (fixed palette), size preset (`sm`/`md`/`lg`), and per-word emphasis overrides. Everything else in §5 is fixed by the style system. This is what `CaptionStyle` in `src/lib/video/types.ts` parameterizes.

The highlight color picker (shown before export) offers **Lime `#F6FF4D`**, **Orange `#FB923C`**, and **Blue `#60A5FA`**; green `#4ADE80` and red `#F87171` remain valid palette values for backward compatibility. The selected color drives both the live preview and the exported render from the same `CaptionStyle`, so there is no preview/export divergence.

## 6. UI/UX guidelines

- **Design system**: Tailwind CSS v4 + shadcn/ui (new-york style, neutral base) as already established in `src/app/globals.css` and `src/components/ui`. New UI uses these primitives; no ad-hoc component libraries.
- **Tone**: confident, creator-oriented, minimal. Copy is short and concrete ("Upload your video", not "Get started with your media journey").
- **Layout**: max-width `6xl` content column, generous vertical rhythm, sticky header (`SiteHeader`), footer on every page.
- **States are first-class**: every async surface has explicit idle / loading / progress / success / error states (the upload dropzone's `UploadState` union is the pattern to follow).
- **Progress honesty**: show real progress when measurable (upload bytes, render %), indeterminate spinners only when not.
- **Errors** are human-readable sentences with a retry action, never raw exception text or status codes alone.
- **Accessibility**: all interactive elements keyboard-operable with visible focus (the dropzone's `role="button"` + key handlers is the floor, not the ceiling); WCAG AA contrast; `aria-hidden` on decorative icons; motion respects `prefers-reduced-motion`.
- **Responsive**: fully usable at 375 px wide; editor may degrade gracefully (stacked layout) but never lose functionality.
- **Dark mode**: theme tokens already support `.dark`; new components must use semantic tokens (`bg-background`, `text-muted-foreground`, …) so dark mode is free.

## 7. Functional requirements

FR are numbered for traceability from TASKS.md acceptance criteria.

- **FR-1 Upload**: Accept MP4 (`video/mp4`) up to 500 MB via drag-and-drop or file picker; validate on client and server; report byte-level progress; support cancel; return a durable video/project identifier.
- **FR-2 Project persistence**: Each upload creates a project record (video metadata, transcript, style, job history) that survives process restarts.
- **FR-3 Transcription**: Automatically transcribe uploaded audio to text with word-level timestamps; expose job status (`queued/transcribing/completed/failed`); allow manual retry.
- **FR-4 Segmenting**: Convert word timestamps into caption segments per §5.5 automatically; user edits (split/merge/re-time/re-text) persist.
- **FR-5 Style editing**: Expose exactly the §5.6 parameters; persist per project; changes reflect in preview immediately (< 100 ms).
- **FR-6 Preview**: Browser preview overlays captions on the playing video using the same layout math as the renderer (shared caption-engine module).
- **FR-7 Render**: Produce an H.264 MP4 at source resolution and frame rate with captions burned in per §5; expose job progress; output downloadable when complete.
- **FR-8 Download**: Completed renders are downloadable; re-rendering replaces the prior output.
- **FR-9 Job visibility**: All long-running work (transcription, render) is a job with id, status, progress 0–100, timestamps, and error message on failure.
- **FR-10 Input hygiene**: Reject non-MP4 and oversized files with 415/413 and clear messages (already implemented in `POST /api/upload`).

## 8. Technical requirements

- **TR-1 Stack**: Next.js (App Router) + TypeScript strict mode; Tailwind v4; shadcn/ui. Node.js runtime for API routes that touch disk/ffmpeg (`export const runtime = "nodejs"`).
- **TR-2 Service seams**: Storage, transcription, and rendering are each behind a single TypeScript interface with a local default implementation (local disk, local whisper-class model or hosted API, local ffmpeg). Swapping providers touches only `src/lib/*` adapters — never components or routes. (`src/lib/video/storage.ts` already models this for storage.)
- **TR-3 Shared caption engine**: Segmenting and layout logic live in one isomorphic module consumed by both the browser preview and the server renderer, so preview = render.
- **TR-4 Types as contract**: All cross-boundary payloads (API request/response, job records) are typed in `src/lib/video/types.ts` and imported by both sides; no `any` at boundaries.
- **TR-5 Streaming I/O**: Uploads and renders stream to/from disk; no whole-file buffering in memory (uploads already stream via `saveVideoStream`).
- **TR-6 Performance**: Upload page interactive < 2 s on broadband; transcription ≤ ~1× video duration; render ≤ ~2× video duration for 1080p on the reference worker; UI never blocks on jobs (poll/subscribe).
- **TR-7 Idempotent, resumable jobs**: A crashed job can be retried without corrupting project state; renders write to a temp path and move into place atomically.
- **TR-8 Observability**: Jobs and API errors are logged with project/job ids; failures carry actionable messages to the UI.
- **TR-9 Security**: Server-generated UUIDs for all file paths (never client filenames — `videoPath()` already enforces this); uploads gitignored and outside the web root; strict validation of all route params.
- **TR-10 Quality gates**: `npm run lint`, type-check, and the test suite (see DEVELOPMENT_RULES.md §Testing) pass on every commit to main.

## 9. Future roadmap

Post-v1, in rough priority order (each requires a spec revision before build):

1. **SRT/VTT export** of the edited transcript.
2. **Auto-emphasis heuristics** — pick "pop" words by loudness/keyword salience instead of just the active word.
3. **Multiple style themes** — parameterized variants (e.g., boxed background, karaoke fill) on the same engine.
4. **Accounts and cloud storage** — auth, S3/GCS storage adapter, per-user project lists.
5. **Background render queue with workers** — horizontal scaling of ffmpeg workers; webhooks on completion.
6. **Translation** — transcript translation with re-timed captions.
7. **Clip resizing** — 9:16 / 1:1 / 16:9 reframing presets at render time.
8. **Brand kits** — saved fonts/colors per user (supersedes the fixed palette).

## 10. Success criteria

v1 is successful when all of the following hold:

- **End-to-end**: A user can go from landing page to a downloaded, caption-burned MP4 without touching anything but the browser.
- **Fidelity**: Rendered captions match the browser preview frame-for-frame in layout, style, and timing (spot-check protocol in TASKS.md M7).
- **Timing accuracy**: ≥ 95% of emphasized words light up within ±100 ms of the spoken word on test fixtures.
- **Robustness**: Killing the server mid-transcription or mid-render loses no uploaded video or edited transcript; the job is retryable.
- **Quality gates**: lint, type-check, and tests green; no `any` at module boundaries; Lighthouse accessibility score ≥ 95 on landing and upload pages.
- **Spec conformance**: The §5 caption spec is implemented by exactly one shared engine module, verified by unit tests on segmenting/layout math.
