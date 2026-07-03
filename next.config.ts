import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Binary-shipping packages resolve their platform build at runtime via
  // dynamic require; they must stay external to the server bundle.
  serverExternalPackages: [
    "@ffmpeg-installer/ffmpeg",
    "@ffprobe-installer/ffprobe",
    "@remotion/bundler",
    "@remotion/renderer",
  ],
};

export default nextConfig;
