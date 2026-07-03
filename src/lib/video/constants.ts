/** Upload constraints shared by the client dropzone and the upload API route. */
export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024; // 500 MB

export const ACCEPTED_VIDEO_MIME_TYPES = ["video/mp4"] as const;

export const ACCEPTED_VIDEO_EXTENSIONS = [".mp4"] as const;

/** Directory (relative to the project root) where raw uploads are staged. */
export const UPLOAD_DIR = ".uploads";

export function isAcceptedVideoType(mimeType: string): boolean {
  return (ACCEPTED_VIDEO_MIME_TYPES as readonly string[]).includes(mimeType);
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
