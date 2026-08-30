"use client";

import { ChangeEvent, DragEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";

type GenerationStatus = "idle" | "generating" | "completed" | "error";

type GeneratedImage = {
  id: string;
  url: string;
  prompt: string;
  createdAt: string;
  style: string;
  aspectRatio: string;
};

const IMAGE_STYLES = [
  {
    id: "photorealistic",
    name: "Photorealistic",
    description: "Ultra realistic photography",
  },
  {
    id: "cinematic",
    name: "Cinematic",
    description: "Movie-quality visual composition",
  },
  {
    id: "digital-art",
    name: "Digital Art",
    description: "Modern high-end digital artwork",
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Clean and elegant visual language",
  },
  {
    id: "anime",
    name: "Anime",
    description: "Premium anime illustration style",
  },
  {
    id: "concept-art",
    name: "Concept Art",
    description: "Detailed futuristic concept design",
  },
];

const ASPECT_RATIOS = [
  { id: "1:1", name: "Square", width: "1", height: "1" },
  { id: "16:9", name: "Landscape", width: "16", height: "9" },
  { id: "9:16", name: "Portrait", width: "9", height: "16" },
  { id: "4:3", name: "Classic", width: "4", height: "3" },
];

const QUALITY_OPTIONS = [
  {
    id: "standard",
    name: "Standard",
    description: "Fast generation",
  },
  {
    id: "high",
    name: "High",
    description: "Enhanced detail",
  },
  {
    id: "ultra",
    name: "Ultra",
    description: "Maximum quality",
  },
];

export default function StudioImagePage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("photorealistic");
  const [selectedRatio, setSelectedRatio] = useState("1:1");
  const [selectedQuality, setSelectedQuality] = useState("high");
  const [imageCount, setImageCount] = useState(1);

  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const selectedStyleData = useMemo(
    () => IMAGE_STYLES.find((style) => style.id === selectedStyle),
    [selectedStyle]
  );

  const selectedRatioData = useMemo(
    () => ASPECT_RATIOS.find((ratio) => ratio.id === selectedRatio),
    [selectedRatio]
  );

  const handleFile = (file: File | undefined) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload a valid image file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Image size must be smaller than 10MB.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        setUploadedImage(reader.result);
        setError(null);
      }
    };

    reader.readAsDataURL(file);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFile(event.target.files?.[0]);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    handleFile(event.dataTransfer.files?.[0]);
  };

  const generateImages = async () => {
    if (!prompt.trim()) {
      setError("Please describe the image you want to create.");
      return;
    }

    setError(null);
    setStatus("generating");

    try {
      /*
       * API entegrasyonu burada yapılacak.
       *
       * Örnek:
       *
       * const response = await fetch("/api/studio/image", {
       *   method: "POST",
       *   headers: {
       *     "Content-Type": "application/json",
       *   },
       *   body: JSON.stringify({
       *     prompt,
       *     negativePrompt,
       *     style: selectedStyle,
       *     aspectRatio: selectedRatio,
       *     quality: selectedQuality,
       *     imageCount,
       *     referenceImage: uploadedImage,
       *   }),
       * });
       *
       * const data = await response.json();
       */

      await new Promise((resolve) => setTimeout(resolve, 1800));

      const newImages: GeneratedImage[] = Array.from(
        { length: imageCount },
        (_, index) => ({
          id: `${Date.now()}-${index}`,
          url:
            uploadedImage ||
            `https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80`,
          prompt,
          createdAt: new Date().toISOString(),
          style: selectedStyleData?.name || selectedStyle,
          aspectRatio: selectedRatioData?.name || selectedRatio,
        })
      );

      setGeneratedImages((previous) => [...newImages, ...previous]);
      setStatus("completed");
    } catch {
      setError("Image generation failed. Please try again.");
      setStatus("error");
    }
  };

  const clearReferenceImage = () => {
    setUploadedImage(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const downloadImage = async (image: GeneratedImage) => {
    try {
      const response = await fetch(image.url);
      const blob = await response.blob();

      const objectUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `syraven-image-${image.id}.jpg`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(objectUrl);
    } catch {
      setError("Unable to download this image.");
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 flex flex-col gap-6 border-b border-border pb-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Link
                href="/studio"
                className="transition hover:text-foreground"
              >
                Studio
              </Link>

              <span>/</span>

              <span className="text-foreground">Image</span>
            </div>

            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              AI Image Studio
            </h1>

            <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
              Transform ideas into high-quality visuals with advanced AI image
              generation.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/studio"
              className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition hover:bg-muted"
            >
              Back to Studio
            </Link>

            <button
              type="button"
              onClick={() => {
                setPrompt("");
                setNegativePrompt("");
                setUploadedImage(null);
                setError(null);
              }}
              className="inline-flex items-center justify-center rounded-xl bg-muted px-4 py-2.5 text-sm font-medium transition hover:bg-muted/70"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* Main workspace */}
          <section className="space-y-8">
            {/* Prompt */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Describe your image</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Be specific about composition, lighting, subjects and mood.
                  </p>
                </div>

                <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                  {prompt.length} characters
                </span>
              </div>

              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="A futuristic European city at sunset, autonomous vehicles, sustainable architecture, cinematic lighting, ultra detailed..."
                rows={7}
                className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
              />

              <div className="mt-4">
                <label className="mb-2 block text-sm font-medium">
                  Negative prompt
                </label>

                <input
                  value={negativePrompt}
                  onChange={(event) => setNegativePrompt(event.target.value)}
                  placeholder="blur, distortion, low quality, text, watermark..."
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {/* Styles */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-5">
                <h2 className="text-lg font-semibold">Visual style</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose the creative direction for your image.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {IMAGE_STYLES.map((style) => {
                  const isSelected = selectedStyle === style.id;

                  return (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setSelectedStyle(style.id)}
                      className={`rounded-xl border p-4 text-left transition ${
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:border-primary/40 hover:bg-muted/40"
                      }`}
                    >
                      <div className="font-medium">{style.name}</div>

                      <div className="mt-1 text-xs leading-5 text-muted-foreground">
                        {style.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Generated images */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Generated images</h2>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Your latest AI generations will appear here.
                  </p>
                </div>

                {generatedImages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setGeneratedImages([])}
                    className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
                  >
                    Clear history
                  </button>
                )}
              </div>

              {status === "generating" && (
                <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-primary/40 bg-primary/[0.03] p-8 text-center">
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-primary" />

                  <h3 className="mt-5 font-semibold">Creating your image</h3>

                  <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                    Our AI is processing your prompt and building the visual
                    composition.
                  </p>
                </div>
              )}

              {status !== "generating" && generatedImages.length === 0 && (
                <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center">
                  <div className="text-5xl">✦</div>

                  <h3 className="mt-5 text-lg font-semibold">
                    Your creative workspace is ready
                  </h3>

                  <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                    Enter a detailed prompt and generate your first AI image.
                  </p>
                </div>
              )}

              {status !== "generating" && generatedImages.length > 0 && (
                <div className="grid gap-5 sm:grid-cols-2">
                  {generatedImages.map((image) => (
                    <article
                      key={image.id}
                      className="group overflow-hidden rounded-2xl border border-border bg-background"
                    >
                      <div className="relative aspect-square overflow-hidden bg-muted">
                        <img
                          src={image.url}
                          alt={image.prompt}
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                        />
                      </div>

                      <div className="p-4">
                        <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                          {image.prompt}
                        </p>

                        <div className="mt-4 flex items-center justify-between gap-3">
                          <div className="flex gap-2">
                            <span className="rounded-full bg-muted px-2.5 py-1 text-xs">
                              {image.style}
                            </span>

                            <span className="rounded-full bg-muted px-2.5 py-1 text-xs">
                              {image.aspectRatio}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => downloadImage(image)}
                            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-muted"
                          >
                            Download
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Settings sidebar */}
          <aside className="space-y-6">
            {/* Reference image */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="font-semibold">Reference image</h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Upload an image for visual guidance.
                </p>
              </div>

              {uploadedImage ? (
                <div className="relative overflow-hidden rounded-xl border border-border">
                  <img
                    src={uploadedImage}
                    alt="Reference upload"
                    className="aspect-square w-full object-cover"
                  />

                  <button
                    type="button"
                    onClick={clearReferenceImage}
                    className="absolute right-3 top-3 rounded-lg bg-background/90 px-3 py-2 text-xs font-medium shadow-sm backdrop-blur transition hover:bg-background"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div
                  onDrop={handleDrop}
                  onDragOver={(event) => event.preventDefault()}
                  className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center transition hover:border-primary/50 hover:bg-primary/[0.03]"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="text-3xl">↑</div>

                  <p className="mt-3 text-sm font-medium">
                    Drop an image here
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    PNG, JPG or WEBP · Max 10MB
                  </p>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Aspect ratio */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h2 className="font-semibold">Aspect ratio</h2>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {ASPECT_RATIOS.map((ratio) => {
                  const isSelected = selectedRatio === ratio.id;

                  return (
                    <button
                      key={ratio.id}
                      type="button"
                      onClick={() => setSelectedRatio(ratio.id)}
                      className={`rounded-xl border p-3 text-left transition ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className="text-sm font-medium">{ratio.name}</div>

                      <div className="mt-1 text-xs text-muted-foreground">
                        {ratio.id}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quality */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h2 className="font-semibold">Generation quality</h2>

              <div className="mt-4 space-y-2">
                {QUALITY_OPTIONS.map((quality) => {
                  const isSelected = selectedQuality === quality.id;

                  return (
                    <button
                      key={quality.id}
                      type="button"
                      onClick={() => setSelectedQuality(quality.id)}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className="text-sm font-medium">{quality.name}</div>

                      <div className="mt-1 text-xs text-muted-foreground">
                        {quality.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Image count */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">Number of images</h2>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Generate up to 4 variations.
                  </p>
                </div>

                <div className="flex items-center rounded-xl border border-border">
                  <button
                    type="button"
                    onClick={() =>
                      setImageCount((current) => Math.max(1, current - 1))
                    }
                    className="px-3 py-2 transition hover:bg-muted"
                  >
                    −
                  </button>

                  <span className="min-w-10 text-center text-sm font-semibold">
                    {imageCount}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setImageCount((current) => Math.min(4, current + 1))
                    }
                    className="px-3 py-2 transition hover:bg-muted"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Generate */}
            <button
              type="button"
              onClick={generateImages}
              disabled={status === "generating"}
              className="flex w-full items-center justify-center rounded-xl bg-primary px-5 py-4 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "generating"
                ? "Generating..."
                : "Generate AI Image"}
            </button>

            <p className="text-center text-xs leading-5 text-muted-foreground">
              Generation settings: {selectedStyleData?.name} ·{" "}
              {selectedRatioData?.name} · {selectedQuality}
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}