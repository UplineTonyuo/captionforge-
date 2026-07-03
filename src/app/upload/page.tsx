import type { Metadata } from "next";

import { VideoDropzone } from "@/components/upload/video-dropzone";

export const metadata: Metadata = {
  title: "Upload",
  description: "Upload an MP4 video to start forging captions.",
};

export default function UploadPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Upload your video
        </h1>
        <p className="mt-3 text-muted-foreground">
          Drop an MP4 below. Once it&apos;s uploaded, it&apos;s staged and
          ready for captioning.
        </p>
      </div>
      <VideoDropzone />
    </section>
  );
}
