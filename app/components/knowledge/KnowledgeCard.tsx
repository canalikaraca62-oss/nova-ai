"use client";

import {
  Calendar,
  CheckCircle2,
  Clock3,
  Database,
  Eye,
  File,
  FileArchive,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  Loader2,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  useMemo,
  useState,
} from "react";

export type KnowledgeStatus =
  | "processing"
  | "ready"
  | "error"
  | "queued"
  | "draft";

export type KnowledgeItem = {
  id: string;
  title: string;
  description?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  type?: string | null;
  size?: number | null;
  status?: KnowledgeStatus | string | null;
  chunkCount?: number | null;
  sourceUrl?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type KnowledgeCardProps = {
  item: KnowledgeItem;
  selected?: boolean;
  disabled?: boolean;
  compact?: boolean;
  showActions?: boolean;
  showDescription?: boolean;
  showMetadata?: boolean;
  onClick?: (
    item: KnowledgeItem
  ) => void;
  onView?: (
    item: KnowledgeItem
  ) => void;
  onEdit?: (
    item: KnowledgeItem
  ) => void;
  onDelete?: (
    item: KnowledgeItem
  ) => void | Promise<void>;
};

function getFileExtension(
  fileName?: string | null
) {
  if (!fileName) {
    return "";
  }

  const parts =
    fileName.split(".");

  if (parts.length < 2) {
    return "";
  }

  return (
    parts[
      parts.length - 1
    ]?.toLowerCase() ?? ""
  );
}

function getKnowledgeName(
  item: KnowledgeItem
) {
  return (
    item.title?.trim() ||
    item.fileName?.trim() ||
    "Untitled knowledge"
  );
}

function getFileType(
  item: KnowledgeItem
) {
  return (
    item.mimeType?.trim() ||
    item.type?.trim() ||
    ""
  ).toLowerCase();
}

function getKnowledgeIcon(
  item: KnowledgeItem
) {
  const type =
    getFileType(item);

  const extension =
    getFileExtension(
      item.fileName ??
        item.title
    );

  if (
    type.startsWith("image/") ||
    [
      "png",
      "jpg",
      "jpeg",
      "webp",
      "gif",
      "svg",
    ].includes(extension)
  ) {
    return FileImage;
  }

  if (
    type.includes("spreadsheet") ||
    type.includes("excel") ||
    [
      "csv",
      "xls",
      "xlsx",
    ].includes(extension)
  ) {
    return FileSpreadsheet;
  }

  if (
    type.includes("json") ||
    type.includes("javascript") ||
    type.includes("typescript") ||
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
    type.includes("zip") ||
    type.includes("archive") ||
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
    type.startsWith("text/") ||
    type.includes("pdf") ||
    type.includes("document") ||
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

function formatBytes(
  value?: number | null
) {
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(value)
  ) {
    return null;
  }

  if (value === 0) {
    return "0 B";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
    "TB",
  ];

  const index = Math.min(
    Math.floor(
      Math.log(value) /
        Math.log(1024)
    ),
    units.length - 1
  );

  const size =
    value /
    1024 ** index;

  return `${size.toFixed(
    size >= 10 ||
      index === 0
      ? 0
      : 1
  )} ${units[index]}`;
}

function formatDate(
  value?: string | null
) {
  if (!value) {
    return null;
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  ).format(date);
}

function normalizeStatus(
  status?: string | null
): KnowledgeStatus {
  switch (
    status
      ?.trim()
      .toLowerCase()
  ) {
    case "processing":
    case "indexing":
    case "embedding":
      return "processing";

    case "ready":
    case "completed":
    case "complete":
    case "active":
      return "ready";

    case "error":
    case "failed":
    case "failure":
      return "error";

    case "queued":
    case "pending":
    case "waiting":
      return "queued";

    default:
      return "draft";
  }
}

function getStatusConfig(
  status: KnowledgeStatus
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
        icon: Clock3,
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

export default function KnowledgeCard({
  item,
  selected = false,
  disabled = false,
  compact = false,
  showActions = true,
  showDescription = true,
  showMetadata = true,
  onClick,
  onView,
  onEdit,
  onDelete,
}: KnowledgeCardProps) {
  const [actionsOpen, setActionsOpen] =
    useState(false);

  const [
    isDeleting,
    setIsDeleting,
  ] = useState(false);

  const name =
    useMemo(
      () =>
        getKnowledgeName(item),
      [item]
    );

  const FileIcon =
    useMemo(
      () =>
        getKnowledgeIcon(item),
      [item]
    );

  const normalizedStatus =
    useMemo(
      () =>
        normalizeStatus(
          item.status
        ),
      [item.status]
    );

  const statusConfig =
    getStatusConfig(
      normalizedStatus
    );

  const StatusIcon =
    statusConfig.icon;

  const formattedSize =
    formatBytes(
      item.size
    );

  const createdAt =
    formatDate(
      item.createdAt
    );

  const canClick =
    Boolean(onClick) &&
    !disabled;

  const handleDelete =
    async (
      event: React.MouseEvent<HTMLButtonElement>
    ) => {
      event.stopPropagation();

      if (
        !onDelete ||
        disabled ||
        isDeleting
      ) {
        return;
      }

      try {
        setIsDeleting(true);

        await onDelete(item);

        setActionsOpen(false);
      } finally {
        setIsDeleting(false);
      }
    };

  const handleView = (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.stopPropagation();

    if (disabled) {
      return;
    }

    setActionsOpen(false);

    onView?.(item);
  };

  const handleEdit = (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.stopPropagation();

    if (disabled) {
      return;
    }

    setActionsOpen(false);

    onEdit?.(item);
  };

  const handleCardClick = () => {
    if (
      disabled ||
      !onClick
    ) {
      return;
    }

    onClick(item);
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>
  ) => {
    if (
      disabled ||
      !onClick
    ) {
      return;
    }

    if (
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();

      onClick(item);
    }
  };

  return (
    <article
      className={[
        "group relative flex w-full",
        compact
          ? "min-h-[88px]"
          : "min-h-[150px]",
        "flex-col rounded-2xl border",
        "bg-background p-4 transition-all duration-200",
        selected
          ? "border-primary/50 ring-1 ring-primary/20"
          : "border-white/10 hover:border-white/20 hover:bg-muted/20",
        canClick
          ? "cursor-pointer"
          : "",
        disabled
          ? "cursor-not-allowed opacity-50"
          : "",
      ].join(" ")}
      onClick={
        handleCardClick
      }
      onKeyDown={
        handleKeyDown
      }
      role={
        canClick
          ? "button"
          : undefined
      }
      tabIndex={
        canClick ? 0 : -1
      }
      aria-disabled={
        disabled
      }
      aria-label={
        canClick
          ? `Open ${name}`
          : name
      }
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-muted/40">
          <FileIcon className="h-5 w-5 text-muted-foreground" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-semibold">
                {name}
              </h3>

              {!compact &&
              showDescription &&
              item.description ? (
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {item.description}
                </p>
              ) : null}
            </div>

            <div
              className={[
                "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1",
                "text-[10px] font-medium",
                statusConfig.className,
              ].join(" ")}
              title={
                statusConfig.label
              }
            >
              <StatusIcon
                className={[
                  "h-3 w-3",
                  normalizedStatus ===
                  "processing"
                    ? "animate-spin"
                    : "",
                ].join(" ")}
              />

              <span>
                {statusConfig.label}
              </span>
            </div>
          </div>

          {!compact &&
          showMetadata ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
              {formattedSize ? (
                <span className="flex items-center gap-1">
                  <Database className="h-3 w-3" />

                  {formattedSize}
                </span>
              ) : null}

              {item.chunkCount !==
                null &&
              item.chunkCount !==
                undefined ? (
                <span className="flex items-center gap-1">
                  <Search className="h-3 w-3" />

                  {item.chunkCount} chunk
                  {item.chunkCount === 1
                    ? ""
                    : "s"}
                </span>
              ) : null}

              {createdAt ? (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />

                  {createdAt}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {showActions &&
        (
          onView ||
          onEdit ||
          onDelete
        ) ? (
          <div
            className="relative shrink-0"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setActionsOpen(
                  (current) =>
                    !current
                );
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100 focus:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={`Actions for ${name}`}
              aria-expanded={
                actionsOpen
              }
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {actionsOpen ? (
              <div className="absolute right-0 top-9 z-30 w-40 overflow-hidden rounded-xl border border-white/10 bg-popover p-1 shadow-xl">
                {onView ? (
                  <button
                    type="button"
                    onClick={
                      handleView
                    }
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors hover:bg-muted"
                  >
                    <Eye className="h-3.5 w-3.5" />

                    View
                  </button>
                ) : null}

                {onEdit ? (
                  <button
                    type="button"
                    onClick={
                      handleEdit
                    }
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
                    onClick={
                      handleDelete
                    }
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}

                    {isDeleting
                      ? "Deleting..."
                      : "Delete"}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {!compact &&
      item.fileName &&
      item.fileName !== name ? (
        <div className="mt-3 border-t border-white/10 pt-3">
          <p className="truncate text-[11px] text-muted-foreground">
            {item.fileName}
          </p>
        </div>
      ) : null}
    </article>
  );
}

export {
  formatBytes,
  formatDate,
  getFileExtension,
  getFileType,
  getKnowledgeIcon,
  getKnowledgeName,
  getStatusConfig,
  normalizeStatus,
};