# CaptionForge

Captions that hit as hard as your content. CaptionForge is a [Next.js](https://nextjs.org) app for uploading videos and forging bold, perfectly timed captions.

## Stack

- **Next.js** (App Router) with **TypeScript**
- **Tailwind CSS v4** for styling
- **shadcn/ui** components (vendored under `src/components/ui`)
- **lucide-react** icons

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Scripts

| Command         | Description                      |
| --------------- | -------------------------------- |
| `npm run dev`   | Start the dev server             |
| `npm run build` | Production build                 |
| `npm run start` | Serve the production build       |
| `npm run lint`  | Lint with ESLint                 |

## Project structure

```
src/
  app/
    page.tsx              # Landing page
    upload/page.tsx       # Upload page (MP4 uploads)
    api/upload/route.ts   # Upload endpoint (validates + stages MP4s)
    layout.tsx            # Root layout with site header/footer
    globals.css           # Tailwind v4 + shadcn/ui theme tokens
  components/
    ui/                   # shadcn/ui primitives (button, card, ...)
    upload/               # Upload-specific components (dropzone)
    site-header.tsx
    site-footer.tsx
  lib/
    utils.ts              # cn() helper
    video/
      constants.ts        # Upload limits + accepted types (shared client/server)
      types.ts            # Domain types (UploadedVideo, CaptionSegment, RenderJob, ...)
      storage.ts          # Server-side upload staging (swap for S3/GCS later)
      render.ts           # Render pipeline seam (not implemented yet)
```

## Uploads

The upload page accepts MP4 files up to 500 MB. Files are validated on both the client and the server, then staged on local disk under `.uploads/` (gitignored). `src/lib/video/storage.ts` is the single module to change when moving to object storage.

## Transcription

The preview page (`/preview`) sends your MP4 to `POST /api/transcribe`, which extracts 16 kHz mono audio (ffmpeg via npm binaries), runs the configured speech-to-text engine, and returns word-timed caption segments rendered in the PrimeClip style.

Configure the engine via environment (see `.env.example`):

- `OPENAI_API_KEY=sk-...` — OpenAI Whisper (paid; word-level timestamps).
- `GROQ_API_KEY=gsk_...` — Groq-hosted Whisper (free tier, no card required; word-level timestamps) — get a key at console.groq.com.
- `CAPTIONFORGE_STT_ENGINE=fake` — deterministic offline engine for development and tests.

Engines live behind the `TranscriptionEngine` interface in `src/lib/transcription/`; adding Deepgram, AssemblyAI, or a local Whisper build is one new adapter file.

## Export (burned-in captions)

"Export MP4" on the preview page renders the captions into the video server-side with Remotion (`src/lib/rendering/`), using the exact same `CaptionedVideo` composition and `CaptionRenderer` component as the preview player — that is the WYSIWYG guarantee. Exports are H.264 + AAC at the source's resolution and frame rate.

- Progress is polled from `GET /api/render/:id`; completed files stream from `GET /api/render/:id/download` and expire after 30 minutes (temp dirs are reclaimed automatically).
- Rendering needs a browser: set `CAPTIONFORGE_BROWSER_EXECUTABLE` to a Chromium/Chrome binary, or let Remotion download its headless shell on first render.
- Caption text renders in Geist (vendored under `public/fonts/`, OFL-licensed) in both preview and export.

## Future: video rendering

Rendering (transcription + burning captions into the video) is intentionally stubbed out in `src/lib/video/render.ts`. The domain types in `src/lib/video/types.ts` — `CaptionSegment`, `CaptionStyle`, and `RenderJob` — define the contract the pipeline will implement, e.g. with an ffmpeg worker or a hosted rendering service.
