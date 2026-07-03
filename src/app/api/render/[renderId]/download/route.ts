import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

import { NextResponse } from "next/server";

import { getRender } from "@/lib/rendering";
import type { UploadErrorResponse } from "@/lib/video/types";

export const runtime = "nodejs";

function errorJson(message: string, status: number) {
  return NextResponse.json<UploadErrorResponse>({ error: message }, { status });
}

/** Download a completed export. Files expire with the render's TTL. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ renderId: string }> }
) {
  const { renderId } = await params;
  const entry = getRender(renderId);
  if (!entry) {
    return errorJson("This export no longer exists. Start a new one.", 404);
  }
  const { job } = entry;
  if (job.status === "failed") {
    return errorJson(job.error ?? "This export failed.", 409);
  }
  if (job.status !== "completed" || !job.outputPath) {
    return errorJson("This export is not finished yet.", 409);
  }

  let size: number;
  try {
    ({ size } = await stat(job.outputPath));
  } catch {
    return errorJson("This export's file has expired. Start a new one.", 410);
  }

  const stream = Readable.toWeb(
    createReadStream(job.outputPath)
  ) as ReadableStream;
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(size),
      "Content-Disposition": 'attachment; filename="captionforge-export.mp4"',
      "Cache-Control": "no-store",
    },
  });
}
