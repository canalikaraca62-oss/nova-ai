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
  ArrowLeft,
  Blocks,
  Bot,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  CircleAlert,
  Code2,
  FileText,
  FolderKanban,
  Globe2,
  Loader2,
  Lock,
  Plus,
  Sparkles,
  Users,
  WandSparkles,
  X,
} from "lucide-react";

/* ==================================================
   TYPES
================================================== */

export type WorkspaceVisibility =
  | "private"
  | "team"
  | "public";

export type WorkspaceTemplateType =
  | "blank"
  | "product"
  | "development"
  | "research"
  | "automation"
  | "ai";

export type WorkspaceTemplate = {
  id: WorkspaceTemplateType;
  name: string;
  description: string;
  icon: ReactNode;
};

export type CreateWorkspaceInput = {
  name: string;
  description?: string;
  visibility: WorkspaceVisibility;
  template: WorkspaceTemplateType;
};

export type CreatedWorkspace = {
  id: string;
  name: string;
  description?: string;
  visibility: WorkspaceVisibility;
  template: WorkspaceTemplateType;
  createdAt?: string;
};

export type CreateWorkspaceProps = {
  initialName?: string;
  initialDescription?: string;
  initialVisibility?: WorkspaceVisibility;
  initialTemplate?: WorkspaceTemplateType;

  templates?: WorkspaceTemplate[];

  onCreate?: (
    input: CreateWorkspaceInput
  ) => Promise<CreatedWorkspace>;

  onCancel?: () => void;

  onCreated?: (
    workspace: CreatedWorkspace
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

function getVisibilityLabel(
  visibility: WorkspaceVisibility
): string {
  switch (visibility) {
    case "private":
      return "Private";

    case "team":
      return "Team";

    case "public":
      return "Public";

    default:
      return visibility;
  }
}

function getVisibilityDescription(
  visibility: WorkspaceVisibility
): string {
  switch (visibility) {
    case "private":
      return "Only you can access this workspace.";

    case "team":
      return "Invite and collaborate with your team.";

    case "public":
      return "Anyone with access can view this workspace.";

    default:
      return "";
  }
}

/* ==================================================
   DEFAULT TEMPLATES
================================================== */

const DEFAULT_TEMPLATES: WorkspaceTemplate[] = [
  {
    id: "blank",
    name: "Blank Workspace",
    description:
      "Start from a completely clean workspace.",
    icon: <Blocks className="h-5 w-5" />,
  },
  {
    id: "product",
    name: "Product",
    description:
      "Plan, build, and manage a complete product.",
    icon: <BriefcaseBusiness className="h-5 w-5" />,
  },
  {
    id: "development",
    name: "Development",
    description:
      "Organize code, architecture, and engineering work.",
    icon: <Code2 className="h-5 w-5" />,
  },
  {
    id: "research",
    name: "Research",
    description:
      "Collect knowledge, documents, and insights.",
    icon: <FileText className="h-5 w-5" />,
  },
  {
    id: "automation",
    name: "Automation",
    description:
      "Build workflows, tasks, and automated systems.",
    icon: <FolderKanban className="h-5 w-5" />,
  },
  {
    id: "ai",
    name: "AI Workspace",
    description:
      "Create an intelligent workspace powered by AI.",
    icon: <Bot className="h-5 w-5" />,
  },
];

/* ==================================================
   VISIBILITY OPTIONS
================================================== */

const VISIBILITY_OPTIONS: Array<{
  id: WorkspaceVisibility;
  label: string;
  description: string;
  icon: ReactNode;
}> = [
  {
    id: "private",
    label: "Private",
    description:
      "Only you can access this workspace.",
    icon: <Lock className="h-4 w-4" />,
  },
  {
    id: "team",
    label: "Team",
    description:
      "Collaborate with invited members.",
    icon: <Users className="h-4 w-4" />,
  },
  {
    id: "public",
    label: "Public",
    description:
      "Visible to everyone with access.",
    icon: <Globe2 className="h-4 w-4" />,
  },
];

/* ==================================================
   COMPONENT
================================================== */

export default function CreateWorkspace({
  initialName = "",
  initialDescription = "",
  initialVisibility = "private",
  initialTemplate = "blank",
  templates = DEFAULT_TEMPLATES,
  onCreate,
  onCancel,
  onCreated,
  onError,
  className = "",
}: CreateWorkspaceProps) {
  const [name, setName] =
    useState<string>(
      initialName
    );

  const [description, setDescription] =
    useState<string>(
      initialDescription
    );

  const [visibility, setVisibility] =
    useState<WorkspaceVisibility>(
      initialVisibility
    );

  const [selectedTemplate, setSelectedTemplate] =
    useState<WorkspaceTemplateType>(
      initialTemplate
    );

  const [isCreating, setIsCreating] =
    useState<boolean>(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [isCreated, setIsCreated] =
    useState<boolean>(false);

  /* ==================================================
     SYNC INITIAL VALUES
  ================================================== */

  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  useEffect(() => {
    setDescription(initialDescription);
  }, [initialDescription]);

  useEffect(() => {
    setVisibility(initialVisibility);
  }, [initialVisibility]);

  useEffect(() => {
    setSelectedTemplate(initialTemplate);
  }, [initialTemplate]);

  /* ==================================================
     DERIVED STATE
  ================================================== */

  const selectedTemplateData = useMemo(
    () =>
      templates.find(
        (template) =>
          template.id ===
          selectedTemplate
      ) ?? null,
    [
      selectedTemplate,
      templates,
    ]
  );

  const isFormValid = useMemo(
    () =>
      Boolean(
        name.trim() &&
          selectedTemplate
      ),
    [
      name,
      selectedTemplate,
    ]
  );

  /* ==================================================
     ERROR HANDLER
  ================================================== */

  const handleError = useCallback(
    (error: unknown): void => {
      const normalizedError =
        error instanceof Error
          ? error
          : new Error(
              "Something went wrong while creating the workspace."
            );

      setErrorMessage(
        normalizedError.message
      );

      onError?.(
        normalizedError
      );
    },
    [onError]
  );

  /* ==================================================
     CREATE WORKSPACE
  ================================================== */

  const handleSubmit = useCallback(
    async (
      event: FormEvent<HTMLFormElement>
    ): Promise<void> => {
      event.preventDefault();

      const trimmedName =
        name.trim();

      if (!trimmedName) {
        setErrorMessage(
          "Workspace name is required."
        );
        return;
      }

      if (!selectedTemplate) {
        setErrorMessage(
          "Please select a workspace template."
        );
        return;
      }

      if (!onCreate) {
        setErrorMessage(
          "Workspace creation is not configured."
        );
        return;
      }

      setIsCreating(true);
      setErrorMessage(null);

      try {
        const workspace =
          await onCreate({
            name: trimmedName,
            description:
              description.trim() ||
              undefined,
            visibility,
            template:
              selectedTemplate,
          });

        setIsCreated(true);

        onCreated?.(
          workspace
        );
      } catch (error: unknown) {
        handleError(
          error
        );
      } finally {
        setIsCreating(false);
      }
    },
    [
      description,
      handleError,
      name,
      onCreate,
      onCreated,
      selectedTemplate,
      visibility,
    ]
  );

  /* ==================================================
     RESET
  ================================================== */

  const handleReset = (): void => {
    setName(initialName);
    setDescription(
      initialDescription
    );
    setVisibility(
      initialVisibility
    );
    setSelectedTemplate(
      initialTemplate
    );
    setErrorMessage(null);
    setIsCreated(false);
  };

  /* ==================================================
     SUCCESS STATE
  ================================================== */

  if (isCreated) {
    return (
      <section
        className={joinClasses(
          "w-full",
          "rounded-2xl",
          "border",
          "border-border",
          "bg-background",
          "p-6",
          "shadow-sm",
          className
        )}
      >
        <div className="mx-auto max-w-md py-10 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <CheckCircle2 className="h-8 w-8" />
          </div>

          <h2 className="mt-5 text-xl font-semibold text-foreground">
            Workspace created
          </h2>

          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Your new workspace is ready.
            You can now start building,
            analyzing, automating, and
            organizing your work.
          </p>

          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Plus className="h-4 w-4" />
              Create another
            </button>

            {onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Done
              </button>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  /* ==================================================
     MAIN UI
  ================================================== */

  return (
    <section
      className={joinClasses(
        "w-full",
        "rounded-2xl",
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

      <div className="flex items-start justify-between gap-4 border-b border-border p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <WandSparkles className="h-5 w-5" />
          </div>

          <div>
            <h1 className="text-lg font-semibold text-foreground">
              Create Workspace
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Set up a new intelligent
              workspace for your next project.
            </p>
          </div>
        </div>

        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={isCreating}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      {/* ==============================================
          ERROR
      ============================================== */}

      {errorMessage ? (
        <div
          role="alert"
          className="mx-5 mt-5 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 sm:mx-6"
        >
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-destructive">
              Unable to create workspace
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              {errorMessage}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setErrorMessage(null);
            }}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* ==============================================
          FORM
      ============================================== */}

      <form
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        className="p-5 sm:p-6"
      >
        {/* ============================================
            BASIC INFORMATION
        ============================================ */}

        <div>
          <div className="flex items-center gap-2">
            <FolderKanban className="h-4 w-4 text-primary" />

            <h2 className="text-sm font-semibold text-foreground">
              Workspace details
            </h2>
          </div>

          <div className="mt-4 grid gap-4">
            <div>
              <label
                htmlFor="workspace-name"
                className="text-sm font-medium text-foreground"
              >
                Workspace name
              </label>

              <input
                id="workspace-name"
                value={name}
                onChange={(event) => {
                  setName(
                    event.target.value
                  );
                }}
                disabled={isCreating}
                placeholder="Example: Global AI Platform"
                maxLength={100}
                className="mt-2 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground transition-shadow focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />

              <p className="mt-1.5 text-xs text-muted-foreground">
                Choose a clear name for your
                workspace.
              </p>
            </div>

            <div>
              <label
                htmlFor="workspace-description"
                className="text-sm font-medium text-foreground"
              >
                Description

                <span className="ml-1 font-normal text-muted-foreground">
                  optional
                </span>
              </label>

              <textarea
                id="workspace-description"
                value={description}
                onChange={(event) => {
                  setDescription(
                    event.target.value
                  );
                }}
                disabled={isCreating}
                rows={4}
                maxLength={500}
                placeholder="Describe the purpose and goals of this workspace..."
                className="mt-2 w-full resize-none rounded-lg border border-border bg-background px-3 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground transition-shadow focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />

              <div className="mt-1.5 flex justify-end">
                <span className="text-xs text-muted-foreground">
                  {description.length}/500
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================
            TEMPLATE
        ============================================ */}

        <div className="mt-8">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />

            <h2 className="text-sm font-semibold text-foreground">
              Choose a starting point
            </h2>
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            Select a template to configure
            your workspace structure.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map(
              (template) => {
                const isSelected =
                  selectedTemplate ===
                  template.id;

                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => {
                      setSelectedTemplate(
                        template.id
                      );
                      setErrorMessage(null);
                    }}
                    disabled={isCreating}
                    className={joinClasses(
                      "relative",
                      "flex",
                      "min-h-[150px]",
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
                      "disabled:pointer-events-none",
                      "disabled:opacity-50",
                      isSelected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border bg-background hover:border-primary/50 hover:bg-muted/20"
                    )}
                  >
                    <div
                      className={joinClasses(
                        "flex",
                        "h-10",
                        "w-10",
                        "items-center",
                        "justify-center",
                        "rounded-lg",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {template.icon}
                    </div>

                    <h3 className="mt-3 text-sm font-semibold text-foreground">
                      {template.name}
                    </h3>

                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {template.description}
                    </p>

                    {isSelected ? (
                      <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-3.5 w-3.5" />
                      </div>
                    ) : null}
                  </button>
                );
              }
            )}
          </div>
        </div>

        {/* ============================================
            VISIBILITY
        ============================================ */}

        <div className="mt-8">
          <h2 className="text-sm font-semibold text-foreground">
            Workspace visibility
          </h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Control who can access and
            collaborate in this workspace.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {VISIBILITY_OPTIONS.map(
              (option) => {
                const isSelected =
                  visibility ===
                  option.id;

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setVisibility(
                        option.id
                      );
                    }}
                    disabled={isCreating}
                    className={joinClasses(
                      "flex",
                      "items-start",
                      "gap-3",
                      "rounded-xl",
                      "border",
                      "p-4",
                      "text-left",
                      "transition-all",
                      "focus-visible:outline-none",
                      "focus-visible:ring-2",
                      "focus-visible:ring-ring",
                      "disabled:pointer-events-none",
                      "disabled:opacity-50",
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/30"
                    )}
                  >
                    <div
                      className={joinClasses(
                        "mt-0.5",
                        "flex",
                        "h-8",
                        "w-8",
                        "shrink-0",
                        "items-center",
                        "justify-center",
                        "rounded-lg",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {option.icon}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {option.label}
                        </span>

                        {isSelected ? (
                          <Check className="h-4 w-4 text-primary" />
                        ) : null}
                      </div>

                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {option.description}
                      </p>
                    </div>
                  </button>
                );
              }
            )}
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            {getVisibilityLabel(
              visibility
            )}:{" "}
            {getVisibilityDescription(
              visibility
            )}
          </p>
        </div>

        {/* ============================================
            AI SUMMARY
        ============================================ */}

        {selectedTemplateData ? (
          <div className="mt-8 rounded-xl border border-primary/20 bg-primary/[0.03] p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-4 w-4" />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Workspace configuration
                </h3>

                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  You are creating a{" "}
                  <span className="font-medium text-foreground">
                    {
                      selectedTemplateData.name
                    }
                  </span>{" "}
                  workspace with{" "}
                  <span className="font-medium text-foreground">
                    {
                      getVisibilityLabel(
                        visibility
                      )
                    }
                  </span>{" "}
                  access.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {/* ============================================
            ACTIONS
        ============================================ */}

        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                disabled={isCreating}
                className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Cancel
              </button>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={
              !isFormValid ||
              isCreating
            }
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating workspace...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Create workspace
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  );
}