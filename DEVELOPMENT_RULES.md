# CaptionForge — Development Rules

> Binding conventions for all contributors (human or AI). If a rule here conflicts with personal preference, the rule wins; if a rule is wrong, change the rule in a PR first. Requirements live in [PROJECT_SPEC.md](./PROJECT_SPEC.md), structure in [ARCHITECTURE.md](./ARCHITECTURE.md), work items in [TASKS.md](./TASKS.md).

## 1. Coding standards

### TypeScript

- `strict` mode stays on. Never weaken `tsconfig.json`.
- **No `any` at module boundaries** (exported functions, API payloads, props). Internal `unknown` + narrowing is fine; `any` needs a comment justifying it and should be rare enough to count on one hand.
- Model state as **discriminated unions**, not boolean soups (`UploadState` in `video-dropzone.tsx` is the house pattern).
- Prefer `interface` for object shapes, `type` for unions/utilities. Use `as const` for fixed catalogs (accepted MIME types, palettes).
- All cross-boundary shapes live in `src/lib/video/types.ts` or the owning service's interface file — never re-declared locally.
- No non-null assertions (`!`) except immediately after an explicit check the compiler can't see; prefer restructuring.
- Times are **seconds as float**, sizes are **bytes as number**, timestamps are **ISO-8601 strings** — everywhere, no exceptions, no mixed units.

### React / Next.js

