"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  LayoutTemplate,
  Loader2,
  Maximize2,
  MonitorPlay,
  Palette,
  Play,
  Plus,
  Presentation,
  Sparkles,
  Trash2,
  WandSparkles,
  X,
} from "lucide-react";

type GenerationStatus = "idle" | "generating" | "completed" | "error";

type PresentationStyle =
  | "professional"
  | "minimal"
  | "creative"
  | "corporate"
  | "dark";

type PresentationSlide = {
  id: string;
  title: string;
  subtitle: string;
  content: string[];
  type: "cover" | "content" | "metrics" | "summary";
};

type PresentationProject = {
  id: string;
  title: string;
  topic: string;
  style: PresentationStyle;
  slideCount: number;
  createdAt: string;
  slides: PresentationSlide[];
};

const presentationStyles: Array<{
  id: PresentationStyle;
  name: string;
  description: string;
}> = [
  {
    id: "professional",
    name: "Professional",
    description: "Clean, premium and business-ready",
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Simple typography and focused content",
  },
  {
    id: "creative",
    name: "Creative",
    description: "Bold layouts and expressive storytelling",
  },
  {
    id: "corporate",
    name: "Corporate",
    description: "Structured and executive presentation",
  },
  {
    id: "dark",
    name: "Dark",
    description: "Modern dark visual experience",
  },
];

const slideOptions = [5, 8, 10, 12, 15, 20];

function createSlides(
  topic: string,
  count: number,
): PresentationSlide[] {
  const baseSlides: PresentationSlide[] = [
    {
      id: "cover",
      title: topic,
      subtitle: "AI Generated Strategic Presentation",
      content: [
        "A structured presentation generated with intelligent storytelling.",
      ],
      type: "cover",
    },
    {
      id: "overview",
      title: "Executive Overview",
      subtitle: "The opportunity and strategic context",
      content: [
        "Clear definition of the core challenge",
        "Key market and business opportunities",
        "Strategic direction for sustainable growth",
      ],
      type: "content",
    },
    {
      id: "problem",
      title: "The Challenge",
      subtitle: "Understanding the current landscape",
      content: [
        "Rapid changes in technology and market expectations",
        "Increasing pressure for efficiency and innovation",
        "Need for scalable and future-ready solutions",
      ],
      type: "content",
    },
    {
      id: "solution",
      title: "Our Strategic Solution",
      subtitle: "A clear path toward measurable impact",
      content: [
        "Build a scalable intelligent infrastructure",
        "Automate high-value workflows",
        "Create a connected data and decision ecosystem",
      ],
      type: "content",
    },
    {
      id: "metrics",
      title: "Projected Impact",
      subtitle: "Potential value creation",
      content: [
        "40% improvement in operational efficiency",
        "3x faster strategic decision cycles",
        "Significant long-term scalability potential",
      ],
      type: "metrics",
    },
    {
      id: "roadmap",
      title: "Implementation Roadmap",
      subtitle: "From strategy to execution",
      content: [
        "Phase 1 — Foundation and infrastructure",
        "Phase 2 — Product and workflow deployment",
        "Phase 3 — Scale, optimization and expansion",
      ],
      type: "content",
    },
    {
      id: "future",
      title: "Future Vision",
      subtitle: "Building the next generation platform",
      content: [
        "Global scalability",
        "AI-native operational intelligence",
        "Long-term ecosystem expansion",
      ],
      type: "summary",
    },
    {
      id: "summary",
      title: "Key Takeaways",
      subtitle: "The strategic conclusion",
      content: [
        "Strong opportunity for transformation",
        "Clear execution roadmap",
        "Significant potential for long-term value creation",
      ],
      type: "summary",
    },
  ];

  if (count <= baseSlides.length) {
    return baseSlides.slice(0, count);
  }

  const additionalSlides = Array.from(
    { length: count - baseSlides.length },
    (_, index) => ({
      id: `additional-${index + 1}`,
      title: `Strategic Insight ${index + 1}`,
      subtitle: "Additional analysis and opportunity",
      content: [
        "Advanced opportunity analysis",
        "Data-driven strategic recommendation",
        "Scalable execution framework",
      ],
      type: "content" as const,
    }),
  );

  return [...baseSlides, ...additionalSlides];
}

