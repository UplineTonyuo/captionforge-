# CaptionForge — Task Breakdown

> Milestones in dependency order. Every task is independently testable and lists its acceptance criteria (AC). FR/TR references point to [PROJECT_SPEC.md](./PROJECT_SPEC.md); module paths to [ARCHITECTURE.md](./ARCHITECTURE.md).
>
> Status: `[x]` done · `[ ]` open. Update this file in the same PR that completes a task.

## Milestone 0 — Foundation ✅ (complete)

- [x] **0.1 Project scaffold** — Next.js (App Router) + TypeScript strict + Tailwind v4 + shadcn/ui primitives; lint/build green.
- [x] **0.2 Landing page** (`/`) — hero, features, how-it-works, CTA to `/upload`.
- [x] **0.3 Upload flow** (`/upload`, `POST /api/upload`) — drag-and-drop MP4, client+server validation (type/size), XHR progress, cancel/retry, streamed staging to `.uploads/` (FR-1 partial, FR-10).
- [x] **0.4 Domain seam** — `lib/video/{constants,types,storage,render}.ts` with documented interfaces.
- [x] **0.5 Remotion caption preview** — Remotion + `@remotion/player` integrated; `/preview` page renders a locally selected MP4 with the PrimeClip caption overlay (`CaptionRenderer`) driven by a static demo word-timing track. Decision: Remotion replaces the ffmpeg+ASS render strategy (see ARCHITECTURE.md §5.3 note); the `RenderEngine` seam is unchanged.

## Milestone 1 — Test harness & persistence

> Everything after this ships with tests; set up the harness first.

- [x] **1.1 Test harness** (TR-10)
  - Vitest wired up (`npm test`, `vitest.config.ts` with `@/` alias); caption engine modules covered. RTL to be added with the first component-logic test.
  - **AC**: `npm test` runs headless and green in CI-like conditions (`npm ci && npm test`); a failing assertion fails the command.

- [x] **1.2 ffprobe metadata** — `lib/video/probe.ts` (TR-1)
  - Extract media metadata (`ProbedMedia`: duration, width, height, frameRate, hasAudio, hasVideo) from a staged MP4 via ffprobe; the only module allowed to invoke the ffprobe binary. Already consumed by the render adapter.
  - **AC**: ✔ typed `UnreadableMediaError` on unreadable/durationless input; exercised end-to-end by the transcription and render integration tests (which generate fixtures at test time). A dedicated ≤1 MB checked-in-fixture unit test can be added when a fixture lands.

- [x] **1.3 Project store** — `lib/projects/store.ts` + `service.ts` (FR-2, TR-7)
  - `ProjectStore` interface; JSON-file adapter under `.data/projects/` with unique-temp write then atomic rename; CRUD + list (newest-first). `service.ts` holds the `newProject` factory (server ids/timestamps, default style, title from filename). Path-traversal guard on ids (TR-9). `.data/`, `.renders/`, `*.tmp` gitignored.
  - **AC**: ✔ `store.test.ts` covers create/get/update/list/delete, identity-field protection on update, `ProjectNotFoundError`, idempotent delete, the id guard, and a simulated crash (orphan `.tmp`) leaving the committed record readable.

- [ ] **1.4 Upload creates a project** (FR-2)
  - Extend upload service: stage → probe → `projects.create` → respond `201 { video, projectId }` (additive to `UploadResponse`).
  - **AC**: integration test: POST fixture MP4 → response has `projectId`; `GET` on the store returns the project with correct `VideoMetadata`; invalid uploads (415/413) create no project and no orphan file.

- [ ] **1.5 Job store + runner** — `lib/jobs/` (FR-9, TR-7)
  - `Job` type, `JobStore` (JSON adapter), in-process `runner.ts` with concurrency 1 per kind, progress callbacks, retry API; `running` jobs reset to retryable `failed` on boot.
  - **AC**: unit tests: enqueue → runs → `completed` with monotonically increasing progress; thrown handler error → `failed` with message; boot-recovery test passes.

- [ ] **1.6 Job & project read APIs** — `GET /api/jobs/:jobId`, `GET /api/projects/:projectId`, `GET /api/projects` (FR-9)
  - Thin handlers over the stores; 404 on unknown ids.
  - **AC**: integration tests for 200 shape (matches `Job`/`Project` types) and 404; no store internals leak (absolute paths redacted).

## Milestone 2 — Transcription

- [x] **2.1 Audio extraction** — ffmpeg → 16 kHz mono WAV (§5.2 pipeline)
  - `lib/transcription/audio.ts`: `extractAudio(videoPath)` in a temp dir with cleanup; ffmpeg/ffprobe binaries ship via npm (`@ffmpeg-installer`, `@ffprobe-installer`); `lib/video/probe.ts` detects missing audio.
  - **AC**: ✔ integration tests generate fixtures at test time, assert 16 kHz/mono/pcm_s16le via ffprobe, `NoAudioError` on silent video, temp cleanup.

