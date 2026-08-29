"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import {
  Blocks,
  Bot,
  CheckCircle2,
  Code2,
  FileText,
  FolderPlus,
  LayoutTemplate,
  Loader2,
  Plus,
  Sparkles,
  TriangleAlert,
  WandSparkles,
  X,
} from "lucide-react";

/* ==================================================
   TYPES
================================================== */

export type WorkspaceBuildType =
  | "app"
  | "document"
  | "workflow"
  | "agent"
  | "custom";

export type WorkspaceBuildStatus =
  | "draft"
  | "building"
  | "ready"
  | "error";

export type WorkspaceBuildItem = {
  id: string;
  name: string;
  description?: string;
  type: WorkspaceBuildType;
  status: WorkspaceBuildStatus;
  createdAt?: string;
  updatedAt?: string;
};

export type WorkspaceTemplate = {
  id: string;
  name: string;
  description: string;
  type: WorkspaceBuildType;
  icon?: ReactNode;
};

export type CreateWorkspaceBuildInput = {
  name: string;
  description?: string;
  type: WorkspaceBuildType;
  templateId?: string;
};

export type BuildWorkspaceProps = {
  workspaceId: string;
  workspaceName?: string;

  initialItems?: WorkspaceBuildItem[];

  templates?: WorkspaceTemplate[];

  onCreate?: (
    workspaceId: string,
    input: CreateWorkspaceBuildInput
  ) => Promise<WorkspaceBuildItem>;

  onDelete?: (
    workspaceId: string,
    item: WorkspaceBuildItem
  ) => Promise<void>;

  onOpen?: (
    workspaceId: string,
    item: WorkspaceBuildItem
  ) => void;

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

function formatDate(
  value?: string
): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle: "medium",
    }
  ).format(date);
}

function getTypeLabel(
  type: WorkspaceBuildType
): string {
  switch (type) {
    case "app":
      return "Application";

    case "document":
      return "Document";

    case "workflow":
      return "Workflow";

    case "agent":
      return "AI Agent";

    case "custom":
      return "Custom";

    default:
      return type;
  }
}

function getStatusLabel(
  status: WorkspaceBuildStatus
): string {
  switch (status) {
    case "draft":
      return "Draft";

    case "building":
      return "Building";

    case "ready":
      return "Ready";

    case "error":
      return "Error";

    default:
      return status;
  }
}

/* ==================================================
   DEFAULT TEMPLATES
================================================== */

const DEFAULT_TEMPLATES: WorkspaceTemplate[] = [
  {
    id: "app",
    name: "Application",
    description:
      "Build a new application inside your workspace.",
    type: "app",
    icon: <Blocks className="h-5 w-5" />,
  },
  {
    id: "document",
    name: "Document",
    description:
      "Create a structured document or knowledge resource.",
    type: "document",
    icon: <FileText className="h-5 w-5" />,
  },
  {
    id: "workflow",
    name: "Workflow",
    description:
      "Create a repeatable workflow with connected steps.",
    type: "workflow",
    icon: <LayoutTemplate className="h-5 w-5" />,
  },
  {
    id: "agent",
    name: "AI Agent",
    description:
      "Create an intelligent agent for workspace tasks.",
    type: "agent",
    icon: <Bot className="h-5 w-5" />,
  },
  {
    id: "custom",
    name: "Custom Build",
    description:
      "Start with a flexible empty structure.",
    type: "custom",
    icon: <Code2 className="h-5 w-5" />,
  },
];

/* ==================================================
   COMPONENT
================================================== */