- Server Components by default; add `"use client"` only at interactive leaves. A file with `"use client"` should be as small as its interactivity allows.
- Route handlers are thin: validate → call service → map to response. Business logic in `app/` is a review blocker.
- Anything touching disk, ffmpeg, or child processes declares `export const runtime = "nodejs"`.
- No layout math, styling constants, or timing rules in components — that belongs to `lib/captions/` (the WYSIWYG guarantee depends on this).
- Clean up effects: abort in-flight requests on unmount (see the dropzone's `requestRef` pattern).

### Styling

- Tailwind utilities with **semantic theme tokens** (`bg-background`, `text-muted-foreground`, `border-destructive/50`) — never raw palette classes like `bg-neutral-100` or hex values in components, so dark mode stays free.
- Compose conditional classes with `cn()` from `src/lib/utils.ts`.
- New primitives go through shadcn/ui conventions under `src/components/ui/`; product components never fork a primitive's internals.
- The one sanctioned exception to "no hex in code": `lib/captions/style.ts`, which encodes the §5 caption spec.

### Comments & docs

- Comments state **constraints the code can't express** ("id is a server UUID, safe as filename"), not narration of the next line.
- Every `lib/` module gets a top-of-file doc comment saying what it owns and where its boundary is (see `storage.ts`, `render.ts`).
- Public functions with non-obvious contracts get JSDoc on params/units.

## 2. Naming conventions

| Thing                    | Convention                  | Example                              |
| ------------------------ | --------------------------- | ------------------------------------ |
| Files (components)       | kebab-case                  | `video-dropzone.tsx`, `style-panel.tsx` |
| Files (lib modules)      | kebab-case                  | `ffmpeg-renderer.ts`                 |
| React components         | PascalCase, named exports   | `VideoDropzone`                      |
| Hooks                    | `use-` file / `use` camelCase | `use-job.ts` → `useJob()`          |
| Types/interfaces         | PascalCase, no `I` prefix   | `CaptionSegment`, `RenderEngine`     |
| Constants                | SCREAMING_SNAKE for module constants | `MAX_UPLOAD_BYTES`            |
| Functions                | camelCase verb-first        | `saveVideoStream`, `layoutSegment`   |
| API routes               | plural resources, nested by ownership | `/api/projects/:projectId/render` |
| Route params             | camelCase in code, `[projectId]` in paths | —                          |
| Booleans                 | `is/has/should` prefix      | `isAcceptedVideoType`                |
| Units in names when ambiguous | suffix the unit        | `startSeconds`, `sizeBytes`, `fontSizePx` |
| Branches                 | `type/short-description`    | `feat/render-progress`, `fix/segment-overlap` |
| Env vars                 | `CAPTIONFORGE_` prefix      | `CAPTIONFORGE_STT_ENGINE=fake`       |

## 3. Project conventions

- **Layer rules** (import direction, enforced in review):
  - `app/` → `components/`, `hooks/`, `lib/` ✓
  - `components/` → `hooks/`, `lib/` ✓ (never disk/subprocess/Node built-ins)
  - `lib/` → `lib/` ✓ (never React, never `app/` or `components/`)
  - `lib/captions/` → **nothing platform-specific** (no Node built-ins, no DOM) — it must run in both browser and Node.
- **Adapters own the outside world.** Only adapter files (`local-whisper.ts`, `ffmpeg-renderer.ts`, `storage.ts`, stores) may import SDKs, spawn processes, or build filesystem paths. Services import interfaces.
- **Server-generated ids everywhere.** Client-supplied names never become paths (TR-9). All ids are `crypto.randomUUID()`.
- **Additive API evolution.** Extending a response type is fine; renaming/removing fields requires updating every consumer in the same PR.
- **Generated/staged data stays out of git**: `.uploads/`, `.renders/`, `.data/`, `*.tmp` are gitignored. Test fixtures are the exception — small (≤1 MB), under `src/**/__fixtures__/` or `tests/fixtures/`.
- **Spec is law.** Caption visuals/timing changes start with a PROJECT_SPEC.md §5 edit, then `lib/captions/style.ts`, then the pinned tests — in that order, in one PR.
- **Docs stay true.** A PR that changes structure updates ARCHITECTURE.md markers; a PR that finishes a task checks it off in TASKS.md.

## 4. Performance goals

- Upload page interactive < 2 s on broadband; landing page Lighthouse performance ≥ 90.
- Preview overlay work per frame < 4 ms (rAF budget): `layoutSegment` must stay pure and allocation-light; memoize per (segment, style, frame, activeWord) — recompute only when the active word changes, not per tick.
- Style changes reflect in preview < 100 ms (FR-5): apply locally first, persist async.
- Job status polling: 1 s → 3 s backoff, stop on terminal states; never poll invisible pages.
- Server: never buffer whole videos in memory (stream uploads, stream file responses with range support); transcription ≤ ~1× and render ≤ ~2× video duration on the reference machine (TR-6).
- Bundle discipline: the editor loads no rendering/ffmpeg code; `lib/captions` is the only shared heavy logic and must stay dependency-free.

## 5. Testing strategy

Framework: **Vitest** (+ React Testing Library for components, Playwright for flows) — set up in task 1.1.

| Layer                | What                                            | Style |
| -------------------- | ----------------------------------------------- | ----- |
| Pure logic (`lib/captions`, stores, validators) | Exhaustive unit tests, table-driven for spec rules; property tests for invariants (no overlapping segments, every word covered) | Fast, no I/O |
| Adapters (ffmpeg, ffprobe, STT)   | Integration tests against ≤1 MB checked-in fixtures; typed-error paths tested | May shell out; skipped only if the binary is genuinely absent, and CI must have the binary |
| API routes           | Integration tests: happy path + every 4xx branch; response shape asserted against the exported types | No mocked internals — real services with fake engine/temp dirs |
| UI components        | RTL for state logic (dropzone states, panels); Playwright for the golden path (upload → edit → export with fake engines) | Few, high-value |
| Spec conformance     | `style.ts` constants pinned to §5 tables; ASS snapshot golden files; fidelity/timing protocols (TASKS M7) | Changing the spec must break a test |

Rules:

- Every task in TASKS.md lands **with** its acceptance-criteria tests in the same PR. No "tests later".
- Bug fixes start with a failing test reproducing the bug.
- Fake adapters (`fake-engine.ts`, in-memory stores) are production-quality code: typed, deterministic, selected via `CAPTIONFORGE_*` env — never `if (process.env.NODE_ENV === "test")` branches in real code paths.
- Tests must not depend on wall-clock time, network, or execution order; temp dirs per test, cleaned in `afterEach`.
- Target: `lib/` logic ≥ 90% branch coverage; no coverage theater on UI — cover states, not markup.

## 6. Git workflow

- **Branches**: `main` is always releasable (lint + type-check + tests green). Work happens on `type/short-description` branches (`feat/`, `fix/`, `chore/`, `docs/`, `refactor/`).
- **Commits**: imperative mood, ≤72-char subject, body explains *why* when non-obvious. One logical change per commit; scaffolding and behavior changes in separate commits when practical.
  - Format: `<area>: <what>` when it helps, e.g. `captions: clamp hang time to next segment start`.
- **PRs**: small, one task (or coherent slice of one) per PR; description links the TASKS.md item and states how the AC were verified (paste test output for manual protocols). Checking off the task in TASKS.md is part of the PR.
- **Reviews**: every PR reviewed before merge. Review blockers: business logic in `app/`, layer-rule violations, `any` at boundaries, missing AC tests, spec-affecting changes without a spec edit.
- **Merges**: squash-merge to keep `main` linear; the squash message follows the commit format above.
- **Never**: force-push `main`; commit `.uploads/`, `.renders/`, `.data/`, secrets, or `.env*`; merge with red checks; reuse a merged branch for new work.

## 7. Definition of Done (any change)

1. Acceptance criteria from TASKS.md met, with tests proving it.
2. `npm run lint`, type-check, and `npm test` green locally.
3. New/changed cross-boundary types exported from the canonical location; no duplicated shapes.
4. Docs updated (TASKS checkbox, ARCHITECTURE markers, spec if behavior-visible).
5. Manual smoke of the touched flow in the running app (upload a real file, play the preview, etc.) — automated tests don't excuse never running the product.
