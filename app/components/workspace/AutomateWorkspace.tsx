"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import {
  Activity,
  Bot,
  CheckCircle2,
  Clock3,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  TriangleAlert,
  Zap,
} from "lucide-react";

/* ==================================================
   TYPES
================================================== */

export type AutomationStatus =
  | "active"
  | "paused"
  | "running"
  | "error";

export type WorkspaceAutomation = {
  id: string;
  name: string;
  description?: string;
  status: AutomationStatus;
  schedule?: string;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt?: string;
};

export type CreateAutomationInput = {
  name: string;
  description?: string;
  schedule?: string;
};

export type AutomateWorkspaceProps = {
  workspaceId: string;
  workspaceName?: string;
  initialAutomations?: WorkspaceAutomation[];

  onCreateAutomation?: (
    workspaceId: string,
    input: CreateAutomationInput
  ) => Promise<WorkspaceAutomation>;

  onToggleAutomation?: (
    workspaceId: string,
    automation: WorkspaceAutomation
  ) => Promise<WorkspaceAutomation>;

  onRunAutomation?: (
    workspaceId: string,
    automation: WorkspaceAutomation
  ) => Promise<WorkspaceAutomation | void>;

  onDeleteAutomation?: (
    workspaceId: string,
    automation: WorkspaceAutomation
  ) => Promise<void>;

  onRefresh?: (
    workspaceId: string
  ) => Promise<WorkspaceAutomation[]>;

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
      timeStyle: "short",
    }
  ).format(date);
}

function getStatusLabel(
  status: AutomationStatus
): string {
  switch (status) {
    case "active":
      return "Active";

    case "paused":
      return "Paused";

    case "running":
      return "Running";

    case "error":
      return "Error";

    default:
      return status;
  }
}

/* ==================================================
   COMPONENT
================================================== */

