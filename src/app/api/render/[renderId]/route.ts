import { NextResponse } from "next/server";

import { getRender } from "@/lib/rendering";
import type {
  RenderStatusResponse,
  UploadErrorResponse,
} from "@/lib/video/types";

export const runtime = "nodejs";

/** Poll a render's status and progress. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ renderId: string }> }
) {
  const { renderId } = await params;
  const entry = getRender(renderId);
  if (!entry) {
    return NextResponse.json<UploadErrorResponse>(
      { error: "This export no longer exists. Start a new one." },
      { status: 404 }
    );
  }
  const { job } = entry;
  return NextResponse.json<RenderStatusResponse>({
    renderId: job.id,
    status: job.status,
    progress: job.progress,
    ...(job.error ? { error: job.error } : {}),
  });
}
