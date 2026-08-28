"use client";

import {
  AlertCircle,
  Archive,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Database,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Globe2,
  Layers3,
  Loader2,
  Plus,
  Sparkles,
} from "lucide-react";
import {
  useMemo,
  useState,
} from "react";

export type KnowledgeSidebarFilter =
  | "all"
  | "ready"
  | "processing"
  | "queued"
  | "error"
  | "draft"
  | "documents"
  | "images"
  | "spreadsheets"
  | "code"
  | "web";

export type KnowledgeSidebarCounts =
  Partial<
    Record<
      KnowledgeSidebarFilter,
      number
    >
  >;

export type KnowledgeSidebarProps = {
  value?: KnowledgeSidebarFilter;
  defaultValue?: KnowledgeSidebarFilter;

  counts?: KnowledgeSidebarCounts;

  title?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;

  disabled?: boolean;
  className?: string;

  showStatusFilters?: boolean;
  showTypeFilters?: boolean;
  showSummary?: boolean;

  onChange?: (
    value: KnowledgeSidebarFilter
  ) => void;

  onCreate?: () => void;
};

type SidebarItem = {
  value: KnowledgeSidebarFilter;
  label: string;
  icon: typeof Database;
};

const STATUS_ITEMS: SidebarItem[] = [
  {
    value: "ready",
    label: "Ready",
    icon: CheckCircle2,
  },
  {
    value: "processing",
    label: "Processing",
    icon: Loader2,
  },
  {
    value: "queued",
    label: "Queued",
    icon: Clock3,
  },
  {
    value: "error",
    label: "Errors",
    icon: AlertCircle,
  },
  {
    value: "draft",
    label: "Drafts",
    icon: FileText,
  },
];

const TYPE_ITEMS: SidebarItem[] = [
  {
    value: "documents",
    label: "Documents",
    icon: FileText,
  },
  {
    value: "images",
    label: "Images",
    icon: FileImage,
  },
  {
    value: "spreadsheets",
    label: "Spreadsheets",
    icon: FileSpreadsheet,
  },
  {
    value: "code",
    label: "Code",
    icon: FileCode2,
  },
  {
    value: "web",
    label: "Web sources",
    icon: Globe2,
  },
];

function normalizeCount(
  value?: number
) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    return 0;
  }

  return Math.floor(value);
}

function formatCount(
  value: number
) {
  return new Intl.NumberFormat().format(
    value
  );
}

