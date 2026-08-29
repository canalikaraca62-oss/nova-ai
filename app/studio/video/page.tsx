"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Clock3,
  Download,
  Film,
  Loader2,
  Play,
  Plus,
  Sparkles,
  Video,
  WandSparkles,
  X,
} from "lucide-react";

type GenerationStatus = "idle" | "generating" | "completed" | "error";

type VideoStyle =
  | "cinematic"
  | "commercial"
  | "realistic"
  | "animation"
  | "futuristic";

type AspectRatio = "16:9" | "9:16" | "1:1";

type GeneratedVideo = {
  id: string;
  title: string;
  prompt: string;
  style: VideoStyle;
  duration: number;
  aspectRatio: AspectRatio;
  createdAt: string;
};

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

  const [status, setStatus] =
    useState<GenerationStatus>("idle");

  const [error, setError] = useState<string | null>(null);

  const [videos, setVideos] = useState<GeneratedVideo[]>([]);

  const [activeVideoId, setActiveVideoId] =
    useState<string | null>(null);

  const selectedStyleData = useMemo(
    () =>
      videoStyles.find(
        (style) => style.id === selectedStyle,
      ),
    [selectedStyle],
  );

  const activeVideo = useMemo(
    () =>
      videos.find((video) => video.id === activeVideoId) ??
      null,
    [videos, activeVideoId],
  );

  const generateVideo = async () => {
    if (!prompt.trim()) {
      setError(
        "Please describe the video you want to generate.",
      );
      return;
    }

    setError(null);
    setStatus("generating");

    try {
      /*
       * Gerçek AI video API entegrasyonu burada yapılacak.
       *
       * Örnek:
       *
       * const response = await fetch("/api/studio/video", {
       *   method: "POST",
       *   headers: {
       *     "Content-Type": "application/json",
       *   },
       *   body: JSON.stringify({
       *     prompt,
       *     negativePrompt,
       *     style: selectedStyle,
       *     duration: selectedDuration,
       *     aspectRatio: selectedAspectRatio,
       *   }),
       * });
       *
       * const data = await response.json();
       */

      await new Promise((resolve) =>
        window.setTimeout(resolve, 2000),
      );

      const newVideo: GeneratedVideo = {
        id: crypto.randomUUID(),
        title:
          prompt.trim().length > 55
            ? `${prompt.trim().slice(0, 55)}...`
            : prompt.trim(),
        prompt: prompt.trim(),
        style: selectedStyle,
        duration: selectedDuration,
        aspectRatio: selectedAspectRatio,
        createdAt: new Date().toISOString(),
      };

      setVideos((currentVideos) => [
        newVideo,
        ...currentVideos,
      ]);

      setActiveVideoId(newVideo.id);
      setStatus("completed");
    } catch {
      setStatus("error");
      setError(
        "Video generation failed. Please try again.",
      );
    }
  };

  const resetForm = () => {
    setPrompt("");
    setNegativePrompt("");
    setSelectedStyle("cinematic");
    setSelectedDuration(10);
    setSelectedAspectRatio("16:9");
    setError(null);
  };

  const deleteVideo = (videoId: string) => {
    setVideos((currentVideos) =>
      currentVideos.filter(
        (video) => video.id !== videoId,
      ),
    );

    if (activeVideoId === videoId) {
      setActiveVideoId(null);
    }
  };

  const downloadVideo = () => {
    if (!activeVideo) {
      return;
    }

    const videoData = [
      "AI VIDEO STUDIO",
      "",
      `Title: ${activeVideo.title}`,
      `Prompt: ${activeVideo.prompt}`,
      `Style: ${activeVideo.style}`,
      `Duration: ${activeVideo.duration} seconds`,
      `Aspect Ratio: ${activeVideo.aspectRatio}`,
      `Created: ${new Date(
        activeVideo.createdAt,
      ).toLocaleString()}`,
    ].join("\n");

    const blob = new Blob([videoData], {
      type: "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeVideo.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, "-")}-video.txt`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  };

  const getAspectRatioClass = (
    aspectRatio: AspectRatio,
  ) => {
    switch (aspectRatio) {
      case "9:16":
        return "aspect-[9/16] max-w-sm mx-auto";

      case "1:1":
        return "aspect-square max-w-xl mx-auto";

      default:
        return "aspect-video";
    }
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
              onClick={generateVideo}
              disabled={status === "generating"}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "generating" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating Video...
                </>
              ) : (
                <>
                  <WandSparkles className="h-4 w-4" />
                  Generate Video
                </>
              )}
            </button>
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

            {/* Loading */}
            {status === "generating" ? (
              <div className="flex min-h-[540px] flex-col items-center justify-center rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
                <div className="relative">
                  <div className="h-20 w-20 animate-spin rounded-full border-4 border-muted border-t-primary" />

                  <Video className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 text-primary" />
                </div>

                <h2 className="mt-8 text-xl font-semibold">
                  AI is producing your video
                </h2>

                <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                  Building scenes, visual motion and cinematic
                  storytelling from your creative direction.
                </p>

                <div className="mt-7 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Processing visual sequences...
                </div>
              </div>
            ) : activeVideo ? (
              <>
                {/* Video Preview */}
                <section className="overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <div
                    className={[
                      "relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950",
                      getAspectRatioClass(
                        activeVideo.aspectRatio,
                      ),
                    ].join(" ")}
                  >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.35),transparent_40%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.2),transparent_35%)]" />

                    <div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-10">
                      <div className="flex items-start justify-between gap-4">
                        <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs text-white/80 backdrop-blur">
                          AI GENERATED VIDEO
                        </div>

                        <span className="rounded-full bg-black/30 px-3 py-1.5 text-xs text-white/80 backdrop-blur">
                          {activeVideo.duration}s
                        </span>
                      </div>

                      <div className="max-w-2xl">
                        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-4xl">
                          {activeVideo.title}
                        </h2>

                        <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/65">
                          {activeVideo.prompt}
                        </p>
                      </div>

                      <div className="flex items-end justify-between">
                        <button
                          type="button"
                          className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-slate-950 shadow-lg transition hover:scale-105"
                          aria-label="Play video"
                        >
                          <Play className="ml-1 h-6 w-6 fill-current" />
                        </button>

                        <div className="text-right text-xs text-white/50">
                          {activeVideo.aspectRatio} ·{" "}
                          {videoStyles.find(
                            (style) =>
                              style.id === activeVideo.style,
                          )?.name}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Video Details */}
                <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="font-semibold">
                        Video Ready
                      </h2>

                      <p className="mt-1 text-sm text-muted-foreground">
                        Your AI video concept has been generated
                        successfully.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={downloadVideo}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                    >
                      <Download className="h-4 w-4" />
                      Export Video
                    </button>
                  </div>
                </section>
              </>
            ) : (
              <div className="flex min-h-[540px] flex-col items-center justify-center rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10">
                  <Video className="h-10 w-10 text-primary" />
                </div>

                <h2 className="mt-7 text-2xl font-semibold">
                  Your video workspace is ready
                </h2>

                <p className="mt-3 max-w-lg text-sm leading-7 text-muted-foreground">
                  Describe your visual story, select a style and
                  format, then let AI build your next-generation
                  video concept.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    document.querySelector("textarea")?.focus()
                  }
                  className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
                >
                  <Sparkles className="h-4 w-4" />
                  Start Creating
                </button>
              </div>
            )}

            {/* Video History */}
            {videos.length > 0 ? (
              <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold">
                      Generated Videos
                    </h2>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Your recent AI video generations.
                    </p>
                  </div>

                  <Film className="h-5 w-5 text-muted-foreground" />
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {videos.map((video) => {
                    const isActive =
                      video.id === activeVideoId;

                    return (
                      <button
                        key={video.id}
                        type="button"
                        onClick={() =>
                          setActiveVideoId(video.id)
                        }
                        className={[
                          "group overflow-hidden rounded-xl border text-left transition",
                          isActive
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted/50",
                        ].join(" ")}
                      >
                        <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950">
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition group-hover:scale-110">
                              <Play className="ml-0.5 h-5 w-5 fill-current" />
                            </div>
                          </div>

                          <div className="absolute bottom-3 right-3 rounded-md bg-black/50 px-2 py-1 text-xs text-white">
                            {video.duration}s
                          </div>
                        </div>

                        <div className="p-4">
                          <h3 className="truncate text-sm font-semibold">
                            {video.title}
                          </h3>

                          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                            <span>
                              {video.aspectRatio}
                            </span>

                            <span>
                              {videoStyles.find(
                                (style) =>
                                  style.id === video.style,
                              )?.name}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}