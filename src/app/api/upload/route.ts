import { NextResponse } from "next/server";

import {
  formatBytes,
  isAcceptedVideoType,
  MAX_UPLOAD_BYTES,
} from "@/lib/video/constants";
import {
  generateVideoId,
  saveVideoStream,
  toUploadedVideo,
} from "@/lib/video/storage";
import type { UploadErrorResponse, UploadResponse } from "@/lib/video/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json<UploadErrorResponse>(
      { error: "Expected multipart/form-data with a \"file\" field." },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json<UploadErrorResponse>(
      { error: "Missing \"file\" field in form data." },
      { status: 400 }
    );
  }

  if (!isAcceptedVideoType(file.type)) {
    return NextResponse.json<UploadErrorResponse>(
      { error: "Only MP4 videos are supported right now." },
      { status: 415 }
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json<UploadErrorResponse>(
      {
        error: `File is too large (${formatBytes(file.size)}). The limit is ${formatBytes(MAX_UPLOAD_BYTES)}.`,
      },
      { status: 413 }
    );
  }

  const id = generateVideoId();
  const sizeBytes = await saveVideoStream(id, file.stream());

  return NextResponse.json<UploadResponse>(
    {
      video: toUploadedVideo({
        id,
        originalName: file.name,
        mimeType: file.type,
        sizeBytes,
      }),
    },
    { status: 201 }
  );
}