export default function PresentationStudioPage() {
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [instructions, setInstructions] = useState("");

  const [selectedStyle, setSelectedStyle] =
    useState<PresentationStyle>("professional");

  const [slideCount, setSlideCount] = useState(10);

  const [status, setStatus] =
    useState<GenerationStatus>("idle");

  const [error, setError] = useState<string | null>(null);

  const [projects, setProjects] = useState<
    PresentationProject[]
  >([]);

  const [selectedProjectId, setSelectedProjectId] =
    useState<string | null>(null);

  const [activeSlideIndex, setActiveSlideIndex] =
    useState(0);

  const selectedProject = useMemo(
    () =>
      projects.find(
        (project) => project.id === selectedProjectId,
      ) ?? null,
    [projects, selectedProjectId],
  );

  const activeSlide =
    selectedProject?.slides[activeSlideIndex] ?? null;

  const selectedStyleData = useMemo(
    () =>
      presentationStyles.find(
        (style) => style.id === selectedStyle,
      ),
    [selectedStyle],
  );

  const generatePresentation = async () => {
    if (!topic.trim()) {
      setError(
        "Please enter a presentation topic before generating.",
      );
      return;
    }

    setError(null);
    setStatus("generating");

    try {
      await new Promise((resolve) =>
        window.setTimeout(resolve, 1800),
      );

      const slides = createSlides(topic.trim(), slideCount);

      const project: PresentationProject = {
        id: crypto.randomUUID(),
        title: topic.trim(),
        topic: topic.trim(),
        style: selectedStyle,
        slideCount,
        createdAt: new Date().toISOString(),
        slides,
      };

      setProjects((currentProjects) => [
        project,
        ...currentProjects,
      ]);

      setSelectedProjectId(project.id);
      setActiveSlideIndex(0);
      setStatus("completed");
    } catch {
      setStatus("error");
      setError(
        "Presentation generation failed. Please try again.",
      );
    }
  };

  const deleteProject = (projectId: string) => {
    setProjects((currentProjects) =>
      currentProjects.filter(
        (project) => project.id !== projectId,
      ),
    );

    if (selectedProjectId === projectId) {
      setSelectedProjectId(null);
      setActiveSlideIndex(0);
    }
  };

  const downloadPresentation = () => {
    if (!selectedProject) {
      return;
    }

    const content = selectedProject.slides
      .map(
        (slide, index) =>
          `SLIDE ${index + 1}\n\n${slide.title}\n${slide.subtitle}\n\n${slide.content
            .map((item) => `• ${item}`)
            .join("\n")}`,
      )
      .join("\n\n====================\n\n");

    const blob = new Blob([content], {
      type: "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;

    link.download = `${selectedProject.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, "-")}-presentation.txt`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  };

  const resetForm = () => {
    setTopic("");
    setAudience("");
    setInstructions("");
    setSelectedStyle("professional");
    setSlideCount(10);
    setError(null);
  };

  const nextSlide = () => {
    if (!selectedProject) {
      return;
    }

    setActiveSlideIndex((currentIndex) =>
      Math.min(
        currentIndex + 1,
        selectedProject.slides.length - 1,
      ),
    );
  };

  const previousSlide = () => {
    setActiveSlideIndex((currentIndex) =>
      Math.max(currentIndex - 1, 0),
    );
  };

  const getSlideTheme = () => {
    switch (selectedProject?.style) {
      case "dark":
        return "bg-zinc-950 text-white";

      case "creative":
        return "bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 text-white";

      case "corporate":
        return "bg-gradient-to-br from-slate-900 to-slate-700 text-white";

      case "minimal":
        return "bg-white text-slate-900";

      default:
        return "bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white";
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
                Presentation
              </span>
            </div>

            <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight sm:text-4xl">
              <Presentation className="h-8 w-8 text-primary" />
              AI Presentation Studio
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Transform complex ideas into structured,
              professional presentations with AI-powered
              storytelling and intelligent slide generation.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/studio"
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" />
              Studio
            </Link>

            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              <Plus className="h-4 w-4" />
              New Presentation
            </button>
          </div>
        </div>

        {error ? (
          <div className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <span>{error}</span>

            <button
              type="button"
              onClick={() => setError(null)}
              aria-label="Close error"
              className="rounded-md p-1 transition hover:bg-destructive/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          {/* LEFT SIDEBAR */}

          <aside className="space-y-6">
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-5 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />

                <div>
                  <h2 className="font-semibold">
                    Presentation Brief
                  </h2>

                  <p className="text-xs text-muted-foreground">
                    Tell AI what you want to create
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Presentation Topic
                  </label>

                  <textarea
                    value={topic}
                    onChange={(event) =>
                      setTopic(event.target.value)
                    }
                    rows={5}
                    placeholder="Example: The future of artificial intelligence in global enterprise infrastructure..."
                    className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Target Audience
                  </label>

                  <input
                    value={audience}
                    onChange={(event) =>
                      setAudience(event.target.value)
                    }
                    placeholder="Investors, executives, clients..."
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Additional Instructions
                  </label>

                  <textarea
                    value={instructions}
                    onChange={(event) =>
                      setInstructions(event.target.value)
                    }
                    rows={4}
                    placeholder="Key points, tone, strategic priorities..."
                    className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </section>

            {/* STYLE */}

            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Palette className="h-4 w-4 text-primary" />

                <h2 className="font-semibold">
                  Visual Style
                </h2>
              </div>

              <div className="space-y-2">
                {presentationStyles.map((style) => {
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

                      <div className="text-sm font-medium">
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

            {/* SLIDE COUNT */}

            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <LayoutTemplate className="h-4 w-4 text-primary" />

                <div>
                  <h2 className="font-semibold">
                    Number of Slides
                  </h2>

                  <p className="text-xs text-muted-foreground">
                    Choose presentation length
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {slideOptions.map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setSlideCount(count)}
                    className={[
                      "rounded-lg border py-2 text-sm font-medium transition-colors",
                      slideCount === count
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:bg-muted",
                    ].join(" ")}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </section>

            {/* GENERATE */}

            <button
              type="button"
              onClick={generatePresentation}
              disabled={status === "generating"}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "generating" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Building Presentation...
                </>
              ) : (
                <>
                  <WandSparkles className="h-4 w-4" />
                  Generate Presentation
                </>
              )}
            </button>

            <p className="px-2 text-center text-xs leading-5 text-muted-foreground">
              {selectedStyleData?.name} style ·{" "}
              {slideCount} slides
            </p>
          </aside>

          {/* MAIN WORKSPACE */}

          <section className="min-w-0 space-y-6">
            {status === "generating" ? (
              <div className="flex min-h-[650px] flex-col items-center justify-center rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
                <div className="relative">
                  <div className="h-20 w-20 animate-spin rounded-full border-4 border-muted border-t-primary" />

                  <Sparkles className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 text-primary" />
                </div>

                <h2 className="mt-8 text-xl font-semibold">
                  AI is building your presentation
                </h2>

                <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                  Creating the narrative structure, organizing
                  slides and preparing a professional visual
                  presentation.
                </p>

                <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Generating intelligent slide structure...
                </div>
              </div>
            ) : selectedProject && activeSlide ? (
              <>
                {/* TOOLBAR */}

                <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Presentation className="h-4 w-4 text-primary" />

                      <h2 className="truncate font-semibold">
                        {selectedProject.title}
                      </h2>
                    </div>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {selectedProject.slides.length} slides ·{" "}
                      {
                        presentationStyles.find(
                          (style) =>
                            style.id ===
                            selectedProject.style,
                        )?.name
                      }{" "}
                      style
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={downloadPresentation}
                      className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-muted"
                    >
                      <Download className="h-4 w-4" />
                      Export
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setActiveSlideIndex(0)
                      }
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                    >
                      <Play className="h-4 w-4 fill-current" />
                      Present
                    </button>
                  </div>
                </div>

                {/* SLIDE */}

                <div className="overflow-hidden rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-5">
                  <div
                    className={[
                      "relative aspect-[16/9] min-h-[420px] overflow-hidden rounded-xl p-8 sm:p-12 lg:p-16",
                      getSlideTheme(),
                    ].join(" ")}
                  >
                    <div className="absolute right-8 top-8 opacity-10">
                      <Presentation className="h-32 w-32" />
                    </div>

                    <div className="relative z-10 flex h-full flex-col">
                      <div className="mb-auto">
                        <div className="mb-6 flex items-center gap-3 text-xs font-medium uppercase tracking-[0.2em] opacity-70">
                          <Sparkles className="h-4 w-4" />
                          AI Presentation
                        </div>

                        <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">
                          {activeSlide.title}
                        </h1>

                        <p className="mt-5 max-w-2xl text-base leading-7 opacity-80 sm:text-xl">
                          {activeSlide.subtitle}
                        </p>
                      </div>

                      <div className="mt-10">
                        <div className="grid gap-4 md:grid-cols-3">
                          {activeSlide.content.map(
                            (item, index) => (
                              <div
                                key={`${activeSlide.id}-${index}`}
                                className="rounded-xl border border-current/10 bg-white/10 p-4 backdrop-blur-sm"
                              >
                                <div className="mb-3 text-sm font-semibold opacity-60">
                                  0{index + 1}
                                </div>

                                <p className="text-sm leading-6 sm:text-base">
                                  {item}
                                </p>
                              </div>
                            ),
                          )}
                        </div>
                      </div>

                      <div className="mt-auto flex items-center justify-between pt-8 text-xs opacity-60">
                        <span>
                          {selectedProject.title}
                        </span>

                        <span>
                          {activeSlideIndex + 1} /{" "}
                          {selectedProject.slides.length}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CONTROLS */}

                <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={previousSlide}
                    disabled={activeSlideIndex === 0}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </button>

                  <div className="flex items-center justify-center gap-1">
                    {selectedProject.slides.map(
                      (slide, index) => (
                        <button
                          key={slide.id}
                          type="button"
                          onClick={() =>
                            setActiveSlideIndex(index)
                          }
                          className={[
                            "h-2 rounded-full transition-all",
                            index === activeSlideIndex
                              ? "w-7 bg-primary"
                              : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/60",
                          ].join(" ")}
                          aria-label={`Go to slide ${
                            index + 1
                          }`}
                        />
                      ),
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={nextSlide}
                    disabled={
                      activeSlideIndex >=
                      selectedProject.slides.length - 1
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {/* SLIDE LIST */}

                <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">
                        Slide Navigator
                      </h3>

                      <p className="mt-1 text-sm text-muted-foreground">
                        Jump directly to any slide.
                      </p>
                    </div>

                    <Maximize2 className="h-4 w-4 text-muted-foreground" />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {selectedProject.slides.map(
                      (slide, index) => (
                        <button
                          key={slide.id}
                          type="button"
                          onClick={() =>
                            setActiveSlideIndex(index)
                          }
                          className={[
                            "rounded-xl border p-4 text-left transition-all",
                            index === activeSlideIndex
                              ? "border-primary bg-primary/5"
                              : "border-border hover:bg-muted/60",
                          ].join(" ")}
                        >
                          <div className="mb-4 flex items-center justify-between">
                            <span className="text-xs font-semibold text-primary">
                              SLIDE{" "}
                              {String(index + 1).padStart(
                                2,
                                "0",
                              )}
                            </span>

                            {index === activeSlideIndex ? (
                              <Check className="h-4 w-4 text-primary" />
                            ) : null}
                          </div>

                          <h4 className="truncate text-sm font-semibold">
                            {slide.title}
                          </h4>

                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                            {slide.subtitle}
                          </p>
                        </button>
                      ),
                    )}
                  </div>
                </section>
              </>
            ) : (
              <div className="flex min-h-[650px] flex-col items-center justify-center rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10">
                  <MonitorPlay className="h-10 w-10 text-primary" />
                </div>

                <h2 className="mt-7 text-2xl font-semibold">
                  Your presentation workspace is ready
                </h2>

                <p className="mt-3 max-w-lg text-sm leading-7 text-muted-foreground">
                  Enter your presentation topic, choose a visual
                  style and let AI create a complete slide
                  structure for your project.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    const element =
                      document.querySelector("textarea");

                    element?.focus();
                  }}
                  className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
                >
                  <Sparkles className="h-4 w-4" />
                  Start Creating
                </button>
              </div>
            )}

            {/* RECENT PRESENTATIONS */}

            {projects.length > 0 ? (
              <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold">
                      Recent Presentations
                    </h2>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Your generated presentation workspace.
                    </p>
                  </div>

                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>

                <div className="space-y-3">
                  {projects.map((project) => {
                    const isSelected =
                      project.id === selectedProjectId;

                    return (
                      <div
                        key={project.id}
                        className={[
                          "flex flex-col gap-4 rounded-xl border p-4 transition sm:flex-row sm:items-center sm:justify-between",
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border",
                        ].join(" ")}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProjectId(project.id);
                            setActiveSlideIndex(0);
                          }}
                          className="flex min-w-0 flex-1 items-center gap-4 text-left"
                        >
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                            <Presentation className="h-5 w-5 text-primary" />
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                              {project.title}
                            </p>

                            <p className="mt-1 text-xs text-muted-foreground">
                              {project.slideCount} slides ·{" "}
                              {presentationStyles.find(
                                (style) =>
                                  style.id === project.style,
                              )?.name ?? "Professional"}
                            </p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            deleteProject(project.id)
                          }
                          className="inline-flex items-center justify-center rounded-lg border border-border p-2 text-muted-foreground transition hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Delete presentation"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
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