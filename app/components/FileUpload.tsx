"use client";

import React, {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

export interface UploadedFile {
  id: string;
  file: File;
  previewUrl?: string;
}

export interface FileUploadError {
  file?: File;
  code:
    | "too-many-files"
    | "file-too-large"
    | "invalid-file-type"
    | "duplicate-file";
  message: string;
}

export interface FileUploadRef {
  open: () => void;
  clear: () => void;
  getFiles: () => File[];
}

export interface FileUploadProps {
  value?: File[];
  defaultValue?: File[];

  accept?: string;
  multiple?: boolean;

  maxFiles?: number;
  maxSize?: number;

  disabled?: boolean;
  loading?: boolean;

  title?: string;
  description?: string;

  showPreview?: boolean;
  showFileSize?: boolean;

  className?: string;

  onChange?: (files: File[]) => void;
  onFilesAdded?: (files: File[]) => void;
  onRemove?: (file: File, index: number) => void;
  onError?: (error: FileUploadError) => void;
}

function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"] as const;

  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );

  const unit = units[index] ?? "B";
  const value = bytes / Math.pow(1024, index);

  return `${value.toFixed(index === 0 ? 0 : 1)} ${unit}`;
}

function getFileId(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

function matchesAccept(
  file: File,
  accept?: string
): boolean {
  if (!accept || accept.trim().length === 0) {
    return true;
  }

  const rules = accept
    .split(",")
    .map((rule) => rule.trim().toLowerCase())
    .filter(Boolean);

  if (rules.length === 0) {
    return true;
  }

  const fileName = file.name.toLowerCase();
  const fileType = file.type.toLowerCase();

  return rules.some((rule) => {
    if (rule === "*/*") {
      return true;
    }

    if (rule.startsWith(".")) {
      return fileName.endsWith(rule);
    }

    if (rule.endsWith("/*")) {
      const baseType = rule.slice(0, -2);

      return fileType.startsWith(`${baseType}/`);
    }

    return fileType === rule;
  });
}

function FileIcon({
  file,
}: {
  file: File;
}) {
  const fileName = file.name.toLowerCase();

  if (isImageFile(file)) {
    return (
      <span
        className="text-lg"
        aria-hidden="true"
      >
        🖼
      </span>
    );
  }

  if (
    file.type.includes("pdf") ||
    fileName.endsWith(".pdf")
  ) {
    return (
      <span
        className="text-[10px] font-bold"
        aria-hidden="true"
      >
        PDF
      </span>
    );
  }

  if (
    file.type.includes("text") ||
    fileName.endsWith(".txt") ||
    fileName.endsWith(".md") ||
    fileName.endsWith(".csv")
  ) {
    return (
      <span
        className="text-[10px] font-bold"
        aria-hidden="true"
      >
        TXT
      </span>
    );
  }

  if (
    fileName.endsWith(".doc") ||
    fileName.endsWith(".docx")
  ) {
    return (
      <span
        className="text-[10px] font-bold"
        aria-hidden="true"
      >
        DOC
      </span>
    );
  }

  if (
    fileName.endsWith(".xls") ||
    fileName.endsWith(".xlsx")
  ) {
    return (
      <span
        className="text-[10px] font-bold"
        aria-hidden="true"
      >
        XLS
      </span>
    );
  }

  return (
    <span
      className="text-lg"
      aria-hidden="true"
    >
      📄
    </span>
  );
}

export const FileUpload = forwardRef<
  FileUploadRef,
  FileUploadProps
>(function FileUpload(
  {
    value,
    defaultValue = [],
    accept,
    multiple = true,
    maxFiles,
    maxSize,
    disabled = false,
    loading = false,
    title = "Upload files",
    description = "Drag and drop files here, or click to browse",
    showPreview = true,
    showFileSize = true,
    className,
    onChange,
    onFilesAdded,
    onRemove,
    onError,
  },
  ref
) {
  const inputId = useId();

  const inputRef =
    useRef<HTMLInputElement | null>(null);

  const dragCounterRef =
    useRef<number>(0);

  const [internalFiles, setInternalFiles] =
    useState<File[]>(() => [...defaultValue]);

  const [isDragging, setIsDragging] =
    useState(false);

  const isControlled = value !== undefined;

  const files: File[] = isControlled
    ? value
    : internalFiles;

  const previews = useMemo<UploadedFile[]>(() => {
    return files.map((file) => {
      const previewUrl =
        showPreview && isImageFile(file)
          ? URL.createObjectURL(file)
          : undefined;

      return {
        id: getFileId(file),
        file,
        previewUrl,
      };
    });
  }, [files, showPreview]);

  useEffect(() => {
    return () => {
      for (const item of previews) {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      }
    };
  }, [previews]);

  const isBusy = disabled || loading;

  const updateFiles = (
    nextFiles: File[]
  ): void => {
    const safeFiles = [...nextFiles];

    if (!isControlled) {
      setInternalFiles(safeFiles);
    }

    onChange?.(safeFiles);
  };

  const reportError = (
    error: FileUploadError
  ): void => {
    onError?.(error);
  };

  const validateFiles = (
    incomingFiles: File[]
  ): File[] => {
    const acceptedFiles: File[] = [];

    const existingIds = new Set<string>(
      files.map(getFileId)
    );

    for (const file of incomingFiles) {
      const fileId = getFileId(file);

      if (existingIds.has(fileId)) {
        reportError({
          file,
          code: "duplicate-file",
          message: `${file.name} has already been added.`,
        });

        continue;
      }

      if (!matchesAccept(file, accept)) {
        reportError({
          file,
          code: "invalid-file-type",
          message: `${file.name} is not an accepted file type.`,
        });

        continue;
      }

      if (
        typeof maxSize === "number" &&
        Number.isFinite(maxSize) &&
        maxSize >= 0 &&
        file.size > maxSize
      ) {
        reportError({
          file,
          code: "file-too-large",
          message: `${file.name} exceeds the maximum file size of ${formatFileSize(
            maxSize
          )}.`,
        });

        continue;
      }

      acceptedFiles.push(file);
      existingIds.add(fileId);
    }

    return acceptedFiles;
  };

  const addFiles = (
    incomingFiles: File[]
  ): void => {
    if (isBusy || incomingFiles.length === 0) {
      return;
    }

    const filesToValidate = multiple
      ? incomingFiles
      : incomingFiles.slice(0, 1);

    let nextFiles = validateFiles(filesToValidate);

    if (
      typeof maxFiles === "number" &&
      Number.isFinite(maxFiles)
    ) {
      const normalizedMaxFiles = Math.max(
        0,
        Math.floor(maxFiles)
      );

      const availableSlots = multiple
        ? Math.max(
            0,
            normalizedMaxFiles - files.length
          )
        : normalizedMaxFiles > 0
          ? 1
          : 0;

      if (nextFiles.length > availableSlots) {
        reportError({
          code: "too-many-files",
          message: `You can upload a maximum of ${normalizedMaxFiles} file${
            normalizedMaxFiles === 1 ? "" : "s"
          }.`,
        });

        nextFiles = nextFiles.slice(
          0,
          availableSlots
        );
      }
    }

    if (nextFiles.length === 0) {
      return;
    }

    if (!multiple) {
      const replacementFile = nextFiles[0];

      if (!replacementFile) {
        return;
      }

      const replacement: File[] = [
        replacementFile,
      ];

      updateFiles(replacement);
      onFilesAdded?.(replacement);

      return;
    }

    const mergedFiles: File[] = [
      ...files,
      ...nextFiles,
    ];

    updateFiles(mergedFiles);
    onFilesAdded?.(nextFiles);
  };

  const removeFile = (
    file: File,
    index: number
  ): void => {
    if (isBusy) {
      return;
    }

    if (index < 0 || index >= files.length) {
      return;
    }

    const nextFiles = files.filter(
      (_, currentIndex) =>
        currentIndex !== index
    );

    updateFiles(nextFiles);
    onRemove?.(file, index);
  };

  const clearFiles = (): void => {
    if (isBusy) {
      return;
    }

    updateFiles([]);
  };

  const openFilePicker = (): void => {
    if (isBusy) {
      return;
    }

    inputRef.current?.click();
  };

  useImperativeHandle(
    ref,
    () => ({
      open: openFilePicker,
      clear: clearFiles,
      getFiles: () => [...files],
    }),
    [files, isBusy]
  );

  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    const selectedFiles: File[] = Array.from(
      event.target.files ?? []
    );

    addFiles(selectedFiles);

    event.target.value = "";
  };

  const handleDragEnter = (
    event: React.DragEvent<HTMLDivElement>
  ): void => {
    event.preventDefault();
    event.stopPropagation();

    if (isBusy) {
      return;
    }

    dragCounterRef.current += 1;
    setIsDragging(true);
  };

  const handleDragLeave = (
    event: React.DragEvent<HTMLDivElement>
  ): void => {
    event.preventDefault();
    event.stopPropagation();

    if (isBusy) {
      return;
    }

    dragCounterRef.current = Math.max(
      0,
      dragCounterRef.current - 1
    );

    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (
    event: React.DragEvent<HTMLDivElement>
  ): void => {
    event.preventDefault();
    event.stopPropagation();

    if (!isBusy) {
      event.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDrop = (
    event: React.DragEvent<HTMLDivElement>
  ): void => {
    event.preventDefault();
    event.stopPropagation();

    dragCounterRef.current = 0;
    setIsDragging(false);

    if (isBusy) {
      return;
    }

    const droppedFiles: File[] = Array.from(
      event.dataTransfer.files
    );

    addFiles(droppedFiles);
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>
  ): void => {
    if (isBusy) {
      return;
    }

    if (
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      openFilePicker();
    }
  };

  return (
    <div className={cn("w-full", className)}>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={isBusy}
        onChange={handleInputChange}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      <div
        role="button"
        tabIndex={isBusy ? -1 : 0}
        aria-disabled={isBusy}
        aria-label={title}
        onClick={openFilePicker}
        onKeyDown={handleKeyDown}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          "flex min-h-[180px] w-full cursor-pointer flex-col items-center justify-center",
          "rounded-2xl border-2 border-dashed px-6 py-8 text-center",
          "transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border bg-card hover:border-primary/40 hover:bg-muted/30",
          isBusy &&
            "cursor-not-allowed opacity-60"
        )}
      >
        <div
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-2xl",
            "border border-border bg-muted text-2xl transition-transform duration-200",
            isDragging &&
              "scale-110 border-primary/30 bg-primary/10"
          )}
          aria-hidden="true"
        >
          ↑
        </div>

        <h3 className="mt-4 text-base font-semibold text-foreground">
          {loading
            ? "Preparing upload..."
            : title}
        </h3>

        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          {description}
        </p>

        <span className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Browse files
        </span>

        {typeof maxSize === "number" ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Maximum file size:{" "}
            {formatFileSize(maxSize)}
            {typeof maxFiles === "number"
              ? ` · Maximum ${maxFiles} file${
                  maxFiles === 1 ? "" : "s"
                }`
              : ""}
          </p>
        ) : typeof maxFiles === "number" ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Maximum {maxFiles} file
            {maxFiles === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>

      {previews.length > 0 ? (
        <div
          className="mt-4 space-y-2"
          aria-label="Selected files"
        >
          {previews.map((item, index) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
            >
              {showPreview &&
              item.previewUrl ? (
                <img
                  src={item.previewUrl}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-lg border border-border object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-xs font-semibold text-muted-foreground">
                  <FileIcon file={item.file} />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {item.file.name}
                </p>

                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {showFileSize ? (
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(
                        item.file.size
                      )}
                    </span>
                  ) : null}

                  {item.file.type ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {item.file.type}
                    </span>
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                disabled={isBusy}
                onClick={(event) => {
                  event.stopPropagation();
                  removeFile(
                    item.file,
                    index
                  );
                }}
                aria-label={`Remove ${item.file.name}`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
              >
                ×
              </button>
            </div>
          ))}

          {files.length > 1 ? (
            <div className="flex justify-end">
              <button
                type="button"
                disabled={isBusy}
                onClick={clearFiles}
                className="text-xs font-medium text-muted-foreground transition-colors hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
              >
                Remove all
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      >
        {files.length > 0
          ? `${files.length} file${
              files.length === 1 ? "" : "s"
            } selected`
          : "No files selected"}
      </div>
    </div>
  );
});

FileUpload.displayName = "FileUpload";

export default FileUpload;