- [x] **2.2 TranscriptionEngine interface + fake** (TR-2)
  - `engine.ts` interface; `fake-engine.ts` deterministic, paced to real audio duration; selected via `CAPTIONFORGE_STT_ENGINE=fake`.
  - **AC**: ✔ fake engine drives the full pipeline in tests (and e2e) without network or models.

- [x] **2.3 Real STT adapter** (FR-3)
  - **Decision: OpenAI Whisper API** (`whisper-1`, verbose_json, word granularity) in `whisper-openai.ts`; needs `OPENAI_API_KEY`. Engine factory in `service.ts`; future Deepgram/AssemblyAI = one new adapter file.
  - **AC**: ✔ automated tests cover response→`Transcript` mapping, empty/HTTP/network failure paths. ⚠ The manual 30 s accuracy protocol still needs a run with a live API key.

- [x] **2.4 Segmenter** — `lib/captions/segmenter.ts` (FR-4, §5.5)
  - Words → `CaptionSegment[]`: ≤4 words / ≤1.8 s, punctuation breaks, ≥350 ms min (merge forward; overrides word cap per spec), +120 ms hang clamped to next start, no overlaps.
  - **AC**: ✔ table-driven unit tests per rule + coverage/no-overlap invariants.

- [~] **2.5 Transcription wiring** (FR-3) — *synchronous MVP form shipped; job form pending M1*
  - Shipped: `POST /api/transcribe` (upload → extract → engine → segmenter → segments, nothing persisted, temp always cleaned); preview page auto-transcribes with upload progress / transcribing / ready / error+retry states; typed errors mapped to 415/413/422/502/503.
  - Remaining (blocked on M1 job/project stores): job-based processing with polled status and idempotent retry over persisted projects.

## Milestone 3 — Caption engine (shared layout)

- [x] **3.1 Style constants** — `lib/captions/style.ts` (§5.2–5.4)
  - Encode PrimeClip constants: size presets (4.0/5.5/7.0 %), stroke ratio, shadow, emphasis scale 1.35, italic emphasis, palette, safe margins.
  - **AC**: unit tests pin every constant to the spec table values (a spec change must touch this test). ✔ `style.test.ts`; timing helpers (`timing.ts`) landed alongside with tests.

- [ ] **3.2 Layout engine** — `lib/captions/layout.ts` (TR-3, FR-6)
  - `layoutSegment(segment, style, frame, currentTime?, measure)` → `CaptionFrameLayout` in frame fractions; 1–2 balanced lines, ≤ ~16 chars/line, word-boundary wrap, safe margins, active/manual emphasis marking.
  - **AC**: unit tests with a stub `measure`: line-break balancing, margin clamping at all three positions, emphasis flips exactly at word boundaries (`t = start` on, `t = end` off); pure-function property: same inputs → identical output (no Date/random).

- [ ] **3.3 Isomorphism guard**
  - Lint/CI check that `lib/captions/` imports no Node built-ins or React.
  - **AC**: adding `import fs from "node:fs"` to any engine file fails `npm run lint`.

## Milestone 4 — Editor UI

- [ ] **4.1 Editor route + data loading** — `/projects/[projectId]` (FR-2)
  - RSC page loads project; renders `EditorShell` with player/transcript/style panels (empty transcript state if job still running, with live job status).
  - **AC**: e2e-ish test (Playwright): visiting a seeded project renders title and video element; unknown id → 404 page.

- [ ] **4.2 Video player + caption overlay** (FR-6)
  - `VideoPlayer` streams `GET /api/files/:videoId` (range support required — implement the files route here); `CaptionOverlay` renders `layoutSegment` output as absolutely-positioned DOM at `use-playback-time` resolution.
  - **AC**: Playwright: with a seeded transcript, the expected caption text is visible at a known timestamp and absent at another; overlay geometry (relative x/y) matches `layoutSegment` output for that frame; video seeks work (range requests observed).

- [ ] **4.3 Transcript editing** (FR-4)
  - `TranscriptPanel`/`SegmentRow`: edit text, split/merge segments, toggle word emphasis; `PUT /api/projects/:id/transcript` persists; optimistic UI with rollback on error.
  - **AC**: integration tests on the PUT route (validation: overlapping/negative times → 400); Playwright: edit a word → reload → edit persisted; split and merge maintain §5.5 invariants (validated server-side).

- [ ] **4.4 Style panel** (FR-5)
  - Controls for exactly position / highlight color / size preset; `PATCH /api/projects/:id`; preview updates < 100 ms (state-local, persistence async).
  - **AC**: Playwright: change highlight color → active word color changes without reload; PATCH rejects out-of-palette color with 400 (typed union enforced at runtime via validation).

## Milestone 5 — Rendering

> **Decision (Remotion):** server-side rendering will use `@remotion/renderer` with the registered `CaptionedVideo` composition (`src/remotion/root.tsx`) instead of an ASS generator + raw ffmpeg. Task 5.1 is superseded; 5.2 becomes a Remotion render adapter behind the same `RenderEngine` interface. Re-scope 5.1/5.2 acceptance criteria when starting M5.

