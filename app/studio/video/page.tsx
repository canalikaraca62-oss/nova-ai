"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Clock3,
  Film,
  Plus,
  Sparkles,
  Video,
  WandSparkles,
  X,
} from "lucide-react";

import CapabilityUnavailable from "@/app/components/ui/CapabilityUnavailable";

type VideoStyle =
  | "cinematic"
  | "commercial"
  | "realistic"
  | "animation"
  | "futuristic";

type AspectRatio = "16:9" | "9:16" | "1:1";

const videoStyles: Array<{
  id: VideoStyle;
  name: string;
  description: string;
}> = [
  {
    id: "cinematic",
    name: "Cinematic",
    description: "High-end film composition and dramatic storytelling",
  },
  {
    id: "commercial",
    name: "Commercial",
    description: "Premium advertising and product-focused visuals",
  },
  {
    id: "realistic",
    name: "Realistic",
    description: "Natural movement and photorealistic scenes",
  },
  {
    id: "animation",
    name: "Animation",
    description: "Stylized motion graphics and animated storytelling",
  },
  {
    id: "futuristic",
    name: "Futuristic",
    description: "Advanced technology, sci-fi and next-generation visuals",
  },
];

const durations = [5, 10, 15, 30];

const aspectRatios: Array<{
  id: AspectRatio;
  name: string;
  description: string;
}> = [
  {
    id: "16:9",
    name: "Landscape",
    description: "YouTube, presentations and cinematic video",
  },
  {
    id: "9:16",
    name: "Vertical",
    description: "TikTok, Reels and Shorts",
  },
  {
    id: "1:1",
    name: "Square",
    description: "Social media and campaigns",
  },
];

export default function VideoStudioPage() {
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [selectedStyle, setSelectedStyle] =
    useState<VideoStyle>("cinematic");
  const [selectedDuration, setSelectedDuration] = useState(10);
  const [selectedAspectRatio, setSelectedAspectRatio] =
    useState<AspectRatio>("16:9");

  const [error, setError] = useState<string | null>(null);

  /*
   * The composer stays usable so a user can capture intent, but there is
   * no generate path: no video provider is connected. The former
   * generateVideo() faked one — see CapabilityUnavailable below.
   */

  const resetForm = () => {
    setPrompt("");
    setNegativePrompt("");
    setSelectedStyle("cinematic");
    setSelectedDuration(10);
    setSelectedAspectRatio("16:9");
    setError(null);
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* HEADER */}
        <div className="mb-8 flex flex-col gap-5 border-b border-border pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Link
                href="/studio"
                className="transition hover:text-foreground"
              >
                Studio
              </Link>

              <span>/</span>

              <span className="text-foreground">
                Video
              </span>
            </div>

            <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight sm:text-4xl">
              <Video className="h-8 w-8 text-primary" />
              AI Video Studio
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Transform ideas into cinematic video concepts,
              intelligent visual stories and next-generation
              AI-powered content.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/studio"
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" />
              Studio
            </Link>

            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition hover:bg-muted"
            >
              <Plus className="h-4 w-4" />
              New Video
            </button>
          </div>
        </div>

        {error ? (
          <div className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <span>{error}</span>

            <button
              type="button"
              onClick={() => setError(null)}
              className="rounded-md p-1 transition hover:bg-destructive/10"
              aria-label="Close error"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          {/* LEFT PANEL */}
          <aside className="space-y-6">
            {/* Prompt */}
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-5 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />

                <div>
                  <h2 className="font-semibold">
                    Video Concept
                  </h2>

                  <p className="text-xs text-muted-foreground">
                    Describe the story you want to create
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Video Prompt
                  </label>

                  <textarea
                    value={prompt}
                    onChange={(event) =>
                      setPrompt(event.target.value)
                    }
                    rows={7}
                    placeholder="A cinematic aerial journey through a futuristic European city at sunrise, autonomous transport, sustainable architecture, dramatic atmosphere..."
                    className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />

                  <p className="mt-2 text-right text-xs text-muted-foreground">
                    {prompt.length} characters
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Negative Prompt
                  </label>

                  <textarea
                    value={negativePrompt}
                    onChange={(event) =>
                      setNegativePrompt(event.target.value)
                    }
                    rows={3}
                    placeholder="Blur, distortion, watermark, poor quality..."
                    className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </section>

            {/* Style */}
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Film className="h-4 w-4 text-primary" />

                <h2 className="font-semibold">
                  Video Style
                </h2>
              </div>

              <div className="space-y-2">
                {videoStyles.map((style) => {
                  const isSelected =
                    selectedStyle === style.id;

                  return (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() =>
                        setSelectedStyle(style.id)
                      }
                      className={[
                        "relative w-full rounded-xl border p-3 text-left transition-all",
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/60",
                      ].join(" ")}
                    >
                      {isSelected ? (
                        <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-3 w-3" />
                        </div>
                      ) : null}

                      <div className="pr-7 text-sm font-medium">
                        {style.name}
                      </div>

                      <p className="mt-1 pr-6 text-xs leading-5 text-muted-foreground">
                        {style.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Duration */}
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-primary" />

                <div>
                  <h2 className="font-semibold">
                    Duration
                  </h2>

                  <p className="text-xs text-muted-foreground">
                    Select target video length
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {durations.map((duration) => (
                  <button
                    key={duration}
                    type="button"
                    onClick={() =>
                      setSelectedDuration(duration)
                    }
                    className={[
                      "rounded-lg border py-2 text-sm font-medium transition",
                      selectedDuration === duration
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:bg-muted",
                    ].join(" ")}
                  >
                    {duration}s
                  </button>
                ))}
              </div>
            </section>

            {/* Generate */}
            <button
              type="button"
              disabled
              aria-describedby="video-generation-availability"
              className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-primary px-5 py-4 text-sm font-semibold text-primary-foreground opacity-60"
            >
              <WandSparkles className="h-4 w-4" />
              Generate Video
            </button>

            <p
              id="video-generation-availability"
              className="text-center text-xs leading-5 text-muted-foreground"
            >
              No video provider is connected, so generation is turned off.
            </p>
          </aside>

          {/* MAIN */}
          <section className="min-w-0 space-y-6">
            {/* Aspect Ratio */}
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-5">
                <h2 className="font-semibold">
                  Format
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Choose the platform and composition format.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {aspectRatios.map((ratio) => {
                  const isSelected =
                    selectedAspectRatio === ratio.id;

                  return (
                    <button
                      key={ratio.id}
                      type="button"
                      onClick={() =>
                        setSelectedAspectRatio(ratio.id)
                      }
                      className={[
                        "rounded-xl border p-4 text-left transition-all",
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/60",
                      ].join(" ")}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-semibold">
                          {ratio.name}
                        </span>

                        {isSelected ? (
                          <Check className="h-4 w-4 text-primary" />
                        ) : null}
                      </div>

                      <div className="text-sm font-medium text-primary">
                        {ratio.id}
                      </div>

                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        {ratio.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            <CapabilityUnavailable
              capability="Video generation"
              alternatives={[
                {
                  href: "/studio/presentation",
                  label: "Build a presentation",
                  description:
                    "Generates real slide content from a topic using the configured text model.",
                },
                {
                  href: "/chat",
                  label: "Plan the video in Chat",
                  description:
                    "Work out the shots and script now, and generate once a provider is connected.",
                },
              ]}
            />
          </section>
        </div>
      </div>
    </main>
  );
}