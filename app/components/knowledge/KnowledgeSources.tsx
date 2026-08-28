"use client";

import {
  Check,
  CheckCircle2,
  ChevronDown,
  File,
  FileArchive,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  Globe2,
  Link2,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import {
  useMemo,
  useState,
} from "react";

export type KnowledgeSourceStatus =
  | "ready"
  | "processing"
  | "queued"
  | "error"
  | "draft";

export type KnowledgeSourceType =
  | "file"
  | "url"
  | "text"
  | "database"
  | "other";

export type KnowledgeSource = {
  id: string;

  title?: string | null;
  fileName?: string | null;
  description?: string | null;

  type?: KnowledgeSourceType | string | null;
  mimeType?: string | null;

  sourceUrl?: string | null;

  status?: KnowledgeSourceStatus | string | null;

  size?: number | null;
  chunkCount?: number | null;

  createdAt?: string | null;
  updatedAt?: string | null;
};

export type KnowledgeSourcesProps = {
  sources?: KnowledgeSource[];

  selectedId?: string | null;
  defaultSelectedId?: string | null;

  loading?: boolean;
  disabled?: boolean;

  searchable?: boolean;
  selectable?: boolean;

  title?: string;
  description?: string;

  emptyTitle?: string;
  emptyDescription?: string;

  showAddButton?: boolean;
  showActions?: boolean;

  className?: string;

  onSelect?: (
    source: KnowledgeSource
  ) => void;

  onAdd?: () => void;

  onEdit?: (
    source: KnowledgeSource
  ) => void;

  onDelete?: (
    source: KnowledgeSource
  ) => void | Promise<void>;
};

function normalizeStatus(
  value?: string | null
): KnowledgeSourceStatus {
  switch (
    value
      ?.trim()
      .toLowerCase()
  ) {
    case "ready":
    case "completed":
    case "complete":
    case "active":
    case "indexed":
      return "ready";

    case "processing":
    case "indexing":
    case "embedding":
      return "processing";

    case "queued":
    case "pending":
    case "waiting":
      return "queued";

    case "error":
    case "failed":
    case "failure":
      return "error";

    default:
      return "draft";
  }
}

function normalizeSourceType(
  source: KnowledgeSource
): KnowledgeSourceType {
  const type =
    source.type
      ?.trim()
      .toLowerCase() ?? "";

  if (
    type === "file" ||
    type === "document"
  ) {
    return "file";
  }

  if (
    type === "url" ||
    type === "website" ||
    type === "web"
  ) {
    return "url";
  }

  if (
    type === "text" ||
    type === "note"
  ) {
    return "text";
  }

  if (
    type === "database" ||
    type === "db"
  ) {
    return "database";
  }

  if (source.sourceUrl) {
    return "url";
  }

  if (
    source.fileName ||
    source.mimeType
  ) {
    return "file";
  }

  return "other";
}

function getSourceName(
  source: KnowledgeSource
) {
  return (
    source.title?.trim() ||
    source.fileName?.trim() ||
    source.sourceUrl?.trim() ||
    "Untitled source"
  );
}

function getFileExtension(
  value?: string | null
) {
  if (!value) {
    return "";
  }

  const cleanValue =
    value
      .split("?")[0]
      ?.split("#")[0] ??
    "";

  const parts =
    cleanValue.split(".");

  if (parts.length < 2) {
    return "";
  }

  return (
    parts[
      parts.length - 1
    ]?.toLowerCase() ?? ""
  );
}

function getSourceIcon(
  source: KnowledgeSource
) {
  const sourceType =
    normalizeSourceType(
      source
    );

  if (sourceType === "url") {
    return Globe2;
  }

  if (
    sourceType === "text"
  ) {
    return FileText;
  }

  if (
    sourceType === "database"
  ) {
    return FileSpreadsheet;
  }

  const mimeType =
    source.mimeType
      ?.toLowerCase() ?? "";

  const extension =
    getFileExtension(
      source.fileName ??
        source.title
    );

  if (
    mimeType.startsWith(
      "image/"
    ) ||
    [
      "png",
      "jpg",
      "jpeg",
      "gif",
      "webp",
      "svg",
    ].includes(extension)
  ) {
    return FileImage;
  }

  if (
    mimeType.includes(
      "spreadsheet"
    ) ||
    mimeType.includes(
      "excel"
    ) ||
    [
      "csv",
      "xls",
      "xlsx",
    ].includes(extension)
  ) {
    return FileSpreadsheet;
  }

  if (
    mimeType.includes(
      "json"
    ) ||
    mimeType.includes(
      "javascript"
    ) ||
    mimeType.includes(
      "typescript"
    ) ||
    [
      "json",
      "js",
      "jsx",
      "ts",
      "tsx",
      "py",
      "sql",
      "html",
      "css",
      "xml",
      "yaml",
      "yml",
    ].includes(extension)
  ) {
    return FileCode2;
  }

  if (
    mimeType.includes(
      "zip"
    ) ||
    mimeType.includes(
      "archive"
    ) ||
    [
      "zip",
      "rar",
      "7z",
      "tar",
      "gz",
    ].includes(extension)
  ) {
    return FileArchive;
  }

  if (
    mimeType.includes(
      "pdf"
    ) ||
    mimeType.includes(
      "document"
    ) ||
    mimeType.startsWith(
      "text/"
    ) ||
    [
      "txt",
      "md",
      "pdf",
      "doc",
      "docx",
      "rtf",
    ].includes(extension)
  ) {
    return FileText;
  }

  return File;
}

function getStatusConfig(
  status: KnowledgeSourceStatus
) {
  switch (status) {
    case "ready":
      return {
        label: "Ready",
        icon: CheckCircle2,
        className:
          "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      };

    case "processing":
      return {
        label: "Processing",
        icon: Loader2,
        className:
          "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
      };

    case "queued":
      return {
        label: "Queued",
        icon: Loader2,
        className:
          "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
      };

    case "error":
      return {
        label: "Error",
        icon: XCircle,
        className:
          "border-destructive/20 bg-destructive/10 text-destructive",
      };

    default:
      return {
        label: "Draft",
        icon: FileText,
        className:
          "border-white/10 bg-muted/50 text-muted-foreground",
      };
  }
}

export default function KnowledgeSources({
  sources = [],

  selectedId,
  defaultSelectedId = null,

  loading = false,
  disabled = false,

  searchable = true,
  selectable = true,

  title = "Knowledge sources",
  description = "Manage the sources used by your knowledge base.",

  emptyTitle = "No knowledge sources",
  emptyDescription = "Add a file, website, or other source to get started.",

  showAddButton = true,
  showActions = true,

  className = "",

  onSelect,
  onAdd,
  onEdit,
  onDelete,
}: KnowledgeSourcesProps) {
  const isControlled =
    selectedId !== undefined;

  const [
    internalSelectedId,
    setInternalSelectedId,
  ] = useState<string | null>(
    defaultSelectedId
  );

  const [
    query,
    setQuery,
  ] = useState("");

  const [
    openActionId,
    setOpenActionId,
  ] = useState<string | null>(
    null
  );

  const [
    deletingId,
    setDeletingId,
  ] = useState<string | null>(
    null
  );

  const currentSelectedId =
    isControlled
      ? selectedId ?? null
      : internalSelectedId;

  const filteredSources =
    useMemo(() => {
      const normalizedQuery =
        query
          .trim()
          .toLowerCase();

      if (!normalizedQuery) {
        return sources;
      }

      return sources.filter(
        (source) => {
          const searchableValue = [
            source.title,
            source.fileName,
            source.description,
            source.sourceUrl,
            source.type,
            source.status,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return searchableValue.includes(
            normalizedQuery
          );
        }
      );
    }, [
      query,
      sources,
    ]);

  const handleSelect = (
    source: KnowledgeSource
  ) => {
    if (
      disabled ||
      !selectable
    ) {
      return;
    }

    if (!isControlled) {
      setInternalSelectedId(
        source.id
      );
    }

    setOpenActionId(null);

    onSelect?.(
      source
    );
  };

  const handleDelete =
    async (
      source: KnowledgeSource
    ) => {
      if (
        !onDelete ||
        disabled ||
        deletingId
      ) {
        return;
      }

      try {
        setDeletingId(
          source.id
        );

        await onDelete(
          source
        );

        if (
          !isControlled &&
          currentSelectedId ===
            source.id
        ) {
          setInternalSelectedId(
            null
          );
        }

        setOpenActionId(
          null
        );
      } finally {
        setDeletingId(
          null
        );
      }
    };

  return (
    <section
      className={[
        "w-full overflow-hidden rounded-2xl border border-white/10 bg-background",
        className,
      ].join(" ")}
    >
      <div className="border-b border-white/10 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">
              {title}
            </h2>

            <p className="mt-1 text-xs text-muted-foreground">
              {description}
            </p>
          </div>

          {showAddButton &&
          onAdd ? (
            <button
              type="button"
              disabled={
                disabled
              }
              onClick={onAdd}
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl bg-primary px-3 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />

              <span className="hidden sm:inline">
                Add source
              </span>
            </button>
          ) : null}
        </div>

        {searchable ? (
          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <input
              type="search"
              value={query}
              disabled={disabled}
              onChange={(
                event
              ) => {
                setQuery(
                  event.target.value
                );
              }}
              placeholder="Search sources..."
              className="h-10 w-full rounded-xl border border-white/10 bg-muted/20 pl-10 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        ) : null}
      </div>

      <div className="max-h-[520px] overflow-y-auto">
        {loading ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 p-6 text-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />

            <p className="text-xs text-muted-foreground">
              Loading knowledge sources...
            </p>
          </div>
        ) : filteredSources.length ===
          0 ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center p-6 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-muted/30">
              {query ? (
                <Search className="h-5 w-5 text-muted-foreground" />
              ) : (
                <Upload className="h-5 w-5 text-muted-foreground" />
              )}
            </div>

            <h3 className="mt-4 text-sm font-medium">
              {query
                ? "No sources found"
                : emptyTitle}
            </h3>

            <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">
              {query
                ? "Try a different search term."
                : emptyDescription}
            </p>

            {!query &&
            showAddButton &&
            onAdd ? (
              <button
                type="button"
                disabled={
                  disabled
                }
                onClick={onAdd}
                className="mt-4 inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />

                Add source
              </button>
            ) : null}
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {filteredSources.map(
              (source) => {
                const name =
                  getSourceName(
                    source
                  );

                const SourceIcon =
                  getSourceIcon(
                    source
                  );

                const status =
                  normalizeStatus(
                    source.status
                  );

                const statusConfig =
                  getStatusConfig(
                    status
                  );

                const StatusIcon =
                  statusConfig.icon;

                const isSelected =
                  currentSelectedId ===
                  source.id;

                const isDeleting =
                  deletingId ===
                  source.id;

                const isActionOpen =
                  openActionId ===
                  source.id;

                return (
                  <div
                    key={source.id}
                    className={[
                      "group relative flex items-center gap-3 p-4 transition-colors",
                      selectable &&
                      !disabled
                        ? "cursor-pointer hover:bg-muted/30"
                        : "",
                      isSelected
                        ? "bg-primary/5"
                        : "",
                    ].join(" ")}
                    onClick={() => {
                      handleSelect(
                        source
                      );
                    }}
                    onKeyDown={(
                      event
                    ) => {
                      if (
                        event.key ===
                          "Enter" ||
                        event.key ===
                          " "
                      ) {
                        event.preventDefault();

                        handleSelect(
                          source
                        );
                      }
                    }}
                    role={
                      selectable
                        ? "button"
                        : undefined
                    }
                    tabIndex={
                      selectable
                        ? 0
                        : -1
                    }
                  >
                    <div
                      className={[
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                        isSelected
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-white/10 bg-muted/30 text-muted-foreground",
                      ].join(" ")}
                    >
                      <SourceIcon className="h-4.5 w-4.5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">
                          {name}
                        </p>

                        {isSelected ? (
                          <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                        ) : null}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          {normalizeSourceType(
                            source
                          ) ===
                          "url" ? (
                            <Link2 className="h-3 w-3" />
                          ) : (
                            <File className="h-3 w-3" />
                          )}

                          {normalizeSourceType(
                            source
                          )}
                        </span>

                        {source.chunkCount !==
                          null &&
                        source.chunkCount !==
                          undefined ? (
                          <>
                            <span>
                              ·
                            </span>

                            <span>
                              {
                                source.chunkCount
                              }{" "}
                              chunks
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <div
                        className={[
                          "hidden items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium sm:inline-flex",
                          statusConfig.className,
                        ].join(" ")}
                      >
                        <StatusIcon
                          className={[
                            "h-3 w-3",
                            status ===
                            "processing"
                              ? "animate-spin"
                              : "",
                          ].join(" ")}
                        />

                        {
                          statusConfig.label
                        }
                      </div>

                      {showActions &&
                      (onEdit ||
                        onDelete) ? (
                        <div
                          className="relative"
                          onClick={(
                            event
                          ) => {
                            event.stopPropagation();
                          }}
                        >
                          <button
                            type="button"
                            disabled={
                              disabled ||
                              isDeleting
                            }
                            onClick={() => {
                              setOpenActionId(
                                isActionOpen
                                  ? null
                                  : source.id
                              );
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100 focus:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={`Actions for ${name}`}
                            aria-expanded={
                              isActionOpen
                            }
                          >
                            {isDeleting ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="h-4 w-4" />
                            )}
                          </button>

                          {isActionOpen ? (
                            <div className="absolute right-0 top-9 z-30 w-36 overflow-hidden rounded-xl border border-white/10 bg-popover p-1 shadow-xl">
                              {onEdit ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenActionId(
                                      null
                                    );

                                    onEdit(
                                      source
                                    );
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors hover:bg-muted"
                                >
                                  <Pencil className="h-3.5 w-3.5" />

                                  Edit
                                </button>
                              ) : null}

                              {onDelete ? (
                                <button
                                  type="button"
                                  disabled={
                                    isDeleting
                                  }
                                  onClick={() => {
                                    void handleDelete(
                                      source
                                    );
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />

                                  Delete
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {!showActions ? (
                        <ChevronDown className="h-4 w-4 rotate-[-90deg] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      ) : null}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export {
  getFileExtension,
  getSourceIcon,
  getSourceName,
  getStatusConfig,
  normalizeSourceType,
  normalizeStatus,
};