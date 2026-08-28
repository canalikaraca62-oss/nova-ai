"use client";

import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Clipboard,
  Copy,
  Download,
  ExternalLink,
  Eye,
  File,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType2,
  Hash,
  Info,
  Loader2,
  Maximize2,
  Minimize2,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

export type KnowledgeDocument = {
  id: string;
  title: string;
  content?: string | null;
  description?: string | null;
  type?: string | null;
  mimeType?: string | null;
  sourceUrl?: string | null;
  fileName?: string | null;
  size?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type DocumentViewerProps = {
  document?: KnowledgeDocument | null;
  loading?: boolean;
  error?: string | null;
  className?: string;
  showHeader?: boolean;
  showMetadata?: boolean;
  showSearch?: boolean;
  showCopy?: boolean;
  showDownload?: boolean;
  showOpenSource?: boolean;
  maxHeight?: number | string;
  emptyTitle?: string;
  emptyDescription?: string;
  onClose?: () => void;
  onDownload?: (
    document: KnowledgeDocument
  ) => void | Promise<void>;
  onOpenSource?: (
    document: KnowledgeDocument
  ) => void | Promise<void>;
};

type SearchMatch = {
  start: number;
  end: number;
};

function getDocumentName(
  document: KnowledgeDocument
) {
  return (
    document.title?.trim() ||
    document.fileName?.trim() ||
    "Untitled document"
  );
}

function getDocumentType(
  document: KnowledgeDocument
) {
  return (
    document.mimeType?.trim() ||
    document.type?.trim() ||
    ""
  ).toLowerCase();
}

function getFileExtension(
  document: KnowledgeDocument
) {
  const fileName =
    document.fileName ??
    document.title ??
    "";

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

function getDocumentIcon(
  document: KnowledgeDocument
) {
  const type =
    getDocumentType(document);

  const extension =
    getFileExtension(document);

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
    type.includes("pdf") ||
    extension === "pdf"
  ) {
    return FileType2;
  }

  if (
    type.startsWith("text/") ||
    [
      "txt",
      "md",
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

  const formatted =
    value /
    1024 ** index;

  return `${formatted.toFixed(
    formatted >= 10 || index === 0
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
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(date);
}

function normalizeContent(
  content?: string | null
) {
  return (
    content?.replace(
      /\r\n/g,
      "\n"
    ) ?? ""
  );
}

function findMatches(
  content: string,
  query: string
): SearchMatch[] {
  const normalizedQuery =
    query.trim().toLocaleLowerCase();

  if (!normalizedQuery) {
    return [];
  }

  const normalizedContent =
    content.toLocaleLowerCase();

  const matches: SearchMatch[] = [];

  let startIndex = 0;

  while (
    startIndex <
    normalizedContent.length
  ) {
    const index =
      normalizedContent.indexOf(
        normalizedQuery,
        startIndex
      );

    if (index === -1) {
      break;
    }

    matches.push({
      start: index,
      end:
        index +
        normalizedQuery.length,
    });

    startIndex =
      index +
      normalizedQuery.length;
  }

  return matches;
}

function HighlightedContent({
  content,
  query,
}: {
  content: string;
  query: string;
}) {
  const matches = useMemo(
    () =>
      findMatches(
        content,
        query
      ),
    [
      content,
      query,
    ]
  );

  if (matches.length === 0) {
    return <>{content}</>;
  }

  const nodes: React.ReactNode[] =
    [];

  let cursor = 0;

  matches.forEach(
    (match, index) => {
      if (
        cursor < match.start
      ) {
        nodes.push(
          <span
            key={`text-${cursor}`}
          >
            {content.slice(
              cursor,
              match.start
            )}
          </span>
        );
      }

      nodes.push(
        <mark
          key={`match-${match.start}-${index}`}
          className="rounded bg-primary/20 px-0.5 text-inherit"
        >
          {content.slice(
            match.start,
            match.end
          )}
        </mark>
      );

      cursor =
        match.end;
    }
  );

  if (
    cursor < content.length
  ) {
    nodes.push(
      <span
        key={`text-${cursor}`}
      >
        {content.slice(cursor)}
      </span>
    );
  }

  return <>{nodes}</>;
}

function MetadataRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 text-muted-foreground">
        {icon}
      </div>

      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>

        <p className="mt-0.5 break-words text-xs text-foreground">
          {value}
        </p>
      </div>
    </div>
  );
}

export default function DocumentViewer({
  document,
  loading = false,
  error = null,
  className = "",
  showHeader = true,
  showMetadata = true,
  showSearch = true,
  showCopy = true,
  showDownload = true,
  showOpenSource = true,
  maxHeight = "70vh",
  emptyTitle = "No document selected",
  emptyDescription = "Choose a document from your knowledge base to view its contents.",
  onClose,
  onDownload,
  onOpenSource,
}: DocumentViewerProps) {
  const searchInputId =
    useId();

  const contentRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const [query, setQuery] =
    useState("");

  const [copied, setCopied] =
    useState(false);

  const [metadataOpen, setMetadataOpen] =
    useState(false);

  const [isFullscreen, setIsFullscreen] =
    useState(false);

  const content =
    useMemo(
      () =>
        normalizeContent(
          document?.content
        ),
      [document?.content]
    );

  const matches = useMemo(
    () =>
      findMatches(
        content,
        query
      ),
    [
      content,
      query,
    ]
  );

  const DocumentIcon =
    document
      ? getDocumentIcon(document)
      : FileText;

  const documentName =
    document
      ? getDocumentName(document)
      : "";

  const fileType =
    document
      ? getDocumentType(document)
      : "";

  const formattedSize =
    document
      ? formatBytes(document.size)
      : null;

  const createdAt =
    document
      ? formatDate(
          document.createdAt
        )
      : null;

  const updatedAt =
    document
      ? formatDate(
          document.updatedAt
        )
      : null;

  useEffect(() => {
    setQuery("");
    setCopied(false);
    setMetadataOpen(false);
  }, [
    document?.id,
  ]);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout =
      window.setTimeout(() => {
        setCopied(false);
      }, 1800);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [copied]);

  const handleCopy = async () => {
    if (!content) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        content
      );

      setCopied(true);
    } catch (copyError) {
      console.error(
        "DOCUMENT COPY ERROR:",
        copyError
      );
    }
  };

  const handleDownload = async () => {
    if (!document) {
      return;
    }

    if (onDownload) {
      await onDownload(document);
      return;
    }

    if (document.sourceUrl) {
      window.open(
        document.sourceUrl,
        "_blank",
        "noopener,noreferrer"
      );
    }
  };

  const handleOpenSource = async () => {
    if (
      !document ||
      !document.sourceUrl
    ) {
      return;
    }

    if (onOpenSource) {
      await onOpenSource(document);
      return;
    }

    window.open(
      document.sourceUrl,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const handleClearSearch = () => {
    setQuery("");
  };

  const viewerStyle = isFullscreen
    ? undefined
    : {
        maxHeight,
      };

  if (loading) {
    return (
      <section
        className={[
          "flex min-h-[320px] items-center justify-center",
          "rounded-2xl border border-white/10",
          "bg-background/70 p-6",
          className,
        ].join(" ")}
        aria-busy="true"
        aria-live="polite"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-muted/40">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>

          <div>
            <p className="text-sm font-medium">
              Loading document
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              Preparing document content...
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section
        className={[
          "flex min-h-[320px] items-center justify-center",
          "rounded-2xl border border-destructive/30",
          "bg-background/70 p-6",
          className,
        ].join(" ")}
        role="alert"
      >
        <div className="max-w-md text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-destructive/20 bg-destructive/10">
            <AlertCircle className="h-5 w-5 text-destructive" />
          </div>

          <h3 className="mt-4 text-sm font-semibold">
            Unable to load document
          </h3>

          <p className="mt-2 text-sm text-muted-foreground">
            {error}
          </p>
        </div>
      </section>
    );
  }

  if (!document) {
    return (
      <section
        className={[
          "flex min-h-[320px] items-center justify-center",
          "rounded-2xl border border-dashed border-white/10",
          "bg-background/40 p-6",
          className,
        ].join(" ")}
      >
        <div className="max-w-md text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-muted/30">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>

          <h3 className="mt-4 text-sm font-semibold">
            {emptyTitle}
          </h3>

          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {emptyDescription}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className={[
        isFullscreen
          ? [
              "fixed inset-0 z-[100]",
              "rounded-none",
            ].join(" ")
          : "rounded-2xl",
        "flex w-full flex-col overflow-hidden",
        "border border-white/10",
        "bg-background shadow-sm",
        className,
      ].join(" ")}
      style={viewerStyle}
      aria-label={`${documentName} document viewer`}
    >
      {showHeader ? (
        <header className="shrink-0 border-b border-white/10">
          <div className="flex items-start gap-3 px-4 py-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-muted/40">
              <DocumentIcon className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-semibold">
                {documentName}
              </h2>

              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                {fileType ? (
                  <span className="text-[11px] text-muted-foreground">
                    {fileType}
                  </span>
                ) : null}

                {formattedSize ? (
                  <span className="text-[11px] text-muted-foreground">
                    {formattedSize}
                  </span>
                ) : null}

                {matches.length > 0 ? (
                  <span className="text-[11px] text-muted-foreground">
                    {matches.length} match
                    {matches.length === 1
                      ? ""
                      : "es"}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {showCopy &&
              content ? (
                <button
                  type="button"
                  onClick={() => {
                    void handleCopy();
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label={
                    copied
                      ? "Document copied"
                      : "Copy document"
                  }
                  title={
                    copied
                      ? "Copied"
                      : "Copy"
                  }
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              ) : null}

              {showDownload &&
              (onDownload ||
                document.sourceUrl) ? (
                <button
                  type="button"
                  onClick={() => {
                    void handleDownload();
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Download document"
                  title="Download"
                >
                  <Download className="h-4 w-4" />
                </button>
              ) : null}

              {showOpenSource &&
              document.sourceUrl ? (
                <button
                  type="button"
                  onClick={() => {
                    void handleOpenSource();
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Open original source"
                  title="Open source"
                >
                  <ExternalLink className="h-4 w-4" />
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => {
                  setIsFullscreen(
                    (current) =>
                      !current
                  );
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={
                  isFullscreen
                    ? "Exit fullscreen"
                    : "Enter fullscreen"
                }
                title={
                  isFullscreen
                    ? "Exit fullscreen"
                    : "Fullscreen"
                }
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </button>

              {onClose ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Close document viewer"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>

          {document.description ? (
            <div className="border-t border-white/10 px-4 py-2.5">
              <p className="text-xs leading-5 text-muted-foreground">
                {document.description}
              </p>
            </div>
          ) : null}

          {showSearch ? (
            <div className="border-t border-white/10 px-4 py-3">
              <label
                htmlFor={searchInputId}
                className="sr-only"
              >
                Search document
              </label>

              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-muted/30 px-3">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />

                <input
                  id={searchInputId}
                  value={query}
                  onChange={(event) => {
                    setQuery(
                      event.target.value
                    );
                  }}
                  placeholder="Search in document..."
                  className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />

                {query ? (
                  <button
                    type="button"
                    onClick={
                      handleClearSearch
                    }
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </header>
      ) : null}

      {showMetadata ? (
        <div className="shrink-0 border-b border-white/10">
          <button
            type="button"
            onClick={() => {
              setMetadataOpen(
                (current) =>
                  !current
              );
            }}
            className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/30"
            aria-expanded={metadataOpen}
          >
            <span className="flex items-center gap-2 text-xs font-medium">
              <Info className="h-3.5 w-3.5 text-muted-foreground" />

              Document details
            </span>

            {metadataOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {metadataOpen ? (
            <div className="grid gap-4 border-t border-white/10 px-4 py-4 sm:grid-cols-2">
              <MetadataRow
                icon={
                  <Hash className="h-3.5 w-3.5" />
                }
                label="Document ID"
                value={document.id}
              />

              {document.fileName ? (
                <MetadataRow
                  icon={
                    <FileText className="h-3.5 w-3.5" />
                  }
                  label="File name"
                  value={
                    document.fileName
                  }
                />
              ) : null}

              {fileType ? (
                <MetadataRow
                  icon={
                    <FileType2 className="h-3.5 w-3.5" />
                  }
                  label="Type"
                  value={fileType}
                />
              ) : null}

              {formattedSize ? (
                <MetadataRow
                  icon={
                    <Clipboard className="h-3.5 w-3.5" />
                  }
                  label="Size"
                  value={formattedSize}
                />
              ) : null}

              {createdAt ? (
                <MetadataRow
                  icon={
                    <Info className="h-3.5 w-3.5" />
                  }
                  label="Created"
                  value={createdAt}
                />
              ) : null}

              {updatedAt ? (
                <MetadataRow
                  icon={
                    <RotateCcw className="h-3.5 w-3.5" />
                  }
                  label="Updated"
                  value={updatedAt}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        ref={contentRef}
        className="min-h-0 flex-1 overflow-auto"
      >
        {content ? (
          <article className="mx-auto w-full max-w-5xl px-5 py-6 sm:px-8 sm:py-8">
            <div className="mb-5 flex items-center gap-2 text-xs text-muted-foreground">
              <Eye className="h-3.5 w-3.5" />

              <span>
                Document content
              </span>
            </div>

            <div className="whitespace-pre-wrap break-words text-sm leading-7 text-foreground">
              <HighlightedContent
                content={content}
                query={query}
              />
            </div>
          </article>
        ) : (
          <div className="flex min-h-[280px] items-center justify-center px-6 py-12">
            <div className="max-w-md text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-muted/30">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>

              <h3 className="mt-4 text-sm font-semibold">
                No text content available
              </h3>

              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                This document may require a
                dedicated preview renderer, or
                its extracted content is not
                available yet.
              </p>

              {document.sourceUrl ? (
                <button
                  type="button"
                  onClick={() => {
                    void handleOpenSource();
                  }}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
                >
                  <ExternalLink className="h-4 w-4" />

                  Open original document
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {query &&
      matches.length === 0 ? (
        <div
          className="shrink-0 border-t border-white/10 px-4 py-2.5"
          role="status"
        >
          <p className="text-xs text-muted-foreground">
            No results found for “{query}”.
          </p>
        </div>
      ) : null}
    </section>
  );
}

export {
  formatBytes,
  formatDate,
  getDocumentIcon,
  getDocumentName,
  getDocumentType,
};