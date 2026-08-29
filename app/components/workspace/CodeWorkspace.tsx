"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Check,
  ChevronDown,
  CircleAlert,
  Code2,
  Copy,
  Download,
  FileCode2,
  FilePlus2,
  Folder,
  FolderOpen,
  Loader2,
  Play,
  Plus,
  Save,
  Search,
  Terminal,
  Trash2,
  X,
} from "lucide-react";

/* ==================================================
   TYPES
================================================== */

export type CodeFileLanguage =
  | "typescript"
  | "typescriptreact"
  | "javascript"
  | "javascriptreact"
  | "json"
  | "css"
  | "html"
  | "markdown"
  | "text";

export type CodeFile = {
  id: string;
  name: string;
  path: string;
  content: string;
  language: CodeFileLanguage;
  updatedAt?: string;
};

export type CodeFolder = {
  id: string;
  name: string;
  path: string;
};

export type CodeWorkspaceRunResult = {
  success: boolean;
  output?: string;
  error?: string;
};

export type CreateCodeFileInput = {
  name: string;
  path?: string;
  language: CodeFileLanguage;
  content?: string;
};

export type CodeWorkspaceProps = {
  workspaceId: string;
  workspaceName?: string;

  initialFiles?: CodeFile[];
  initialFolders?: CodeFolder[];

  onSaveFile?: (
    workspaceId: string,
    file: CodeFile
  ) => Promise<CodeFile>;

  onCreateFile?: (
    workspaceId: string,
    input: CreateCodeFileInput
  ) => Promise<CodeFile>;

  onDeleteFile?: (
    workspaceId: string,
    file: CodeFile
  ) => Promise<void>;

  onRun?: (
    workspaceId: string,
    files: CodeFile[]
  ) => Promise<CodeWorkspaceRunResult>;

  onError?: (
    error: Error
  ) => void;

  className?: string;
};

/* ==================================================
   HELPERS
================================================== */

function joinClasses(
  ...classes: Array<
    string | false | null | undefined
  >
): string {
  return classes
    .filter(Boolean)
    .join(" ");
}

function getLanguageFromFileName(
  name: string
): CodeFileLanguage {
  const extension =
    name.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "ts":
      return "typescript";

    case "tsx":
      return "typescriptreact";

    case "js":
      return "javascript";

    case "jsx":
      return "javascriptreact";

    case "json":
      return "json";

    case "css":
      return "css";

    case "html":
      return "html";

    case "md":
      return "markdown";

    default:
      return "text";
  }
}

function getLanguageLabel(
  language: CodeFileLanguage
): string {
  switch (language) {
    case "typescript":
      return "TypeScript";

    case "typescriptreact":
      return "TSX";

    case "javascript":
      return "JavaScript";

    case "javascriptreact":
      return "JSX";

    case "json":
      return "JSON";

    case "css":
      return "CSS";

    case "html":
      return "HTML";

    case "markdown":
      return "Markdown";

    case "text":
      return "Text";

    default:
      return language;
  }
}

function createLocalId(): string {
  return [
    "file",
    Date.now().toString(36),
    Math.random()
      .toString(36)
      .slice(2, 9),
  ].join("-");
}

/* ==================================================
   COMPONENT
================================================== */

