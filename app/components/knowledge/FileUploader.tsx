"use client";

import {
  AlertCircle,
  CheckCircle2,
  File,
  FileArchive,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileUp,
  Loader2,
  Paperclip,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

export type UploadedKnowledgeFile = {
  id: string;
  name: string;
  size: number;
  type: string;
  url?: string | null;
  path?: string | null;
  status?: "uploading" | "success" | "error";
  error?: string | null;
};

export type FileUploaderProps = {
  endpoint?: string;
  multiple?: boolean;
  disabled?: boolean;
  maxFiles?: number;
  maxFileSize?: number;
  acceptedTypes?: string[];
  className?: string;
  label?: string;
  description?: string;
  uploadButtonText?: string;
  autoUpload?: boolean;
  onFilesChange?: (
    files: UploadedKnowledgeFile[]
  ) => void;
  onUploadComplete?: (
    files: UploadedKnowledgeFile[]
  ) => void;
  onUploadError?: (
    error: string
  ) => void;
};

type UploadApiResponse = {
  success?: boolean;
  file?: {
    id?: string;
    name?: string;
    size?: number;
    type?: string;
    url?: string | null;
    path?: string | null;
  };
  files?: Array<{
    id?: string;
    name?: string;
    size?: number;
    type?: string;
    url?: string | null;
    path?: string | null;
  }>;
  error?: string;
};

function formatBytes(
  bytes: number
) {
  if (!bytes) {
    return "0 B";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
  ];

  const index = Math.min(
    Math.floor(
      Math.log(bytes) /
        Math.log(1024)
    ),
    units.length - 1
  );

  const value =
    bytes /
    1024 ** index;

  return `${value.toFixed(
    value >= 10 ||
      index === 0
      ? 0
      : 1
  )} ${units[index]}`;
}

function getFileExtension(
  fileName: string
) {
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

function getFileIcon(
  file: Pick<
    UploadedKnowledgeFile,
    "name" | "type"
  >
) {
  const type =
    file.type.toLowerCase();

  const extension =
    getFileExtension(
      file.name
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

function isAcceptedFile(
  file: File,
  acceptedTypes: string[]
) {
  if (
    acceptedTypes.length === 0
  ) {
    return true;
  }

  const extension =
    getFileExtension(
      file.name
    );

  return acceptedTypes.some(
    (acceptedType) => {
      const normalized =
        acceptedType
          .trim()
          .toLowerCase();

      if (!normalized) {
        return false;
      }

      if (
        normalized.startsWith(".")
      ) {
        return (
          `.${extension}` ===
          normalized
        );
      }

      if (
        normalized.endsWith(
          "/*"
        )
      ) {
        const prefix =
          normalized.slice(
            0,
            -1
          );

        return file.type
          .toLowerCase()
          .startsWith(prefix);
      }

      return (
        file.type
          .toLowerCase() ===
        normalized
      );
    }
  );
}

function createLocalFile(
  file: File
): UploadedKnowledgeFile {
  return {
    id:
      typeof crypto !==
        "undefined" &&
      "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${file.name}-${Date.now()}-${Math.random()}`,
    name: file.name,
    size: file.size,
    type:
      file.type ||
      "application/octet-stream",
    status: "uploading",
  };
}

export default function FileUploader({
  endpoint = "/api/files/upload",
  multiple = true,
  disabled = false,
  maxFiles = 10,
  maxFileSize = 25 * 1024 * 1024,
  acceptedTypes = [],
  className = "",
  label = "Upload knowledge files",
  description = "Drag and drop files here, or browse from your device.",
  uploadButtonText = "Choose files",
  autoUpload = true,
  onFilesChange,
  onUploadComplete,
  onUploadError,
}: FileUploaderProps) {
  const inputId = useId();

  const inputRef =
    useRef<HTMLInputElement | null>(
      null
    );

  const [files, setFiles] =
    useState<
      UploadedKnowledgeFile[]
    >([]);

  const [isDragging, setIsDragging] =
    useState(false);

  const [
    isUploading,
    setIsUploading,
  ] = useState(false);

  const [
    globalError,
    setGlobalError,
  ] = useState<
    string | null
  >(null);

  const notifyFilesChange =
    useCallback(
      (
        nextFiles: UploadedKnowledgeFile[]
      ) => {
        setFiles(nextFiles);

        onFilesChange?.(
          nextFiles
        );
      },
      [onFilesChange]
    );

  const acceptAttribute =
    useMemo(
      () =>
        acceptedTypes.length > 0
          ? acceptedTypes.join(",")
          : undefined,
      [acceptedTypes]
    );

  const uploadFiles =
    useCallback(
      async (
        rawFiles: File[]
      ) => {
        if (
          rawFiles.length === 0 ||
          disabled
        ) {
          return;
        }

        setGlobalError(null);

        const selectedFiles =
          multiple
            ? rawFiles.slice(
                0,
                Math.max(
                  0,
                  maxFiles -
                    files.length
                )
              )
            : rawFiles.slice(0, 1);

        if (
          selectedFiles.length === 0
        ) {
          const message =
            `Maximum of ${maxFiles} file${
              maxFiles === 1
                ? ""
                : "s"
            } allowed.`;

          setGlobalError(message);
          onUploadError?.(
            message
          );

          return;
        }

        const validationErrors:
          string[] = [];

        const validFiles =
          selectedFiles.filter(
            (file) => {
              if (
                file.size >
                maxFileSize
              ) {
                validationErrors.push(
                  `${file.name} exceeds the ${formatBytes(
                    maxFileSize
                  )} limit.`
                );

                return false;
              }

              if (
                !isAcceptedFile(
                  file,
                  acceptedTypes
                )
              ) {
                validationErrors.push(
                  `${file.name} is not a supported file type.`
                );

                return false;
              }

              return true;
            }
          );

        if (
          validationErrors.length >
          0
        ) {
          const message =
            validationErrors.join(
              " "
            );

          setGlobalError(message);
          onUploadError?.(
            message
          );
        }

        if (
          validFiles.length === 0
        ) {
          return;
        }

        const localFiles =
          validFiles.map(
            createLocalFile
          );

        const previousFiles =
          multiple
            ? files
            : [];

        const optimisticFiles = [
          ...previousFiles,
          ...localFiles,
        ];

        notifyFilesChange(
          optimisticFiles
        );

        if (!autoUpload) {
          return;
        }

        setIsUploading(true);

        try {
          const formData =
            new FormData();

          validFiles.forEach(
            (file) => {
              formData.append(
                "files",
                file
              );
            }
          );

          const response =
            await fetch(endpoint, {
              method: "POST",
              body: formData,
            });

          const payload =
            (await response
              .json()
              .catch(() => null)) as
              | UploadApiResponse
              | null;

          if (!response.ok) {
            throw new Error(
              payload?.error ||
                "File upload failed."
            );
          }

          if (
            payload?.success === false
          ) {
            throw new Error(
              payload.error ||
                "File upload failed."
            );
          }

          const returnedFiles =
            payload?.files ??
            (payload?.file
              ? [payload.file]
              : []);

          const completedFiles =
            localFiles.map(
              (
                localFile,
                index
              ) => {
                const uploaded =
                  returnedFiles[index];

                return {
                  ...localFile,
                  id:
                    uploaded?.id ??
                    localFile.id,
                  name:
                    uploaded?.name ??
                    localFile.name,
                  size:
                    uploaded?.size ??
                    localFile.size,
                  type:
                    uploaded?.type ??
                    localFile.type,
                  url:
                    uploaded?.url ??
                    null,
                  path:
                    uploaded?.path ??
                    null,
                  status:
                    "success" as const,
                  error:
                    null,
                };
              }
            );

          const nextFiles = [
            ...previousFiles,
            ...completedFiles,
          ];

          notifyFilesChange(
            nextFiles
          );

          onUploadComplete?.(
            completedFiles
          );
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "File upload failed.";

          const failedFiles =
            localFiles.map(
              (file) => ({
                ...file,
                status:
                  "error" as const,
                error:
                  message,
              })
            );

          const nextFiles = [
            ...previousFiles,
            ...failedFiles,
          ];

          notifyFilesChange(
            nextFiles
          );

          setGlobalError(message);

          onUploadError?.(
            message
          );
        } finally {
          setIsUploading(false);
        }
      },
      [
        acceptedTypes,
        autoUpload,
        disabled,
        endpoint,
        files,
        maxFileSize,
        maxFiles,
        multiple,
        notifyFilesChange,
        onUploadComplete,
        onUploadError,
      ]
    );

  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFiles =
      Array.from(
        event.target.files ?? []
      );

    void uploadFiles(
      selectedFiles
    );

    event.target.value = "";
  };

  const handleDrop = (
    event: React.DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();

    if (disabled) {
      return;
    }

    setIsDragging(false);

    const droppedFiles =
      Array.from(
        event.dataTransfer.files
      );

    void uploadFiles(
      droppedFiles
    );
  };

  const handleDragOver = (
    event: React.DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();

    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (
    event: React.DragEvent<HTMLDivElement>
  ) => {
    if (
      event.currentTarget ===
      event.target
    ) {
      setIsDragging(false);
    }
  };

  const removeFile = (
    id: string
  ) => {
    const nextFiles =
      files.filter(
        (file) =>
          file.id !== id
      );

    notifyFilesChange(
      nextFiles
    );
  };

  const retryFile = (
    file: UploadedKnowledgeFile
  ) => {
    if (
      file.status !== "error"
    ) {
      return;
    }

    setGlobalError(
      "To retry this upload, select the original file again."
    );
  };

  const canAddMoreFiles =
    multiple
      ? files.length < maxFiles
      : files.length === 0;

  return (
    <section
      className={[
        "w-full",
        className,
      ].join(" ")}
    >
      <div className="mb-3">
        <h2 className="text-sm font-semibold">
          {label}
        </h2>

        {description ? (
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>

      {canAddMoreFiles ? (
        <div
          onDrop={handleDrop}
          onDragOver={
            handleDragOver
          }
          onDragLeave={
            handleDragLeave
          }
          className={[
            "relative flex min-h-[190px] flex-col items-center justify-center",
            "rounded-2xl border border-dashed p-6 text-center transition-colors",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-white/10 bg-muted/20 hover:bg-muted/30",
            disabled
              ? "cursor-not-allowed opacity-50"
              : "cursor-pointer",
          ].join(" ")}
          role="button"
          tabIndex={
            disabled ? -1 : 0
          }
          aria-disabled={
            disabled
          }
          onClick={() => {
            if (
              !disabled &&
              !isUploading
            ) {
              inputRef.current?.click();
            }
          }}
          onKeyDown={(event) => {
            if (
              disabled ||
              isUploading
            ) {
              return;
            }

            if (
              event.key === "Enter" ||
              event.key === " "
            ) {
              event.preventDefault();

              inputRef.current?.click();
            }
          }}
        >
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            className="sr-only"
            multiple={multiple}
            disabled={
              disabled ||
              isUploading
            }
            accept={
              acceptAttribute
            }
            onChange={
              handleInputChange
            }
          />

          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-background shadow-sm">
            {isUploading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : isDragging ? (
              <FileUp className="h-6 w-6 text-primary" />
            ) : (
              <Upload className="h-6 w-6 text-muted-foreground" />
            )}
          </div>

          <h3 className="mt-4 text-sm font-medium">
            {isDragging
              ? "Drop files to upload"
              : "Drag files here"}
          </h3>

          <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
            Or click to browse
            your device.
          </p>

          <button
            type="button"
            disabled={
              disabled ||
              isUploading
            }
            onClick={(event) => {
              event.stopPropagation();

              inputRef.current?.click();
            }}
            className="mt-4 inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-background px-3 text-xs font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Paperclip className="h-3.5 w-3.5" />

            {uploadButtonText}
          </button>

          <p className="mt-3 text-[11px] text-muted-foreground">
            Maximum{" "}
            {multiple
              ? `${maxFiles} files`
              : "1 file"}
            {" · "}
            {formatBytes(
              maxFileSize
            )} per file
          </p>
        </div>
      ) : null}

      {globalError ? (
        <div
          className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />

          <p className="text-xs leading-5 text-destructive">
            {globalError}
          </p>
        </div>
      ) : null}

      {files.length > 0 ? (
        <div className="mt-4 space-y-2">
          {files.map(
            (file) => {
              const FileIcon =
                getFileIcon(file);

              const isUploadingFile =
                file.status ===
                "uploading";

              const isSuccess =
                file.status ===
                "success";

              const isError =
                file.status ===
                "error";

              return (
                <div
                  key={file.id}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-background px-3 py-3"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/40">
                    <FileIcon className="h-4 w-4 text-muted-foreground" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {file.name}
                    </p>

                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[11px] text-muted-foreground">
                        {formatBytes(
                          file.size
                        )}
                      </span>

                      {isUploadingFile ? (
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Uploading
                        </span>
                      ) : null}

                      {isSuccess ? (
                        <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          Uploaded
                        </span>
                      ) : null}

                      {isError ? (
                        <span className="text-[11px] text-destructive">
                          {file.error ||
                            "Upload failed"}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {isError ? (
                    <button
                      type="button"
                      onClick={() =>
                        retryFile(file)
                      }
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label={`Retry ${file.name}`}
                      title="Retry"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() =>
                      removeFile(
                        file.id
                      )
                    }
                    disabled={
                      isUploadingFile
                    }
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={`Remove ${file.name}`}
                    title="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            }
          )}
        </div>
      ) : null}
    </section>
  );
}

export {
  formatBytes,
  getFileExtension,
  getFileIcon,
  isAcceptedFile,
};