export default function BuildWorkspace({
  workspaceId,
  workspaceName = "Workspace",
  initialItems = [],
  templates = DEFAULT_TEMPLATES,
  onCreate,
  onDelete,
  onOpen,
  onError,
  className = "",
}: BuildWorkspaceProps) {
  const [items, setItems] =
    useState<WorkspaceBuildItem[]>(
      initialItems
    );

  const [selectedTemplateId, setSelectedTemplateId] =
    useState<string | null>(null);

  const [name, setName] =
    useState<string>("");

  const [description, setDescription] =
    useState<string>("");

  const [isCreating, setIsCreating] =
    useState<boolean>(false);

  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  useEffect(() => {
    setItems(initialItems);
  }, [
    initialItems,
    workspaceId,
  ]);

  const selectedTemplate = useMemo(
    () =>
      templates.find(
        (template) =>
          template.id ===
          selectedTemplateId
      ) ?? null,
    [
      selectedTemplateId,
      templates,
    ]
  );

  const readyCount = useMemo(
    () =>
      items.filter(
        (item) =>
          item.status === "ready"
      ).length,
    [items]
  );

  const handleError = useCallback(
    (error: unknown): void => {
      const normalizedError =
        error instanceof Error
          ? error
          : new Error(
              "Something went wrong while building the workspace."
            );

      setErrorMessage(
        normalizedError.message
      );

      onError?.(normalizedError);
    },
    [onError]
  );

  const handleSelectTemplate = (
    template: WorkspaceTemplate
  ): void => {
    setSelectedTemplateId(template.id);

    if (!name.trim()) {
      setName(template.name);
    }

    setErrorMessage(null);
  };

  const handleCreate = useCallback(
    async (
      event: FormEvent<HTMLFormElement>
    ): Promise<void> => {
      event.preventDefault();

      const trimmedName =
        name.trim();

      if (!trimmedName) {
        setErrorMessage(
          "Please enter a name for your build."
        );
        return;
      }

      if (!selectedTemplate) {
        setErrorMessage(
          "Please select a build template."
        );
        return;
      }

      if (!onCreate) {
        return;
      }

      setIsCreating(true);
      setErrorMessage(null);

      try {
        const createdItem =
          await onCreate(
            workspaceId,
            {
              name: trimmedName,
              description:
                description.trim() ||
                undefined,
              type:
                selectedTemplate.type,
              templateId:
                selectedTemplate.id,
            }
          );

        setItems(
          (current) => [
            createdItem,
            ...current,
          ]
        );

        setName("");
        setDescription("");
        setSelectedTemplateId(null);
      } catch (error: unknown) {
        handleError(error);
      } finally {
        setIsCreating(false);
      }
    },
    [
      description,
      handleError,
      name,
      onCreate,
      selectedTemplate,
      workspaceId,
    ]
  );

  const handleDelete = useCallback(
    async (
      item: WorkspaceBuildItem
    ): Promise<void> => {
      if (!onDelete) {
        return;
      }

      setDeletingId(item.id);
      setErrorMessage(null);

      try {
        await onDelete(
          workspaceId,
          item
        );

        setItems(
          (current) =>
            current.filter(
              (currentItem) =>
                currentItem.id !==
                item.id
            )
        );
      } catch (error: unknown) {
        handleError(error);
      } finally {
        setDeletingId(null);
      }
    },
    [
      handleError,
      onDelete,
      workspaceId,
    ]
  );

  return (
    <section
      className={joinClasses(
        "w-full",
        "rounded-xl",
        "border",
        "border-border",
        "bg-background",
        "p-5",
        "shadow-sm",
        className
      )}
    >
      {/* ================= HEADER ================= */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <WandSparkles className="h-5 w-5" />
          </div>

          <div>
            <h2 className="text-base font-semibold text-foreground">
              Build in {workspaceName}
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Create applications, workflows,
              documents, and intelligent workspace
              systems.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
          <CheckCircle2 className="h-4 w-4 text-primary" />

          <span className="text-sm text-muted-foreground">
            {readyCount} ready
          </span>
        </div>
      </div>

      {/* ================= ERROR ================= */}

      {errorMessage ? (
        <div
          role="alert"
          className="mt-5 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4"
        >
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />

          <div>
            <p className="text-sm font-medium text-destructive">
              Build error
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              {errorMessage}
            </p>
          </div>
        </div>
      ) : null}

      {/* ================= TEMPLATE SELECTOR ================= */}

      <div className="mt-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />

          <h3 className="text-sm font-semibold text-foreground">
            Choose what to build
          </h3>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map(
            (template) => {
              const isSelected =
                selectedTemplateId ===
                template.id;

              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => {
                    handleSelectTemplate(
                      template
                    );
                  }}
                  className={joinClasses(
                    "group",
                    "relative",
                    "flex",
                    "min-h-32",
                    "flex-col",
                    "items-start",
                    "rounded-xl",
                    "border",
                    "p-4",
                    "text-left",
                    "transition-all",
                    "focus-visible:outline-none",
                    "focus-visible:ring-2",
                    "focus-visible:ring-ring",
                    "focus-visible:ring-offset-2",
                    isSelected
                      ? [
                          "border-primary",
                          "bg-primary/5",
                          "shadow-sm",
                        ].join(" ")
                      : [
                          "border-border",
                          "bg-background",
                          "hover:border-primary/50",
                          "hover:bg-muted/30",
                        ].join(" ")
                  )}
                >
                  <div
                    className={joinClasses(
                      "flex",
                      "h-9",
                      "w-9",
                      "items-center",
                      "justify-center",
                      "rounded-lg",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {template.icon ?? (
                      <Blocks className="h-5 w-5" />
                    )}
                  </div>

                  <h4 className="mt-3 text-sm font-semibold text-foreground">
                    {template.name}
                  </h4>

                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {template.description}
                  </p>

                  {isSelected ? (
                    <CheckCircle2 className="absolute right-3 top-3 h-4 w-4 text-primary" />
                  ) : null}
                </button>
              );
            }
          )}
        </div>
      </div>

      {/* ================= CREATE FORM ================= */}

      {selectedTemplate ? (
        <form
          onSubmit={(event) => {
            void handleCreate(event);
          }}
          className="mt-6 rounded-xl border border-border bg-muted/20 p-5"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Create {selectedTemplate.name}
              </h3>

              <p className="mt-1 text-sm text-muted-foreground">
                Configure the basics before creating
                your workspace build.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedTemplateId(null);
                setErrorMessage(null);
              }}
              disabled={isCreating}
              aria-label="Close build form"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5 grid gap-4">
            <div>
              <label
                htmlFor="workspace-build-name"
                className="text-sm font-medium text-foreground"
              >
                Name
              </label>

              <input
                id="workspace-build-name"
                value={name}
                onChange={(event) => {
                  setName(
                    event.target.value
                  );
                }}
                disabled={isCreating}
                placeholder={`My ${selectedTemplate.name}`}
                className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
            </div>

            <div>
              <label
                htmlFor="workspace-build-description"
                className="text-sm font-medium text-foreground"
              >
                Description
                <span className="ml-1 text-muted-foreground">
                  (optional)
                </span>
              </label>

              <textarea
                id="workspace-build-description"
                value={description}
                onChange={(event) => {
                  setDescription(
                    event.target.value
                  );
                }}
                disabled={isCreating}
                rows={3}
                placeholder="Describe what you want to build..."
                className="mt-2 w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedTemplateId(null);
                  setName("");
                  setDescription("");
                }}
                disabled={isCreating}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isCreating || !onCreate}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Building...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Create build
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {/* ================= BUILDS ================= */}

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Workspace builds
            </h3>

            <p className="mt-1 text-xs text-muted-foreground">
              Everything created inside this workspace.
            </p>
          </div>

          <span className="text-xs text-muted-foreground">
            {items.length} total
          </span>
        </div>

        {items.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <FolderPlus className="h-5 w-5 text-muted-foreground" />
            </div>

            <h4 className="mt-4 text-sm font-semibold text-foreground">
              Nothing built yet
            </h4>

            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Choose a template above and start
              building your first workspace system.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            {items.map((item) => {
              const isDeleting =
                deletingId === item.id;

              const updatedAt =
                formatDate(
                  item.updatedAt ??
                    item.createdAt
                );

              return (
                <article
                  key={item.id}
                  className="group flex flex-col gap-4 rounded-xl border border-border bg-background p-4 transition-colors hover:bg-muted/20 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="truncate text-sm font-semibold text-foreground">
                        {item.name}
                      </h4>

                      <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {getTypeLabel(
                          item.type
                        )}
                      </span>

                      <span
                        className={joinClasses(
                          "rounded-full",
                          "border",
                          "px-2",
                          "py-0.5",
                          "text-[11px]",
                          "font-medium",
                          item.status ===
                            "ready" &&
                            "border-primary/30 bg-primary/10 text-primary",
                          item.status ===
                            "draft" &&
                            "border-border bg-muted text-muted-foreground",
                          item.status ===
                            "building" &&
                            "border-primary/30 bg-primary/10 text-primary",
                          item.status ===
                            "error" &&
                            "border-destructive/30 bg-destructive/10 text-destructive"
                        )}
                      >
                        {getStatusLabel(
                          item.status
                        )}
                      </span>
                    </div>

                    {item.description ? (
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {item.description}
                      </p>
                    ) : null}

                    {updatedAt ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Updated {updatedAt}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {onOpen ? (
                      <button
                        type="button"
                        onClick={() => {
                          onOpen(
                            workspaceId,
                            item
                          );
                        }}
                        className="inline-flex h-9 items-center justify-center rounded-lg border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                      >
                        Open
                      </button>
                    ) : null}

                    {onDelete ? (
                      <button
                        type="button"
                        onClick={() => {
                          void handleDelete(
                            item
                          );
                        }}
                        disabled={isDeleting}
                        aria-label={`Delete ${item.name}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <X className="h-4 w-4" />
                        )}
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}