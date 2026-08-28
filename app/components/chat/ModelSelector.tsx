"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type ModelCapability =
  | "chat"
  | "reasoning"
  | "code"
  | "vision"
  | "image"
  | "audio"
  | "search"
  | "tools"
  | "fast";

export type ModelProvider =
  | "openai"
  | "anthropic"
  | "google"
  | "groq"
  | "custom"
  | string;

export type ChatModel = {
  id: string;
  name: string;

  provider?: ModelProvider;

  description?: string;

  capabilities?: ModelCapability[];

  contextWindow?: number;

  maxOutputTokens?: number;

  inputPrice?: number | null;

  outputPrice?: number | null;

  badge?: string;

  disabled?: boolean;

  isNew?: boolean;

  isRecommended?: boolean;
};

export type ModelSelectorProps = {
  models?: ChatModel[];

  value?: string | null;

  defaultValue?: string | null;

  placeholder?: string;

  disabled?: boolean;

  loading?: boolean;

  searchable?: boolean;

  showProvider?: boolean;

  showCapabilities?: boolean;

  showPricing?: boolean;

  showContextWindow?: boolean;

  className?: string;

  onChange?: (
    model: ChatModel
  ) => void | Promise<void>;
};

function cn(
  ...classes: Array<
    string | undefined | null | false
  >
) {
  return classes
    .filter(Boolean)
    .join(" ");
}

function formatNumber(
  value?: number
) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return null;
  }

  return new Intl.NumberFormat(
    "en",
    {
      notation: "compact",
      maximumFractionDigits: 1,
    }
  ).format(value);
}

function formatPrice(
  value?: number | null
) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return null;
  }

  if (value === 0) {
    return "Free";
  }

  return `$${value.toFixed(
    value < 0.01 ? 4 : 2
  )}`;
}

function getProviderLabel(
  provider?: string
) {
  if (!provider) {
    return "Custom";
  }

  const normalized =
    provider.toLowerCase();

  const labels: Record<
    string,
    string
  > = {
    openai: "OpenAI",
    anthropic: "Anthropic",
    google: "Google",
    groq: "Groq",
    custom: "Custom",
  };

  return (
    labels[normalized] ??
    provider.charAt(0).toUpperCase() +
      provider.slice(1)
  );
}

function getProviderInitial(
  provider?: string
) {
  const label =
    getProviderLabel(provider);

  return label
    .charAt(0)
    .toUpperCase();
}

function getCapabilityLabel(
  capability: ModelCapability
) {
  const labels: Record<
    ModelCapability,
    string
  > = {
    chat: "Chat",
    reasoning: "Reasoning",
    code: "Code",
    vision: "Vision",
    image: "Image",
    audio: "Audio",
    search: "Search",
    tools: "Tools",
    fast: "Fast",
  };

  return labels[capability];
}