export default function AutomateWorkspace({
  workspaceId,
  workspaceName = "Workspace",
  initialAutomations = [],
  onCreateAutomation,
  onToggleAutomation,
  onRunAutomation,
  onDeleteAutomation,
  onRefresh,
  onError,
  className = "",
}: AutomateWorkspaceProps) {
  const [automations, setAutomations] =
    useState<WorkspaceAutomation[]>(
      initialAutomations
    );

  const [isCreating, setIsCreating] =
    useState<boolean>(false);

  const [isRefreshing, setIsRefreshing] =
    useState<boolean>(false);

  const [processingId, setProcessingId] =
    useState<string | null>(null);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [name, setName] =
    useState<string>("");

  const [description, setDescription] =
    useState<string>("");

  const [schedule, setSchedule] =
    useState<string>("");

  useEffect(() => {
    setAutomations(initialAutomations);
  }, [initialAutomations, workspaceId]);

  const activeCount = useMemo(
    () =>
      automations.filter(
        (automation) =>
          automation.status === "active"
      ).length,
    [automations]
  );

  const runningCount = useMemo(
    () =>
      automations.filter(
        (automation) =>
          automation.status === "running"
      ).length,
    [automations]
  );

  const handleError = useCallback(
    (error: unknown): void => {
      const normalizedError =
        error instanceof Error
          ? error
          : new Error(
              "Something went wrong while managing automations."
            );

      setErrorMessage(
        normalizedError.message
      );

      onError?.(normalizedError);
    },
    [onError]
  );

  const handleCreate = useCallback(
    async (
      event: FormEvent<HTMLFormElement>
    ): Promise<void> => {
      event.preventDefault();

      const trimmedName =
        name.trim();

      if (!trimmedName) {
        setErrorMessage(
          "Automation name is required."
        );
        return;
      }

      if (!onCreateAutomation) {
        return;
      }

      setIsCreating(true);
      setErrorMessage(null);

      try {
        const automation =
          await onCreateAutomation(
            workspaceId,
            {
              name: trimmedName,
              description:
                description.trim() || undefined,
              schedule:
                schedule.trim() || undefined,
            }
          );

        setAutomations(
          (current) => [
            automation,
            ...current,
          ]
        );

        setName("");
        setDescription("");
        setSchedule("");
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
      onCreateAutomation,
      schedule,
      workspaceId,
    ]
  );

  const handleToggle = useCallback(
    async (
      automation: WorkspaceAutomation
    ): Promise<void> => {
      if (!onToggleAutomation) {
        return;
      }

      setProcessingId(
        automation.id
      );

      setErrorMessage(null);

      try {
        const updated =
          await onToggleAutomation(
            workspaceId,
            automation
          );

        setAutomations(
          (current) =>
            current.map(
              (item) =>
                item.id === updated.id
                  ? updated
                  : item
            )
        );
      } catch (error: unknown) {
        handleError(error);
      } finally {
        setProcessingId(null);
      }
    },
    [
      handleError,
      onToggleAutomation,
      workspaceId,
    ]
  );

  const handleRun = useCallback(
    async (
      automation: WorkspaceAutomation
    ): Promise<void> => {
      if (!onRunAutomation) {
        return;
      }

      setProcessingId(
        automation.id
      );

      setErrorMessage(null);

      try {
        const result =
          await onRunAutomation(
            workspaceId,
            automation
          );

        if (result) {
          setAutomations(
            (current) =>
              current.map(
                (item) =>
                  item.id === result.id
                    ? result
                    : item
              )
          );
        }
      } catch (error: unknown) {
        handleError(error);
      } finally {
        setProcessingId(null);
      }
    },
    [
      handleError,
      onRunAutomation,
      workspaceId,
    ]
  );

  const handleDelete = useCallback(
    async (
      automation: WorkspaceAutomation
    ): Promise<void> => {
      if (!onDeleteAutomation) {
        return;
      }

      setProcessingId(
        automation.id
      );

      setErrorMessage(null);

      try {
        await onDeleteAutomation(
          workspaceId,
          automation
        );

        setAutomations(
          (current) =>
            current.filter(
              (item) =>
                item.id !== automation.id
            )
        );
      } catch (error: unknown) {
        handleError(error);
      } finally {
        setProcessingId(null);
      }
    },
    [
      handleError,
      onDeleteAutomation,
      workspaceId,
    ]
  );

  const handleRefresh = useCallback(
    async (): Promise<void> => {
      if (!onRefresh) {
        return;
      }

      setIsRefreshing(true);
      setErrorMessage(null);

      try {
        const refreshed =
          await onRefresh(workspaceId);

        setAutomations(refreshed);
      } catch (error: unknown) {
        handleError(error);
      } finally {
        setIsRefreshing(false);
      }
    },
    [
      handleError,
      onRefresh,
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
      {/* HEADER */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Bot className="h-5 w-5" />
          </div>

          <div>
            <h2 className="text-base font-semibold text-foreground">
              Automate {workspaceName}
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Build recurring workflows and automate
              actions inside this workspace.
            </p>
          </div>
        </div>

        {onRefresh ? (
          <button
            type="button"
            onClick={() => {
              void handleRefresh();
            }}
            disabled={isRefreshing}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
          >
            <RefreshCw
              className={joinClasses(
                "h-4 w-4",
                isRefreshing &&
                  "animate-spin"
              )}
            />

            Refresh
          </button>
        ) : null}
      </div>

      {/* STATS */}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Activity className="h-4 w-4" />
            Total automations
          </div>

          <p className="mt-2 text-2xl font-semibold text-foreground">
            {automations.length}
          </p>
        </div>

        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" />
            Active
          </div>

          <p className="mt-2 text-2xl font-semibold text-foreground">
            {activeCount}
          </p>
        </div>

        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Zap className="h-4 w-4" />
            Running
          </div>

          <p className="mt-2 text-2xl font-semibold text-foreground">
            {runningCount}
          </p>
        </div>
      </div>

      {/* ERROR */}

      {errorMessage ? (
        <div
          role="alert"
          className="mt-5 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4"
        >
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />

          <div>
            <p className="text-sm font-medium text-destructive">
              Automation error
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              {errorMessage}
            </p>
          </div>
        </div>
      ) : null}

      {/* CREATE FORM */}

      {onCreateAutomation ? (
        <form
          onSubmit={(event) => {
            void handleCreate(event);
          }}
          className="mt-6 rounded-xl border border-border bg-muted/20 p-4"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />

            <h3 className="text-sm font-semibold text-foreground">
              Create automation
            </h3>
          </div>

          <div className="mt-4 grid gap-3">
            <input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
              }}
              placeholder="Automation name"
              disabled={isCreating}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring disabled:opacity-50"
            />

            <textarea
              value={description}
              onChange={(event) => {
                setDescription(
                  event.target.value
                );
              }}
              placeholder="What should this automation do?"
              disabled={isCreating}
              rows={3}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring disabled:opacity-50"
            />

            <input
              value={schedule}
              onChange={(event) => {
                setSchedule(
                  event.target.value
                );
              }}
              placeholder="Schedule, e.g. Every Monday at 09:00"
              disabled={isCreating}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring disabled:opacity-50"
            />

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isCreating}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Create automation
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {/* AUTOMATION LIST */}

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            Workspace automations
          </h3>

          <span className="text-xs text-muted-foreground">
            {automations.length} total
          </span>
        </div>

        {automations.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Bot className="h-5 w-5 text-muted-foreground" />
            </div>

            <h4 className="mt-4 text-sm font-semibold text-foreground">
              No automations yet
            </h4>

            <p className="mt-1 text-sm text-muted-foreground">
              Create your first automation to start
              building repeatable workspace workflows.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {automations.map(
              (automation) => {
                const isProcessing =
                  processingId ===
                  automation.id;

                const lastRun =
                  formatDate(
                    automation.lastRunAt
                  );

                const nextRun =
                  formatDate(
                    automation.nextRunAt
                  );

                return (
                  <article
                    key={automation.id}
                    className="rounded-xl border border-border p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="truncate text-sm font-semibold text-foreground">
                            {automation.name}
                          </h4>

                          <span
                            className={joinClasses(
                              "rounded-full",
                              "border",
                              "px-2",
                              "py-0.5",
                              "text-[11px]",
                              "font-medium",
                              automation.status ===
                                "active" &&
                                "border-primary/30 bg-primary/10 text-primary",
                              automation.status ===
                                "paused" &&
                                "border-border bg-muted text-muted-foreground",
                              automation.status ===
                                "running" &&
                                "border-primary/30 bg-primary/10 text-primary",
                              automation.status ===
                                "error" &&
                                "border-destructive/30 bg-destructive/10 text-destructive"
                            )}
                          >
                            {getStatusLabel(
                              automation.status
                            )}
                          </span>
                        </div>

                        {automation.description ? (
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {
                              automation.description
                            }
                          </p>
                        ) : null}

                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                          {automation.schedule ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Clock3 className="h-3.5 w-3.5" />
                              {
                                automation.schedule
                              }
                            </span>
                          ) : null}

                          {lastRun ? (
                            <span>
                              Last run:{" "}
                              {lastRun}
                            </span>
                          ) : null}

                          {nextRun ? (
                            <span>
                              Next run:{" "}
                              {nextRun}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        {onRunAutomation ? (
                          <button
                            type="button"
                            onClick={() => {
                              void handleRun(
                                automation
                              );
                            }}
                            disabled={
                              isProcessing
                            }
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
                          >
                            {isProcessing ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}

                            Run
                          </button>
                        ) : null}

                        {onToggleAutomation ? (
                          <button
                            type="button"
                            onClick={() => {
                              void handleToggle(
                                automation
                              );
                            }}
                            disabled={
                              isProcessing
                            }
                            className="inline-flex h-9 items-center justify-center rounded-lg border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
                          >
                            {automation.status ===
                            "active"
                              ? "Pause"
                              : "Activate"}
                          </button>
                        ) : null}

                        {onDeleteAutomation ? (
                          <button
                            type="button"
                            onClick={() => {
                              void handleDelete(
                                automation
                              );
                            }}
                            disabled={
                              isProcessing
                            }
                            aria-label={`Delete ${automation.name}`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              }
            )}
          </div>
        )}
      </div>
    </section>
  );
}