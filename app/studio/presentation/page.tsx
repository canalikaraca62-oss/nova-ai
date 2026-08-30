"use client";

import { useCallback, useMemo, useState } from "react";
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

type SlideType = "cover" | "content" | "metrics" | "summary";

type PresentationSlide = {
  id: string;
  title: string;
  subtitle: string;
  content: string[];
  type: SlideType;
};

type PresentationProject = {
  id: string;
  title: string;
  topic: string;
  audience: string;
  instructions: string;
  style: PresentationStyle;
  slideCount: number;
  createdAt: string;
  slides: PresentationSlide[];
};

type GeneratePresentationRequest = {
  topic: string;
  audience: string;
  instructions: string;
  style: PresentationStyle;
  slideCount: number;
};

type GeneratePresentationResponse = {
  title?: string;
  slides?: PresentationSlide[];
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

function createId(prefix = "presentation") {
  if (
    typeof window !== "undefined" &&
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function normalizeSlide(
  slide: Partial<PresentationSlide>,
  index: number,
): PresentationSlide {
  return {
    id: slide.id || createId(`slide-${index + 1}`),
    title: slide.title?.trim() || `Slide ${index + 1}`,
    subtitle: slide.subtitle?.trim() || "",
    content:
      Array.isArray(slide.content) && slide.content.length > 0
        ? slide.content
            .filter(
              (item): item is string =>
                typeof item === "string" && item.trim().length > 0,
            )
            .slice(0, 6)
        : ["Key strategic insight"],
    type:
      slide.type === "cover" ||
      slide.type === "content" ||
      slide.type === "metrics" ||
      slide.type === "summary"
        ? slide.type
        : "content",
  };
}

function createFallbackSlides(
  request: GeneratePresentationRequest,
): PresentationSlide[] {
  const {
    topic,
    audience,
    instructions,
    slideCount,
  } = request;

  const audienceLabel = audience.trim()
    ? audience.trim()
    : "decision-makers and stakeholders";

  const instructionLabel = instructions.trim()
    ? instructions.trim()
    : "Focus on strategic clarity, measurable value, and scalable execution.";

  const baseSlides: PresentationSlide[] = [
    {
      id: createId("cover"),
      title: topic,
      subtitle: `A strategic presentation for ${audienceLabel}`,
      content: [
        "SYRAVEN AI-generated strategic narrative",
      ],
      type: "cover",
    },
    {
      id: createId("context"),
      title: "Executive Context",
      subtitle: "Why this topic matters now",
      content: [
        `The strategic relevance of ${topic}`,
        `Key implications for ${audienceLabel}`,
        "The market, technology, and operational forces shaping the opportunity",
      ],
      type: "content",
    },
    {
      id: createId("challenge"),
      title: "The Core Challenge",
      subtitle: "Understanding the problem before designing the solution",
      content: [
        "Increasing complexity across technology, operations, and decision-making",
        "Growing expectations for speed, intelligence, and measurable outcomes",
        "The need to connect fragmented systems into a scalable operating model",
      ],
      type: "content",
    },
    {
      id: createId("opportunity"),
      title: "Strategic Opportunity",
      subtitle: "Where transformation can create disproportionate value",
      content: [
        `Create a differentiated approach around ${topic}`,
        "Build reusable intelligence and operational capabilities",
        "Turn strategic insight into repeatable execution",
      ],
      type: "content",
    },
    {
      id: createId("solution"),
      title: "Recommended Strategy",
      subtitle: "A structured path from ambition to execution",
      content: [
        "Establish a clear foundation and governance model",
        "Prioritize high-impact workflows and measurable use cases",
        "Scale through modular systems, automation, and intelligence",
      ],
      type: "content",
    },
    {
      id: createId("impact"),
      title: "Projected Impact",
      subtitle: "The potential value of successful execution",
      content: [
        "Faster decision cycles through connected intelligence",
        "Higher operational efficiency through automation",
        "Long-term scalability through reusable infrastructure",
      ],
      type: "metrics",
    },
    {
      id: createId("roadmap"),
      title: "Implementation Roadmap",
      subtitle: "A phased approach to sustainable transformation",
      content: [
        "Phase 1 — Strategy, architecture, and foundations",
        "Phase 2 — Product deployment and workflow integration",
        "Phase 3 — Optimization, expansion, and ecosystem scale",
      ],
      type: "content",
    },
    {
      id: createId("recommendations"),
      title: "Strategic Recommendations",
      subtitle: "Key actions for leadership and execution teams",
      content: [
        instructionLabel,
        "Define measurable success criteria before scaling",
        "Maintain strong alignment between technology, operations, and business goals",
      ],
      type: "summary",
    },
    {
      id: createId("future"),
      title: "Future Vision",
      subtitle: "Building for long-term competitive advantage",
      content: [
        "AI-native operational intelligence",
        "Global scalability and ecosystem expansion",
        "A continuously improving strategic platform",
      ],
      type: "summary",
    },
    {
      id: createId("summary"),
      title: "Key Takeaways",
      subtitle: "The strategic conclusion",
      content: [
        `${topic} represents a meaningful transformation opportunity`,
        "A structured execution model reduces risk and improves speed",
        "Long-term value depends on scalable systems and disciplined implementation",
      ],
      type: "summary",
    },
  ];

  if (slideCount <= baseSlides.length) {
    return baseSlides.slice(0, slideCount);
  }

  const additionalSlides = Array.from(
    { length: slideCount - baseSlides.length },
    (_, index): PresentationSlide => ({
      id: createId(`insight-${index + 1}`),
      title: `Strategic Insight ${index + 1}`,
      subtitle: `Additional analysis for ${audienceLabel}`,
      content: [
        `Deepen understanding of ${topic}`,
        "Identify high-leverage opportunities",
        "Convert insight into measurable execution priorities",
      ],
      type: "content",
    }),
  );

  return [...baseSlides, ...additionalSlides];
}

async function generatePresentationWithApi(
  request: GeneratePresentationRequest,
): Promise<PresentationSlide[] | null> {
  try {
    const response = await fetch("/api/presentations/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      return null;
    }

    const data =
      (await response.json()) as GeneratePresentationResponse;

    if (!Array.isArray(data.slides) || data.slides.length === 0) {
      return null;
    }

    return data.slides
      .map((slide, index) => normalizeSlide(slide, index))
      .slice(0, request.slideCount);
  } catch {
    return null;
  }
}

function getProjectExportContent(
  project: PresentationProject,
) {
  const styleName =
    presentationStyles.find(
      (style) => style.id === project.style,
    )?.name ?? "Professional";

  const header = [
    `# ${project.title}`,
    "",
    "Generated with SYRAVEN Presentation Studio",
    "",
    `Topic: ${project.topic}`,
    `Audience: ${project.audience || "Not specified"}`,
    `Style: ${styleName}`,
    `Slides: ${project.slides.length}`,
    `Created: ${new Date(
      project.createdAt,
    ).toLocaleString()}`,
    "",
    "---",
    "",
  ].join("\n");

  const slides = project.slides
    .map((slide, index) => {
      const items = slide.content
        .map((item) => `- ${item}`)
        .join("\n");

      return [
        `## Slide ${index + 1}: ${slide.title}`,
        "",
        slide.subtitle,
        "",
        items,
      ].join("\n");
    })
    .join("\n\n---\n\n");

  return `${header}${slides}`;
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

  const generatePresentation = useCallback(async () => {
    const normalizedTopic = topic.trim();

    if (!normalizedTopic) {
      setStatus("error");
      setError(
        "Please enter a presentation topic before generating.",
      );
      return;
    }

    if (normalizedTopic.length < 3) {
      setStatus("error");
      setError(
        "Please enter a more detailed presentation topic.",
      );
      return;
    }

    setError(null);
    setStatus("generating");

    const request: GeneratePresentationRequest = {
      topic: normalizedTopic,
      audience: audience.trim(),
      instructions: instructions.trim(),
      style: selectedStyle,
      slideCount,
    };

    try {
      const apiSlides =
        await generatePresentationWithApi(request);

      const slides =
        apiSlides && apiSlides.length > 0
          ? apiSlides
          : createFallbackSlides(request);

      const project: PresentationProject = {
        id: createId("project"),
        title: normalizedTopic,
        topic: normalizedTopic,
        audience: audience.trim(),
        instructions: instructions.trim(),
        style: selectedStyle,
        slideCount: slides.length,
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
  }, [
    audience,
    instructions,
    selectedStyle,
    slideCount,
    topic,
  ]);

  const deleteProject = useCallback(
    (projectId: string) => {
      setProjects((currentProjects) =>
        currentProjects.filter(
          (project) => project.id !== projectId,
        ),
      );

      if (selectedProjectId === projectId) {
        setSelectedProjectId(null);
        setActiveSlideIndex(0);
      }
    },
    [selectedProjectId],
  );

  const downloadPresentation = useCallback(() => {
    if (!selectedProject) {
      return;
    }

    const content =
      getProjectExportContent(selectedProject);

    const blob = new Blob([content], {
      type: "text/markdown;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;

    const filename = selectedProject.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "");

    link.download = `${filename || "syraven-presentation"}.md`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }, [selectedProject]);

  const resetForm = useCallback(() => {
    setTopic("");
    setAudience("");
    setInstructions("");
    setSelectedStyle("professional");
    setSlideCount(10);
    setError(null);
    setStatus("idle");
  }, []);

  const nextSlide = useCallback(() => {
    if (!selectedProject) {
      return;
    }

    setActiveSlideIndex((currentIndex) =>
      Math.min(
        currentIndex + 1,
        selectedProject.slides.length - 1,
      ),
    );
  }, [selectedProject]);

  const previousSlide = useCallback(() => {
    setActiveSlideIndex((currentIndex) =>
      Math.max(currentIndex - 1, 0),
    );
  }, []);

  const getSlideTheme = useCallback(() => {
    switch (selectedProject?.style) {
      case "dark":
        return "bg-zinc-950 text-white";

      case "creative":
        return "bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 text-white";

      case "corporate":
        return "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 text-white";

      case "minimal":
        return "bg-white text-slate-900";

      case "professional":
      default:
        return "bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white";
    }
  }, [selectedProject?.style]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-5 border-b border-border pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Link
                href="/studio"
                className="transition-colors hover:text-foreground"
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
              SYRAVEN Presentation Studio
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
          <div
            role="alert"
            className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
          >
            <span>{error}</span>

            <button
              type="button"
              onClick={() => {
                setError(null);
                setStatus("idle");
              }}
              aria-label="Close error"
              className="rounded-md p-1 transition hover:bg-destructive/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-5 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />

                <div>
                  <h2 className="font-semibold">
                    Presentation Brief
                  </h2>

                  <p className="text-xs text-muted-foreground">
                    Tell SYRAVEN what you want to create
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label
                    htmlFor="presentation-topic"
                    className="mb-2 block text-sm font-medium"
                  >
                    Presentation Topic
                  </label>

                  <textarea
                    id="presentation-topic"
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
                  <label
                    htmlFor="presentation-audience"
                    className="mb-2 block text-sm font-medium"
                  >
                    Target Audience
                  </label>

                  <input
                    id="presentation-audience"
                    value={audience}
                    onChange={(event) =>
                      setAudience(event.target.value)
                    }
                    placeholder="Investors, executives, clients..."
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="presentation-instructions"
                    className="mb-2 block text-sm font-medium"
                  >
                    Additional Instructions
                  </label>

                  <textarea
                    id="presentation-instructions"
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

          <section className="min-w-0 space-y-6">
            {status === "generating" ? (
              <div className="flex min-h-[650px] flex-col items-center justify-center rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
                <div className="relative">
                  <div className="h-20 w-20 animate-spin rounded-full border-4 border-muted border-t-primary" />

                  <Sparkles className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 text-primary" />
                </div>

                <h2 className="mt-8 text-xl font-semibold">
                  SYRAVEN is building your presentation
                </h2>

                <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                  Creating the narrative structure, organizing
                  slides, and preparing your strategic
                  presentation.
                </p>

                <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Generating intelligent slide structure...
                </div>
              </div>
            ) : selectedProject && activeSlide ? (
              <>
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
                      {presentationStyles.find(
                        (style) =>
                          style.id === selectedProject.style,
                      )?.name ?? "Professional"}{" "}
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
                          SYRAVEN Intelligence
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
                                  {String(index + 1).padStart(
                                    2,
                                    "0",
                                  )}
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

                  <div className="flex max-w-full items-center justify-center gap-1 overflow-x-auto py-1">
                    {selectedProject.slides.map(
                      (slide, index) => (
                        <button
                          key={slide.id}
                          type="button"
                          onClick={() =>
                            setActiveSlideIndex(index)
                          }
                          className={[
                            "h-2 shrink-0 rounded-full transition-all",
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
                  Enter your presentation topic, define your
                  audience, choose a visual style, and let
                  SYRAVEN create a structured presentation.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    document
                      .getElementById("presentation-topic")
                      ?.focus();
                  }}
                  className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
                >
                  <Sparkles className="h-4 w-4" />
                  Start Creating
                </button>
              </div>
            )}

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

                    const styleName =
                      presentationStyles.find(
                        (style) =>
                          style.id === project.style,
                      )?.name ?? "Professional";

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
                              {project.slides.length} slides ·{" "}
                              {styleName}
                            </p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            deleteProject(project.id)
                          }
                          className="inline-flex items-center justify-center rounded-lg border border-border p-2 text-muted-foreground transition hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Delete ${project.title}`}
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