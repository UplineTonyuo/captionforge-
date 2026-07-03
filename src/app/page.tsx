import Link from "next/link";
import { ArrowRight, Captions, Sparkles, UploadCloud, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const features = [
  {
    icon: UploadCloud,
    title: "Upload in seconds",
    description:
      "Drag and drop your MP4 and it's staged for captioning immediately. No account hoops, no re-encoding on your end.",
  },
  {
    icon: Captions,
    title: "Captions that pop",
    description:
      "Word-level timing with bold, highlight-style captions designed for short-form video — the kind viewers actually read.",
  },
  {
    icon: Zap,
    title: "Built for rendering",
    description:
      "A render pipeline is wired into the architecture from day one, so burned-in captions are an implementation away — not a rewrite.",
  },
] as const;

const steps = [
  {
    step: "01",
    title: "Upload your video",
    description: "Drop an MP4 up to 500 MB on the upload page.",
  },
  {
    step: "02",
    title: "Forge your captions",
    description: "Timed caption segments with styles you control.",
  },
  {
    step: "03",
    title: "Render and ship",
    description: "Export with captions burned in, ready for every platform.",
  },
] as const;

export default function HomePage() {
  return (
    <>
      <section className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-24 text-center sm:px-6">
        <Badge variant="secondary" className="gap-1.5">
          <Sparkles className="size-3" aria-hidden />
          Early preview
        </Badge>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
          Captions that hit as hard as your content
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          CaptionForge turns raw videos into caption-ready projects. Upload an
          MP4, forge bold and perfectly timed captions, and get it ready for
          every feed.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button size="lg" asChild>
            <Link href="/upload">
              Upload a video
              <ArrowRight aria-hidden />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="#how-it-works">See how it works</Link>
          </Button>
        </div>
      </section>

      <section className="border-t bg-muted/40">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-20 sm:px-6 md:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <Card key={title}>
              <CardHeader>
                <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Icon className="size-5" aria-hidden />
                </div>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight">
            How it works
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {steps.map(({ step, title, description }) => (
              <div key={step} className="flex flex-col items-center text-center">
                <span className="font-mono text-sm font-semibold text-muted-foreground">
                  {step}
                </span>
                <h3 className="mt-2 text-lg font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t bg-muted/40">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-20 text-center sm:px-6">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle className="text-2xl">Ready to forge?</CardTitle>
              <CardDescription>
                Upload your first MP4 and see it staged for captioning.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="lg" asChild>
                <Link href="/upload">
                  Start uploading
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}
