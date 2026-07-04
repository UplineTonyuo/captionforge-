# CaptionForge — single-container image for Railway (Linux/amd64).
#
# Debian (glibc) base, NOT Alpine: the @ffmpeg-installer / @ffprobe-installer
# binaries and Remotion's compositor are glibc builds. Chromium (for the
# server-side Remotion export) is installed from apt; apt resolves its shared
# libraries, so no separate lib list is needed.
#
# The whole app (including src/) ships in the image because Remotion bundles
# src/remotion at render time (getRemotionBundle). node_modules is installed
# INSIDE the container so the Linux ffmpeg/ffprobe/compositor binaries are the
# ones fetched (never copy host node_modules — see .dockerignore).

FROM node:22-bookworm-slim

# Chromium + fonts + CA certs for headless rendering. apt pulls chromium's
# own runtime libraries (libnss3, libgbm1, ...) as dependencies.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
     chromium \
     fonts-liberation \
     ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NEXT_TELEMETRY_DISABLED=1 \
    # Point the Remotion render at the apt-installed Chromium (browser.ts also
    # auto-detects /usr/bin/chromium, but set it explicitly for determinism).
    CAPTIONFORGE_BROWSER_EXECUTABLE=/usr/bin/chromium

WORKDIR /app

# Install dependencies first for layer caching. NODE_ENV is deliberately NOT
# "production" here so devDependencies (typescript, tailwind, eslint-config)
# are installed — `next build` needs them. This also fetches the Linux
# ffmpeg/ffprobe and @remotion/compositor-linux-* binaries.
COPY package.json package-lock.json ./
RUN npm ci

# App source. Remotion needs src/ at runtime; public/ holds the caption fonts.
COPY . .

# Production Next.js build (runs with devDependencies present).
RUN npm run build

# Runtime settings only — set after the build so it doesn't affect npm ci.
# Railway provides $PORT; next start reads it. Default 3000 for local runs.
ENV NODE_ENV=production \
    PORT=3000
EXPOSE 3000

CMD ["npm", "run", "start"]