export default function CodeWorkspace({
  workspaceId,
  workspaceName = "Workspace",
  initialFiles = [],
  initialFolders = [],
  onSaveFile,
  onCreateFile,
  onDeleteFile,
  onRun,
  onError,
  className = "",
}: CodeWorkspaceProps) {
  const [files, setFiles] =
    useState<CodeFile[]>(
      initialFiles
    );

  const [folders] =
    useState<CodeFolder[]>(
      initialFolders
    );

  const [selectedFileId, setSelectedFileId] =
    useState<string | null>(
      initialFiles[0]?.id ?? null
    );

  const [searchQuery, setSearchQuery] =
    useState<string>("");

  const [editorValue, setEditorValue] =
    useState<string>(
      initialFiles[0]?.content ?? ""
    );

  const [isDirty, setIsDirty] =
    useState<boolean>(false);

  const [isSaving, setIsSaving] =
    useState<boolean>(false);

  const [isRunning, setIsRunning] =
    useState<boolean>(false);

  const [isCreating, setIsCreating] =
    useState<boolean>(false);

  const [isDeleting, setIsDeleting] =
    useState<boolean>(false);

  const [showCreateFile, setShowCreateFile] =
    useState<boolean>(false);

  const [newFileName, setNewFileName] =
    useState<string>("");

  const [newFilePath, setNewFilePath] =
    useState<string>("");

  const [runResult, setRunResult] =
    useState<CodeWorkspaceRunResult | null>(
      null
    );

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  /* ==================================================
     SYNC
  ================================================== */

  useEffect(() => {
    setFiles(initialFiles);

    const firstFile =
      initialFiles[0] ?? null;

    setSelectedFileId(
      firstFile?.id ?? null
    );

    setEditorValue(
      firstFile?.content ?? ""
    );

    setIsDirty(false);
  }, [
    initialFiles,
    workspaceId,
  ]);

  /* ==================================================
     DERIVED STATE
  ================================================== */

  const selectedFile = useMemo(
    () =>
      files.find(
        (file) =>
          file.id === selectedFileId
      ) ?? null,
    [
      files,
      selectedFileId,
    ]
  );

  const filteredFiles = useMemo(() => {
    const query =
      searchQuery
        .trim()
        .toLowerCase();

    if (!query) {
      return files;
    }

    return files.filter(
      (file) =>
        file.name
          .toLowerCase()
          .includes(query) ||
        file.path
          .toLowerCase()
          .includes(query)
    );
  }, [
    files,
    searchQuery,
  ]);

  /* ==================================================
     ERROR HANDLER
  ================================================== */

  const handleError = useCallback(
    (error: unknown): void => {
      const normalizedError =
        error instanceof Error
          ? error
          : new Error(
              "Something went wrong in the code workspace."
            );

      setErrorMessage(
        normalizedError.message
      );

      onError?.(normalizedError);
    },
    [onError]
  );

  /* ==================================================
     FILE SELECT
  ================================================== */

  const handleSelectFile = useCallback(
    (file: CodeFile): void => {
      setSelectedFileId(file.id);
      setEditorValue(file.content);
      setIsDirty(false);
      setErrorMessage(null);
    },
    []
  );

  /* ==================================================
     EDITOR CHANGE
  ================================================== */

  const handleEditorChange = (
    value: string
  ): void => {
    setEditorValue(value);

    if (
      selectedFile &&
      value !== selectedFile.content
    ) {
      setIsDirty(true);
    } else {
      setIsDirty(false);
    }
  };

  /* ==================================================
     SAVE FILE
  ================================================== */

  const handleSave = useCallback(
    async (): Promise<void> => {
      if (!selectedFile) {
        return;
      }

      setIsSaving(true);
      setErrorMessage(null);

      const updatedFile: CodeFile = {
        ...selectedFile,
        content: editorValue,
        updatedAt: new Date().toISOString(),
      };

      try {
        if (onSaveFile) {
          const savedFile =
            await onSaveFile(
              workspaceId,
              updatedFile
            );

          setFiles(
            (current) =>
              current.map(
                (file) =>
                  file.id === savedFile.id
                    ? savedFile
                    : file
              )
          );

          setEditorValue(
            savedFile.content
          );
        } else {
          setFiles(
            (current) =>
              current.map(
                (file) =>
                  file.id === updatedFile.id
                    ? updatedFile
                    : file
              )
          );
        }

        setIsDirty(false);
      } catch (error: unknown) {
        handleError(error);
      } finally {
        setIsSaving(false);
      }
    },
    [
      editorValue,
      handleError,
      onSaveFile,
      selectedFile,
      workspaceId,
    ]
  );

  /* ==================================================
     CREATE FILE
  ================================================== */

  const handleCreateFile = useCallback(
    async (): Promise<void> => {
      const trimmedName =
        newFileName.trim();

      if (!trimmedName) {
        setErrorMessage(
          "Please enter a file name."
        );
        return;
      }

      setIsCreating(true);
      setErrorMessage(null);

      const language =
        getLanguageFromFileName(
          trimmedName
        );

      const input: CreateCodeFileInput = {
        name: trimmedName,
        path:
          newFilePath.trim() ||
          trimmedName,
        language,
        content: "",
      };

      try {
        let createdFile: CodeFile;

        if (onCreateFile) {
          createdFile =
            await onCreateFile(
              workspaceId,
              input
            );
        } else {
          createdFile = {
            id: createLocalId(),
            name: input.name,
            path:
              input.path ??
              input.name,
            language: input.language,
            content:
              input.content ?? "",
            updatedAt:
              new Date().toISOString(),
          };
        }

        setFiles(
          (current) => [
            ...current,
            createdFile,
          ]
        );

        setSelectedFileId(
          createdFile.id
        );

        setEditorValue(
          createdFile.content
        );

        setNewFileName("");
        setNewFilePath("");
        setShowCreateFile(false);
        setIsDirty(false);
      } catch (error: unknown) {
        handleError(error);
      } finally {
        setIsCreating(false);
      }
    },
    [
      handleError,
      newFileName,
      newFilePath,
      onCreateFile,
      workspaceId,
    ]
  );

  /* ==================================================
     DELETE FILE
  ================================================== */

  const handleDelete = useCallback(
    async (): Promise<void> => {
      if (!selectedFile) {
        return;
      }

      setIsDeleting(true);
      setErrorMessage(null);

      try {
        if (onDeleteFile) {
          await onDeleteFile(
            workspaceId,
            selectedFile
          );
        }

        setFiles(
          (current) =>
            current.filter(
              (file) =>
                file.id !==
                selectedFile.id
            )
        );

        const remainingFiles =
          files.filter(
            (file) =>
              file.id !==
              selectedFile.id
          );

        const nextFile =
          remainingFiles[0] ?? null;

        setSelectedFileId(
          nextFile?.id ?? null
        );

        setEditorValue(
          nextFile?.content ?? ""
        );

        setIsDirty(false);
      } catch (error: unknown) {
        handleError(error);
      } finally {
        setIsDeleting(false);
      }
    },
    [
      files,
      handleError,
      onDeleteFile,
      selectedFile,
      workspaceId,
    ]
  );

  /* ==================================================
     RUN WORKSPACE
  ================================================== */

  const handleRun = useCallback(
    async (): Promise<void> => {
      if (!onRun) {
        return;
      }

      setIsRunning(true);
      setErrorMessage(null);
      setRunResult(null);

      try {
        const filesToRun =
          selectedFile
            ? files.map(
                (file) =>
                  file.id ===
                  selectedFile.id
                    ? {
                        ...file,
                        content:
                          editorValue,
                      }
                    : file
              )
            : files;

        const result =
          await onRun(
            workspaceId,
            filesToRun
          );

        setRunResult(result);
      } catch (error: unknown) {
        const normalizedError =
          error instanceof Error
            ? error
            : new Error(
                "Code execution failed."
              );

        setRunResult({
          success: false,
          error:
            normalizedError.message,
        });

        handleError(
          normalizedError
        );
      } finally {
        setIsRunning(false);
      }
    },
    [
      editorValue,
      files,
      handleError,
      onRun,
      selectedFile,
      workspaceId,
    ]
  );

  /* ==================================================
     COPY CODE
  ================================================== */

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(
        editorValue
      );
    } catch {
      setErrorMessage(
        "Unable to copy code to clipboard."
      );
    }
  };

  /* ==================================================
     DOWNLOAD
  ================================================== */

  const handleDownload = (): void => {
    if (!selectedFile) {
      return;
    }

    const blob = new Blob(
      [editorValue],
      {
        type: "text/plain",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const anchor =
      document.createElement("a");

    anchor.href = url;
    anchor.download =
      selectedFile.name;

    document.body.appendChild(
      anchor
    );

    anchor.click();

    document.body.removeChild(
      anchor
    );

    URL.revokeObjectURL(url);
  };

  return (
    <section
      className={joinClasses(
        "flex",
        "min-h-[650px]",
        "w-full",
        "flex-col",
        "overflow-hidden",
        "rounded-xl",
        "border",
        "border-border",
        "bg-background",
        "shadow-sm",
        className
      )}
    >
      {/* ==============================================
          HEADER
      ============================================== */}

      <div className="flex flex-col gap-4 border-b border-border px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Code2 className="h-5 w-5" />
          </div>

          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Code Workspace
            </h2>

            <p className="mt-0.5 text-xs text-muted-foreground">
              {workspaceName}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isDirty ? (
            <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600">
              Unsaved changes
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              <Check className="h-3.5 w-3.5" />
              Saved
            </span>
          )}

          <button
            type="button"
            onClick={() => {
              void handleRun();
            }}
            disabled={
              isRunning ||
              !onRun
            }
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}

            Run
          </button>

          <button
            type="button"
            onClick={() => {
              void handleSave();
            }}
            disabled={
              !selectedFile ||
              !isDirty ||
              isSaving
            }
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}

            Save
          </button>
        </div>
      </div>

      {/* ==============================================
          ERROR
      ============================================== */}

      {errorMessage ? (
        <div
          role="alert"
          className="flex items-start gap-3 border-b border-destructive/30 bg-destructive/10 px-4 py-3"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />

          <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
            <p className="text-sm text-destructive">
              {errorMessage}
            </p>

            <button
              type="button"
              onClick={() => {
                setErrorMessage(null);
              }}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close error"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      {/* ==============================================
          MAIN
      ============================================== */}

      <div className="grid min-h-0 flex-1 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* ============================================
            FILE EXPLORER
        ============================================ */}

        <aside className="flex min-h-[300px] flex-col border-b border-border lg:min-h-0 lg:border-b-0 lg:border-r">
          <div className="border-b border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Explorer
              </span>

              <button
                type="button"
                onClick={() => {
                  setShowCreateFile(true);
                }}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Create file"
              >
                <FilePlus2 className="h-4 w-4" />
              </button>
            </div>

            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <input
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(
                    event.target.value
                  );
                }}
                placeholder="Search files..."
                className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {folders.length > 0 ? (
              <div className="mb-2">
                {folders.map(
                  (folder) => (
                    <div
                      key={folder.id}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground"
                    >
                      <FolderOpen className="h-4 w-4" />

                      <span className="truncate">
                        {folder.name}
                      </span>
                    </div>
                  )
                )}
              </div>
            ) : null}

            {filteredFiles.length === 0 ? (
              <div className="px-3 py-8 text-center">
                <FileCode2 className="mx-auto h-5 w-5 text-muted-foreground" />

                <p className="mt-2 text-xs text-muted-foreground">
                  No files found
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredFiles.map(
                  (file) => {
                    const isSelected =
                      selectedFileId ===
                      file.id;

                    return (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => {
                          handleSelectFile(
                            file
                          );
                        }}
                        className={joinClasses(
                          "flex",
                          "w-full",
                          "items-center",
                          "gap-2",
                          "rounded-md",
                          "px-2",
                          "py-2",
                          "text-left",
                          "text-sm",
                          "transition-colors",
                          isSelected
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <FileCode2 className="h-4 w-4 shrink-0" />

                        <span className="min-w-0 flex-1 truncate">
                          {file.name}
                        </span>
                      </button>
                    );
                  }
                )}
              </div>
            )}
          </div>

          <div className="border-t border-border p-3">
            <button
              type="button"
              onClick={() => {
                setShowCreateFile(true);
              }}
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
            >
              <Plus className="h-4 w-4" />
              New file
            </button>
          </div>
        </aside>

        {/* ============================================
            EDITOR
        ============================================ */}

        <main className="flex min-h-[450px] min-w-0 flex-col">
          {selectedFile ? (
            <>
              {/* EDITOR HEADER */}

              <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/20 px-4 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <FileCode2 className="h-4 w-4 shrink-0 text-primary" />

                  <span className="truncate text-sm font-medium text-foreground">
                    {selectedFile.name}
                  </span>

                  <span className="hidden rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
                    {getLanguageLabel(
                      selectedFile.language
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      void handleCopy();
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Copy code"
                  >
                    <Copy className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={handleDownload}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Download file"
                  >
                    <Download className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      void handleDelete();
                    }}
                    disabled={isDeleting}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    aria-label="Delete file"
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* CODE EDITOR */}

              <div className="relative flex-1 bg-background">
                <textarea
                  value={editorValue}
                  onChange={(event) => {
                    handleEditorChange(
                      event.target.value
                    );
                  }}
                  spellCheck={false}
                  className="min-h-[420px] w-full resize-none bg-transparent p-5 font-mono text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground"
                  placeholder="// Start writing your code..."
                />
              </div>

              {/* STATUS BAR */}

              <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/20 px-4 py-2 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span>
                    {editorValue.split("\n")
                      .length} lines
                  </span>

                  <span>
                    {
                      editorValue.length
                    } characters
                  </span>
                </div>

                <span>
                  {getLanguageLabel(
                    selectedFile.language
                  )}
                </span>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8">
              <div className="max-w-sm text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-muted">
                  <Terminal className="h-6 w-6 text-muted-foreground" />
                </div>

                <h3 className="mt-4 text-sm font-semibold text-foreground">
                  No file selected
                </h3>

                <p className="mt-1 text-sm text-muted-foreground">
                  Select an existing file or create a
                  new file to start coding.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setShowCreateFile(true);
                  }}
                  className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4" />
                  Create file
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ==============================================
          RUN OUTPUT
      ============================================== */}

      {runResult ? (
        <div className="border-t border-border">
          <div className="flex items-center justify-between bg-muted/20 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-muted-foreground" />

              <span className="text-xs font-semibold text-foreground">
                Execution output
              </span>

              <span
                className={joinClasses(
                  "rounded-full",
                  "px-2",
                  "py-0.5",
                  "text-[10px]",
                  "font-medium",
                  runResult.success
                    ? "bg-primary/10 text-primary"
                    : "bg-destructive/10 text-destructive"
                )}
              >
                {runResult.success
                  ? "Success"
                  : "Failed"}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                setRunResult(null);
              }}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close output"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <pre
            className={joinClasses(
              "max-h-64",
              "overflow-auto",
              "whitespace-pre-wrap",
              "break-words",
              "p-4",
              "font-mono",
              "text-xs",
              "leading-6",
              runResult.success
                ? "text-foreground"
                : "text-destructive"
            )}
          >
            {runResult.success
              ? runResult.output ||
                "Execution completed successfully."
              : runResult.error ||
                "Execution failed."}
          </pre>
        </div>
      ) : null}

      {/* ==============================================
          CREATE FILE MODAL
      ============================================== */}

      {showCreateFile ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-border bg-background p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  Create new file
                </h3>

                <p className="mt-1 text-sm text-muted-foreground">
                  Add a new file to this workspace.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowCreateFile(false);
                }}
                disabled={isCreating}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="code-file-name"
                  className="text-sm font-medium text-foreground"
                >
                  File name
                </label>

                <input
                  id="code-file-name"
                  value={newFileName}
                  onChange={(event) => {
                    setNewFileName(
                      event.target.value
                    );
                  }}
                  placeholder="Example.tsx"
                  disabled={isCreating}
                  className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring disabled:opacity-50"
                />
              </div>

              <div>
                <label
                  htmlFor="code-file-path"
                  className="text-sm font-medium text-foreground"
                >
                  Path
                  <span className="ml-1 text-muted-foreground">
                    (optional)
                  </span>
                </label>

                <input
                  id="code-file-path"
                  value={newFilePath}
                  onChange={(event) => {
                    setNewFilePath(
                      event.target.value
                    );
                  }}
                  placeholder="app/components/Example.tsx"
                  disabled={isCreating}
                  className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring disabled:opacity-50"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateFile(false);
                  }}
                  disabled={isCreating}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => {
                    void handleCreateFile();
                  }}
                  disabled={isCreating}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Create file
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}