- [ ] **5.1 ASS generator** — consumes engine layout (§5 fidelity)
  - Compile `CaptionSegment[]` + `CaptionStyle` + `VideoMetadata` into an ASS document: one dialogue event per word-emphasis window, libass styles matching `style.ts` (weight, stroke, shadow, italic 1.35× emphasis), times snapped to frame rate.
  - **AC**: unit tests: generated ASS parses (round-trip with an ASS parser or strict snapshot), event times match segment/word times to the frame, emphasis events carry italic + highlight color + scaled size; golden-file snapshot reviewed against §5.

- [x] **5.2 Remotion render adapter** — `lib/rendering/{bundle,renderer}.ts` (FR-7, TR-7)
  - `@remotion/renderer` burns the `CaptionedVideo` composition (same `CaptionRenderer`) at source resolution/fps; h264 + audio; process-cached webpack bundle; input staged into the bundle's public dir and removed after; Geist loaded from `public/fonts` so preview and render share the font. Browser via `CAPTIONFORGE_BROWSER_EXECUTABLE` (falls back to Remotion's headless shell download).
  - **AC**: ✔ integration test (generated fixture + 2 segments): output exists, matches source geometry/duration, increasing progress, staged input cleaned. (Runs when a browser executable is configured.)

- [~] **5.3 Render API** (FR-7, FR-8, FR-9) — *no-persistence MVP shipped; project-based form pending M1*
  - Shipped: `POST /api/render` (multipart video + validated segments/style → 202 renderId), `GET /api/render/:id` (status/progress), `GET /api/render/:id/download` (streamed MP4, 409 while running, 410 after file expiry); in-memory registry with 30-min TTL reclaiming temp dirs; renders serialized one at a time.
  - Remaining (blocked on M1): durable jobs over persisted projects, per-project concurrency guard, `latestRender` bookkeeping.

- [x] **5.4 Export panel UI** (FR-8)
  - In the preview flow (editor arrives with M4): Export button when captions are ready, upload progress → render progress via polling, download link on completion, readable error + retry.
  - **AC**: ✔ verified with Playwright end-to-end (fake STT engine + real Remotion render): export → progress → download link streams a valid MP4 with burned-in captions matching the preview.

## Milestone 6 — Hardening

- [ ] **6.1 Project deletion & disk hygiene** — `DELETE /api/projects/:id` removes record + source + renders + orphaned temp files; startup sweep for `.tmp` older than 24 h.
  - **AC**: integration test: after delete, all paths gone, job records for the project marked orphaned/removed; sweep test removes stale temp files only.
- [ ] **6.2 Input validation pass** — runtime validation (e.g. zod) on every mutating route body/params, mapped to 400 with field messages (TR-9).
  - **AC**: fuzz-ish tests per route: wrong types, path traversal attempts in ids, oversized bodies → 4xx, never 500.
- [ ] **6.3 Observability** — structured logs (project/job ids) around job lifecycle and API errors (TR-8).
  - **AC**: log-capture test: a failed render logs kind, jobId, projectId, error once at `error` level.
- [ ] **6.4 Accessibility & performance audit** — Lighthouse a11y ≥ 95 on `/`, `/upload`, editor; keyboard-only walkthrough of the full flow (spec §6).
  - **AC**: recorded audit results checked into the PR; every interactive editor control reachable and operable by keyboard.

## Milestone 7 — Release readiness

- [ ] **7.1 WYSIWYG fidelity check** (Success criterion "Fidelity")
  - Protocol: render 3 fixture projects (each position × size preset mix); capture render frames at 5 timestamps each; overlay-compare against preview screenshots at identical timestamps.
  - **AC**: caption block position within 1% of frame dimensions, line breaks identical, emphasis word identical, in 15/15 comparisons; protocol + results committed under `docs/fidelity/`.
- [ ] **7.2 Timing accuracy check** (Success criterion "Timing")
  - **AC**: on the fixture set, ≥95% of emphasis transitions within ±100 ms of STT word times (scripted check against render at known frames).
- [ ] **7.3 Crash-safety drill** (Success criterion "Robustness")
  - **AC**: scripted kill during transcription and during render → restart → project intact, job retryable, retry completes.
- [ ] **7.4 Docs sync** — README, this file, and ARCHITECTURE "(current)" markers updated to reality.
  - **AC**: no "(planned)" marker on shipped modules; fresh-clone `npm install && npm run dev` instructions verified.

## Dependency graph

```
M0 ──▶ 1.1 ──▶ 1.2 ──▶ 1.3 ──▶ 1.4 ──▶ 1.5 ──▶ 1.6
                                          │
              2.1 ◀───────────────────────┤
              2.2 ──▶ 2.3 (parallel: 2.4) │
              2.1+2.2+2.4 ──▶ 2.5         │
                                          │
              3.1 ──▶ 3.2 ──▶ 3.3   (needs only M1 types; parallel to M2)
                                          │
        M2 + M3 ──▶ 4.1 ──▶ 4.2 ──▶ 4.3 ──▶ 4.4
        M3 ──▶ 5.1 ──▶ 5.2 ──▶ 5.3 ──▶ 5.4   (5.1–5.2 parallel to M4)
        M4 + M5 ──▶ M6 ──▶ M7
```
