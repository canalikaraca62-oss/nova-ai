"use client";

import {
  ChangeEvent,
  DragEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AudioLines,
  Check,
  Download,
  FileAudio,
  Loader2,
  Mic,
  Music2,
  Pause,
  Play,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  WandSparkles,
  X,
} from "lucide-react";

type AudioStatus = "ready" | "processing" | "completed" | "error";

type AudioProject = {
  id: string;
  name: string;
  size: number;
  duration: number;
  url: string;
  createdAt: Date;
  status: AudioStatus;
};

type EnhancementMode =
  | "clean"
  | "voice"
  | "podcast"
  | "music"
  | "studio";

const MAX_FILE_SIZE = 100 * 1024 * 1024;

const enhancementModes: Array<{
  id: EnhancementMode;
  title: string;
  description: string;
  icon: typeof Sparkles;
}> = [
  {
    id: "clean",
    title: "Clean Audio",
    description: "Remove noise and improve clarity",
    icon: Sparkles,
  },
  {
    id: "voice",
    title: "Voice Enhance",
    description: "Improve speech presence and detail",
    icon: Mic,
  },
  {
    id: "podcast",
    title: "Podcast",
    description: "Balanced voice processing",
    icon: AudioLines,
  },
  {
    id: "music",
    title: "Music",
    description: "Preserve dynamics and richness",
    icon: Music2,
  },
  {
    id: "studio",
    title: "Studio Master",
    description: "Professional mastering preset",
    icon: WandSparkles,
  },
];

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 MB";
  }

  const megabytes = bytes / (1024 * 1024);

  if (megabytes < 1) {
    return `${Math.max(0.1, megabytes).toFixed(1)} MB`;
  }

  return `${megabytes.toFixed(1)} MB`;
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "00:00";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`;
}

function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    const objectUrl = URL.createObjectURL(file);

    audio.preload = "metadata";
    audio.src = objectUrl;

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      audio.remove();
    };

    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;

      cleanup();
      resolve(duration);
    };

    audio.onerror = () => {
      cleanup();
      resolve(0);
    };
  });
}

export default function AudioStudioPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [projects, setProjects] = useState<AudioProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [selectedMode, setSelectedMode] =
    useState<EnhancementMode>("studio");

  const [isDragging, setIsDragging] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(80);
  const [error, setError] = useState<string | null>(null);

  const selectedProject = useMemo(() => {
    return (
      projects.find((project) => project.id === selectedProjectId) ?? null
    );
  }, [projects, selectedProjectId]);

  useEffect(() => {
    return () => {
      projects.forEach((project) => {
        URL.revokeObjectURL(project.url);
      });
    };
  }, [projects]);

  useEffect(() => {
    if (!audioRef.current) {
      return;
    }

    audioRef.current.volume = volume / 100;
  }, [volume]);

  const processFile = async (file: File) => {
    setError(null);

    if (!file.type.startsWith("audio/")) {
      setError("Please upload a valid audio file.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("Audio file must be smaller than 100 MB.");
      return;
    }

    const id = crypto.randomUUID();
    const url = URL.createObjectURL(file);
    const duration = await getAudioDuration(file);

    const newProject: AudioProject = {
      id,
      name: file.name,
      size: file.size,
      duration,
      url,
      createdAt: new Date(),
      status: "ready",
    };

    setProjects((currentProjects) => [newProject, ...currentProjects]);
    setSelectedProjectId(id);
    setCurrentTime(0);
    setIsPlaying(false);
  };

  const handleFileChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    await processFile(file);
    event.target.value = "";
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];

    if (!file) {
      return;
    }

    await processFile(file);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const togglePlayback = async () => {
    if (!selectedProject || !audioRef.current) {
      return;
    }

    try {
      if (audioRef.current.paused) {
        await audioRef.current.play();
        setIsPlaying(true);
      } else {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    } catch {
      setError("Audio playback could not be started.");
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) {
      return;
    }

    setCurrentTime(audioRef.current.currentTime);
  };

  const handleSeek = (value: number) => {
    if (!audioRef.current) {
      return;
    }

    audioRef.current.currentTime = value;
    setCurrentTime(value);
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const removeProject = (projectId: string) => {
    setProjects((currentProjects) => {
      const project = currentProjects.find(
        (item) => item.id === projectId,
      );

      if (project) {
        URL.revokeObjectURL(project.url);
      }

      return currentProjects.filter((item) => item.id !== projectId);
    });

    if (selectedProjectId === projectId) {
      setSelectedProjectId(null);
      setCurrentTime(0);
      setIsPlaying(false);
    }
  };

  const enhanceAudio = async () => {
    if (!selectedProject) {
      setError("Upload and select an audio file first.");
      return;
    }

    setError(null);

    setProjects((currentProjects) =>
      currentProjects.map((project) =>
        project.id === selectedProject.id
          ? {
              ...project,
              status: "processing",
            }
          : project,
      ),
    );

    await new Promise((resolve) => {
      window.setTimeout(resolve, 1800);
    });

    setProjects((currentProjects) =>
      currentProjects.map((project) =>
        project.id === selectedProject.id
          ? {
              ...project,
              status: "completed",
            }
          : project,
      ),
    );
  };

  const downloadAudio = () => {
    if (!selectedProject) {
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = selectedProject.url;
    anchor.download = selectedProject.name;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  const selectedModeData = enhancementModes.find(
    (mode) => mode.id === selectedMode,
  );

  const progress =
    selectedProject && selectedProject.duration > 0
      ? Math.min((currentTime / selectedProject.duration) * 100, 100)
      : 0;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <section className="mb-8 flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Music2 className="h-4 w-4" />
              <span>Syraven Studio</span>
              <span>/</span>
              <span>Audio Intelligence</span>
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              AI Audio Studio
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Upload, enhance, clean and preview audio with intelligent
              processing designed for professional workflows.
            </p>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Upload className="h-4 w-4" />
            Upload Audio
          </button>
        </section>

        {error ? (
          <div className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <span>{error}</span>

            <button
              type="button"
              onClick={() => setError(null)}
              className="rounded-md p-1 transition-colors hover:bg-destructive/10"
              aria-label="Close error"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          {/* Main Studio */}
          <div className="space-y-6">
            {/* Upload Area */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={[
                "relative overflow-hidden rounded-2xl border border-dashed p-8 transition-all sm:p-12",
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/50",
              ].join(" ")}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={handleFileChange}
              />

              <div className="mx-auto flex max-w-md flex-col items-center text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-background shadow-sm">
                  <FileAudio className="h-7 w-7 text-primary" />
                </div>

                <h2 className="text-lg font-semibold text-foreground">
                  Upload an audio file
                </h2>

                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Drag and drop your audio here or choose a file from your
                  device.
                </p>

                <p className="mt-2 text-xs text-muted-foreground">
                  MP3, WAV, M4A, AAC and other browser-supported formats · Max
                  100 MB
                </p>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-6 inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <Upload className="h-4 w-4" />
                  Choose File
                </button>
              </div>
            </div>

            {/* Selected Audio */}
            {selectedProject ? (
              <section className="overflow-hidden rounded-2xl border border-border bg-card">
                <audio
                  ref={audioRef}
                  src={selectedProject.url}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={handleAudioEnded}
                  onPause={() => setIsPlaying(false)}
                  onPlay={() => setIsPlaying(true)}
                />

                <div className="border-b border-border p-5 sm:p-6">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-center gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <AudioLines className="h-6 w-6 text-primary" />
                      </div>

                      <div className="min-w-0">
                        <h2 className="truncate font-semibold text-foreground">
                          {selectedProject.name}
                        </h2>

                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span>{formatFileSize(selectedProject.size)}</span>
                          <span>
                            {formatDuration(selectedProject.duration)}
                          </span>
                          <span>
                            {selectedProject.status === "processing"
                              ? "Processing"
                              : selectedProject.status === "completed"
                                ? "Enhanced"
                                : "Ready"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeProject(selectedProject.id)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </button>
                  </div>
                </div>

                <div className="space-y-6 p-5 sm:p-6">
                  {/* Waveform */}
                  <div className="rounded-xl border border-border bg-background p-4">
                    <div className="mb-4 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatDuration(currentTime)}</span>
                      <span>{formatDuration(selectedProject.duration)}</span>
                    </div>

                    <div className="relative h-24 overflow-hidden rounded-lg bg-muted/40">
                      <div className="absolute inset-0 flex items-center justify-around px-2">
                        {Array.from({ length: 64 }).map((_, index) => {
                          const height =
                            20 +
                            Math.abs(
                              Math.sin(index * 0.73) *
                                52 *
                                (0.6 + (index % 5) / 10),
                            );

                          return (
                            <div
                              key={index}
                              className="w-1 rounded-full bg-primary/40"
                              style={{
                                height: `${Math.min(height, 76)}%`,
                              }}
                            />
                          );
                        })}
                      </div>

                      <div
                        className="absolute bottom-0 left-0 top-0 bg-primary/10"
                        style={{
                          width: `${progress}%`,
                        }}
                      />

                      <div
                        className="absolute bottom-0 top-0 w-0.5 bg-primary"
                        style={{
                          left: `${progress}%`,
                        }}
                      />
                    </div>

                    <input
                      type="range"
                      min="0"
                      max={selectedProject.duration || 0}
                      step="0.01"
                      value={currentTime}
                      onChange={(event) =>
                        handleSeek(Number(event.target.value))
                      }
                      className="mt-4 w-full cursor-pointer accent-primary"
                    />

                    <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={togglePlayback}
                          className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105"
                          aria-label={
                            isPlaying ? "Pause audio" : "Play audio"
                          }
                        >
                          {isPlaying ? (
                            <Pause className="h-5 w-5 fill-current" />
                          ) : (
                            <Play className="ml-0.5 h-5 w-5 fill-current" />
                          )}
                        </button>

                        <span className="text-sm font-medium text-foreground">
                          {isPlaying ? "Playing" : "Ready to play"}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <Volume2 className="h-4 w-4 text-muted-foreground" />

                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={volume}
                          onChange={(event) =>
                            setVolume(Number(event.target.value))
                          }
                          className="w-28 cursor-pointer accent-primary"
                          aria-label="Volume"
                        />

                        <span className="w-9 text-right text-xs text-muted-foreground">
                          {volume}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Enhancement */}
                  <div>
                    <div className="mb-4">
                      <h3 className="font-semibold text-foreground">
                        AI Enhancement
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Select an intelligent processing profile.
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {enhancementModes.map((mode) => {
                        const Icon = mode.icon;
                        const isSelected = selectedMode === mode.id;

                        return (
                          <button
                            key={mode.id}
                            type="button"
                            onClick={() => setSelectedMode(mode.id)}
                            className={[
                              "relative rounded-xl border p-4 text-left transition-all",
                              isSelected
                                ? "border-primary bg-primary/5 shadow-sm"
                                : "border-border bg-background hover:border-primary/40",
                            ].join(" ")}
                          >
                            {isSelected ? (
                              <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                <Check className="h-3 w-3" />
                              </div>
                            ) : null}

                            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                              <Icon className="h-4 w-4 text-foreground" />
                            </div>

                            <h4 className="text-sm font-semibold text-foreground">
                              {mode.title}
                            </h4>

                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                              {mode.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row">
                    <button
                      type="button"
                      onClick={enhanceAudio}
                      disabled={selectedProject.status === "processing"}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {selectedProject.status === "processing" ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Processing Audio...
                        </>
                      ) : (
                        <>
                          <WandSparkles className="h-4 w-4" />
                          Enhance with{" "}
                          {selectedModeData?.title ?? "AI"}
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={downloadAudio}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </button>
                  </div>
                </div>
              </section>
            ) : (
              <section className="rounded-2xl border border-border bg-card p-8 text-center sm:p-12">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                  <Music2 className="h-6 w-6 text-muted-foreground" />
                </div>

                <h2 className="mt-5 text-lg font-semibold text-foreground">
                  Your audio workspace is ready
                </h2>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  Upload an audio file to start cleaning, enhancing and
                  processing your sound.
                </p>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <aside className="space-y-6">
            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h2 className="font-semibold text-foreground">
                  Processing Engine
                </h2>
              </div>

              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-border bg-background p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      Noise Reduction
                    </span>

                    <Check className="h-4 w-4 text-primary" />
                  </div>

                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Intelligent background noise analysis.
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-background p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      Voice Clarity
                    </span>

                    <Check className="h-4 w-4 text-primary" />
                  </div>

                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Improve speech detail and intelligibility.
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-background p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      Dynamic Balance
                    </span>

                    <Check className="h-4 w-4 text-primary" />
                  </div>

                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Maintain consistent professional loudness.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-foreground">
                  Recent Files
                </h2>

                <RefreshCw className="h-4 w-4 text-muted-foreground" />
              </div>

              {projects.length === 0 ? (
                <div className="py-8 text-center">
                  <FileAudio className="mx-auto h-7 w-7 text-muted-foreground" />

                  <p className="mt-3 text-sm text-muted-foreground">
                    No audio files yet
                  </p>
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  {projects.map((project) => {
                    const isSelected =
                      project.id === selectedProjectId;

                    return (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => {
                          setSelectedProjectId(project.id);
                          setCurrentTime(0);
                          setIsPlaying(false);
                        }}
                        className={[
                          "w-full rounded-xl border p-3 text-left transition-colors",
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted/50",
                        ].join(" ")}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                            <FileAudio className="h-4 w-4 text-muted-foreground" />
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {project.name}
                            </p>

                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {formatDuration(project.duration)} ·{" "}
                              {formatFileSize(project.size)}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}