export default function KnowledgeSidebar({
  value,
  defaultValue = "all",
  counts = {},
  title = "Knowledge",
  collapsible = true,
  defaultCollapsed = false,
  disabled = false,
  className = "",
  showStatusFilters = true,
  showTypeFilters = true,
  showSummary = true,
  onChange,
  onCreate,
}: KnowledgeSidebarProps) {
  const isControlled =
    value !== undefined;

  const [
    internalValue,
    setInternalValue,
  ] =
    useState<KnowledgeSidebarFilter>(
      defaultValue
    );

  const [
    collapsed,
    setCollapsed,
  ] = useState(
    defaultCollapsed
  );

  const currentValue =
    isControlled
      ? value
      : internalValue;

  const totalCount =
    useMemo(() => {
      if (
        typeof counts.all ===
          "number" &&
        Number.isFinite(
          counts.all
        )
      ) {
        return normalizeCount(
          counts.all
        );
      }

      const knownKeys: KnowledgeSidebarFilter[] =
        [
          "ready",
          "processing",
          "queued",
          "error",
          "draft",
        ];

      return knownKeys.reduce(
        (total, key) =>
          total +
          normalizeCount(
            counts[key]
          ),
        0
      );
    }, [counts]);

  const updateValue = (
    nextValue: KnowledgeSidebarFilter
  ) => {
    if (
      disabled ||
      nextValue ===
        currentValue
    ) {
      return;
    }

    if (!isControlled) {
      setInternalValue(
        nextValue
      );
    }

    onChange?.(
      nextValue
    );
  };

  const renderItem = (
    item: SidebarItem
  ) => {
    const Icon =
      item.icon;

    const count =
      normalizeCount(
        counts[item.value]
      );

    const isActive =
      currentValue ===
      item.value;

    const isProcessing =
      item.value ===
        "processing" &&
      count > 0;

    return (
      <button
        key={item.value}
        type="button"
        disabled={disabled}
        onClick={() =>
          updateValue(
            item.value
          )
        }
        className={[
          "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
          disabled
            ? "cursor-not-allowed opacity-50"
            : "",
        ].join(" ")}
        aria-pressed={
          isActive
        }
      >
        <Icon
          className={[
            "h-4 w-4 shrink-0",
            isProcessing
              ? "animate-spin"
              : "",
          ].join(" ")}
        />

        <span className="min-w-0 flex-1 truncate">
          {item.label}
        </span>

        <span
          className={[
            "rounded-md px-1.5 py-0.5 text-[10px] font-medium",
            isActive
              ? "bg-primary/15 text-primary"
              : "bg-muted text-muted-foreground",
          ].join(" ")}
        >
          {formatCount(
            count
          )}
        </span>
      </button>
    );
  };

  return (
    <aside
      className={[
        "w-full overflow-hidden rounded-2xl border border-white/10 bg-background",
        className,
      ].join(" ")}
    >
      <div className="flex items-center gap-3 border-b border-white/10 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
          <BookOpen className="h-4 w-4 text-primary" />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">
            {title}
          </h2>

          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {formatCount(
              totalCount
            )} knowledge item
            {totalCount === 1
              ? ""
              : "s"}
          </p>
        </div>

        {collapsible ? (
          <button
            type="button"
            onClick={() => {
              setCollapsed(
                (current) =>
                  !current
              );
            }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={
              collapsed
                ? "Expand knowledge sidebar"
                : "Collapse knowledge sidebar"
            }
            aria-expanded={
              !collapsed
            }
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        ) : null}
      </div>

      {!collapsed ? (
        <div className="p-3">
          {onCreate ? (
            <button
              type="button"
              disabled={disabled}
              onClick={onCreate}
              className="mb-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />

              Add knowledge
            </button>
          ) : null}

          <div className="space-y-1">
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                updateValue("all")
              }
              className={[
                "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                currentValue === "all"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                disabled
                  ? "cursor-not-allowed opacity-50"
                  : "",
              ].join(" ")}
              aria-pressed={
                currentValue ===
                "all"
              }
            >
              <Database className="h-4 w-4 shrink-0" />

              <span className="flex-1">
                All knowledge
              </span>

              <span
                className={[
                  "rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                  currentValue ===
                  "all"
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground",
                ].join(" ")}
              >
                {formatCount(
                  totalCount
                )}
              </span>
            </button>

            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                updateValue(
                  "documents"
                )
              }
              className={[
                "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                currentValue ===
                "documents"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                disabled
                  ? "cursor-not-allowed opacity-50"
                  : "",
              ].join(" ")}
              aria-pressed={
                currentValue ===
                "documents"
              }
            >
              <FolderOpen className="h-4 w-4 shrink-0" />

              <span className="flex-1">
                Library
              </span>

              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {formatCount(
                  normalizeCount(
                    counts.documents
                  )
                )}
              </span>
            </button>
          </div>

          {showStatusFilters ? (
            <SidebarSection
              title="Status"
            >
              {STATUS_ITEMS.map(
                renderItem
              )}
            </SidebarSection>
          ) : null}

          {showTypeFilters ? (
            <SidebarSection
              title="Content type"
            >
              {TYPE_ITEMS.map(
                renderItem
              )}
            </SidebarSection>
          ) : null}

          {showSummary ? (
            <div className="mt-5 rounded-xl border border-white/10 bg-muted/20 p-3">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-medium">
                    Knowledge base
                  </p>

                  <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                    {normalizeCount(
                      counts.ready
                    )} ready ·{" "}
                    {normalizeCount(
                      counts.processing
                    )} processing ·{" "}
                    {normalizeCount(
                      counts.error
                    )} errors
                  </p>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <Layers3 className="h-3.5 w-3.5 text-muted-foreground" />

                <span className="text-[11px] text-muted-foreground">
                  {formatCount(
                    totalCount
                  )} indexed sources
                </span>
              </div>
            </div>
          ) : null}

          <div className="hidden">
            <Archive />
          </div>
        </div>
      ) : null}
    </aside>
  );
}

type SidebarSectionProps = {
  title: string;
  children: React.ReactNode;
};

function SidebarSection({
  title,
  children,
}: SidebarSectionProps) {
  return (
    <section className="mt-5">
      <h3 className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>

      <div className="space-y-1">
        {children}
      </div>
    </section>
  );
}

export {
  STATUS_ITEMS,
  TYPE_ITEMS,
  formatCount,
  normalizeCount,
};