export default function ModelSelector({
  models = [],
  value,
  defaultValue = null,
  placeholder = "Select a model",
  disabled = false,
  loading = false,
  searchable = true,
  showProvider = true,
  showCapabilities = true,
  showPricing = false,
  showContextWindow = true,
  className,
  onChange,
}: ModelSelectorProps) {
  const containerRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const searchInputRef =
    useRef<HTMLInputElement | null>(
      null
    );

  const [open, setOpen] =
    useState(false);

  const [query, setQuery] =
    useState("");

  const [selectedId, setSelectedId] =
    useState<string | null>(
      value ?? defaultValue
    );

  const [isChanging, setIsChanging] =
    useState(false);

  useEffect(() => {
    if (
      value !== undefined
    ) {
      setSelectedId(value);
    }
  }, [value]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleMouseDown = (
      event: MouseEvent
    ) => {
      const target =
        event.target as Node;

      if (
        containerRef.current &&
        !containerRef.current.contains(
          target
        )
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (
        event.key === "Escape"
      ) {
        setOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleMouseDown
    );

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleMouseDown
      );

      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [open]);

  useEffect(() => {
    if (
      open &&
      searchable
    ) {
      const timeout =
        window.setTimeout(() => {
          searchInputRef.current?.focus();
        }, 50);

      return () => {
        window.clearTimeout(timeout);
      };
    }
  }, [
    open,
    searchable,
  ]);

  const selectedModel =
    useMemo(
      () =>
        models.find(
          model =>
            model.id === selectedId
        ) ?? null,
      [
        models,
        selectedId,
      ]
    );

  const filteredModels =
    useMemo(() => {
      const normalizedQuery =
        query
          .trim()
          .toLowerCase();

      if (!normalizedQuery) {
        return models;
      }

      return models.filter(
        model => {
          const searchableText = [
            model.id,
            model.name,
            model.description,
            model.provider,
            model.badge,
            ...(model.capabilities ??
              []),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return searchableText.includes(
            normalizedQuery
          );
        }
      );
    }, [
      models,
      query,
    ]);

  const recommendedModels =
    filteredModels.filter(
      model =>
        model.isRecommended
    );

  const regularModels =
    filteredModels.filter(
      model =>
        !model.isRecommended
    );

  const isBusy =
    disabled ||
    loading ||
    isChanging;

  const handleToggle = () => {
    if (isBusy) {
      return;
    }

    setOpen(
      previous => !previous
    );

    setQuery("");
  };

  const handleSelect = async (
    model: ChatModel
  ) => {
    if (
      isBusy ||
      model.disabled
    ) {
      return;
    }

    const previousId =
      selectedId;

    setSelectedId(model.id);
    setOpen(false);
    setQuery("");

    try {
      setIsChanging(true);

      await onChange?.(model);
    } catch (error) {
      console.error(
        "Model selection failed:",
        error
      );

      if (
        value === undefined
      ) {
        setSelectedId(
          previousId
        );
      }
    } finally {
      setIsChanging(false);
    }
  };

  const renderModelMeta = (
    model: ChatModel
  ) => {
    const context =
      formatNumber(
        model.contextWindow
      );

    const inputPrice =
      formatPrice(
        model.inputPrice
      );

    const outputPrice =
      formatPrice(
        model.outputPrice
      );

    return (
      <>
        {showProvider &&
          model.provider && (
            <span>
              {getProviderLabel(
                model.provider
              )}
            </span>
          )}

        {showContextWindow &&
          context && (
            <>
              {showProvider &&
                model.provider && (
                  <span>•</span>
                )}

              <span>
                {context} context
              </span>
            </>
          )}

        {showPricing &&
          (inputPrice ||
            outputPrice) && (
            <>
              <span>•</span>

              <span>
                {inputPrice ?? "—"} in
                {" / "}
                {outputPrice ?? "—"} out
              </span>
            </>
          )}
      </>
    );
  };

  const renderModel = (
    model: ChatModel
  ) => {
    const isSelected =
      model.id === selectedId;

    return (
      <button
        key={model.id}
        type="button"
        disabled={
          isBusy ||
          model.disabled
        }
        onClick={() =>
          void handleSelect(model)
        }
        className={cn(
          "group flex w-full items-start gap-3 rounded-xl p-3 text-left transition",
          "focus:outline-none focus:ring-2 focus:ring-violet-500/30",
          "disabled:cursor-not-allowed disabled:opacity-50",
          isSelected
            ? "bg-violet-500/10"
            : "hover:bg-zinc-100 dark:hover:bg-zinc-900"
        )}
      >
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-bold transition",
            isSelected
              ? "border-violet-500/30 bg-violet-500/15 text-violet-700 dark:text-violet-300"
              : "border-zinc-200 bg-white text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
          )}
        >
          {getProviderInitial(
            model.provider
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
              {model.name}
            </span>

            {model.isNew && (
              <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                New
              </span>
            )}

            {model.badge && (
              <span className="truncate rounded-md bg-zinc-200 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {model.badge}
              </span>
            )}
          </div>

          {model.description && (
            <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              {model.description}
            </p>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-400 dark:text-zinc-500">
            {renderModelMeta(
              model
            )}
          </div>

          {showCapabilities &&
            model.capabilities &&
            model.capabilities.length >
              0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {model.capabilities
                  .slice(0, 5)
                  .map(
                    capability => (
                      <span
                        key={
                          capability
                        }
                        className="rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400"
                      >
                        {getCapabilityLabel(
                          capability
                        )}
                      </span>
                    )
                  )}
              </div>
            )}
        </div>

        <div className="flex h-6 w-6 shrink-0 items-center justify-center">
          {isSelected ? (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              className="text-violet-600 dark:text-violet-300"
            >
              <path
                d="m5 12 4 4L19 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              className="opacity-0 transition group-hover:opacity-100 text-zinc-400"
            >
              <path
                d="M9 18l6-6-6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
      </button>
    );
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full max-w-sm",
        className
      )}
    >
      <button
        type="button"
        disabled={isBusy}
        onClick={handleToggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
          "focus:outline-none focus:ring-2 focus:ring-violet-500/30",
          "disabled:cursor-not-allowed disabled:opacity-50",
          open
            ? "border-violet-500/40 bg-white dark:bg-zinc-950"
            : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-xs font-bold text-violet-700 dark:text-violet-300">
          {selectedModel
            ? getProviderInitial(
                selectedModel.provider
              )
            : "AI"}
        </div>

        <div className="min-w-0 flex-1">
          {loading ? (
            <>
              <div className="h-3 w-28 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
              <div className="mt-1.5 h-2 w-20 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
            </>
          ) : selectedModel ? (
            <>
              <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
                {selectedModel.name}
              </p>

              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                {getProviderLabel(
                  selectedModel.provider
                )}
              </p>
            </>
          ) : (
            <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
              {placeholder}
            </p>
          )}
        </div>

        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className={cn(
            "shrink-0 text-zinc-400 transition-transform",
            open &&
              "rotate-180"
          )}
        >
          <path
            d="m6 9 6 6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
          {searchable && (
            <div className="border-b border-zinc-200 p-3 dark:border-zinc-800">
              <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                  className="shrink-0 text-zinc-400"
                >
                  <circle
                    cx="11"
                    cy="11"
                    r="6"
                    stroke="currentColor"
                    strokeWidth="2"
                  />

                  <path
                    d="m20 20-4.5-4.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>

                <input
                  ref={searchInputRef}
                  value={query}
                  onChange={event =>
                    setQuery(
                      event.target.value
                    )
                  }
                  placeholder="Search models..."
                  className="min-w-0 flex-1 bg-transparent text-sm text-zinc-800 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
                />

                {query && (
                  <button
                    type="button"
                    onClick={() =>
                      setQuery("")
                    }
                    className="text-xs text-zinc-400 transition hover:text-zinc-700 dark:hover:text-zinc-200"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}

          <div
            role="listbox"
            className="max-h-[480px] overflow-y-auto p-2"
          >
            {recommendedModels.length >
              0 && (
              <div className="pb-2">
                <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">
                  Recommended
                </div>

                <div className="space-y-1">
                  {recommendedModels.map(
                    renderModel
                  )}
                </div>
              </div>
            )}

            {regularModels.length >
              0 && (
              <div>
                {recommendedModels.length >
                  0 && (
                  <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">
                    All models
                  </div>
                )}

                <div className="space-y-1">
                  {regularModels.map(
                    renderModel
                  )}
                </div>
              </div>
            )}

            {filteredModels.length ===
              0 && (
              <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400 dark:bg-zinc-900">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle
                      cx="11"
                      cy="11"
                      r="6"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />

                    <path
                      d="m20 20-4-4"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  No models found
                </p>

                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Try a different search.
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-zinc-200 px-3 py-2 dark:border-zinc-800">
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
              Model availability can depend on
              your plan and configured providers.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}