import type { Metadata } from "next";

import { VideoPreview } from "@/components/preview/video-preview";

export const metadata: Metadata = {
  title: "Preview",
  description:
    "Preview PrimeClip-style captions rendered over your video with Remotion.",
};

export default function PreviewPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Preview captions
        </h1>
        <p className="mt-3 text-muted-foreground">
          Select a local MP4 and watch the PrimeClip caption style rendered
          over it in real time.
        </p>
      </div>
      <VideoPreview />
    </section>
  );
}
